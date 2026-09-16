"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Layers, Loader2, Package, QrCode, ScanLine, Send, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import ScanEnterInput from "@/ui/common/scan/ScanEnterInput";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import { SCAN_SNACK_MSG } from "@/ui/common/Constants";
import { manageTrayService } from "@/apps/ims/lib/services/manageTray";
import { manageTrayLinkProgress } from "@/apps/ims/lib/helpers/manageTrayHelper";
import { boxNoUidDisplayLabel, normalizeScanInput } from "@/apps/ims/lib/helpers/qrScan";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { blurActiveElement, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import { unlockScanAudio, playScanSuccessBeep } from "@/platform/utils/global/scanFeedback";
import { useScanSnackbarActions } from "@/platform/utils/global";

const MANAGE_TRAY_SCANNER_ID = "manage-tray-scanner-reader";
const INITIAL_SNACK = { open: false, variant: "error", title: "", message: "", duration: 4000 };

export default function ManageTrayLinkModal({ open, onClose, onSuccess, record, readOnly = false }) {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState([]);
  const [scanStep, setScanStep] = useState("sticker");
  const [pendingSticker, setPendingSticker] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);

  const scanBusyRef = useRef(false);
  const inputRef = useRef(null);
  const laserBlurRef = useRef(null);
  const processScanRef = useRef(async () => {});
  const prevOpenRef = useRef(false);
  const scanToastRef = useRef({});

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);

  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);
  const { laserScan, keyboardType, showPhoneQr } = useDeviceScanSettings();
  const scanBtnCount = (showPhoneQr ? 1 : 0) + (laserScan ? 1 : 0);
  const scanBtnFill = scanBtnCount > 1 ? "flex-1 basis-0 min-w-0 w-full" : "w-full";

  const progress = useMemo(() => manageTrayLinkProgress(record), [record]);
  const required = progress.required;
  const linkedCount = links.length;
  const isComplete = required > 0 ? linkedCount >= required : linkedCount > 0;
  const isTrayStep = scanStep === "tray" && Boolean(pendingSticker);

  const loadDetail = useCallback(async () => {
    if (!record?.id) return;
    setLoading(true);
    try {
      const res = await manageTrayService.get(record.packing_number || record.id);
      const data = res?.data ?? {};
      setLinks(
        (data.links || []).map((row, idx) => ({
          clientId: String(row.id ?? `saved-${idx}`),
          box_no_uid: row.box_no_uid,
          box_uid: row.box_uid,
          tray_id: row.tray_id,
          tray_code: row.tray_code,
          qty: row.qty,
        }))
      );
    } catch (err) {
      toast.error(err?.message || "Failed to load links.");
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [record?.id]);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setScanStep("sticker");
      setPendingSticker(null);
      setIsScannerOpen(false);
      scanBusyRef.current = false;
      setSnackbar(INITIAL_SNACK);
      if (isLaserScanEnabled() && !keyboardType) blurActiveElement();
    }
    prevOpenRef.current = open;
  }, [open, keyboardType]);

  useEffect(() => {
    if (!open || !record?.id) return;
    void loadDetail();
  }, [open, record?.id, loadDetail]);

  const removeLink = useCallback((clientId) => {
    setLinks((prev) => prev.filter((row) => row.clientId !== clientId));
  }, []);

  const removeLastLink = useCallback(() => {
    setLinks((prev) => (prev.length ? prev.slice(1) : prev));
    setPendingSticker(null);
    setScanStep("sticker");
  }, []);

  const processScan = useCallback(
    async (rawInput) => {
      const raw = normalizeScanInput(rawInput);
      if (!raw || !record?.id || scanBusyRef.current || saving || loading) return;
      scanBusyRef.current = true;
      setScanning(true);

      try {
        if (scanStep === "sticker") {
          const res = await manageTrayService.scanSticker(record.packing_number || record.id, raw);
          if (res?.success === false) throw new Error(res?.message || "Sticker scan failed.");
          const data = res?.data;
          if (!data?.box_no_uid) throw new Error("Sticker not found.");
          if (links.some((l) => l.box_no_uid === data.box_no_uid)) {
            showScanToast("error", `mt-dup-sticker-${data.box_no_uid}`, "This sticker is already linked.", 1800);
            return;
          }
          setPendingSticker(data);
          setScanStep("tray");
          void playScanSuccessBeep();
          showScanSuccess(
            `mt-sticker-${data.box_no_uid}`,
            `${data.box_no_uid} — scan tray now`,
            3500
          );
          if (!keyboardType) blurActiveElement();
          return;
        }

        if (!pendingSticker) {
          setScanStep("sticker");
          showScanToast("error", "mt-scan-sticker-first", "Scan the sticker first.", 2000);
          return;
        }

        const res = await manageTrayService.scanTray(record.packing_number || record.id, raw);
        if (res?.success === false) throw new Error(res?.message || "Tray scan failed.");
        const tray = res?.data;
        if (!tray?.tray_code) throw new Error("Tray not found.");
        if (links.some((l) => l.tray_code === tray.tray_code)) {
          showScanToast("error", `mt-dup-tray-${tray.tray_code}`, "This tray is already linked to another sticker.", 1800);
          return;
        }

        setLinks((prev) => [
          {
            clientId: `tmp-${Date.now()}-${prev.length}`,
            box_no_uid: pendingSticker.box_no_uid,
            box_uid: pendingSticker.box_uid,
            tray_id: tray.tray_id,
            tray_code: tray.tray_code,
            qty: pendingSticker.qty,
          },
          ...prev,
        ]);
        setPendingSticker(null);
        setScanStep("sticker");
        void playScanSuccessBeep();
        showScanSuccess(`mt-linked-${tray.tray_code}`, `Linked to ${tray.tray_code}`, 2000);
        if (!keyboardType) blurActiveElement();
      } catch (err) {
        showScanToast("error", "mt-scan-failed", err?.message || "Scan failed.", 2200);
      } finally {
        scanBusyRef.current = false;
        setScanning(false);
      }
    },
    [record?.id, saving, loading, scanStep, pendingSticker, links, keyboardType, showScanToast, showScanSuccess]
  );

  processScanRef.current = processScan;

  const handleLaserScan = useCallback((code) => {
    void processScanRef.current(code);
  }, []);

  const handleLaserScanRejected = useCallback(
    ({ reason }) => {
      if (reason === "empty") {
        showScanToast("error", "laser-empty-scan", SCAN_SNACK_MSG.REJECTED, 1800);
      }
    },
    [showScanToast]
  );

  const laserPreviewLabel = useCallback(
    (raw) => (isTrayStep ? String(raw ?? "").trim().toUpperCase() : boxNoUidDisplayLabel(raw)),
    [isTrayStep]
  );

  const handleKeyboardEnter = useCallback((code) => {
    void processScanRef.current(code);
  }, []);

  const handleScanSubmit = (e) => {
    e.preventDefault();
    const code = String(inputRef.current?.value ?? "").trim();
    if (inputRef.current) inputRef.current.value = "";
    void processScanRef.current(code);
  };

  const startScanner = () => {
    void unlockScanAudio().catch(() => {});
    setIsScannerOpen(true);
  };

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: isScannerOpen,
    elementId: MANAGE_TRAY_SCANNER_ID,
    onDecoded: (raw) => {
      setIsScannerOpen(false);
      void processScanRef.current(raw);
    },
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: (err) => {
      const isDenied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      toast.error(isDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA, { autoClose: 4000 });
      setIsScannerOpen(false);
    },
  });

  const save = useCallback(
    async (submit = false) => {
      if (!record?.id || saving || loading) return;
      if (!linkedCount) {
        toast.error("Scan at least one sticker and tray.");
        return;
      }
      if (submit && !isComplete) {
        toast.error(required > 0 ? `Link all stickers (${linkedCount}/${required}).` : "Scan at least one sticker and tray.");
        return;
      }
      setSaving(true);
      try {
        const payloadLinks = links.map(({ box_no_uid, box_uid, tray_id, tray_code, qty }) => ({
          box_no_uid,
          box_uid,
          tray_id,
          tray_code,
          qty,
        }));
        const res = await manageTrayService.saveLinks(record.packing_number || record.id, { links: payloadLinks, submit });
        toast.success(res?.message || (submit ? "Links saved." : "Draft saved."));
        onSuccess?.(res?.data);
        onClose?.();
      } catch (err) {
        toast.error(err?.message || (submit ? "Submit failed." : "Save failed."));
      } finally {
        setSaving(false);
      }
    },
    [record?.id, saving, loading, linkedCount, isComplete, required, links, onSuccess, onClose]
  );

  const scanDisabled = loading || saving || readOnly;
  const laserScanActive = open && (laserScan || isLaserScanEnabled()) && !scanDisabled;

  useEffect(() => {
    if (!open || !keyboardType || scanDisabled) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open, keyboardType, isTrayStep, scanStep, scanDisabled]);

  useEffect(() => {
    if (!open) return;
    const handleGlobalKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        e.stopPropagation();
        if (scanDisabled) return;
        removeLastLink();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [open, scanDisabled, removeLastLink]);

  const drawerFooter = (
    <div className="flex justify-end gap-3 w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="px-5 py-2 text-sm font-bold text-slate-500 disabled:opacity-40"
      >
        {readOnly ? "Close" : "Cancel"}
      </button>
      {readOnly ? null : (
      <button
        type="button"
        onClick={() => void save(isComplete)}
        disabled={saving || loading || !linkedCount}
        title="Ctrl+S"
        className="min-w-[140px] px-6 py-2 text-sm font-bold text-white rounded-xl shadow-lg bg-red-600 hover:bg-red-700 disabled:bg-slate-300 transition-all active:scale-95"
      >
        {saving
          ? isComplete
            ? "Submitting..."
            : "Saving..."
          : isComplete
            ? "Submit"
            : `Save draft (${linkedCount}/${required || "?"})`}
      </button>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() => {
        if (readOnly || saving || loading) return;
        void save(isComplete);
      }}
      closeOnOutside={!saving}
      title={readOnly ? "Submitted links" : "Link sticker to tray"}
      description={
        readOnly
          ? `${record?.packing_number || "—"} · saved links. This does not change.`
          : `${record?.packing_number || "—"} · ${linkedCount}/${required || "?"} linked`
      }
      maxWidth="max-w-2xl"
      bodyScrollable={false}
      footer={drawerFooter}
    >
      <div className="flex flex-col flex-1 min-h-0 gap-2.5">
        <QrScannerOverlay
          open={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          readerId={MANAGE_TRAY_SCANNER_ID}
          frameClassName={isTrayStep ? "border-4 border-indigo-400" : "border-4 border-amber-400"}
          hint={isTrayStep ? "Scan tray QR" : "Scan sticker QR"}
          torchSupported={torchSupported}
          torchOn={torchOn}
          onToggleTorch={toggleTorch}
        />

        {readOnly ? null : (
        <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 space-y-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase shrink-0 ${
                isTrayStep ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {isTrayStep ? <Check size={11} strokeWidth={3} /> : <Package size={11} />}
              1. Sticker
            </span>
            <span className={`h-px flex-1 ${isTrayStep ? "bg-emerald-300" : "bg-slate-200"}`} aria-hidden />
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase shrink-0 ${
                isTrayStep ? "text-indigo-600" : "text-slate-400"
              }`}
            >
              <Layers size={11} />
              2. Tray {linkedCount > 0 ? linkedCount : ""}
            </span>
          </div>
          <p
            className={`text-[11px] font-semibold leading-snug ${isTrayStep ? "text-indigo-700" : "text-amber-800"}`}
            role="status"
          >
            {isTrayStep
              ? pendingSticker
                ? `${pendingSticker.box_no_uid} — scan the matching tray.`
                : "Scan tray QR"
              : "Scan the sticker first, then the tray."}
          </p>
        </div>
        )}

        {readOnly ? null : (
        <div className="shrink-0 space-y-2">
          {showPhoneQr || laserScan ? (
            <div className="flex items-stretch gap-2 w-full min-w-0">
              {showPhoneQr && (
                <button
                  type="button"
                  onClick={startScanner}
                  disabled={scanDisabled}
                  className={`h-10 sm:h-9 px-3 rounded-lg text-white inline-flex items-center justify-center gap-1.5 ${scanBtnFill} ${
                    isTrayStep ? "bg-indigo-600" : "bg-amber-500"
                  } disabled:opacity-60`}
                  title={isTrayStep ? "Scan tray QR" : "Scan sticker QR"}
                >
                  <QrCode size={16} />
                  <span className="text-[10px] font-black uppercase">QR</span>
                </button>
              )}
              {laserScan && (
                <LaserScanField
                  active={laserScanActive}
                  onScanned={handleLaserScan}
                  onScanRejected={handleLaserScanRejected}
                  keyboardInputRef={laserBlurRef}
                  companionTypableRef={inputRef}
                  formatPreview={laserPreviewLabel}
                  compact
                  heightClass="h-10 sm:h-9"
                  armButtonLabel={isTrayStep ? "Scan Tray" : "Scan Sticker"}
                  fill={scanBtnCount > 0}
                  autoArmOnActive={false}
                />
              )}
            </div>
          ) : null}
          {keyboardType ? (
            <form onSubmit={handleScanSubmit} className="relative w-full min-w-0">
              <ScanLine size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <ScanEnterInput
                ref={inputRef}
                onEnter={handleKeyboardEnter}
                placeholder={
                  isTrayStep ? "Type tray code, then press Enter" : "Type sticker code, then press Enter"
                }
                className={`w-full h-10 sm:h-9 bg-white border rounded-lg pl-7 pr-8 text-[11px] font-mono outline-none focus:ring-2 ${
                  isTrayStep
                    ? "border-indigo-200 focus:border-indigo-500 focus:ring-indigo-50"
                    : "border-amber-200 focus:border-amber-500 focus:ring-amber-50"
                }`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                {scanning ? (
                  <Loader2 size={13} className="animate-spin text-indigo-500" />
                ) : (
                  <Send size={13} className={isTrayStep ? "text-indigo-500" : "text-amber-500"} />
                )}
              </div>
            </form>
          ) : null}
          {!showPhoneQr && !laserScan && !keyboardType ? (
            <p className="text-[10px] text-slate-500">Enable laser scanner or keyboard input in Settings.</p>
          ) : null}
        </div>
        )}

        <div className="flex flex-col flex-1 min-h-0 border border-slate-200 rounded-lg overflow-hidden bg-white">
          <div className="shrink-0 flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 bg-slate-50">
            <p className="text-[9px] font-bold text-indigo-600 uppercase">Linked ({linkedCount})</p>
            {linkedCount > 0 && !scanDisabled ? (
              <button
                type="button"
                onClick={removeLastLink}
                className="text-[9px] font-bold text-rose-500 uppercase"
                title="Remove last link (Ctrl+D)"
              >
                Remove last
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <FormPanelLoader label="Loading..." />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-1.5 py-1.5 space-y-1">
              {linkedCount === 0 ? (
                <div className="h-full min-h-[180px] flex items-center justify-center">
                  <p className="text-[10px] text-slate-400 italic">Scan the sticker, then the tray.</p>
                </div>
              ) : (
                links.map((row, idx) => (
                  <div
                    key={row.clientId}
                    className="flex items-center justify-between py-1.5 px-2 bg-slate-50 border border-slate-100 rounded-md"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[9px] font-bold text-slate-400 shrink-0">{linkedCount - idx}.</span>
                      <span className="font-mono text-[10px] font-bold text-indigo-700 truncate">{row.box_no_uid}</span>
                      <span className="text-[9px] text-slate-300 shrink-0">→</span>
                      <span className="font-mono text-[10px] font-bold text-slate-700 truncate">{row.tray_code}</span>
                    </div>
                    {!scanDisabled ? (
                      <button
                        type="button"
                        onClick={() => removeLink(row.clientId)}
                        className="text-slate-300 hover:text-rose-500 p-0.5 shrink-0"
                        aria-label="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <Snackbar
        open={snackbar.open}
        variant={snackbar.variant}
        title={snackbar.title}
        message={snackbar.message}
        duration={snackbar.duration}
        onClose={closeSnackbar}
      />
    </Drawer>
  );
}
