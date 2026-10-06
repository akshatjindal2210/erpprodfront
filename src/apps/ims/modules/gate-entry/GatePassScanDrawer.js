"use client";

import { useState, useRef, useCallback } from "react";
import { ScanLine, CameraOff, QrCode, DoorOpen } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/platform/utils/global";
import { prepareQrScanSession } from "@/platform/utils/global/scanFeedback";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import ScanEnterInput from "@/ui/common/scan/ScanEnterInput";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import { gatePassService } from "@/apps/hrms/lib/services/hrms";
import { extractGatePassIdFromScan } from "@/apps/hrms/lib/gatePassUtils";

const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "info", title: "", message: "", duration: SNACK_DUR.med };
const GP_SCANNER_ID = "gate-entry-gate-pass-scan-reader";

export default function GatePassScanDrawer({ open, onClose }) {
  const [cameraOn, setCameraOn] = useState(false);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);
  const [lastResult, setLastResult] = useState(null);
  const busyRef = useRef(false);

  const keyboardInputRef = useRef(null);
  const scanToastRef = useRef({});
  const { laserScan, keyboardType, showPhoneQr } = useDeviceScanSettings();
  const showLaserUi = laserScan || isLaserScanEnabled();

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);

  const { showScanToast } = useScanSnackbarActions(setSnackbar, scanToastRef);

  const applyScan = useCallback(
    (raw) => {
      void (async () => {
        const id = extractGatePassIdFromScan(raw);
        if (!id) {
          showScanToast("error", "invalid-gp-qr", "Could not read gate pass from QR. Scan the HRMS gate pass QR.");
          return;
        }
        if (busyRef.current) return;
        busyRef.current = true;
        try {
          const res = await gatePassService.scan({ id: Number(id) });
          if (!res?.success) throw new Error(res?.message || "Scan failed.");
          setLastResult(res);
          const d = res.data;
          const who = d?.emp_name ? `${d.emp_name}${d?.emp_code ? ` (${d.emp_code})` : ""}` : `Pass #${id}`;
          const action = res.scan === "out" ? "OUT recorded" : "IN recorded";
          showScanToast("success", `gp-${id}-${res.scan}`, `${action} · ${who}`, SNACK_DUR.short);
          setCameraOn(false);
        } catch (err) {
          showScanToast("error", `gp-err-${id}`, err?.message || "Gate pass scan failed.");
        } finally {
          busyRef.current = false;
        }
      })();
    },
    [showScanToast]
  );

  const applyScanRef = useRef(applyScan);
  applyScanRef.current = applyScan;

  const handleScanEnter = useCallback((code) => {
    applyScanRef.current(code);
  }, []);

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: cameraOn,
    elementId: GP_SCANNER_ID,
    onDecoded: (decodedText) => {
      setCameraOn(false);
      applyScanRef.current(decodedText);
    },
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: () => {
      showScanToast("error", "camera-list", SCAN_SNACK_MSG.CAMERA_DENIED ?? SCAN_SNACK_MSG.CAMERA, 4000);
      setCameraOn(false);
    },
  });

  const stopCamera = useCallback(() => setCameraOn(false), []);

  const startCamera = useCallback(() => {
    void (async () => {
      const prep = await prepareQrScanSession();
      if (!prep.cameraOk) {
        showScanToast(
          "error",
          "camera-list",
          prep.cameraDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA,
          4000
        );
        return;
      }
      setCameraOn(true);
    })();
  }, [showScanToast]);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose?.();
  }, [onClose, stopCamera]);

  const d = lastResult?.data;

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={handleClose}
        title="Scan Gate Pass"
        description="First scan = OUT, second = IN (HRMS gate pass QR only)"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 pb-6">
          <div className="flex items-end gap-2">
            <div className="relative flex-1 space-y-2">
              <label className="text-xs font-medium text-slate-600 ml-1 block">Gate pass QR</label>
              {showLaserUi && (
                <LaserScanField
                  active={open && showLaserUi && !cameraOn}
                  onScanned={handleScanEnter}
                  keyboardInputRef={keyboardInputRef}
                  requireArmButton={false}
                />
              )}
              {keyboardType && (
                <div className="relative">
                  <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 z-10" />
                  <ScanEnterInput
                    ref={keyboardInputRef}
                    placeholder={getScanInputPlaceholder() || "Scan QR or enter pass id"}
                    onEnter={handleScanEnter}
                    className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              )}
              {!showLaserUi && !keyboardType && (
                <p className="text-xs text-slate-500 px-1">
                  {showPhoneQr
                    ? "Use the camera button to scan the gate pass QR."
                    : "Enable Laser scanner, Keyboard type, or Phone QR in Device Settings."}
                </p>
              )}
            </div>

            {showPhoneQr && (
              <button
                type="button"
                onClick={() => (cameraOn ? stopCamera() : startCamera())}
                className={`w-12 h-11 flex items-center justify-center rounded-xl border transition-all shadow-sm ${
                  cameraOn
                    ? "bg-rose-50 border-rose-200 text-rose-600"
                    : "bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700"
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
            readerId={GP_SCANNER_ID}
            hint="Point camera at HRMS gate pass QR"
            torchSupported={torchSupported}
            torchOn={torchOn}
            onToggleTorch={toggleTorch}
            allowDesktop
          />

          {d ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1 text-xs text-slate-600">
              <p className="text-[10px] font-black uppercase text-slate-400">{lastResult?.scan === "out" ? "OUT" : "IN"}</p>
              <p className="font-bold text-slate-800 text-sm">
                {d.emp_name || "—"} <span className="font-mono text-indigo-600">{d.emp_code}</span>
              </p>
              <p>Type: {d.pass_type_display || d.pass_type || "—"}</p>
              <p className="tabular-nums">Gone at: {d.gone_at_display || "—"}</p>
              <p className="tabular-nums">Returned at: {d.returned_at_display || "—"}</p>
            </div>
          ) : (
            !cameraOn && (
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                  <DoorOpen size={24} className="text-slate-200" />
                </div>
                <p className="text-sm font-medium text-slate-500">Scan or enter the HRMS gate pass QR to record OUT / IN.</p>
              </div>
            )
          )}
        </div>
      </Drawer>
      <Snackbar
        open={snackbar.open}
        variant={snackbar.variant}
        title={snackbar.title}
        message={snackbar.message}
        duration={snackbar.duration}
        onClose={closeSnackbar}
      />
    </>
  );
}
