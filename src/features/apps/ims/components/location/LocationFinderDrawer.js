"use client";

import { useState, useRef, useCallback } from "react";
import { Loader2, ScanLine, CameraOff, MapPin, Info, Package, User, QrCode } from "lucide-react";
import Drawer from "@/core/components/ui/Drawer";
import Snackbar from "@/core/components/ui/Snackbar";
import { locationService } from "@/features/apps/ims/services/location";
import { boxService } from "@/features/apps/ims/services/box";
import { isMobileDevice } from "@/core/utils/pwa";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/core/utils/global";
import { extractBoxCode } from "@/features/apps/ims/helpers/qrScan";
import { playScanSuccessBeep, prepareQrScanSession } from "@/features/apps/ims/helpers/scanFeedback";
import { pickBoxFromViewsResponse } from "@/features/apps/ims/helpers/boxViewsLookup";
import { useHtml5QrScanner } from "@/core/hooks/useHtml5QrScanner";
import QrScannerOverlay from "@/core/components/common/QrScannerOverlay";

const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "info", title: "", message: "", duration: SNACK_DUR.med };
const LOCATION_FINDER_SCANNER_ID = "location-finder-scanner-reader";

const NO_SUITABLE_LOCATION_MSG = "No place found.";

const INWARD_BOX_VIEWS_BASE = {
  permission_module: "inventory_inwards",
  permission_action: "view",
  page: 1,
  limit: 1,
  include_suggested_inward_location: true,
};

const MATCH_TIER_UI = {
  1: {
    title: "Customer and item",
    line: "This rack is for this customer and this item.",
    listHeadline: "Put the box here",
    shell: "border-indigo-200 bg-indigo-50/95",
    pin: "text-indigo-500",
  },
  2: {
    title: "Customer only",
    line: "This rack is for this customer. Item is not fixed on the rack.",
    listHeadline: "Put the box here",
    shell: "border-violet-200 bg-violet-50/95",
    pin: "text-violet-600",
  },
  3: {
    title: "Item only",
    line: "This rack is for this item. Customer is not fixed on the rack.",
    listHeadline: "Put the box here",
    shell: "border-amber-200 bg-amber-50/95",
    pin: "text-amber-600",
  },
  4: {
    title: "Open places",
    line: "You can use any of these open places.",
    listHeadline: "Choose a place",
    shell: "border-teal-200 bg-teal-50/95",
    pin: "text-teal-600",
  },
};

function MatchTierCallout({ tier, openCount }) {
  if (tier === 1 || tier === 2 || tier === 3 || tier === 4) {
    const u = MATCH_TIER_UI[tier];
    const suffix = tier === 4 && openCount != null && openCount > 0 ? ` (${openCount})` : "";
    return (
      <div className={`rounded-xl border px-3 py-2.5 ${u.shell}`}>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs font-semibold text-slate-900">{u.title}</span>
          {tier === 4 && suffix ? <span className="text-[11px] font-mono text-slate-600">{suffix.trim()}</span> : null}
        </div>
        <p className="text-[11px] text-slate-600 mt-1 leading-snug">{u.line}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-xs font-semibold text-slate-800">From the box record</p>
      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">Showing the place already saved on this box.</p>
    </div>
  );
}

function tierPinClass(tier) {
  if (tier === 1 || tier === 2 || tier === 3 || tier === 4) return MATCH_TIER_UI[tier].pin;
  return "text-slate-500";
}

function tierListHeadline(tier, openCount) {
  if (tier === 4 && openCount > 0) return `${MATCH_TIER_UI[4].listHeadline} (${openCount} places)`;
  if (tier === 1 || tier === 2 || tier === 3 || tier === 4) return MATCH_TIER_UI[tier].listHeadline;
  return "Where to put the box";
}

function formatLocationNo(loc) {
  if (!loc) return "—";
  return loc.location_no || `${loc.rack_no || ""}${(loc.shelf_no || "").toString().toUpperCase()}` || "—";
}

function parseBoxSku(box) {
  if (!box) return { customer: null, itemCode: null, itemDesc: null };
  const customerRaw = [box.acc_name, box.override_cust, box.party_rate_cust_code].find(
    (x) => x != null && String(x).trim() !== ""
  );
  const customer = customerRaw != null ? String(customerRaw).trim() : null;
  const itemCode =
    box.item_code || box.item_name
      ? String(box.item_code || box.item_name).trim()
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
    return <p className="text-[11px] text-slate-500 px-0.5">Open place — no fixed customer or item.</p>;
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

export default function LocationFinderDrawer({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [locationList, setLocationList] = useState([]);
  const [boxData, setBoxData] = useState(null);
  const [matchTier, setMatchTier] = useState(null);
  const [suggestError, setSuggestError] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);

  const scanToastRef = useRef({});

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);

  const { showScanToast } = useScanSnackbarActions(setSnackbar, scanToastRef);

  const fetchBoxAndLocation = async (rawValue) => {
    const boxCode = extractBoxCode(rawValue);
    if (!boxCode) {
      showScanToast("error", "invalid-box-qr", SCAN_SNACK_MSG.REJECTED);
      return;
    }

    setLoading(true);
    setLocationList([]);
    setBoxData(null);
    setMatchTier(null);
    setSuggestError(null);

    const applyHierarchyResult = (box) => {
      if (!box || !Object.prototype.hasOwnProperty.call(box, "suggested_inward_locations")) {
        return false;
      }
      const locs = Array.isArray(box.suggested_inward_locations) ? box.suggested_inward_locations : [];
      setMatchTier(box.suggested_location_match_tier ?? null);
      if (locs.length > 0) {
        setLocationList(locs);
        setSuggestError(null);
      } else {
        setLocationList([]);
        const msg = box.suggested_location_message || NO_SUITABLE_LOCATION_MSG;
        setSuggestError(msg);
        showScanToast("error", "no-suitable-location", msg);
      }
      return true;
    };

    try {
      const boxRes = await boxService.getViews({
        ...INWARD_BOX_VIEWS_BASE,
        id: boxCode,
      });
      const box = pickBoxFromViewsResponse(boxRes);

      if (!box) {
        showScanToast("error", "box-not-found", "Box not found");
        setLoading(false);
        return;
      }

      setBoxData(box);

      if (applyHierarchyResult(box)) {
        if (Array.isArray(box.suggested_inward_locations) && box.suggested_inward_locations.length > 0) {
          void playScanSuccessBeep();
        }
        setLoading(false);
        return;
      }

      if (!box.location_id) {
        showScanToast("warning", "no-location-assigned", "This box has no saved place yet.");
        setLoading(false);
        return;
      }

      const locRes = await locationService.getViews({
        id: box.location_id,
        permission_module: "inventory_inwards",
        permission_action: "view",
      });
      if (locRes.data) {
        setLocationList([locRes.data]);
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

  function handleFinderCameraDecoded(decodedText) {
    setCameraOn(false);
    fetchBoxAndLocation(decodedText);
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
      setLocationList([]);
      setBoxData(null);
      setMatchTier(null);
      setSuggestError(null);
      setCameraOn(true);
    })();
  };

  const handleClose = () => {
    stopCamera();
    setLocationList([]);
    setBoxData(null);
    setMatchTier(null);
    setSuggestError(null);
    setSearchValue("");
    onClose();
  };

  return (
    <>
    <Drawer
      isOpen={open}
      onClose={handleClose}
      title="Find Location"
      description="Locate box in warehouse"
      maxWidth="max-w-md"
    >
      <div className="space-y-5 pb-6">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <label className="text-xs font-medium text-slate-600 ml-1 mb-1 block">Box code</label>
            <div className="relative">
              <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input
                type="text"
                placeholder="Type the code, then press Enter"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchValue.trim()) {
                    fetchBoxAndLocation(searchValue);
                  }
                }}
                className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
              />
            </div>
          </div>

          {isMobileDevice() && (
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
          hint="Scan the sticker"
          torchSupported={torchSupported}
          torchOn={torchOn}
          onToggleTorch={toggleTorch}
        />

        {/* Content Section */}
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

            {locationList.length > 0 ? (
              locationList.length === 1 ? (
              <div className="space-y-4">
                <MatchTierCallout tier={matchTier} openCount={1} />

                <div className="flex items-center gap-2 px-1">
                  <MapPin size={14} className={tierPinClass(matchTier)} />
                  <span className="text-xs font-medium text-slate-600">{tierListHeadline(matchTier, 1)}</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-50/50">
                    <p className="text-[11px] text-emerald-600 font-medium mb-1">Storage code</p>
                    <p className="text-2xl font-bold text-emerald-900 leading-none font-mono tracking-tight">
                      {formatLocationNo(locationList[0])}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-50/50">
                      <p className="text-[11px] text-emerald-600 font-medium mb-1">Rack</p>
                      <p className="text-2xl font-bold text-emerald-900 leading-none font-mono">{locationList[0].rack_no || "—"}</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-50/50">
                      <p className="text-[11px] text-emerald-600 font-medium mb-1">Shelf</p>
                      <p className="text-2xl font-bold text-emerald-900 leading-none font-mono">{locationList[0].shelf_no || "—"}</p>
                    </div>
                  </div>
                </div>

                <LocationRackDetail loc={locationList[0]} />
              </div>
              ) : (
              <div className="space-y-3">
                <MatchTierCallout tier={matchTier ?? 4} openCount={locationList.length} />

                <div className="flex items-center gap-2 px-1">
                  <MapPin size={14} className={tierPinClass(matchTier ?? 4)} />
                  <span className="text-xs font-medium text-slate-600">
                    {tierListHeadline(matchTier ?? 4, locationList.length)}
                  </span>
                </div>
                <div className="max-h-[min(24rem,55vh)] overflow-y-auto rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
                  {locationList.map((loc) => (
                    <div key={String(loc.location_id)} className="px-3 py-2.5 hover:bg-emerald-50/50 transition-colors">
                      <p className="text-sm font-semibold text-emerald-900 font-mono">{formatLocationNo(loc)}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Rack {loc.rack_no ?? "—"} · Shelf {loc.shelf_no ?? "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              )
            ) : suggestError ? (
              <div className="py-10 px-4 text-center bg-rose-50 rounded-2xl border border-rose-200">
                <Info size={24} className="text-rose-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">No place found</p>
                <p className="text-sm font-medium text-rose-700 mt-2 leading-relaxed">{suggestError}</p>
                <p className="text-[10px] text-rose-600/90 mt-2 leading-snug">Check Location Master or try another box.</p>
              </div>
            ) : (
              <div className="py-10 text-center bg-amber-50 rounded-2xl border border-dashed border-amber-200">
                <Info size={24} className="text-amber-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-amber-800">No place on this box</p>
                <p className="text-[10px] text-amber-700 mt-1 px-2">
                  We could not find a suggested place, and this box has no saved place yet.
                </p>
              </div>
            )}
          </div>
        ) : (
          !cameraOn && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Package size={24} className="text-slate-200" />
              </div>
              <p className="text-sm font-medium text-slate-500">Enter a box code above, or use the camera button.</p>
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
