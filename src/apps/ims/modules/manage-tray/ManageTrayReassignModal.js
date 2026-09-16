"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightLeft, CameraOff, Layers, Loader2, Package, QrCode, ScanLine } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import ActionButton from "@/ui/primitives/ActionButton";
import { LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import ScanEnterInput from "@/ui/common/scan/ScanEnterInput";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import { manageTrayService } from "@/apps/ims/lib/services/manageTray";
import { normalizeScanInput } from "@/apps/ims/lib/helpers/qrScan";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import { playScanSuccessBeep, prepareQrScanSession } from "@/platform/utils/global/scanFeedback";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/platform/utils/global";

const SCANNER_ID = "manage-tray-reassign-scanner";
const INITIAL_SNACK = { open: false, variant: "info", title: "", message: "", duration: 4000 };

export default function ManageTrayReassignModal({ open, onClose, onSuccess, embedded = false, onBind }) {
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState("sticker");
  const [sticker, setSticker] = useState(null);
  const [tray, setTray] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);

  const keyboardInputRef = useRef(null);
  const scanBusyRef = useRef(false);
  const processScanRef = useRef(async () => {});
  const prevOpenRef = useRef(false);
  const scanToastRef = useRef({});

  const closeSnackbar = useCallback(() => setSnackbar((s) => ({ ...s, open: false })), []);
  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);
  const { laserScan, keyboardType, showPhoneQr } = useDeviceScanSettings();
  const showLaserUi = laserScan || isLaserScanEnabled();

  const reset = useCallback(() => {
    setStep("sticker");
    setSticker(null);
    setTray(null);
  }, []);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset();
      setCameraOn(false);
      scanBusyRef.current = false;
      setSnackbar(INITIAL_SNACK);
    }
    if (!open) setCameraOn(false);
    prevOpenRef.current = open;
  }, [open, reset]);

  const processScan = useCallback(
    async (rawInput) => {
      const raw = normalizeScanInput(rawInput);
      if (!raw || scanBusyRef.current || saving) return;
      scanBusyRef.current = true;
      setScanning(true);
      try {
        if (step === "sticker") {
          const res = await manageTrayService.scanReassignSticker(raw);
          if (res?.success === false) throw new Error(res?.message || "Scan failed.");
          const data = res?.data;
          if (!data?.box_no_uid) throw new Error("Sticker not found.");
          setSticker(data);
          setTray(null);
          setStep("tray");
          showScanSuccess(`mt-re-sticker-${data.box_no_uid}`, `${data.box_no_uid} — scan new tray`, 2800);
          void playScanSuccessBeep();
          return;
        }

        if (!sticker?.box_no_uid) {
          setStep("sticker");
          showScanToast("error", "need-sticker", "Scan the sticker first.", 2000);
          return;
        }

        const res = await manageTrayService.scanReassignTray(raw, {
          from_tray_id: sticker.tray_id,
          box_no_uid: sticker.box_no_uid,
        });
        if (res?.success === false) throw new Error(res?.message || "Scan failed.");
        const data = res?.data;
        if (!data?.tray_id) throw new Error("Tray not found.");
        setTray(data);
        showScanSuccess(`mt-re-tray-${data.tray_code}`, data.tray_code, 1800);
        void playScanSuccessBeep();
      } catch (err) {
        showScanToast("error", "mt-reassign-scan", err?.message || "Scan failed.", 2200);
      } finally {
        setScanning(false);
        scanBusyRef.current = false;
      }
    },
    [saving, step, sticker, showScanSuccess, showScanToast]
  );

  useEffect(() => {
    processScanRef.current = processScan;
  }, [processScan]);

  const stopCamera = useCallback(() => setCameraOn(false), []);

  const startCamera = () => {
    void (async () => {
      const prep = await prepareQrScanSession();
      if (!prep.cameraOk) {
        showScanToast("error", "camera-list", prep.cameraDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA, 4000);
        return;
      }
      setCameraOn(true);
    })();
  };

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: cameraOn,
    elementId: SCANNER_ID,
    onDecoded: (raw) => {
      setCameraOn(false);
      void processScanRef.current(raw);
    },
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: () => {
      showScanToast("error", "camera", SCAN_SNACK_MSG.CAMERA, 4000);
      setCameraOn(false);
    },
  });

  const handleSave = useCallback(async () => {
    if (!sticker?.box_no_uid || !tray?.tray_id) {
      showScanToast("info", "need-both", "Scan the sticker, then the new tray.", 2200);
      return;
    }
    setSaving(true);
    try {
      const res = await manageTrayService.reassignTray({
        box_no_uid: sticker.box_no_uid,
        tray_id: tray.tray_id,
        tray_code: tray.tray_code,
      });
      if (res?.success === false) throw new Error(res?.message || "Reassign failed.");
      showScanSuccess(`mt-reassigned-${sticker.box_no_uid}`, res?.message || "Reassigned", 2200);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      showScanToast("error", "reassign-fail", err?.message || "Reassign failed.", 2800);
    } finally {
      setSaving(false);
    }
  }, [sticker, tray, onSuccess, onClose, showScanSuccess, showScanToast]);

  useEffect(() => {
    if (!embedded) return;
    onBind?.({
      submit: () => void handleSave(),
      saving,
      canSubmit: Boolean(sticker?.box_no_uid && tray?.tray_id) && !saving,
      clear: reset,
    });
  }, [embedded, onBind, handleSave, saving, sticker, tray, reset]);

  const handleClose = useCallback(() => {
    stopCamera();
    reset();
    onClose?.();
  }, [onClose, reset, stopCamera]);

  useEffect(() => {
    if (!open) return;
    const handleGlobalKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        e.stopPropagation();
        if (saving || (!sticker && !tray)) return;
        reset();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [open, saving, sticker, tray, reset]);

  const hint = step === "tray" ? "Scan the new tray QR" : "Scan the sticker QR";

  const form = (
      <div className="space-y-5 pb-6">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide">
          <span className={`px-2 py-1 border ${step === "sticker" ? "bg-indigo-600 text-white border-indigo-600" : "bg-indigo-50 text-indigo-700 border-indigo-100"}`}>
            1. Sticker
          </span>
          <span className="text-slate-300">→</span>
          <span className={`px-2 py-1 border ${step === "tray" ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
            2. New tray
          </span>
        </div>

        <div className="flex items-end gap-2">
          <div className="relative flex-1 space-y-2">
            <label className="text-xs font-medium text-slate-600 ml-1 block">{step === "tray" ? "New tray code" : "Sticker"}</label>
            {showLaserUi && (
              <LaserScanField
                active={open && showLaserUi && !saving}
                onScanned={(v) => void processScan(v)}
                keyboardInputRef={keyboardInputRef}
                requireArmButton={false}
              />
            )}
            {keyboardType && (
              <div className="relative">
                <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 z-10" />
                <ScanEnterInput
                  ref={keyboardInputRef}
                  placeholder={getScanInputPlaceholder()}
                  onEnter={(v) => void processScan(v)}
                  className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            )}
            {!showLaserUi && !keyboardType && (
              <p className="text-xs text-slate-500 px-1">Enable laser scanner or keyboard input in Settings.</p>
            )}
          </div>
          {showPhoneQr && (
            <button
              type="button"
              onClick={() => (cameraOn ? stopCamera() : startCamera())}
              disabled={saving}
              className={`w-12 h-11 flex items-center justify-center rounded-xl border transition-all shadow-sm ${
                cameraOn ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700"
              }`}
              title={cameraOn ? "Stop camera" : "Scan QR"}
            >
              {cameraOn ? <CameraOff size={20} /> : <QrCode size={20} />}
            </button>
          )}
        </div>

        <QrScannerOverlay
          open={cameraOn}
          onClose={stopCamera}
          readerId={SCANNER_ID}
          hint={hint}
          torchSupported={torchSupported}
          torchOn={torchOn}
          onToggleTorch={toggleTorch}
        />

        {scanning ? (
          <div className="py-16 text-center">
            <Loader2 className="animate-spin text-indigo-500 mx-auto mb-3" size={32} />
              <p className="text-xs font-medium text-slate-500">Please wait.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sticker ? (
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <p className="text-[10px] font-medium text-slate-500">Sticker · current tray</p>
                <p className="text-sm font-bold font-mono text-slate-900 mt-0.5">{sticker.box_no_uid}</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Tray <span className="font-mono font-semibold">{sticker.tray_code || "—"}</span>
                  <span className="text-slate-300 mx-1">·</span>
                  Packing <span className="font-mono font-semibold">{sticker.packing_number || "—"}</span>
                </p>
              </div>
            ) : (
              !cameraOn && (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <Package size={24} className="text-slate-200" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">Scan a sticker that is already on a tray.</p>
                </div>
              )
            )}
            {tray ? (
              <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/50">
                <div className="flex items-start gap-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-indigo-600 text-white">
                    <Layers size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-indigo-500">Move to</p>
                    <p className="text-sm font-bold font-mono text-slate-900">{tray.tray_code}</p>
                    <p className="text-[11px] text-slate-600">Type {tray.tray_type || "—"}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <Snackbar
          open={snackbar.open}
          onClose={closeSnackbar}
          variant={snackbar.variant}
          title={snackbar.title}
          message={snackbar.message}
          duration={snackbar.duration}
        />
      </div>
  );

  if (embedded) return form;

  return (
    <Drawer
      isOpen={open}
      onClose={handleClose}
      onSubmit={() => {
        if (saving) return;
        void handleSave();
      }}
      closeOnOutside={!saving}
      title="Reassign Tray"
      description="Scan the sticker, then scan the new tray."
      maxWidth="max-w-md"
      footer={
        sticker && tray ? (
          <div className="flex flex-wrap items-center justify-end gap-2 w-full">
            <button type="button" onClick={reset} disabled={saving} title="Clear scan (Ctrl+D)" className={`${LIST_PAGE_ACTION_CLASS} px-4 bg-white border border-slate-300 text-slate-600`}>
              Clear
            </button>
            <ActionButton
              module="manage_tray"
              action="edit"
              label={saving ? "Saving..." : "Submit"}
              icon={saving ? Loader2 : ArrowRightLeft}
              disabled={saving}
              title="Ctrl+S"
              onClick={() => void handleSave()}
              className={`${LIST_PAGE_ACTION_CLASS} px-4 bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600`}
            />
          </div>
        ) : null
      }
    >
      {form}
    </Drawer>
  );
}
