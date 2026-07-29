"use client";

import { useState, useRef, useCallback } from "react";
import { Loader2, ScanLine, CameraOff, MapPin, Info, Layers, Package, QrCode } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import { coilService } from "@/apps/rmstore/lib/services/coil";
import { storeLocationService } from "@/apps/rmstore/lib/services/storeLocation";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/platform/utils/global";
import { extractCoilUid, coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import { getLocationDisplayNo } from "@/apps/rmstore/lib/helpers/locationQrLabel";
import { playScanSuccessBeep, prepareQrScanSession } from "@/platform/utils/global/scanFeedback";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import ScanEnterInput from "@/ui/common/scan/ScanEnterInput";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";

const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "info", title: "", message: "", duration: SNACK_DUR.med };
const COIL_FINDER_SCANNER_ID = "rm-coil-finder-scanner-reader";

function formatLocationNo(loc) {
  if (!loc) return "—";
  return getLocationDisplayNo(loc);
}

function IconLabeledRow({ icon: Icon, label, children, iconClass = "text-slate-400" }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[10px] font-medium text-slate-500 mb-0.5">{label}</p>
        <div className="text-xs font-semibold text-slate-800 leading-snug">{children}</div>
      </div>
    </div>
  );
}

export default function CoilFinderDrawer({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [coilData, setCoilData] = useState(null);
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

  const fetchCoilInfo = async (rawValue) => {
    const coilUid = extractCoilUid(rawValue);
    if (!coilUid) {
      showScanToast("error", "invalid-coil-qr", SCAN_SNACK_MSG.REJECTED);
      return;
    }

    setLoading(true);
    setLocationData(null);
    setCoilData(null);

    try {
      const coilRes = await coilService.getByUid(coilUid);
      const coil = coilRes?.data;

      if (!coil) {
        showScanToast("error", "coil-not-found", "Coil not found. Check the UID and try again.");
        return;
      }

      setCoilData(coil);

      const locationId = coil.location_id;
      if (!locationId) {
        showScanToast("warning", "no-location-assigned", "This coil is unassigned and not linked to any location yet.");
        void playScanSuccessBeep();
        return;
      }

      const locRes = await storeLocationService.getViews({
        id: locationId,
        permission_module: "rm_coils",
        permission_action: "view",
      });
      if (locRes.data) {
        setLocationData(locRes.data);
        void playScanSuccessBeep();
      } else {
        showScanToast("error", "assigned-location-not-found", "Saved location was not found in the location list.");
      }
    } catch (err) {
      showScanToast("error", "fetch-error", err?.message || "Could not load the coil details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCoilInfoRef = useRef(fetchCoilInfo);
  fetchCoilInfoRef.current = fetchCoilInfo;

  const handleScanEnter = useCallback((code) => {
    void fetchCoilInfoRef.current(code);
  }, []);

  function handleFinderCameraDecoded(decodedText) {
    setCameraOn(false);
    void fetchCoilInfoRef.current(decodedText);
  }

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: cameraOn,
    elementId: COIL_FINDER_SCANNER_ID,
    onDecoded: handleFinderCameraDecoded,
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: () => {
      showScanToast(
        "error",
        "camera-list",
        SCAN_SNACK_MSG.CAMERA_DENIED ?? SCAN_SNACK_MSG.CAMERA,
        4000
      );
      setCameraOn(false);
    },
  });

  const stopCamera = useCallback(() => {
    setCameraOn(false);
  }, []);

  const startCamera = () => {
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
      setLocationData(null);
      setCoilData(null);
      setCameraOn(true);
    })();
  };

  const handleClose = useCallback(() => {
    stopCamera();
    setLocationData(null);
    setCoilData(null);
    onClose();
  }, [onClose, stopCamera]);

  const isStored = !!coilData?.location_id;

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={handleClose}
        title="Coil Finder"
        description="Scan a coil QR code to view its location and details"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 pb-6">
          <div className="flex items-end gap-2">
            <div className="relative flex-1 space-y-2">
              <label className="text-xs font-medium text-slate-600 ml-1 block">Coil UID</label>
              {showLaserUi && (
                <LaserScanField
                  active={open && showLaserUi}
                  onScanned={handleScanEnter}
                  keyboardInputRef={keyboardInputRef}
                  formatPreview={coilUidDisplayLabel}
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
                <p className="text-xs text-slate-500 px-1">Enable the laser scanner or keyboard input in Settings.</p>
              )}
            </div>

            {showPhoneQr && (
              <button
                type="button"
                onClick={() => (cameraOn ? stopCamera() : startCamera())}
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
            readerId={COIL_FINDER_SCANNER_ID}
            hint="Scan the coil sticker"
            torchSupported={torchSupported}
            torchOn={torchOn}
            onToggleTorch={toggleTorch}
          />

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin text-indigo-500 mx-auto mb-3" size={32} />
              <p className="text-xs font-medium text-slate-500">Please wait…</p>
            </div>
          ) : coilData ? (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
              <div className={`p-3 rounded-xl border ${isStored ? "border-emerald-200 bg-emerald-50/80" : "border-indigo-200 bg-indigo-50/90"}`}>
                <div className="flex items-start gap-2">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                      isStored ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white"
                    }`}
                  >
                    <Layers size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-medium leading-none ${isStored ? "text-emerald-700" : "text-indigo-600"}`}>
                      This coil
                    </p>
                    <p className={`text-sm font-bold font-mono leading-tight break-all ${isStored ? "text-emerald-900" : "text-indigo-900"}`}>
                      {coilData.coil_no_uid}
                    </p>
                    <p className={`text-[11px] mt-1 ${isStored ? "text-emerald-700/80" : "text-indigo-700/80"}`}>
                      Heat <span className="font-mono font-semibold">{coilData.heat_no ?? "—"}</span>
                      <span className="mx-1 opacity-50">·</span>
                      Qty <span className="font-semibold">{coilData.qty ?? "—"}</span>
                    </p>
                    <div className="mt-2 pt-2 border-t border-indigo-100/90 space-y-2.5">
                      <IconLabeledRow icon={Package} label="Item" iconClass="text-indigo-500">
                        <span className="font-mono uppercase">{coilData.item_code || "—"}</span>
                        {coilData.item_desc ? (
                          <span className="block font-normal text-slate-600 mt-0.5">{coilData.item_desc}</span>
                        ) : null}
                      </IconLabeledRow>
                      <IconLabeledRow icon={MapPin} label="Zone" iconClass={isStored ? "text-emerald-500" : "text-blue-500"}>
                        <span>{isStored ? "Stored" : "Unassigned"}</span>
                      </IconLabeledRow>
                    </div>
                  </div>
                </div>
              </div>

              {locationData ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-xs font-semibold text-slate-800">Current location</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">Where this coil is stored now.</p>
                  </div>

                  <div className="flex items-center gap-2 px-1">
                    <MapPin size={14} className="text-emerald-600" />
                    <span className="text-xs font-medium text-slate-600">Coil is here</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-50/50">
                      <p className="text-[11px] text-emerald-600 font-medium mb-1">Location No.</p>
                      <p className="text-2xl font-bold text-emerald-900 leading-none font-mono tracking-tight">
                        {formatLocationNo(locationData)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-50/50">
                        <p className="text-[11px] text-emerald-600 font-medium mb-1">Rack</p>
                        <p className="text-2xl font-bold text-emerald-900 leading-none font-mono">{locationData.rack_no || "—"}</p>
                      </div>
                      <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-50/50">
                        <p className="text-[11px] text-emerald-600 font-medium mb-1">Row</p>
                        <p className="text-2xl font-bold text-emerald-900 leading-none font-mono">{locationData.row_no || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center bg-amber-50 rounded-2xl border border-dashed border-amber-200">
                  <Info size={24} className="text-amber-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-amber-800">Unassigned</p>
                  <p className="text-[10px] text-amber-700 mt-1 px-2">This coil is not linked to any location yet.</p>
                </div>
              )}
            </div>
          ) : (
            !cameraOn && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                  <Layers size={24} className="text-slate-200" />
                </div>
                <p className="text-sm font-medium text-slate-500">Scan or enter a coil UID to see where it is.</p>
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
