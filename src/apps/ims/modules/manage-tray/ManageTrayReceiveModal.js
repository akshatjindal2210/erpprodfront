"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, Inbox, Layers, Loader2, Package, QrCode, ScanLine } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import ActionButton from "@/ui/primitives/ActionButton";
import { LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import FormTextarea from "@/ui/common/forms/FormTextarea";
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
import { formatDateTime } from "@/platform/utils/core/utilHelper";

const SCANNER_ID = "manage-tray-receive-scanner";
const INITIAL_SNACK = { open: false, variant: "info", title: "", message: "", duration: 4000 };

function poolBadgeClass(label) {
  const s = String(label || "").toUpperCase();
  if (s === "PACKING AREA" || s === "IN USE") return "bg-amber-50 text-amber-800 border-amber-200";
  if (s === "CUSTOMER END") return "bg-indigo-50 text-indigo-700 border-indigo-100";
  if (s === "STORE IN" || s === "STORAGE") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

export default function ManageTrayReceiveModal({ open, onClose, onSuccess, embedded = false, onBind }) {
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tray, setTray] = useState(null);
  const [remark, setRemark] = useState("");
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

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setTray(null);
      setRemark("");
      setCameraOn(false);
      scanBusyRef.current = false;
      setSnackbar(INITIAL_SNACK);
    }
    if (!open) setCameraOn(false);
    prevOpenRef.current = open;
  }, [open]);

  const processScan = useCallback(
    async (rawInput) => {
      const raw = normalizeScanInput(rawInput);
      if (!raw || scanBusyRef.current || saving) return;
      scanBusyRef.current = true;
      setScanning(true);
      setTray(null);
      try {
        const res = await manageTrayService.previewReceive(raw);
        if (res?.success === false) throw new Error(res?.message || "Scan failed.");
        const data = res?.data;
        if (!data?.tray_code) throw new Error("Tray not found.");
        setTray(data);
        showScanSuccess(`mt-receive-${data.tray_code}`, data.tray_code, 1800);
        void playScanSuccessBeep();
      } catch (err) {
        setTray(null);
        showScanToast("error", `mt-receive-${raw}`, err?.message || "Scan failed.", 2200);
      } finally {
        setScanning(false);
        scanBusyRef.current = false;
      }
    },
    [saving, showScanSuccess, showScanToast]
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
      setTray(null);
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
    if (!tray?.tray_code) {
      showScanToast("info", "need-tray", "Scan a tray first.", 2200);
      return;
    }
    if (!remark.trim()) {
      showScanToast("info", "need-remark", "Enter a remark.", 2200);
      return;
    }
    setSaving(true);
    try {
      const res = await manageTrayService.receiveTray(tray.tray_code, { remark: remark.trim() });
      if (res?.success === false) throw new Error(res?.message || "Receive failed.");
      showScanSuccess(`mt-received-${tray.tray_code}`, res?.message || `Tray ${tray.tray_code} received`, 2200);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      showScanToast("error", "receive-fail", err?.message || "Receive failed.", 2800);
    } finally {
      setSaving(false);
    }
  }, [tray, remark, onSuccess, onClose, showScanSuccess, showScanToast]);

  const handleClose = useCallback(() => {
    stopCamera();
    setTray(null);
    setRemark("");
    onClose?.();
  }, [onClose, stopCamera]);

  const clearTray = useCallback(() => {
    setTray(null);
    setRemark("");
  }, []);

  useEffect(() => {
    if (!embedded) return;
    onBind?.({
      submit: () => void handleSave(),
      saving,
      canSubmit: Boolean(tray?.tray_code && remark.trim()) && !saving,
      clear: clearTray,
    });
  }, [embedded, onBind, handleSave, saving, tray, remark, clearTray]);

  useEffect(() => {
    if (!open) return;
    const handleGlobalKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        e.stopPropagation();
        if (saving || !tray) return;
        clearTray();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [open, saving, tray, clearTray]);

  const form = (
    <div className="space-y-5 pb-6">
        <div className="flex items-end gap-2">
          <div className="relative flex-1 space-y-2">
            <label className="text-xs font-medium text-slate-600 ml-1 block">Tray code</label>
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
          hint="Scan the tray QR"
          torchSupported={torchSupported}
          torchOn={torchOn}
          onToggleTorch={toggleTorch}
        />

        {scanning ? (
          <div className="py-20 text-center">
            <Loader2 className="animate-spin text-indigo-500 mx-auto mb-3" size={32} />
              <p className="text-xs font-medium text-slate-500">Please wait.</p>
          </div>
        ) : tray ? (
          <div className="space-y-4">
            <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/40">
              <div className="flex items-start gap-2">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm bg-emerald-600 text-white">
                  <Layers size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-medium text-emerald-600 leading-none">This tray</p>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${poolBadgeClass(tray.pool_label)}`}>
                      ● {tray.pool_label || tray.pool_status}
                    </span>
                  </div>
                  <p className="text-sm font-bold font-mono leading-tight text-slate-900 mt-0.5">{tray.tray_code}</p>
                  <p className="text-[11px] mt-1 text-slate-600">
                    Type <span className="font-mono font-semibold">{tray.tray_type || "—"}</span>
                    <span className="text-slate-300 mx-1">·</span>
                    Packing <span className="font-mono font-semibold">{tray.packing_number || "—"}</span>
                    <span className="text-slate-300 mx-1">·</span>
                    {tray.box_count || 1} sticker{Number(tray.box_count) === 1 ? "" : "s"}
                  </p>
                  <div className="mt-2 pt-2 border-t border-emerald-100/90 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="text-[10px] font-medium text-slate-500">Sticker</p>
                      <p className="font-semibold text-slate-800 truncate">{tray.box_no_uid || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-slate-500">Assigned</p>
                      <p className="font-semibold text-slate-800">{formatDateTime(tray.assigned_at) || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <FormTextarea
              label="Remark"
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              disabled={saving}
              placeholder="Enter remark"
              required
            />
          </div>
        ) : (
          !cameraOn && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Package size={24} className="text-slate-200" />
              </div>
              <p className="text-sm font-medium text-slate-500">Scan a tray sent to a customer, enter a remark, then submit.</p>
            </div>
          )
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
      title="Receive Tray"
      description="Scan the tray, enter a remark, then submit. Stickers will leave the tray."
      maxWidth="max-w-md"
      footer={
        tray ? (
          <div className="flex flex-wrap items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={clearTray}
              disabled={saving}
              title="Clear scan (Ctrl+D)"
              className={`${LIST_PAGE_ACTION_CLASS} px-4 bg-white border border-slate-300 text-slate-600`}
            >
              Clear
            </button>
            <ActionButton
              module="manage_tray"
              action="edit"
              label={saving ? "Saving..." : "Submit"}
              icon={saving ? Loader2 : Inbox}
              disabled={saving}
              title="Ctrl+S"
              onClick={() => void handleSave()}
              className={`${LIST_PAGE_ACTION_CLASS} px-4 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600`}
            />
          </div>
        ) : null
      }
    >
      {form}
    </Drawer>
  );
}
