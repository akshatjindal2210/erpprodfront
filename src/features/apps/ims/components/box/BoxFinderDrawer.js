"use client";

import { useState, useRef, useCallback } from "react";
import { Loader2, ScanLine, CameraOff, MapPin, Info, Package, User, QrCode } from "lucide-react";
import Drawer from "@/core/components/ui/Drawer";
import Snackbar from "@/core/components/ui/Snackbar";
import { locationService } from "@/features/apps/ims/services/location";
import { boxService } from "@/features/apps/ims/services/box";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/core/utils/global";
import { extractBoxCode, boxNoUidDisplayLabel } from "@/features/apps/ims/helpers/qrScan";
import { playScanSuccessBeep, prepareQrScanSession } from "@/features/apps/ims/helpers/scanFeedback";
import { pickBoxFromViewsResponse } from "@/features/apps/ims/helpers/boxViewsLookup";
import { useHtml5QrScanner } from "@/core/hooks/useHtml5QrScanner";
import { useDeviceScanSettings } from "@/core/hooks/useDeviceScanSettings";
import ScanEnterInput from "@/core/components/common/ScanEnterInput";
import LaserScanField from "@/core/components/common/LaserScanField";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/core/utils/deviceScanSettings";
import QrScannerOverlay from "@/core/components/common/QrScannerOverlay";

const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "info", title: "", message: "", duration: SNACK_DUR.med };
const BOX_FINDER_SCANNER_ID = "box-finder-scanner-reader";

const BOX_FINDER_VIEWS_BASE = {
  permission_module: "boxes",
  permission_action: "view",
  page: 1,
  limit: 1,
};

function formatLocationNo(loc) {
  if (!loc) return "—";
  return loc.location_no || `${loc.rack_no || ""}${(loc.shelf_no || "").toString().toUpperCase()}` || "—";
}

function parseBoxSku(box) {
  if (!box) return { customer: null, itemCode: null, itemDesc: null };
  const customerRaw = [box.acc_name, box.override_cust, box.party_rate_cust_code].find(
    (x) => x != null && String(x).trim() !== "" && String(x).trim() !== "—"
  );
  const customer = customerRaw != null ? String(customerRaw).trim() : null;
  const itemCode =
    box.item_code != null && String(box.item_code).trim() !== ""
      ? String(box.item_code).trim()
      : box.item_name != null && String(box.item_name).trim() !== ""
        ? String(box.item_name).trim()
        : box.itemdcode != null || box.item_dcode != null
          ? String(box.itemdcode ?? box.item_dcode).trim()
          : null;
  const rawDesc = box.item_desc ?? box.itemdesc;
  const itemDesc = rawDesc != null && String(rawDesc).trim() !== "" ? String(rawDesc).trim() : null;
  return { customer, itemCode, itemDesc };
}

function parseLocationSku(loc) {
  if (!loc) return { customer: null, itemCode: null, itemDesc: null };
  const customer = loc.acc_name != null && String(loc.acc_name).trim() !== "" ? String(loc.acc_name).trim() : null;
  const itemCode =
    loc.item_code != null && String(loc.item_code).trim() !== ""
      ? String(loc.item_code).trim()
      : loc.item_dcode != null && String(loc.item_dcode).trim() !== ""
        ? String(loc.item_dcode).trim()
        : null;
  const itemDesc = loc.item_desc != null && String(loc.item_desc).trim() !== "" ? String(loc.item_desc).trim() : null;
  return { customer, itemCode, itemDesc };
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

function BoxSkuBlock({ box }) {
  const { customer, itemCode, itemDesc } = parseBoxSku(box);
  if (!customer && !itemCode && !itemDesc) return null;
  return (
    <div className="mt-2 pt-2 border-t border-indigo-100/90 space-y-2.5">
      <IconLabeledRow icon={User} label="Customer" iconClass="text-indigo-500">
        <span className="break-words font-semibold">{customer || "—"}</span>
      </IconLabeledRow>
      <IconLabeledRow icon={Package} label="Item code" iconClass="text-indigo-500">
        <span className="font-mono">{itemCode || "—"}</span>
      </IconLabeledRow>
      <IconLabeledRow icon={Info} label="Item description" iconClass="text-indigo-400">
        <span className="font-normal">{itemDesc || "—"}</span>
      </IconLabeledRow>
    </div>
  );
}

function LocationRackDetail({ loc }) {
  const { customer, itemCode, itemDesc } = parseLocationSku(loc);
  const noCust = !customer;
  const noItem = !itemCode && !itemDesc;
  if (noCust && noItem && !loc.location_description) {
    return (
      <p className="text-[11px] text-slate-500 px-0.5">
        This rack has no fixed customer or item — any box can be stored here.
      </p>
    );
  }
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
      <IconLabeledRow icon={User} label="Customer" iconClass="text-slate-400">
        <span className="break-words">{customer || "—"}</span>
      </IconLabeledRow>
      <IconLabeledRow icon={Package} label="Item code" iconClass="text-slate-400">
        <span className="font-mono">{itemCode || "—"}</span>
      </IconLabeledRow>
      <IconLabeledRow icon={Info} label="Item description" iconClass="text-slate-400">
        <span className="font-normal">{itemDesc || "—"}</span>
      </IconLabeledRow>
      {loc.location_description ? (
        <div className="flex items-start gap-2.5 pt-2 border-t border-slate-50">
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400">
            <MapPin size={16} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-slate-500 mb-0.5">Extra note</p>
            <p className="text-xs text-slate-600 leading-relaxed italic line-clamp-4">{loc.location_description}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function BoxFinderDrawer({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [boxData, setBoxData] = useState(null);
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

  const fetchBoxInfo = async (rawValue) => {
    const boxCode = extractBoxCode(rawValue);
    if (!boxCode) {
      showScanToast("error", "invalid-box-qr", SCAN_SNACK_MSG.REJECTED);
      return;
    }

    setLoading(true);
    setLocationData(null);
    setBoxData(null);

    try {
      const boxRes = await boxService.getViews({
        ...BOX_FINDER_VIEWS_BASE,
        id: boxCode,
      });
      const box = pickBoxFromViewsResponse(boxRes);

      if (!box) {
        showScanToast("error", "box-not-found", "Box not found");
        return;
      }

      setBoxData(box);

      const locationId = box.location_id;
      if (!locationId) {
        showScanToast("warning", "no-location-assigned", "This box has no saved place yet.");
        void playScanSuccessBeep();
        return;
      }

      const locRes = await locationService.getViews({
        id: locationId,
        permission_module: "boxes",
        permission_action: "view",
      });
      if (locRes.data) {
        setLocationData(locRes.data);
        void playScanSuccessBeep();
      } else {
        showScanToast("error", "assigned-location-not-found", "Saved place not found in the list.");
      }
    } catch (err) {
      showScanToast("error", "fetch-error", err?.message || "Error fetching details");
    } finally {
      setLoading(false);
    }
  };

  const fetchBoxInfoRef = useRef(fetchBoxInfo);
  fetchBoxInfoRef.current = fetchBoxInfo;

  const handleScanEnter = useCallback((code) => {
    void fetchBoxInfoRef.current(code);
  }, []);

  function handleFinderCameraDecoded(decodedText) {
    setCameraOn(false);
    void fetchBoxInfoRef.current(decodedText);
  }

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: cameraOn,
    elementId: BOX_FINDER_SCANNER_ID,
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
      setBoxData(null);
      setCameraOn(true);
    })();
  };

  const handleClose = useCallback(() => {
    stopCamera();
    setLocationData(null);
    setBoxData(null);
    onClose();
  }, [onClose, stopCamera]);

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={handleClose}
        title="Box Finder"
        description="Scan box QR to see location and customer"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 pb-6">
          <div className="flex items-end gap-2">
            <div className="relative flex-1 space-y-2">
              <label className="text-xs font-medium text-slate-600 ml-1 block">Box code</label>
              {showLaserUi && (
                <LaserScanField
                  active={open && showLaserUi}
                  onScanned={handleScanEnter}
                  keyboardInputRef={keyboardInputRef}
                  formatPreview={boxNoUidDisplayLabel}
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
                <p className="text-xs text-slate-500 px-1">Enable Laser scanner or Keyboard type in Settings.</p>
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
            readerId={BOX_FINDER_SCANNER_ID}
            hint="Scan the box sticker"
            torchSupported={torchSupported}
            torchOn={torchOn}
            onToggleTorch={toggleTorch}
          />

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin text-indigo-500 mx-auto mb-3" size={32} />
              <p className="text-xs font-medium text-slate-500">Please wait…</p>
            </div>
          ) : boxData ? (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                <div className="flex items-start gap-2">
                  <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Package size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-indigo-600 leading-none">This box</p>
                    <p className="text-sm font-bold text-indigo-950 font-mono leading-tight">{boxData.box_no_uid}</p>
                    <p className="text-[11px] text-indigo-900/90 mt-1">
                      Packing no. <span className="font-mono font-semibold">{boxData.packing_number ?? "—"}</span>
                      <span className="text-indigo-400 mx-1">·</span>
                      Qty <span className="font-semibold">{boxData.qty ?? "—"}</span>
                    </p>
                    <BoxSkuBlock box={boxData} />
                  </div>
                </div>
              </div>

              {locationData ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-xs font-semibold text-slate-800">Current location</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">Where this box is stored now.</p>
                  </div>

                  <div className="flex items-center gap-2 px-1">
                    <MapPin size={14} className="text-emerald-600" />
                    <span className="text-xs font-medium text-slate-600">Box is here</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-50/50">
                      <p className="text-[11px] text-emerald-600 font-medium mb-1">Storage code</p>
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
                        <p className="text-[11px] text-emerald-600 font-medium mb-1">Shelf</p>
                        <p className="text-2xl font-bold text-emerald-900 leading-none font-mono">{locationData.shelf_no || "—"}</p>
                      </div>
                    </div>
                  </div>

                  <LocationRackDetail loc={locationData} />
                </div>
              ) : (
                <div className="py-10 text-center bg-amber-50 rounded-2xl border border-dashed border-amber-200">
                  <Info size={24} className="text-amber-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-amber-800">No place on this box</p>
                  <p className="text-[10px] text-amber-700 mt-1 px-2">This box is not linked to any location yet.</p>
                </div>
              )}
            </div>
          ) : (
            !cameraOn && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                  <Package size={24} className="text-slate-200" />
                </div>
                <p className="text-sm font-medium text-slate-500">Scan or enter a box code to see where it is.</p>
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
