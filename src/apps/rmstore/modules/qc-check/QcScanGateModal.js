"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus, QrCode, ScanLine } from "lucide-react";

import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/platform/utils/global";
import { prepareQrScanSession, unlockScanAudio } from "@/platform/utils/global/scanFeedback";
import { extractBatchMrnUid, extractQcStickerUid, normalizeScanInput, qcStickerDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import { qcCheckService } from "@/apps/rmstore/lib/services/qcCheck";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import { SCAN_INPUT_CLASS } from "@/ui/common/Constants";

const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = {
  open: false,
  variant: "success",
  title: "",
  message: "",
  duration: SNACK_DUR.med,
};

/**
 * Scan-driven QC unlock.
 *
 * Coil-wise MRN: scan QC|{coil_uid} → open that coil's Spec form.
 * Batch-wise MRN: scan QC|{mrn}_batch_qc only → open Spec form for the whole batch.
 *                 Individual coil QC stickers from a batch MRN are rejected (not independent).
 */
export default function QcScanGateModal({ open, onClose, row, onUnlocked }) {
  const [busy, setBusy] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [laserCaptureMode, setLaserCaptureMode] = useState(null);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);
  const [batchCoils, setBatchCoils] = useState([]);

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
    setBusy(false);
    setIsScannerOpen(false);
    setBatchCoils([]);
    armLaser();
  }, [armLaser]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    reset();
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
    const hit =
      (res?.data || []).find(
        (r) => String(r.coil_no_uid || "").toLowerCase() === uid.toLowerCase()
      ) || null;
    if (!hit) return null;
    // Batch MRN coils must use the batch QC sticker — not independent coil QC
    if (String(hit.sticker_mode || "").toLowerCase() === "batch" || hit.is_batch_pending) {
      return {
        __batchCoilBlocked: true,
        mrn_uid: hit.mrn_uid,
        mrn_no: hit.mrn_no,
        coil_no_uid: hit.coil_no_uid,
      };
    }
    return hit;
  }, []);

  const openCoilFromScan = useCallback(
    async (pendingRow, remainingQueue = []) => {
      if (!pendingRow?.coil_no_uid) {
        showScanToast("error", "coil-missing", "The scanned coil was not found in the pending QC queue.");
        return;
      }
      setBusy(true);
      try {
        const prepareBody = pendingRow.qc_check_uid
          ? { qc_check_uid: pendingRow.qc_check_uid }
          : { coil_no_uid: pendingRow.coil_no_uid };
        await qcCheckService.prepare(prepareBody);
        const extra =
          Array.isArray(remainingQueue) && remainingQueue.length
            ? ` (${remainingQueue.length} more in batch queue)`
            : "";
        showScanSuccess(
          "qc-ok",
          `Scan accepted. Opening the spec check for ${pendingRow.coil_no_uid}.${extra}`,
          SNACK_DUR.short
        );
        onUnlocked?.(pendingRow, remainingQueue);
      } catch (err) {
        showScanToast(
          "error",
          "spec-load",
          err?.message || "Specifications could not be loaded. Define them in RM Spec Master.",
          SNACK_DUR.long
        );
      } finally {
        setBusy(false);
      }
    },
    [onUnlocked, showScanToast, showScanSuccess]
  );

  /** Batch QC sticker → not queuing coils anymore; check the whole batch together. */
  const openBatchFromScan = useCallback(
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
      // expand_coils returns one row per coil; batch MRNs flag is_batch_pending=true
      // so we must NOT filter those out here — batch sticker unlocks the whole set.
      const list = (res?.data || []).filter((r) => String(r.coil_no_uid || "").trim());
      if (!list.length) {
        showScanToast("error", "batch-empty", "No pending coils were found for this batch MRN.");
        return false;
      }
      const mode = String(list[0]?.sticker_mode || "").toLowerCase();
      if (mode && mode !== "batch") {
        showScanToast(
          "error",
          "not-batch-mrn",
          "This MRN is coil-wise. Scan each coil QC sticker, not the batch sticker.",
          SNACK_DUR.long
        );
        return false;
      }

      // Create a virtual batch row that contains all coil UIDs
      const batchRow = {
        ...list[0],
        coil_no_uid: list.map((c) => c.coil_no_uid).join(", "),
        coil_count: list.length,
        is_batch_pending: true,
      };

      setBusy(true);
      try {
        await qcCheckService.prepare({ coil_no_uid: batchRow.coil_no_uid, is_batch_qc: true });
        showScanSuccess(
          "qc-ok",
          `Batch scan accepted. Opening spec check for all ${list.length} coils in MRN ${list[0].mrn_no || uid}.`,
          SNACK_DUR.short
        );
        onUnlocked?.(batchRow, []); // Empty queue — we are checking all at once
        return true;
      } catch (err) {
        showScanToast(
          "error",
          "spec-load",
          err?.message || "Specifications could not be loaded. Define them in RM Spec Master.",
          SNACK_DUR.long
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onUnlocked, showScanToast, showScanSuccess]
  );

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
          await openBatchFromScan(batchMrn);
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
        if (pending.__batchCoilBlocked) {
          const mrnLabel = pending.mrn_no || pending.mrn_uid || "this MRN";
          showScanToast(
            "error",
            "batch-coil",
            `MRN ${mrnLabel} is batch-wise. Scan the batch QC sticker, not an individual coil.`,
            SNACK_DUR.long
          );
          return;
        }
        await openCoilFromScan(pending);
      } catch (err) {
        showScanToast("error", "scan-fail", err?.message || "Scan could not be processed. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [open, busy, row, openBatchFromScan, resolvePendingCoil, openCoilFromScan, showScanToast]
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
            className={SCAN_INPUT_CLASS}
            placeholder={getScanInputPlaceholder() || "Scan / paste QC sticker"}
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
        title="Scan QC Sticker"
        description="Scan coil or batch QC sticker once, then fill specs (batch coils continue after each submit)"
        maxWidth="max-w-lg"
        footer={<RmStoreDrawerFooter onClose={onClose} cancelOnly />}
      >
        <div className="space-y-3 pb-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <ScanLine size={13} className="text-indigo-600" />
                QC sticker
                {busy ? <Loader2 size={12} className="animate-spin text-slate-400" /> : null}
              </span>
            </div>
            {scanControls}
          </div>

          {batchCoils.length > 0 && (
            <div
              className="rounded-xl border border-indigo-100 bg-indigo-50 p-2.5 flex items-center justify-between gap-2 cursor-help transition-colors hover:bg-indigo-100/50 animate-in fade-in slide-in-from-bottom-2"
              title={`Coils in this batch:\n${batchCoils.map((c) => c.coil_no_uid).join("\n")}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 truncate">
                  Batch: ALL ({batchCoils.length} coils)
                </span>
              </div>
            </div>
          )}
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
