"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, QrCode, ScanLine, X } from "lucide-react";

import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/platform/utils/global";
import { prepareQrScanSession, unlockScanAudio } from "@/platform/utils/global/scanFeedback";
import { extractBatchMrnUid, extractCoilUid, extractQcStickerUid, normalizeScanInput, qcStickerDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import { qcCheckService } from "@/apps/rmstore/lib/services/qcCheck";

const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = {
  open: false,
  variant: "success",
  title: "",
  message: "",
  duration: SNACK_DUR.med,
};

/**
 * Scan-driven QC unlock (IMS-style scan controls).
 * Specs open only for the coil identified by the scanned sticker.
 *
 * Coil-wise: scan QC|{coil_uid} → open that coil's QC form.
 * Batch-wise: scan QC|{mrn}_batch_qc → scan each coil → open a pending coil from that batch.
 */
export default function QcScanGateModal({ open, onClose, row, onUnlocked }) {
  const [phase, setPhase] = useState("idle"); // idle | batch_coils
  const [batchMrnUid, setBatchMrnUid] = useState("");
  const [batchMrnNo, setBatchMrnNo] = useState("");
  const [batchCoils, setBatchCoils] = useState([]);
  const [scannedCoils, setScannedCoils] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [laserCaptureMode, setLaserCaptureMode] = useState(null);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);

  const coilInputRef = useRef(null);
  const scanToastRef = useRef({});
  const laserCaptureModeRef = useRef(null);
  const tryScanRef = useRef(async () => {});
  const scannerElementId = "qc-scan-gate-qr";

  const { laserScan, keyboardType, showPhoneQr } = useDeviceScanSettings();
  const scanBtnCount = (showPhoneQr ? 1 : 0) + (laserScan ? 1 : 0);
  const scanBtnFill = scanBtnCount > 1 ? "flex-1 basis-0 min-w-0 w-full" : "w-full";

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);
  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);

  const remaining = useMemo(
    () => batchCoils.filter((c) => !scannedCoils.has(String(c.coil_no_uid || "").toLowerCase())),
    [batchCoils, scannedCoils]
  );

  const armLaser = useCallback(() => {
    if (laserScan || isLaserScanEnabled()) {
      laserCaptureModeRef.current = "qc";
      setLaserCaptureMode("qc");
    } else {
      laserCaptureModeRef.current = null;
      setLaserCaptureMode(null);
    }
  }, [laserScan]);

  const reset = useCallback(() => {
    setPhase("idle");
    setBatchMrnUid("");
    setBatchMrnNo("");
    setBatchCoils([]);
    setScannedCoils(new Set());
    setBusy(false);
    setIsScannerOpen(false);
    armLaser();
  }, [armLaser]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    reset();
    if (row?.is_batch_pending && row?.mrn_uid) {
      setBatchMrnUid(String(row.mrn_uid));
      setBatchMrnNo(row.mrn_no != null ? String(row.mrn_no) : "");
      setPhase("idle");
    }
    void unlockScanAudio().catch(() => {});
  }, [open, row?.coil_no_uid, row?.mrn_uid, row?.is_batch_pending, reset]);

  const resolvePendingCoil = useCallback(async (coilUid) => {
    const uid = String(coilUid || "").trim();
    if (!uid) return null;
    const res = await qcCheckService.getAll({
      page: 1,
      limit: 5,
      filters: { status: "pending", coil_no_uid: uid, expand_coils: true },
    });
    return (
      (res?.data || []).find(
        (r) => String(r.coil_no_uid || "").toLowerCase() === uid.toLowerCase() && !r.is_batch_pending
      ) || null
    );
  }, []);

  const loadBatchPending = useCallback(
    async (mrnUid) => {
      const uid = String(mrnUid || "").trim();
      if (!uid) {
        showScanToast("error", "batch-mrn", "The batch sticker has no MRN.");
        return false;
      }
      const res = await qcCheckService.getAll({
        page: 1,
        limit: 1000,
        filters: { status: "pending", mrn_uid: uid, expand_coils: true },
      });
      const list = (res?.data || []).filter(
        (r) => String(r.coil_no_uid || "").trim() && !r.is_batch_pending
      );
      if (!list.length) {
        showScanToast("error", "batch-empty", "No pending coils were found for this batch MRN.");
        return false;
      }
      setBatchMrnUid(uid);
      setBatchMrnNo(list[0]?.mrn_no != null ? String(list[0].mrn_no) : "");
      setBatchCoils(list);
      setScannedCoils(new Set());
      setPhase("batch_coils");
      showScanSuccess(
        "batch-ok",
        `Batch unlocked. Scan all ${list.length} coil sticker(s).`,
        SNACK_DUR.med
      );
      return true;
    },
    [showScanToast, showScanSuccess]
  );

  const openCoilFromScan = useCallback(
    (pendingRow, remainingQueue = []) => {
      if (!pendingRow?.coil_no_uid) {
        showScanToast("error", "coil-missing", "The scanned coil was not found in the pending QC queue.");
        return;
      }
      showScanSuccess(
        "qc-ok",
        `Scan accepted. Opening the spec check for ${pendingRow.coil_no_uid}.`,
        SNACK_DUR.short
      );
      onUnlocked?.(pendingRow, remainingQueue);
    },
    [onUnlocked, showScanToast, showScanSuccess]
  );

  const finishBatchUnlock = useCallback(() => {
    const scannedPending = batchCoils.filter(
      (c) =>
        scannedCoils.has(String(c.coil_no_uid || "").toLowerCase()) &&
        (["pending", "draft"].includes(String(c.status || "").toLowerCase()) ||
          c.is_virtual_pending)
    );
    const allScanned = batchCoils.filter((c) =>
      scannedCoils.has(String(c.coil_no_uid || "").toLowerCase())
    );
    const queue = scannedPending.length ? scannedPending : allScanned;
    if (!queue.length) {
      showScanToast("error", "batch-none", "No coils remain available for QC in this batch.");
      return;
    }
    const [first, ...rest] = queue;
    // Coil-level Spec form for first; remaining open after each submit
    openCoilFromScan(first, rest);
  }, [batchCoils, scannedCoils, openCoilFromScan, showScanToast]);

  const tryScan = useCallback(
    async (rawVal) => {
      if (!open || busy) return;
      const raw = normalizeScanInput(rawVal);
      if (!raw) {
        showScanToast("error", "invalid-scan", SCAN_SNACK_MSG.REJECTED);
        return;
      }

      setBusy(true);
      try {
        if (phase === "batch_coils") {
          let coilUid = extractCoilUid(raw);
          if (!coilUid) {
            const qcUid = extractQcStickerUid(raw);
            if (qcUid && !/_batch_qc$/i.test(qcUid)) coilUid = qcUid;
          }
          if (!coilUid) {
            showScanToast("error", "need-coil", "Scan a coil sticker for this batch.");
            return;
          }
          const key = coilUid.toLowerCase();
          const inBatch = batchCoils.some((c) => String(c.coil_no_uid || "").toLowerCase() === key);
          if (!inBatch) {
            showScanToast("error", "coil-batch", "This coil does not belong to the scanned batch.");
            return;
          }
          if (scannedCoils.has(key)) {
            showScanToast("error", "coil-dup", "This coil has already been scanned.");
            return;
          }
          const next = new Set(scannedCoils);
          next.add(key);
          setScannedCoils(next);
          const left = batchCoils.filter(
            (c) => !next.has(String(c.coil_no_uid || "").toLowerCase())
          );
          if (left.length === 0) finishBatchUnlock();
          else {
            showScanSuccess(
              "coil-ok",
              `Coil accepted (${next.size} of ${batchCoils.length}).`,
              SNACK_DUR.short
            );
          }
          return;
        }

        const batchMrn = extractBatchMrnUid(raw);
        if (batchMrn) {
          if (
            row?.is_batch_pending &&
            row?.mrn_uid &&
            String(row.mrn_uid).toLowerCase() !== batchMrn.toLowerCase()
          ) {
            showScanToast(
              "error",
              "batch-other",
              "Opening QC for the scanned batch, which differs from the selected row."
            );
          }
          await loadBatchPending(batchMrn);
          return;
        }

        const qcUid = extractQcStickerUid(raw);
        if (!qcUid) {
          showScanToast("error", "need-qc", "Scan a valid QC sticker for a coil or a batch.");
          return;
        }

        const pending = await resolvePendingCoil(qcUid);
        if (!pending) {
          showScanToast("error", "no-pending", `No pending QC check was found for coil ${qcUid}.`);
          return;
        }
        openCoilFromScan(pending);
      } catch (err) {
        showScanToast("error", "scan-fail", err?.message || "Scan could not be processed. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [
      open,
      busy,
      phase,
      batchCoils,
      scannedCoils,
      row,
      loadBatchPending,
      resolvePendingCoil,
      openCoilFromScan,
      finishBatchUnlock,
      showScanToast,
      showScanSuccess,
    ]
  );

  tryScanRef.current = tryScan;

  const onLaserScan = useCallback((code) => {
    void tryScanRef.current(code);
  }, []);

  const handleLaserScanRejected = useCallback(
    ({ reason: r }) => {
      if (r === "empty") {
        showScanToast("error", "laser-empty", SCAN_SNACK_MSG.REJECTED, SNACK_DUR.short);
      }
    },
    [showScanToast]
  );

  const startCameraScanner = useCallback(async () => {
    try {
      await prepareQrScanSession();
    } catch (err) {
      const denied = /NotAllowed|Permission|denied/i.test(String(err?.message || err || ""));
      showScanToast(
        "error",
        "cam-prep",
        denied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA
      );
      return;
    }
    void unlockScanAudio().catch(() => {});
    setIsScannerOpen(true);
  }, [showScanToast]);

  const handleCameraDecoded = useCallback((decodedText) => {
    setIsScannerOpen(false);
    void tryScanRef.current(decodedText);
  }, []);

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: isScannerOpen,
    elementId: scannerElementId,
    onDecoded: handleCameraDecoded,
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: (err) => {
      setIsScannerOpen(false);
      const denied = /NotAllowed|Permission|denied/i.test(String(err?.message || err || ""));
      showScanToast(
        "error",
        "cam-fail",
        denied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA
      );
    },
  });

  const laserScanActive = open && Boolean(laserCaptureMode) && (laserScan || isLaserScanEnabled());
  const title = phase === "batch_coils" ? "Scan Batch Coils" : "Scan QC Sticker";
  const hint =
    phase === "batch_coils"
      ? `MRN ${batchMrnNo || batchMrnUid} · scan each coil, then fill specs`
      : "Scan QC sticker once, then fill specs for that coil";

  const scanControls = (
    <>
      {(showPhoneQr || laserScan) && (
        <div className="flex items-stretch gap-2 w-full min-w-0">
          {showPhoneQr && (
            <button
              type="button"
              onClick={() => void startCameraScanner()}
              disabled={isScannerOpen || busy}
              className={`h-8 px-3 bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 rounded-lg inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${scanBtnFill}`}
            >
              <QrCode size={14} />
              <span className="text-[10px] font-bold uppercase">QR</span>
            </button>
          )}
          {laserScan && (
            <LaserScanField
              active={laserScanActive}
              onScanned={onLaserScan}
              onScanRejected={handleLaserScanRejected}
              formatPreview={(v) => qcStickerDisplayLabel(v) || String(v || "").trim()}
              compact
              heightClass="h-8"
              fill={scanBtnCount > 0}
              armButtonLabel="Scan"
            />
          )}
        </div>
      )}

      {keyboardType && (
        <div className="flex gap-2">
          <input
            ref={coilInputRef}
            type="text"
            className="flex-1 h-8 px-2.5 border border-slate-300 rounded-lg text-xs font-mono"
            placeholder={
              phase === "batch_coils"
                ? getScanInputPlaceholder("coil")
                : "Scan / paste QC sticker"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void tryScan(e.currentTarget.value);
                e.currentTarget.value = "";
              }
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const el = coilInputRef.current;
              if (!el) return;
              void tryScan(el.value);
              el.value = "";
            }}
            className="h-8 px-3 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      )}

      {!showPhoneQr && !laserScan && !keyboardType && (
        <p className="text-[10px] font-medium text-slate-500 px-0.5">
          Enable laser or keyboard scan in Settings.
        </p>
      )}
    </>
  );

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={onClose}
        title={title}
        description={hint}
        maxWidth="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-500"
            >
              Cancel
            </button>
          </div>
        }
      >
        <div className="space-y-3 pb-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <ScanLine size={13} className="text-indigo-600" />
                {phase === "batch_coils" ? "Coil sticker" : "QC sticker"}
                {busy ? <Loader2 size={12} className="animate-spin text-slate-400" /> : null}
              </span>
              {phase === "batch_coils" ? (
                <span className="text-[10px] font-bold text-indigo-600 tabular-nums">
                  {scannedCoils.size}/{batchCoils.length}
                </span>
              ) : null}
            </div>
            {scanControls}
          </div>

          {phase === "batch_coils" ? (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Coils · MRN {batchMrnNo || batchMrnUid}
                </span>
                {remaining.length > 0 ? (
                  <span className="text-[10px] font-medium text-slate-500">
                    {remaining.length} left
                  </span>
                ) : null}
              </div>
              <ul className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                {batchCoils.map((c) => {
                  const uid = String(c.coil_no_uid || "");
                  const done = scannedCoils.has(uid.toLowerCase());
                  return (
                    <li
                      key={uid}
                      className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="font-mono font-bold text-slate-800 truncate">{uid}</span>
                      {done ? (
                        <Check size={14} className="text-emerald-600 shrink-0" />
                      ) : (
                        <X size={14} className="text-slate-300 shrink-0" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </Drawer>

      <QrScannerOverlay
        open={isScannerOpen}
        readerId={scannerElementId}
        onClose={() => setIsScannerOpen(false)}
        torchSupported={torchSupported}
        torchOn={torchOn}
        onToggleTorch={toggleTorch}
      />

      <Snackbar
        open={snackbar.open}
        onClose={closeSnackbar}
        variant={snackbar.variant}
        title={snackbar.title}
        message={snackbar.message}
        duration={snackbar.duration}
      />
    </>
  );
}
