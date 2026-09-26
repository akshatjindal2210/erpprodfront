"use client";

import { useState, useRef, useCallback } from "react";
import { ScanLine, CameraOff, QrCode, FileSearch } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/platform/utils/global";
import { normalizeScanInput } from "@/apps/ims/lib/helpers/qrScan";
import { playScanSuccessBeep, prepareQrScanSession } from "@/platform/utils/global/scanFeedback";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import ScanEnterInput from "@/ui/common/scan/ScanEnterInput";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";

const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "info", title: "", message: "", duration: SNACK_DUR.med };
const FN_SCANNER_ID = "out-entry-fn-scan-drawer-reader";

/** FN print QR / public URL / plain FUID → numeric fuid string. */
export function extractForwardingFuidFromScan(rawValue) {
  const text = normalizeScanInput(rawValue);
  if (!text) return null;

  const fromQuery = text.match(/[?&]fuid=([^&#\s]+)/i);
  if (fromQuery?.[1]) {
    try {
      const v = decodeURIComponent(fromQuery[1].replace(/\+/g, " ")).trim();
      if (/^\d+$/.test(v)) return v;
    } catch {
      const v = String(fromQuery[1]).trim();
      if (/^\d+$/.test(v)) return v;
    }
  }

  try {
    if (/^https?:\/\//i.test(text)) {
      const u = new URL(text);
      const fuidParam = u.searchParams.get("fuid");
      if (fuidParam != null && /^\d+$/.test(String(fuidParam).trim())) {
        return String(fuidParam).trim();
      }
    }
  } catch {
    /* ignore */
  }

  if (/^\d+$/.test(text)) return text;

  const labeled = text.match(/(?:^|[^\w])(?:fuid|fn)[\s\-#:]*(\d{1,12})(?:$|[^\d])/i);
  if (labeled?.[1]) return labeled[1];

  return null;
}

/**
 * Pending Forwarding → New — scan FN QR (Finder-style laser / keyboard / phone QR + snackbar).
 * onScanned(fuid) must return true only when a pending FN matched and Store Out should open.
 */
export default function ForwardingNoteScanDrawer({ open, onClose, onScanned }) {
  const [cameraOn, setCameraOn] = useState(false);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);

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
        const fuid = extractForwardingFuidFromScan(raw);
        if (!fuid) {
          showScanToast("error", "invalid-fn-qr", "Could not read forwarding note from QR. Scan the FN print QR.");
          return;
        }
        let matched = false;
        try {
          matched = await Promise.resolve(onScanned?.(fuid));
        } catch (err) {
          showScanToast("error", `fn-err-${fuid}`, err?.message || "Could not open this forwarding note.");
          return;
        }
        if (!matched) {
          showScanToast(
            "error",
            `fn-miss-${fuid}`,
            `No pending forwarding note found for #${fuid}. Scan a pending FN QR.`
          );
          return;
        }
        void playScanSuccessBeep();
        showScanToast("success", `fn-${fuid}`, `Forwarding note #${fuid}`, SNACK_DUR.short);
        setCameraOn(false);
      })();
    },
    [onScanned, showScanToast]
  );

  const applyScanRef = useRef(applyScan);
  applyScanRef.current = applyScan;

  const handleScanEnter = useCallback((code) => {
    applyScanRef.current(code);
  }, []);

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: cameraOn,
    elementId: FN_SCANNER_ID,
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

  const stopCamera = useCallback(() => {
    setCameraOn(false);
  }, []);

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

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={handleClose}
        title="Scan Forwarding Note"
        description="Scan the QR on the forwarding note print to start Store Out"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 pb-6">
          <div className="flex items-end gap-2">
            <div className="relative flex-1 space-y-2">
              <label className="text-xs font-medium text-slate-600 ml-1 block">Forwarding note QR</label>
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
                    placeholder={getScanInputPlaceholder()}
                    onEnter={handleScanEnter}
                    className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              )}
              {!showLaserUi && !keyboardType && (
                <p className="text-xs text-slate-500 px-1">
                  {showPhoneQr
                    ? "Use the camera button to scan the forwarding note QR."
                    : "Enable Laser scanner, Keyboard type, or Phone QR in Settings."}
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
            readerId={FN_SCANNER_ID}
            hint="Point camera at forwarding note QR"
            torchSupported={torchSupported}
            torchOn={torchOn}
            onToggleTorch={toggleTorch}
            allowDesktop
          />

          {!cameraOn && (
            <div className="py-16 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <FileSearch size={24} className="text-slate-200" />
              </div>
              <p className="text-sm font-medium text-slate-500">Scan or enter the forwarding note QR to open Store Out.</p>
            </div>
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
