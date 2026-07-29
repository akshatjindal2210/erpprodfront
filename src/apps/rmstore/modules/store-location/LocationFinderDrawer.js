"use client";

import { useState, useRef, useCallback } from "react";
import { Loader2, ScanLine, CameraOff, MapPin, Info, QrCode, Layers } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import { storeLocationService } from "@/apps/rmstore/lib/services/storeLocation";
import { coilService } from "@/apps/rmstore/lib/services/coil";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/platform/utils/global";
import { extractLocationNo, extractCoilUid, locationNoDisplayLabel, coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
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
const LOCATION_FINDER_SCANNER_ID = "rm-location-finder-scanner-reader";
const MODULE = "rm_inventory_inwards";

function formatLocationNo(loc) {
  if (!loc) return "—";
  return getLocationDisplayNo(loc);
}

function normalizeLoc(row) {
  if (!row || typeof row !== "object") return row;
  const location_id = row.location_id ?? row.id ?? null;
  return {
    ...row,
    id: location_id,
    location_id,
    location_no: formatLocationNo(row) === "—" ? "" : formatLocationNo(row),
  };
}

function pickLocationFromList(list, locationNo) {
  const target = String(locationNo || "").trim().toUpperCase();
  if (!target || !Array.isArray(list)) return null;
  return (
    list
      .map(normalizeLoc)
      .find((r) => String(r.location_no || "").trim().toUpperCase() === target) || null
  );
}

export default function LocationFinderDrawer({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [coilData, setCoilData] = useState(null);
  const [coilsAtLoc, setCoilsAtLoc] = useState([]);
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

  const clearResult = () => {
    setLocationData(null);
    setCoilData(null);
    setCoilsAtLoc([]);
  };

  const loadCoilsForLocation = async (locationId) => {
    if (!locationId) return [];
    try {
      const res = await coilService.getAll({
        filters: { location_id: Number(locationId) },
        page: 1,
        limit: 200,
        sortBy: "coil_uid",
        order: "DESC",
      });
      return Array.isArray(res?.data) ? res.data : [];
    } catch {
      return [];
    }
  };

  const resolveLocation = async (locationNo) => {
    let matched = null;

    if (/^\d+$/.test(locationNo)) {
      const byId = await storeLocationService.getViews({
        id: Number(locationNo),
        permission_module: MODULE,
        permission_action: "view",
      });
      if (byId?.data) matched = normalizeLoc(byId.data);
      if (!matched) {
        try {
          const getRes = await storeLocationService.getById(Number(locationNo));
          if (getRes?.data) matched = normalizeLoc(getRes.data);
        } catch {
          /* ignore */
        }
      }
    }

    if (!matched) {
      const listRes = await storeLocationService.getViews({
        search: locationNo,
        permission_module: MODULE,
        permission_action: "view",
        page: 1,
        limit: 50,
        sortBy: "location_no",
        order: "ASC",
      });
      const list = Array.isArray(listRes?.data) ? listRes.data : [];
      matched = pickLocationFromList(list, locationNo);
      if (!matched && list.length === 1) matched = normalizeLoc(list[0]);
    }

    if (!matched) {
      const filterRes = await storeLocationService.getViews({
        filters: { location_no: locationNo },
        permission_module: MODULE,
        permission_action: "view",
        page: 1,
        limit: 10,
      });
      const filterList = Array.isArray(filterRes?.data) ? filterRes.data : [];
      matched =
        pickLocationFromList(filterList, locationNo) ||
        (filterList[0] ? normalizeLoc(filterList[0]) : null);
    }

    return matched;
  };

  const fetchFinderInfo = async (rawValue) => {
    const coilUid = extractCoilUid(rawValue);
    const locationNo = coilUid ? null : extractLocationNo(rawValue);

    if (!coilUid && !locationNo) {
      showScanToast("error", "invalid-qr", SCAN_SNACK_MSG.REJECTED);
      return;
    }

    setLoading(true);
    clearResult();

    try {
      // IMS-style: scan coil → show where it is stored
      if (coilUid) {
        const coilRes = await coilService.getByUid(coilUid);
        const coil = coilRes?.data;
        if (!coil) {
          showScanToast("error", "coil-not-found", "Coil not found. Check the UID and try again.");
          return;
        }
        setCoilData(coil);

        if (!coil.location_id) {
          showScanToast("warning", "no-loc", "This coil is unassigned and not stored yet.", 3500);
          void playScanSuccessBeep();
          return;
        }

        let loc = null;
        try {
          const locRes = await storeLocationService.getById(coil.location_id);
          loc = locRes?.data ? normalizeLoc(locRes.data) : null;
        } catch {
          loc = null;
        }
        if (!loc?.location_id) {
          const viewsRes = await storeLocationService.getViews({
            id: Number(coil.location_id),
            permission_module: MODULE,
            permission_action: "view",
          });
          loc = viewsRes?.data ? normalizeLoc(viewsRes.data) : null;
        }

        if (!loc?.location_id) {
          showScanToast("error", "loc-missing", "Saved location was not found in the location list.");
          return;
        }

        setLocationData(loc);
        setCoilsAtLoc(await loadCoilsForLocation(loc.location_id));
        void playScanSuccessBeep();
        return;
      }

      // Location scan → location + coils on rack
      const matched = await resolveLocation(locationNo);
      if (!matched) {
        showScanToast("error", "location-not-found", "Location not found. Check the location number and try again.");
        return;
      }

      setLocationData(matched);
      setCoilsAtLoc(await loadCoilsForLocation(matched.location_id));
      void playScanSuccessBeep();
    } catch (err) {
      showScanToast("error", "fetch-error", err?.message || "Could not load the location details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFinderInfoRef = useRef(fetchFinderInfo);
  fetchFinderInfoRef.current = fetchFinderInfo;

  const handleScanEnter = useCallback((code) => {
    void fetchFinderInfoRef.current(code);
  }, []);

  function handleFinderCameraDecoded(decodedText) {
    setCameraOn(false);
    void fetchFinderInfoRef.current(decodedText);
  }

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: cameraOn,
    elementId: LOCATION_FINDER_SCANNER_ID,
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
      clearResult();
      setCameraOn(true);
    })();
  };

  const handleClose = useCallback(() => {
    stopCamera();
    clearResult();
    onClose();
  }, [onClose, stopCamera]);

  const previewLabel = (raw) => {
    const coil = extractCoilUid(raw);
    if (coil) return coilUidDisplayLabel(raw);
    return locationNoDisplayLabel(raw);
  };

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={handleClose}
        title="Location Finder"
        description="Scan a coil sticker or a location number"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 pb-6">
          <div className="flex items-end gap-2">
            <div className="relative flex-1 space-y-2">
              <label className="text-xs font-medium text-slate-600 ml-1 block">Coil / Location</label>
              {showLaserUi && (
                <LaserScanField
                  active={open && showLaserUi}
                  onScanned={handleScanEnter}
                  keyboardInputRef={keyboardInputRef}
                  formatPreview={previewLabel}
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
            readerId={LOCATION_FINDER_SCANNER_ID}
            hint="Scan coil or location sticker"
            torchSupported={torchSupported}
            torchOn={torchOn}
            onToggleTorch={toggleTorch}
          />

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin text-indigo-500 mx-auto mb-3" size={32} />
              <p className="text-xs font-medium text-slate-500">Please wait…</p>
            </div>
          ) : locationData || coilData ? (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
              {coilData && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-indigo-700 mb-1 flex items-center gap-1">
                    <Layers size={12} /> Coil
                  </p>
                  <p className="text-sm font-bold font-mono text-slate-900">{coilData.coil_no_uid}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {coilData.item_code || "—"}
                    {coilData.heat_no ? ` · Heat ${coilData.heat_no}` : ""}
                    {coilData.qty != null ? ` · Qty ${Number(coilData.qty).toLocaleString()}` : ""}
                  </p>
                </div>
              )}

              {locationData ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-xs font-semibold text-slate-800">Location found</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">RM store rack / row details.</p>
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

                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <p className="text-[11px] font-bold text-slate-700 uppercase">Coils here</p>
                      <span className="text-[10px] font-bold text-slate-500">{coilsAtLoc.length}</span>
                    </div>
                    {coilsAtLoc.length === 0 ? (
                      <p className="px-3 py-4 text-[11px] text-slate-400">No coils are stored at this location.</p>
                    ) : (
                      <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {coilsAtLoc.map((c) => (
                          <li key={c.coil_no_uid || c.coil_uid} className="px-3 py-2">
                            <p className="text-[11px] font-mono font-bold text-slate-800">{c.coil_no_uid}</p>
                            <p className="text-[10px] text-slate-500">
                              {c.item_code || "—"}
                              {c.qty != null ? ` · ${Number(c.qty).toLocaleString()}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-xs font-semibold text-amber-800">Not stored yet</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">This coil is unassigned — not linked to a location yet.</p>
                </div>
              )}
            </div>
          ) : (
            !cameraOn && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                  <MapPin size={24} className="text-slate-200" />
                </div>
                <p className="text-sm font-medium text-slate-500">Scan a coil or location number to look it up.</p>
                <p className="text-[10px] text-slate-400 mt-2 flex items-center justify-center gap-1">
                  <Info size={12} /> Coil sticker or location number (for example, RM-01A)
                </p>
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
