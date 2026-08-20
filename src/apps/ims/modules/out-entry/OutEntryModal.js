"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "@/platform/store/slices/authSlice";
import { Check, AlertCircle, Loader2, Shield, Hash, Truck, User, Package, ChevronRight, CheckCircle2, QrCode, ScanLine, Camera, X, MapPin, CheckCircle, LogOut } from "lucide-react";
import { toast } from "react-toastify";
// Services & Components
import { outEntryService } from "@/apps/ims/lib/services/outEntry";
import { forwardingNoteService } from "@/apps/ims/lib/services/forwardingNote";
import { qcHoldMaterialService } from "@/apps/ims/lib/services/qcHoldMaterial";
import { masterService } from "@/apps/ims/lib/services/master";
import Drawer from "@/ui/primitives/Drawer";
import { ERR_INPUT, FORM_LABEL_CLASS, OK_INPUT } from "@/ui/common/Constants";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import Snackbar from "@/ui/primitives/Snackbar";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { SCAN_SNACK_MSG, notifyDecodeSuppressedScan, markRecentScanSuccess, shouldSilenceScanDuplicate, useScanSnackbarActions } from "@/platform/utils/global";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import { isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { detectQrType, parseBoxScanRaw, parseStickerScan, boxNoUidDisplayLabel } from "@/apps/ims/lib/helpers/qrScan";
import { prepareQrScanSession } from "@/platform/utils/global/scanFeedback";
import { createScanBatchQueue } from "@/apps/ims/lib/helpers/scanBatchQueue";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import { focusFirstError } from "@/platform/utils/form/formFocus";
import { boxInventoryStatus, isBoxAvailableForOutEntryScan, isStockAdjustmentOut, outEntryBoxStatusLabel } from "@/apps/ims/lib/utils/boxInventory";
import {
  buildOutEntryPackingGroups,
  buildOutEntryScanCodeIndex,
  countScannedFulfillmentByPacking,
  findActivePackingIdxForScanned,
  findFirstIncompletePackingIdx,
  findNextIncompletePackingIdx,
  findPackingGroupByNumber,
  getOutEntryPackingProgressList,
  getOutEntryGlobalScanTotals,
  collectForwardingNoteBoxUids,
  packingKey,
  isOutEntryFulfillmentComplete,
  OUT_ENTRY_APPROVE_BLOCKED_MSG,
} from "@/apps/ims/lib/utils/outEntryFulfillment";
import {
  OUT_ENTRY_TYPE,
  OUT_ENTRY_MODE_PICKER_OPTIONS,
  getOutEntryModePickerOption,
  isOutEntryAutoAuthorized,
  isOutEntryInventoryOut,
  isOutEntryQcArea,
  isOutEntrySimpleScanMode,
  pickerIdFromEntryType,
} from "@/apps/ims/lib/utils/outEntryTypes";
import { canApproveInventoryOut, canCreateInventoryOut } from "@/apps/ims/lib/utils/imsSpecialPermissions";
import { mapQcHoldSelectRow } from "@/apps/ims/lib/utils/qcHoldTypes";
import { withSortedViewsData } from "@/apps/ims/lib/helpers/sortDropdownResponse";
import { isForwardingLooseBox } from "@/platform/utils/core/utilHelper";

const OUT_ENTRY_SCANNER_ID = "out-entry-scanner-reader";
const FIELD_ORDER = ["fuid"];
const SIMPLE_SCAN_FIELD_ORDER = ["reason"];

const INITIAL_FORM = {
  fuid: "",
  qc_hold_id: "",
  reason: "",
  item_dcode: "",
  remarks: "",
  approved: false,
};
const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "info", title: "", message: "", duration: SNACK_DUR.med };
const PICKER_ICONS = { truck: Truck, "log-out": LogOut, package: Package, shield: Shield };
const PICKER_ACCENT = {
  red: {
    card: "border-red-200 bg-red-50/60 hover:border-red-400 hover:bg-red-50",
    title: "text-red-800",
    banner: "border-red-200 bg-red-50 text-red-900",
    submit: "bg-red-600 shadow-red-100 hover:bg-red-700",
  },
  yellow: {
    card: "border-yellow-300 bg-yellow-50/60 hover:border-yellow-400 hover:bg-yellow-50",
    title: "text-yellow-900",
    banner: "border-yellow-300 bg-yellow-50 text-yellow-900",
    submit: "bg-yellow-600 shadow-yellow-100 hover:bg-yellow-700",
  },
  indigo: {
    card: "border-indigo-200 bg-indigo-50/60 hover:border-indigo-400 hover:bg-indigo-50",
    title: "text-indigo-900",
    banner: "border-indigo-200 bg-indigo-50 text-indigo-900",
    submit: "bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700",
  },
};

function buildQcHoldBoxIndex(boxes = []) {
  const map = new Map();
  for (const box of boxes) {
    if (!box?.box_no_uid || box.is_needs_scan === false || box.is_released) continue;
    map.set(String(box.box_no_uid).toLowerCase(), box);
  }
  return map;
}

function normalizeIsLoose(val) {
  return val === true || val === 1 || val === "true" || val === "1";
}

/** Forwarding-note box — same open/loose rules as forwarding modal (incl. sticker snapshot). */
function isFnLooseBox(box) {
  return isForwardingLooseBox(box);
}

function countQcHoldBoxKinds(boxes = []) {
  let full = 0;
  let loose = 0;
  for (const box of boxes) {
    if (box?.is_needs_scan === false || box?.is_released) continue;
    if (normalizeIsLoose(box?.is_loose)) loose += 1;
    else full += 1;
  }
  return { full, loose, total: full + loose };
}

function BoxKindBadge({ isLoose, size = "md" }) {
  const loose = normalizeIsLoose(isLoose);
  const sizeClass = size === "sm" ? "w-5 h-5 text-[8px]" : "w-8 h-8 text-[10px]";
  return (
    <div
      className={`${sizeClass} rounded-lg flex items-center justify-center font-black shrink-0 ${
        loose ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
      }`}
      title={loose ? "Loose (L)" : "Full box (B)"}
    >
      {loose ? "L" : "B"}
    </div>
  );
}

function groupInventoryBoxesByPacking(boxes = []) {
  const groups = new Map();
  for (const box of boxes) {
    const pn = String(box?.packing_number ?? "").trim() || "—";
    if (!groups.has(pn)) {
      groups.set(pn, { packing_number: pn, boxes: [], qty: 0, full: 0, loose: 0 });
    }
    const g = groups.get(pn);
    g.boxes.push(box);
    g.qty += Number(box?.qty) || 0;
    if (normalizeIsLoose(box?.is_loose)) g.loose += 1;
    else g.full += 1;
  }
  return [...groups.values()].sort((a, b) => {
    const na = Number(a.packing_number);
    const nb = Number(b.packing_number);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a.packing_number).localeCompare(String(b.packing_number));
  });
}

/** Read-only in-stock boxes for selected Inventory Out item (info only — user still types box_no_uid to ADD). */
function CollapsibleInventoryItemBoxes({
  itemLabel,
  boxes = [],
  scannedIds,
  loading = false,
}) {
  const [open, setOpen] = useState(true);
  const [expandedPackings, setExpandedPackings] = useState(() => new Set());
  const { full, loose, total } = countQcHoldBoxKinds(boxes);
  const scannedSet = scannedIds instanceof Set ? scannedIds : new Set();
  const totalQty = useMemo(
    () => (boxes || []).reduce((sum, b) => sum + (Number(b?.qty) || 0), 0),
    [boxes]
  );
  const packingGroups = useMemo(() => groupInventoryBoxesByPacking(boxes), [boxes]);
  const packingCount = packingGroups.length;

  useEffect(() => {
    // New item / stock reload → open first packing only so long lists stay manageable.
    if (!packingGroups.length) {
      setExpandedPackings(new Set());
      return;
    }
    setExpandedPackings(new Set([packingGroups[0].packing_number]));
  }, [itemLabel, packingGroups]);

  const togglePacking = useCallback((packingNumber) => {
    setExpandedPackings((prev) => {
      const next = new Set(prev);
      if (next.has(packingNumber)) next.delete(packingNumber);
      else next.add(packingNumber);
      return next;
    });
  }, []);

  const expandAllPackings = useCallback(() => {
    setExpandedPackings(new Set(packingGroups.map((g) => g.packing_number)));
  }, [packingGroups]);

  const collapseAllPackings = useCallback(() => {
    setExpandedPackings(new Set());
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-indigo-600 shrink-0" />
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
          Loading in-stock boxes…
        </p>
      </div>
    );
  }

  if (!itemLabel) return null;

  const allPackingsOpen = packingCount > 0 && expandedPackings.size === packingCount;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Collapse in-stock boxes" : "Expand in-stock boxes"}
        onClick={() => setOpen((p) => !p)}
        className={`w-full px-3 py-2 flex items-start gap-2 text-left hover:bg-slate-50/80 transition-colors ${open ? "border-b border-slate-100" : ""}`}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Package size={13} className="text-indigo-500 shrink-0" aria-hidden />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide shrink-0">
              In stock
            </span>
            <span className="text-[11px] font-bold text-slate-800 truncate">{itemLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-[9px] font-black text-indigo-700 tabular-nums">
              {packingCount} packing{packingCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-black text-slate-600 tabular-nums">
              {total} boxes
            </span>
            {full > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-[9px] font-black text-emerald-700 tabular-nums">
                {full} full
              </span>
            ) : null}
            {loose > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-[9px] font-black text-amber-700 tabular-nums">
                {loose} loose
              </span>
            ) : null}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-black text-slate-600 tabular-nums">
              Qty {totalQty.toLocaleString()}
            </span>
          </div>
        </div>
        <span className="shrink-0 mt-0.5 px-1.5 py-0.5 text-[8px] font-bold uppercase border rounded bg-slate-50 text-slate-500 border-slate-200">
          Info
        </span>
        <ChevronRight
          className={`text-slate-400 shrink-0 mt-0.5 transition-transform ${open ? "rotate-90" : ""}`}
          size={14}
        />
      </button>

      {open ? (
        <div className="bg-slate-50/40 max-h-[min(42dvh,340px)] overflow-y-auto custom-scrollbar">
          {boxes.length ? (
            <div>
              {packingCount > 1 ? (
                <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50/95 border-b border-slate-100 backdrop-blur-sm">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                    {packingCount} packing nos
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (allPackingsOpen) collapseAllPackings();
                      else expandAllPackings();
                    }}
                    className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800"
                  >
                    {allPackingsOpen ? "Collapse all" : "Expand all"}
                  </button>
                </div>
              ) : null}

              <div className="divide-y divide-slate-100">
                {packingGroups.map((group) => {
                  const isPackingOpen = expandedPackings.has(group.packing_number);
                  const scannedInGroup = group.boxes.filter((b) =>
                    scannedSet.has(String(b.box_no_uid || ""))
                  ).length;
                  return (
                    <div key={group.packing_number} className="bg-white/60">
                      <button
                        type="button"
                        aria-expanded={isPackingOpen}
                        aria-label={`${isPackingOpen ? "Collapse" : "Expand"} packing ${group.packing_number}`}
                        onClick={() => togglePacking(group.packing_number)}
                        className="w-full px-2.5 py-2 flex items-center gap-2 text-left hover:bg-white transition-colors"
                      >
                        <ChevronRight
                          className={`text-slate-400 shrink-0 transition-transform ${isPackingOpen ? "rotate-90" : ""}`}
                          size={14}
                        />
                        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-800">
                            <Hash size={11} className="text-slate-400" aria-hidden />
                            <span className="tabular-nums">{group.packing_number}</span>
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase">
                            {group.boxes.length} box{group.boxes.length === 1 ? "" : "es"}
                          </span>
                          {group.full > 0 ? (
                            <span className="text-[8px] font-black text-emerald-600 tabular-nums">
                              {group.full} full
                            </span>
                          ) : null}
                          {group.loose > 0 ? (
                            <span className="text-[8px] font-black text-amber-600 tabular-nums">
                              {group.loose} loose
                            </span>
                          ) : null}
                          {scannedInGroup > 0 ? (
                            <span className="text-[8px] font-black text-emerald-700 uppercase">
                              {scannedInGroup} added
                            </span>
                          ) : null}
                        </div>
                        <span className="text-[9px] font-black text-slate-500 tabular-nums shrink-0">
                          Qty {group.qty.toLocaleString()}
                        </span>
                      </button>

                      {isPackingOpen ? (
                        <div className="px-2 pb-2">
                          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-50">
                            {group.boxes.map((box) => {
                              const uid = String(box.box_no_uid || "");
                              const isScanned = scannedSet.has(uid);
                              const isLoose = normalizeIsLoose(box.is_loose);
                              return (
                                <div
                                  key={uid}
                                  className={`px-2.5 py-2 flex items-start gap-2.5 min-w-0 ${
                                    isScanned ? "bg-emerald-50/80" : ""
                                  }`}
                                >
                                  <BoxKindBadge isLoose={isLoose} size="sm" />
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <span
                                        className="text-[11px] font-mono font-black text-slate-800 break-all leading-snug"
                                        title={uid}
                                      >
                                        {boxNoUidDisplayLabel(uid) || uid}
                                      </span>
                                      {isScanned ? (
                                        <span className="inline-flex items-center gap-0.5 shrink-0 text-[8px] font-black uppercase text-emerald-700">
                                          <CheckCircle2 size={11} aria-hidden />
                                          Added
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-600">
                                        <span className="text-slate-400 uppercase tracking-wide">Qty</span>
                                        <span className="tabular-nums font-black text-slate-800">
                                          {(Number(box.qty) || 0).toLocaleString()}
                                        </span>
                                      </span>
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                          isLoose
                                            ? "bg-amber-50 text-amber-700"
                                            : "bg-emerald-50 text-emerald-700"
                                        }`}
                                      >
                                        {isLoose ? "Loose" : "Full"}
                                      </span>
                                      {box.location_no ? (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-600">
                                          <MapPin size={10} className="shrink-0" aria-hidden />
                                          {box.location_no}
                                        </span>
                                      ) : (
                                        <span className="text-[8px] font-bold text-slate-300 uppercase">
                                          No location
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center py-6">
              No in-stock boxes for this item
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CollapsibleQcHoldBoxes({ hold, boxes = [], scannedCount = 0, packingAreaBoxCount = 0 }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [hold?.hold_id]);

  if (!hold) return null;

  const item = hold.item_code || hold.item_dcode || "—";
  const { full, loose, total } = countQcHoldBoxKinds(boxes);
  const scanTotal = total || Number(hold.store_box_count) || 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Collapse QC hold boxes" : "Expand QC hold boxes"}
        onClick={() => setOpen((p) => !p)}
        className={`w-full px-2.5 py-1.5 flex items-center gap-1.5 text-left hover:bg-slate-50 transition-colors min-h-[40px] ${open ? "border-b border-slate-100" : ""}`}
      >
        <span className="text-[11px] flex-1 truncate min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">QC hold:</span>
          <span className="font-bold text-slate-800">#{hold.hold_id}</span>
          <span className="text-slate-300 hidden sm:inline">·</span>
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Packing:</span>
          <span className="font-bold text-slate-800">#{hold.packing_number || "—"}</span>
          <span className="text-slate-300 hidden sm:inline">·</span>
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Item:</span>
          <span className="font-bold text-slate-800">{item}</span>
          <span className="text-slate-300 hidden sm:inline">·</span>
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">In store:</span>
          <span className="font-bold text-slate-800 tabular-nums">{scanTotal}</span>
          {full > 0 ? (
            <>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <span className="text-[9px] font-bold text-emerald-700 tabular-nums" title="Full boxes">
                {full} B
              </span>
            </>
          ) : null}
          {loose > 0 ? (
            <>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <span className="text-[9px] font-bold text-amber-700 tabular-nums" title="Loose boxes">
                {loose} L
              </span>
            </>
          ) : null}
          {packingAreaBoxCount > 0 ? (
            <>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <span className="text-[9px] font-semibold text-indigo-500 uppercase tracking-wide">QC area:</span>
              <span className="font-bold text-indigo-700 tabular-nums" title="Already in packing / QC area — no scan needed">
                {packingAreaBoxCount} auto
              </span>
            </>
          ) : null}
        </span>
        <span
          className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase border rounded ${
            scannedCount > 0
              ? "bg-amber-50 text-amber-800 border-amber-200"
              : "bg-slate-50 text-slate-500 border-slate-200"
          }`}
        >
          {scannedCount}/{scanTotal} scanned
        </span>
        <ChevronRight
          className={`text-slate-400 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          size={14}
        />
      </button>

      {open ? (
        <div className="px-2 pb-2 pt-1.5 max-h-[min(28dvh,220px)] overflow-y-auto custom-scrollbar">
          {boxes.length ? (
            <div className="flex flex-wrap gap-1">
              {boxes.map((box) => (
                <div
                  key={box.box_no_uid}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border flex items-center gap-1 max-w-full ${
                    box.is_scanned
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : box.is_released
                        ? "bg-slate-50 text-slate-500 border-slate-200"
                        : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  <BoxKindBadge isLoose={box.is_loose} size="sm" />
                  {box.is_scanned ? <CheckCircle2 size={10} className="shrink-0" aria-hidden /> : null}
                  <span className="truncate">{box.box_no_uid}</span>
                  {box.location_no ? (
                    <span className="text-[7px] font-sans font-semibold text-indigo-600 uppercase shrink-0">
                      @ {box.location_no}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 italic px-0.5">
              {packingAreaBoxCount > 0
                ? "All hold boxes are already in QC area — nothing to scan from store."
                : "No in-store boxes on this hold."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function OutEntryModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const user = useSelector(selectUser);
  const canAccess = useCanAccess();
  const canRemoveScannedBox = canAccess("out_entry", "delete").allowed;

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";

  const [loading, setLoading] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [fetchingFuid, setFetchingFuid] = useState(false);
  const [fuidDetails, setFuidDetails] = useState(null);
  const [qcHoldDetails, setQcHoldDetails] = useState(null);
  const [fetchingQcHold, setFetchingQcHold] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [activePackingIdx, setActivePackingIdx] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors]           = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  // Scanning State
  const [scannedBoxIds, setScannedBoxIds] = useState(new Set());
  const [linkedBoxes, setLinkedBoxes] = useState([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState(new Set());
  const [dispatchDetailsOpen, setDispatchDetailsOpen] = useState(false);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);
  const packingFocusSeedRef = useRef("");
  const packingWasCompleteRef = useRef({});
  const lastCameraScanRef = useRef({ code: "", at: 0 });
  const recentSuccessRef = useRef(new Map());
  const scanToastRef = useRef({});
  const scannedBoxIdsRef = useRef(new Set());
  const scannedCountsByPackingRef = useRef(new Map());
  const scanCodeIndexRef = useRef(new Map());
  const displayFlushTimerRef = useRef(null);
  const scanBatchRef = useRef(null);
  const scanSeqRef = useRef(0);
  const pendingCountRef = useRef(0);
  const activePackingIdxRef = useRef(0);
  const formFuidRef = useRef("");
  const [pendingScanCount, setPendingScanCount] = useState(0);
  const [entryMode, setEntryMode] = useState(null);
  const [pickerChoiceId, setPickerChoiceId] = useState(null);
  const [otherBoxMap, setOtherBoxMap] = useState(() => new Map());
  const [manualOtherBoxId, setManualOtherBoxId] = useState("");
  const otherBoxMapRef = useRef(new Map());
  const qcHoldBoxIndexRef = useRef(new Map());
  const [reasonOpts, setReasonOpts] = useState([]);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonHighlight, setReasonHighlight] = useState(-1);
  const [inventoryItemBoxes, setInventoryItemBoxes] = useState([]);
  const [inventoryItemLabel, setInventoryItemLabel] = useState("");
  const [fetchingInventoryBoxes, setFetchingInventoryBoxes] = useState(false);
  const inventoryBoxIndexRef = useRef(new Map());
  const inventoryBoxesFetchRef = useRef(0);
  const fetchingInventoryBoxesRef = useRef(false);
  const reasonSuggestTimerRef = useRef(null);
  const reasonSuggestFetchRef = useRef(0);

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);

  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);
  const { laserScan, keyboardType, showPhoneQr } = useDeviceScanSettings();
  const scanBtnCount = (showPhoneQr ? 1 : 0) + (laserScan ? 1 : 0);
  const scanBtnFill =
    scanBtnCount > 1 ? "flex-1 basis-0 min-w-0 w-full" : "w-full";

  const isSimpleScanMode = isOutEntrySimpleScanMode(entryMode);
  const isQcAreaMode = isOutEntryQcArea(entryMode);
  const isAutoScanFlow =
    isSimpleScanMode ||
    (isQcAreaMode && isConfirmed && (qcHoldDetails || fetchingQcHold));
  const isInventoryOutMode = entryMode === OUT_ENTRY_TYPE.INVENTORY_OUT;
  const isForwardingMode = entryMode === OUT_ENTRY_TYPE.FORWARDING_NOTE;
  const canApproveStoreOut = canAccess("out_entry", "authorize").allowed;
  const canApproveInvOut = canApproveInventoryOut(user);
  const canApprove = isInventoryOutMode ? canApproveInvOut : canApproveStoreOut;
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";
  const showApproval =
    canApprove &&
    (isInventoryOutMode ? mode === "approve" : mode === "add" || mode === "approve");
  const selectedQcHoldId = form?.qc_hold_id ?? "";

  const loadReasonSuggestions = useCallback((search = "", { immediate = false } = {}) => {
    if (reasonSuggestTimerRef.current) {
      clearTimeout(reasonSuggestTimerRef.current);
      reasonSuggestTimerRef.current = null;
    }

    const run = async () => {
      const fetchId = ++reasonSuggestFetchRef.current;
      try {
        const res = await outEntryService.getReasons({ search });
        if (fetchId !== reasonSuggestFetchRef.current) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setReasonOpts(withSortedViewsData(list, "reason"));
      } catch {
        if (fetchId !== reasonSuggestFetchRef.current) return;
        setReasonOpts([]);
      }
    };

    if (immediate) {
      void run();
      return;
    }
    reasonSuggestTimerRef.current = setTimeout(() => {
      reasonSuggestTimerRef.current = null;
      void run();
    }, 300);
  }, []);

  const handleReasonPick = useCallback((opt) => {
    setForm((prev) => ({
      ...prev,
      reason: opt?.reason ?? opt?.id ?? prev.reason,
    }));
    if (errors.reason) setErrors((prev) => ({ ...prev, reason: "" }));
  }, [errors.reason]);

  const clearInventoryItemStock = useCallback(() => {
    inventoryBoxesFetchRef.current += 1;
    inventoryBoxIndexRef.current = new Map();
    fetchingInventoryBoxesRef.current = false;
    setInventoryItemBoxes([]);
    setInventoryItemLabel("");
    setFetchingInventoryBoxes(false);
  }, []);

  const loadInventoryItemBoxes = useCallback(async (itemDcode, itemMeta = null) => {
    const id = itemDcode != null && String(itemDcode).trim() !== "" ? String(itemDcode).trim() : "";
    if (!id) {
      clearInventoryItemStock();
      return;
    }

    const fetchId = ++inventoryBoxesFetchRef.current;
    fetchingInventoryBoxesRef.current = true;
    setFetchingInventoryBoxes(true);
    const labelFromMeta = [itemMeta?.item_code, itemMeta?.itemdesc]
      .map((v) => (v != null ? String(v).trim() : ""))
      .filter(Boolean)
      .join(" — ");
    if (labelFromMeta) setInventoryItemLabel(labelFromMeta);

    try {
      const res = await outEntryService.getAvailableBoxes(id);
      if (fetchId !== inventoryBoxesFetchRef.current) return;
      const rows = Array.isArray(res?.data) ? res.data : [];
      const map = new Map();
      for (const box of rows) {
        if (!box?.box_no_uid) continue;
        map.set(String(box.box_no_uid).toLowerCase(), box);
      }
      inventoryBoxIndexRef.current = map;
      setInventoryItemBoxes(rows);
      if (!labelFromMeta) {
        setInventoryItemLabel(itemMeta?.item_code || id);
      }
    } catch {
      if (fetchId !== inventoryBoxesFetchRef.current) return;
      inventoryBoxIndexRef.current = new Map();
      setInventoryItemBoxes([]);
      toast.error("Could not load in-stock boxes for this item.");
    } finally {
      if (fetchId === inventoryBoxesFetchRef.current) {
        fetchingInventoryBoxesRef.current = false;
        setFetchingInventoryBoxes(false);
      }
    }
  }, [clearInventoryItemStock]);

  const handleInventoryItemChange = useCallback(
    (id, item) => {
      const nextId = id != null && String(id).trim() !== "" ? String(id) : "";
      setForm((prev) => ({ ...prev, item_dcode: nextId }));
      if (errors.item_dcode) setErrors((prev) => ({ ...prev, item_dcode: "" }));
      if (!nextId) {
        clearInventoryItemStock();
        return;
      }
      void loadInventoryItemBoxes(nextId, item);
    },
    [clearInventoryItemStock, errors.item_dcode, loadInventoryItemBoxes]
  );

  const scopedOutUid = useMemo(() => {
    if (!isEdit && !isApprove) return null;
    const raw = editData?.out_uid ?? editData?.outUid ?? editData?.id ?? null;
    if (raw == null || String(raw).trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [isEdit, isApprove, editData?.out_uid, editData?.outUid, editData?.id]);

  const toggleLocation = (locId) => {
    const next = new Set(expandedLocations);
    if (next.has(locId)) next.delete(locId);
    else next.add(locId);
    setExpandedLocations(next);
  };

  // ── API Fetch Logic ────────────────────────────────────────────────────────
  const fetchFuidInfo = useCallback(async (id, opts = {}) => {
    if (!id) return;
    setFetchingFuid(true);
    setFuidDetails(null);
    try {
      const res = await outEntryService.getFuidDetails(id, opts.forOutUid);
      if (res.success && res.data) {
        const fnApproved =
          res.data.approved === true || res.data.approved === "true" || res.data.approved === 1;
        if (!fnApproved && !isEdit && !isApprove) {
          toast.error("Approve the forwarding note first, then use it in out entry.");
          setFuidDetails(null);
          setForm((prev) => ({ ...prev, fuid: "" }));
          setIsConfirmed(false);
          return;
        }
        setFuidDetails(res.data);
        if (isEdit || isApprove) {
          const fallbackOutUid =
            editData?.out_uid ??
            editData?.outUid ??
            editData?.id ??
            null;
          const scopedOutUid =
            opts.forOutUid !== undefined && opts.forOutUid !== null && String(opts.forOutUid).trim() !== ""
              ? Number(opts.forOutUid)
              : fallbackOutUid !== null && fallbackOutUid !== undefined && String(fallbackOutUid).trim() !== ""
                ? Number(fallbackOutUid)
                : null;
          const linkedFromApi = res.data.linked_boxes || [];
          setLinkedBoxes(linkedFromApi);
          const groups = buildOutEntryPackingGroups(res.data.items || []);
          const fnBoxUids = collectForwardingNoteBoxUids(groups);
          const alreadyOut = new Set();
          // For an existing out entry, linked_boxes is the source of truth (draft scans or approved stock).
          // Do not also treat box_table.out_uid as scanned — after edit→draft, unlinked boxes can still
          // carry a stale out_uid and would block re-scan (duplicate + false limit reached).
          linkedFromApi.forEach((b) => {
            if (b?.box_no_uid && fnBoxUids.has(b.box_no_uid)) alreadyOut.add(b.box_no_uid);
          });
          if (scopedOutUid == null) {
            res.data.items?.forEach((item) => {
              item.locations?.forEach((loc) => {
                loc.boxes?.forEach((box) => {
                  if (
                    (Boolean(box.is_out_current) || Boolean(box.is_out)) &&
                    box.box_no_uid &&
                    fnBoxUids.has(box.box_no_uid)
                  ) {
                    alreadyOut.add(box.box_no_uid);
                  }
                });
              });
            });
          }
          setScannedBoxIds(alreadyOut);
          scannedBoxIdsRef.current = new Set(alreadyOut);
          scannedCountsByPackingRef.current = countScannedFulfillmentByPacking(
            groups,
            alreadyOut,
            linkedFromApi
          );
          const progress = getOutEntryPackingProgressList(groups, alreadyOut, linkedFromApi);
          const hasIncomplete = progress.some((p) => !p.complete && (p.required_total || 0) > 0);
          setActivePackingIdx(
            hasIncomplete ? findFirstIncompletePackingIdx(progress) : findActivePackingIdxForScanned(groups, alreadyOut)
          );
        } else {
          setLinkedBoxes([]);
          setScannedBoxIds(new Set());
          scannedBoxIdsRef.current = new Set();
          scannedCountsByPackingRef.current = new Map();
          setActivePackingIdx(0);
        }
      } else {
        toast.error("Forwarding Note not found");
      }
    } catch (err) {
      toast.error(err?.message || "Error fetching details");
    } finally {
      setFetchingFuid(false);
    }
  }, [isEdit, isApprove, editData?.out_uid, editData?.outUid, editData?.id]);

  const fetchQcHoldInfo = useCallback(async (holdId, opts = {}) => {
    if (!holdId) return false;
    setFetchingQcHold(true);
    setQcHoldDetails(null);
    qcHoldBoxIndexRef.current = new Map();
    try {
      const res = await outEntryService.getQcHoldDetails(holdId, opts.forOutUid);
      if (res.success && res.data) {
        setQcHoldDetails(res.data);
        qcHoldBoxIndexRef.current = buildQcHoldBoxIndex(res.data.boxes || []);
        if (isEdit || isApprove) {
          const linkedFromApi = (res.data.boxes || []).filter((b) => b.is_scanned);
          const alreadyOut = new Set(
            linkedFromApi.map((b) => b.box_no_uid).filter(Boolean)
          );
          setScannedBoxIds(alreadyOut);
          scannedBoxIdsRef.current = new Set(alreadyOut);
          const boxMap = new Map();
          linkedFromApi.forEach((b) => {
            if (b?.box_no_uid) {
              boxMap.set(b.box_no_uid, {
                box_no_uid: b.box_no_uid,
                packing_number: b.packing_number,
                qty: b.qty,
                is_loose: b.is_loose === true || b.is_loose === 1,
              });
            }
          });
          setOtherBoxMap(boxMap);
          otherBoxMapRef.current = new Map(boxMap);
        } else {
          setScannedBoxIds(new Set());
          scannedBoxIdsRef.current = new Set();
          otherBoxMapRef.current = new Map();
          setOtherBoxMap(new Map());
        }
        return true;
      }
      toast.error("QC hold not found");
      return false;
    } catch (err) {
      toast.error(err?.message || "Error fetching QC hold details");
      return false;
    } finally {
      setFetchingQcHold(false);
    }
  }, [isEdit, isApprove]);

  const fetchApprovedForwardingNotes = useCallback(
    (params = {}) =>
      forwardingNoteService.getViews({
        ...params,
        permission_module: "out_entry",
        permission_action: "view",
        filters: {
          ...(params.filters || {}),
          approved: true,
          out_entry_available: true
        }
      }),
    []
  );

  const lockForwardingNoteForProcessing = useCallback(async (fuid) => {
    await outEntryService.lockFuid(Number(fuid));
  }, []);

  const closeScanner = () => setIsScannerOpen(false);

  useEffect(() => {
    let timeoutId;
    let cancelled = false;

    if (!open) {
      setIsScannerOpen(false);
      setFormReady(false);
      if (reasonSuggestTimerRef.current) {
        clearTimeout(reasonSuggestTimerRef.current);
        reasonSuggestTimerRef.current = null;
      }
      reasonSuggestFetchRef.current += 1;
      timeoutId = setTimeout(() => {
        setForm(INITIAL_FORM);
        setFuidDetails(null);
        setIsConfirmed(false);
        setScannedBoxIds(new Set());
        scannedBoxIdsRef.current = new Set();
        scannedCountsByPackingRef.current = new Map();
        setLinkedBoxes([]);
        setActivePackingIdx(0);
        packingFocusSeedRef.current = "";
        packingWasCompleteRef.current = {};
        setExpandedLocations(new Set());
        setErrors({});
        setDispatchDetailsOpen(false);
        setEntryMode(null);
        setPickerChoiceId(null);
        setOtherBoxMap(new Map());
        otherBoxMapRef.current = new Map();
        setManualOtherBoxId("");
        setReasonOpts([]);
        setReasonOpen(false);
        setReasonHighlight(-1);
        setQcHoldDetails(null);
        qcHoldBoxIndexRef.current = new Map();
        clearInventoryItemStock();
      }, 300);
      return () => clearTimeout(timeoutId);
    }

    const bootstrap = async () => {
      setFormReady(false);
      setFuidDetails(null);
      setIsConfirmed(false);
      setScannedBoxIds(new Set());
      scannedBoxIdsRef.current = new Set();
      scannedCountsByPackingRef.current = new Map();
      setLinkedBoxes([]);
      setActivePackingIdx(0);
      setExpandedLocations(new Set());
      setDispatchDetailsOpen(false);
      setErrors({});
      setEntryMode(null);
      setPickerChoiceId(null);
      setOtherBoxMap(new Map());
      otherBoxMapRef.current = new Map();
      setManualOtherBoxId("");
      setReasonOpts([]);
      setReasonOpen(false);
      setReasonHighlight(-1);
      setQcHoldDetails(null);
      qcHoldBoxIndexRef.current = new Map();
      clearInventoryItemStock();

      if (editData) {
        const isAutoEntry = isOutEntryAutoAuthorized(editData.entry_type);
        const isInventoryOutEntry = isOutEntryInventoryOut(editData.entry_type);
        if (isAutoEntry || isInventoryOutEntry) {
          const outUid = editData.out_uid ?? editData.outUid ?? editData.id;
          const entryType = isOutEntryInventoryOut(editData.entry_type)
            ? OUT_ENTRY_TYPE.INVENTORY_OUT
            : isOutEntryQcArea(editData.entry_type)
              ? OUT_ENTRY_TYPE.QC_AREA
              : OUT_ENTRY_TYPE.PACKING_AREA;

          if (!cancelled) {
            setEntryMode(entryType);
            setPickerChoiceId(pickerIdFromEntryType(editData.entry_type));
            setIsConfirmed(true);
            setForm({
              fuid: "",
              qc_hold_id: editData.qc_hold_id ? String(editData.qc_hold_id) : "",
              reason: editData.reason || "",
              item_dcode: "",
              remarks: editData.remarks || "",
              approved: editData?.approved ?? false,
            });

            if (isOutEntryQcArea(editData.entry_type) && editData.qc_hold_id) {
              try {
                await fetchQcHoldInfo(editData.qc_hold_id, { forOutUid: outUid });
              } catch {
                /* fetchQcHoldInfo shows toast */
              }
            } else if (outUid) {
              try {
                const res = await outEntryService.getLinkedBoxes(outUid);
                if (res.success && res.data && !cancelled) {
                  const boxes = res.data || [];
                  const uids = new Set(boxes.map((b) => b.box_no_uid).filter(Boolean));
                  const boxMap = new Map();
                  boxes.forEach((b) => {
                    if (b.box_no_uid) {
                      boxMap.set(b.box_no_uid, {
                        box_no_uid: b.box_no_uid,
                        packing_number: b.packing_number,
                        qty: b.qty,
                        is_loose: b.is_loose === true || b.is_loose === 1,
                      });
                    }
                  });
                  setLinkedBoxes(boxes);
                  setScannedBoxIds(uids);
                  scannedBoxIdsRef.current = new Set(uids);
                  setOtherBoxMap(boxMap);
                  otherBoxMapRef.current = new Map(boxMap);
                }
              } catch (err) {
                console.error("Error loading linked boxes:", err);
              }
            }
          }
        } else {
          const initialFuid = editData.fuid || "";
          try {
            if (initialFuid) {
              await fetchFuidInfo(initialFuid, {
                forOutUid:
                  isEdit || isApprove
                    ? editData.out_uid ?? editData.outUid ?? editData.id
                    : undefined,
              });
            }
            if (!cancelled) {
              setEntryMode(OUT_ENTRY_TYPE.FORWARDING_NOTE);
              setPickerChoiceId("forwarding_note");
              setForm({
                fuid: initialFuid,
                qc_hold_id: "",
                reason: "",
                item_dcode: "",
                remarks: editData.remarks || "",
                approved: editData?.approved ?? false,
              });
              if (initialFuid) {
                try {
                  await lockForwardingNoteForProcessing(initialFuid);
                  if (!cancelled) setIsConfirmed(true);
                } catch (lockErr) {
                  if (!cancelled) {
                    toast.error(lockErr?.message || "Unable to lock forwarding note for out entry.");
                    setForm((prev) => ({ ...prev, fuid: "" }));
                    setFuidDetails(null);
                    setIsConfirmed(false);
                  }
                }
              }
            }
          } catch {
            /* fetchFuidInfo shows toast */
          }
        }
      } else {
        setForm(INITIAL_FORM);
      }
      if (!cancelled) setFormReady(true);
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [open, editData?.out_uid, editData?.outUid, editData?.id, editData?.fuid, editData?.qc_hold_id, editData?.entry_type, isApprove, isEdit, lockForwardingNoteForProcessing, fetchQcHoldInfo, clearInventoryItemStock]);

  useEffect(() => {
    if (!open || !formReady || !isAutoScanFlow) return;
    loadReasonSuggestions("", { immediate: true });
  }, [open, formReady, isAutoScanFlow, loadReasonSuggestions]);

  const selectEntryMode = useCallback((mode, choiceId = null) => {
    setEntryMode(mode);
    setPickerChoiceId(choiceId);
    setErrors({});
    setQcHoldDetails(null);
    qcHoldBoxIndexRef.current = new Map();
    clearInventoryItemStock();
    if (isOutEntrySimpleScanMode(mode)) {
      setIsConfirmed(true);
      setFuidDetails(null);
      setForm((prev) => ({ ...prev, fuid: "", qc_hold_id: "", reason: "", item_dcode: "" }));
    } else if (isOutEntryQcArea(mode)) {
      setIsConfirmed(false);
      setFuidDetails(null);
      setForm((prev) => ({ ...prev, fuid: "", qc_hold_id: "", reason: "", item_dcode: "" }));
    } else {
      setIsConfirmed(false);
    }
  }, [clearInventoryItemStock]);

  const handleChangeEntryType = useCallback(() => {
    setEntryMode(null);
    setPickerChoiceId(null);
    setIsConfirmed(false);
    scannedBoxIdsRef.current = new Set();
    setScannedBoxIds(new Set());
    otherBoxMapRef.current = new Map();
    setOtherBoxMap(new Map());
    setFuidDetails(null);
    setQcHoldDetails(null);
    qcHoldBoxIndexRef.current = new Map();
    clearInventoryItemStock();
    setForm(INITIAL_FORM);
    setErrors({});
  }, [clearInventoryItemStock]);

  const handleConfirmQcHold = async (holdIdOverride = null) => {
    const holdId = String(holdIdOverride ?? form.qc_hold_id ?? "").trim();
    if (!holdId) {
      setIsConfirmed(false);
      setQcHoldDetails(null);
      qcHoldBoxIndexRef.current = new Map();
      scannedBoxIdsRef.current = new Set();
      setScannedBoxIds(new Set());
      otherBoxMapRef.current = new Map();
      setOtherBoxMap(new Map());
      return;
    }
    setLoading(true);
    try {
      const ok = await fetchQcHoldInfo(holdId);
      if (ok) {
        setIsConfirmed(true);
        loadReasonSuggestions("", { immediate: true });
      } else {
        setIsConfirmed(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!form.fuid) {
      const e = { fuid: "Please select a forwarding note." };
      setErrors(e);
      toast.warning("Please select a forwarding note.");
      focusFirstError(e, FIELD_ORDER, (key) =>
        formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }
    const fnApproved =
      fuidDetails?.approved === true ||
      fuidDetails?.approved === "true" ||
      fuidDetails?.approved === 1;
    if (!fnApproved) {
      toast.error("Only approved forwarding notes can be used in out entry.");
      return;
    }
    setLoading(true);
    try {
      await lockForwardingNoteForProcessing(form.fuid);
      packingFocusSeedRef.current = "";
      setIsConfirmed(true);
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      toast.success("Forwarding note locked for Out Entry processing.");
    } catch (err) {
      toast.error(err?.message || "Unable to lock forwarding note for out entry.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = async (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: "" }));
    if (key === "fuid") {
      setIsConfirmed(false);
      if (value) fetchFuidInfo(value, { forOutUid: isEdit || isApprove ? (editData?.out_uid ?? editData?.outUid ?? editData?.id) : undefined });
      else setFuidDetails(null);
    }
  };

  const packingGroups = useMemo(
    () => buildOutEntryPackingGroups(fuidDetails?.items || []),
    [fuidDetails]
  );

  const scanCodeIndex = useMemo(
    () => buildOutEntryScanCodeIndex(packingGroups, linkedBoxes),
    [packingGroups, linkedBoxes]
  );

  useEffect(() => {
    scanCodeIndexRef.current = scanCodeIndex;
  }, [scanCodeIndex]);

  useEffect(() => {
    activePackingIdxRef.current = activePackingIdx;
  }, [activePackingIdx]);

  useEffect(() => {
    formFuidRef.current = form.fuid;
  }, [form.fuid]);

  const scheduleDisplaySync = useCallback(() => {
    if (displayFlushTimerRef.current) return;
    displayFlushTimerRef.current = setTimeout(() => {
      displayFlushTimerRef.current = null;
      setScannedBoxIds(new Set(scannedBoxIdsRef.current));
    }, 80);
  }, []);

  const revertScanCount = useCallback((canonicalBoxId) => {
    const hit = [...scanCodeIndexRef.current.values()].find(
      (entry) => entry.canonicalBoxId === canonicalBoxId
    );
    if (!hit) return;
    const pk = packingKey(hit.packing_number);
    const counts = scannedCountsByPackingRef.current.get(pk) || { standard: 0, loose: 0 };
    const isLoose = isFnLooseBox(hit.box);
    if (isLoose) counts.loose = Math.max(0, counts.loose - 1);
    else counts.standard = Math.max(0, counts.standard - 1);
    scannedCountsByPackingRef.current.set(pk, counts);
  }, []);

  const packingProgressList = useMemo(
    () => getOutEntryPackingProgressList(packingGroups, scannedBoxIds, linkedBoxes),
    [packingGroups, scannedBoxIds, linkedBoxes]
  );

  const hasMultiplePackings = packingGroups.length > 1;

  useEffect(() => {
    if (!open || !isConfirmed || !packingProgressList.length) return;
    const seed = `${form.fuid}-${isEdit || isApprove ? editData?.out_uid ?? "" : "new"}`;
    if (packingFocusSeedRef.current === seed) return;
    packingFocusSeedRef.current = seed;
    const idx = findFirstIncompletePackingIdx(packingProgressList);
    setActivePackingIdx(idx);
    packingWasCompleteRef.current = Object.fromEntries(
      packingProgressList.map((p, i) => [i, Boolean(p.complete)])
    );
  }, [open, isConfirmed, form.fuid, packingProgressList, isEdit, isApprove, editData?.out_uid]);

  useEffect(() => {
    if (!open || !isConfirmed || !hasMultiplePackings) return;

    packingProgressList.forEach((p, idx) => {
      const wasComplete = packingWasCompleteRef.current[idx];
      const nowComplete = Boolean(p.complete);
      if (wasComplete === false && nowComplete && idx === activePackingIdx) {
        const nextIdx = findNextIncompletePackingIdx(packingProgressList, idx);
        if (nextIdx >= 0 && nextIdx !== idx) {
          const nextPn = packingGroups[nextIdx]?.packing_number;
          setActivePackingIdx(nextIdx);
          toast.info(`Packing #${packingGroups[idx]?.packing_number} complete — scan #${nextPn} next`, {
            autoClose: 3200,
          });
        }
      }
      packingWasCompleteRef.current[idx] = nowComplete;
    });
  }, [packingProgressList, activePackingIdx, open, isConfirmed, hasMultiplePackings, packingGroups]);

  const processScanBatch = useCallback(
    async (batch) => {
      try {
        const fuid = formFuidRef.current;
        if (!fuid) return;

        const batchIds = new Set(batch.map((item) => item.canonicalBoxId));
        const session_scanned = [...scannedBoxIdsRef.current].filter((uid) => !batchIds.has(uid));

        const res = await outEntryService.batchScanBoxes({
          fuid: Number(fuid),
          for_out_uid: scopedOutUid,
          session_scanned,
          items: batch.map((item) => ({ id: item.id, code: item.code })),
        });

        const resultMap = new Map((res?.results || []).map((row) => [String(row.id), row]));
        for (const item of batch) {
          const result = resultMap.get(String(item.id));
          if (result?.allowed) continue;

          if (result?.duplicate) {
            revertScanCount(item.canonicalBoxId);
            if (!shouldSilenceScanDuplicate(recentSuccessRef, item.canonicalBoxId)) {
              showScanToast(
                "error",
                `batch-dup-${item.id}`,
                result?.message || SCAN_SNACK_MSG.BOX_DUPLICATE(item.canonicalBoxId),
                2200
              );
            }
            continue;
          }

          scannedBoxIdsRef.current.delete(item.canonicalBoxId);
          revertScanCount(item.canonicalBoxId);
          showScanToast(
            "error",
            `batch-fail-${item.id}`,
            result?.message || SCAN_SNACK_MSG.REJECTED,
            2200
          );
        }
      } catch (err) {
        for (const item of batch) {
          scannedBoxIdsRef.current.delete(item.canonicalBoxId);
          revertScanCount(item.canonicalBoxId);
        }
        showScanToast(
          "error",
          "out-batch-scan-failed",
          err?.message || "Could not verify scanned boxes. Please try again.",
          2800
        );
      } finally {
        pendingCountRef.current = Math.max(0, pendingCountRef.current - batch.length);
        setPendingScanCount(pendingCountRef.current);
        scheduleDisplaySync();
      }
    },
    [scopedOutUid, revertScanCount, scheduleDisplaySync, showScanToast]
  );

  const processOtherScanBatch = useCallback(
    async (batch) => {
      try {
        const batchIds = new Set(batch.map((item) => item.canonicalBoxId));
        const session_scanned = [...scannedBoxIdsRef.current].filter((uid) => !batchIds.has(uid));

        const res = await outEntryService.batchScanBoxes({
          entry_type: entryMode,
          ...(isQcAreaMode && selectedQcHoldId
            ? { qc_hold_id: Number(selectedQcHoldId) }
            : {}),
          for_out_uid: scopedOutUid,
          session_scanned,
          items: batch.map((item) => ({ id: item.id, code: item.code })),
        });

        const resultMap = new Map((res?.results || []).map((row) => [String(row.id), row]));
        for (const item of batch) {
          const result = resultMap.get(String(item.id));
          if (result?.allowed) {
            const resolvedUid = String(result.box_no_uid || "").trim();
            if (!resolvedUid) {
              scannedBoxIdsRef.current.delete(item.canonicalBoxId);
              otherBoxMapRef.current.delete(item.canonicalBoxId);
              continue;
            }
            scannedBoxIdsRef.current.delete(item.canonicalBoxId);
            otherBoxMapRef.current.delete(item.canonicalBoxId);
            scannedBoxIdsRef.current.add(resolvedUid);
            otherBoxMapRef.current.set(resolvedUid, {
              box_no_uid: resolvedUid,
              packing_number: result.packing_number ?? null,
              qty: result.qty ?? 0,
              is_loose: result.is_loose === true || result.is_loose === 1,
            });
            continue;
          }

          if (result?.duplicate) {
            scannedBoxIdsRef.current.delete(item.canonicalBoxId);
            otherBoxMapRef.current.delete(item.canonicalBoxId);
            if (!shouldSilenceScanDuplicate(recentSuccessRef, item.canonicalBoxId)) {
              showScanToast(
                "error",
                `other-batch-dup-${item.id}`,
                result?.message || SCAN_SNACK_MSG.BOX_DUPLICATE(item.canonicalBoxId),
                2200
              );
            }
            continue;
          }

          scannedBoxIdsRef.current.delete(item.canonicalBoxId);
          otherBoxMapRef.current.delete(item.canonicalBoxId);
          showScanToast(
            "error",
            `other-batch-fail-${item.id}`,
            result?.message || SCAN_SNACK_MSG.REJECTED,
            2200
          );
        }
        setOtherBoxMap(new Map(otherBoxMapRef.current));
      } catch (err) {
        for (const item of batch) {
          scannedBoxIdsRef.current.delete(item.canonicalBoxId);
          otherBoxMapRef.current.delete(item.canonicalBoxId);
        }
        setOtherBoxMap(new Map(otherBoxMapRef.current));
        showScanToast(
          "error",
          "other-batch-scan-failed",
          err?.message || "Could not verify scanned boxes. Please try again.",
          2800
        );
      } finally {
        pendingCountRef.current = Math.max(0, pendingCountRef.current - batch.length);
        setPendingScanCount(pendingCountRef.current);
        scheduleDisplaySync();
      }
    },
    [scopedOutUid, entryMode, isQcAreaMode, selectedQcHoldId, scheduleDisplaySync, showScanToast]
  );

  useEffect(() => {
    if (!open || !isConfirmed) {
      scanBatchRef.current = null;
      pendingCountRef.current = 0;
      setPendingScanCount(0);
      return undefined;
    }

    // Inventory/Packing/QC use processOtherScanBatch; Forwarding Note uses processScanBatch.
    // Keep a single queue so QC does not get overwritten by the FN handler.
    scanBatchRef.current = createScanBatchQueue({
      flushMs: 80,
      maxBatch: 20,
      onFlush: isAutoScanFlow ? processOtherScanBatch : processScanBatch,
    });

    return () => {
      scanBatchRef.current = null;
    };
  }, [open, isConfirmed, isAutoScanFlow, processOtherScanBatch, processScanBatch]);

  const tryAddOtherBox = useCallback(
    (rawScanValue) => {
      const qrType = detectQrType(rawScanValue);
      if (qrType === "location") {
        showScanToast("error", "other-location-scan", SCAN_SNACK_MSG.REJECTED);
        return;
      }

      const { box_no_uid: scanNoUid, box_uid: scanUid } = parseStickerScan(rawScanValue);
      const bId = (scanNoUid || scanUid || parseBoxScanRaw(rawScanValue) || "").trim();
      if (!bId) {
        showScanToast("error", "other-invalid-sticker", SCAN_SNACK_MSG.REJECTED);
        return;
      }

      const canonicalBoxId = bId;
      const qcHoldHit = isQcAreaMode ? qcHoldBoxIndexRef.current.get(bId.toLowerCase()) : null;
      if (isQcAreaMode && !qcHoldHit) {
        showScanToast("error", "qc-not-on-hold", "This box is not an in-store box on the selected QC hold.");
        return;
      }

      if (isInventoryOutMode) {
        // Item picker is optional info only — still enrich row details when the box is on the loaded list.
        const invHit = inventoryBoxIndexRef.current.get(bId.toLowerCase());
        if (invHit) {
          otherBoxMapRef.current.set(canonicalBoxId, {
            box_no_uid: canonicalBoxId,
            packing_number: invHit.packing_number ?? null,
            qty: Number(invHit.qty) || 0,
            is_loose: normalizeIsLoose(invHit.is_loose),
            location_no: invHit.location_no ?? null,
          });
          setOtherBoxMap(new Map(otherBoxMapRef.current));
        }
      }

      if (scannedBoxIdsRef.current.has(canonicalBoxId)) {
        if (!shouldSilenceScanDuplicate(recentSuccessRef, canonicalBoxId)) {
          showScanToast("error", "other-duplicate-scan", SCAN_SNACK_MSG.BOX_DUPLICATE(canonicalBoxId), 1200);
        }
        return;
      }

      if (qcHoldHit) {
        otherBoxMapRef.current.set(canonicalBoxId, {
          box_no_uid: canonicalBoxId,
          packing_number: qcHoldHit.packing_number ?? null,
          qty: Number(qcHoldHit.qty) || 0,
          is_loose: normalizeIsLoose(qcHoldHit.is_loose),
          location_no: qcHoldHit.location_no ?? null,
        });
        setOtherBoxMap(new Map(otherBoxMapRef.current));
      }

      scannedBoxIdsRef.current.add(canonicalBoxId);
      markRecentScanSuccess(recentSuccessRef, canonicalBoxId);
      showScanSuccess(
        `other-scan-ok-${String(canonicalBoxId).toLowerCase()}`,
        SCAN_SNACK_MSG.BOX_SCANNED_TOTAL(canonicalBoxId, scannedBoxIdsRef.current.size)
      );
      scheduleDisplaySync();

      pendingCountRef.current += 1;
      setPendingScanCount(pendingCountRef.current);

      scanBatchRef.current?.enqueue({
        id: `other-scan-${++scanSeqRef.current}`,
        code: bId,
        canonicalBoxId,
      });
    },
    [
      isInventoryOutMode,
      isQcAreaMode,
      showScanSuccess,
      showScanToast,
      scheduleDisplaySync,
    ]
  );

  const tryAddBox = useCallback(
    (rawScanValue) => {
      const qrType = detectQrType(rawScanValue);
      if (qrType === "location") {
        showScanToast("error", "generic-scan-out-entry", SCAN_SNACK_MSG.REJECTED);
        return;
      }

      const { box_no_uid: scanNoUid, box_uid: scanUid } = parseStickerScan(rawScanValue);
      const bId = (scanNoUid || scanUid || parseBoxScanRaw(rawScanValue) || "").trim();
      if (!bId) {
        showScanToast("error", "generic-invalid-sticker", SCAN_SNACK_MSG.REJECTED);
        return;
      }

      const hit = scanCodeIndexRef.current.get(bId.toLowerCase());
      if (!hit) {
        showScanToast("error", "box-not-found", SCAN_SNACK_MSG.BOX_NOT_IN_NOTE(bId));
        return;
      }

      const boxData = hit.box;
      const canonicalBoxId = hit.canonicalBoxId;
      const targetGroup = findPackingGroupByNumber(packingGroups, hit.packing_number);
      if (!targetGroup) {
        showScanToast("error", "box-not-found", SCAN_SNACK_MSG.BOX_NOT_IN_NOTE(bId));
        return;
      }

      if (!isBoxAvailableForOutEntryScan(boxData, { forOutUid: scopedOutUid })) {
        const status = boxInventoryStatus(boxData);
        if (status === "stock_adjustment" || isStockAdjustmentOut(boxData)) {
          showScanToast(
            "error",
            `box-sa-out-${canonicalBoxId}`,
            SCAN_SNACK_MSG.BOX_STOCK_ADJUSTMENT_OUT(canonicalBoxId)
          );
        } else {
          showScanToast(
            "error",
            `box-outward-${canonicalBoxId}`,
            SCAN_SNACK_MSG.BOX_ALREADY_OUTWARD(canonicalBoxId)
          );
        }
        return;
      }

      if (scannedBoxIdsRef.current.has(canonicalBoxId)) {
        if (!shouldSilenceScanDuplicate(recentSuccessRef, canonicalBoxId)) {
          showScanToast("error", "duplicate-scan", SCAN_SNACK_MSG.BOX_DUPLICATE(canonicalBoxId), 1200);
        }
        return;
      }

      const packKeyVal = packingKey(targetGroup.packing_number);
      const counts = scannedCountsByPackingRef.current.get(packKeyVal) || { standard: 0, loose: 0 };
      const isLoose = isFnLooseBox(boxData);
      const limit = isLoose ? Number(targetGroup.loose_box) || 0 : Number(targetGroup.box) || 0;
      const alreadyScannedCount = isLoose ? counts.loose : counts.standard;
      const typeLabel = isLoose ? "loose boxes" : "standard boxes";

      if (alreadyScannedCount >= limit) {
        showScanToast(
          "error",
          `limit-${targetGroup.packing_number}-${typeLabel}`,
          `Limit reached for packing #${targetGroup.packing_number}: only ${limit} ${typeLabel} required.`
        );
        return;
      }

      scannedBoxIdsRef.current.add(canonicalBoxId);
      if (isLoose) counts.loose += 1;
      else counts.standard += 1;
      scannedCountsByPackingRef.current.set(packKeyVal, counts);

      const tabIdx = packingGroups.findIndex(
        (pg) => packingKey(pg.packing_number) === packKeyVal
      );
      if (tabIdx >= 0 && tabIdx !== activePackingIdxRef.current) {
        setActivePackingIdx(tabIdx);
      }

      markRecentScanSuccess(recentSuccessRef, canonicalBoxId);
      showScanSuccess(
        `scan-ok-${String(canonicalBoxId).toLowerCase()}`,
        SCAN_SNACK_MSG.BOX_SCANNED_TOTAL(canonicalBoxId, scannedBoxIdsRef.current.size)
      );
      scheduleDisplaySync();

      pendingCountRef.current += 1;
      setPendingScanCount(pendingCountRef.current);

      scanBatchRef.current?.enqueue({
        id: `scan-${++scanSeqRef.current}`,
        code: bId,
        canonicalBoxId,
      });
    },
    [packingGroups, scopedOutUid, showScanSuccess, showScanToast, scheduleDisplaySync]
  );

  const handleRemoveScannedBox = useCallback(
    (boxNoUid) => {
      if (!boxNoUid) return;
      scannedBoxIdsRef.current.delete(boxNoUid);
      if (isAutoScanFlow) {
        otherBoxMapRef.current.delete(boxNoUid);
        setOtherBoxMap(new Map(otherBoxMapRef.current));
      } else {
        revertScanCount(boxNoUid);
      }
      setScannedBoxIds(new Set(scannedBoxIdsRef.current));
    },
    [revertScanCount, isAutoScanFlow]
  );

  const activeBD = packingGroups?.[activePackingIdx];

  const packingLaserActive =
    open &&
    formReady &&
    isConfirmed &&
    !isAutoScanFlow &&
    Boolean(activeBD) &&
    (laserScan || isLaserScanEnabled());

  const otherLaserActive =
    open && formReady && isConfirmed && isAutoScanFlow && (laserScan || isLaserScanEnabled());

  const laserScanSessionKey = `${Number(isConfirmed)}-${
    isAutoScanFlow ? (isQcAreaMode ? "qc-area" : "other") : `packing-${activePackingIdx}`
  }`;

  const handleLaserScanRejected = useCallback(
    ({ reason }) => {
      if (reason === "empty") {
        showScanToast("error", "laser-empty-scan", SCAN_SNACK_MSG.REJECTED, 1800);
      }
    },
    [showScanToast]
  );

  const handlePackingLaserScan = useCallback(
    (code) => {
      tryAddBox(code);
    },
    [tryAddBox]
  );

  const handleOtherLaserScan = useCallback(
    (code) => {
      tryAddOtherBox(code);
    },
    [tryAddOtherBox]
  );

  useEffect(() => {
    if (activePackingIdx >= (packingGroups?.length || 0)) {
      setActivePackingIdx(0);
    }
  }, [activePackingIdx, packingGroups]);

  const handleCameraDecoded = useCallback(
    (decodedText) => {
      const code = parseBoxScanRaw(decodedText)?.trim();
      if (!code) {
        showScanToast("error", "camera-invalid-scan", SCAN_SNACK_MSG.REJECTED, 1800);
        return;
      }

      const now = Date.now();
      if (
        lastCameraScanRef.current.code === code &&
        now - lastCameraScanRef.current.at < 1200
      ) {
        return;
      }
      lastCameraScanRef.current = { code, at: now };
      if (isAutoScanFlow) tryAddOtherBox(decodedText);
      else tryAddBox(decodedText);
    },
    [tryAddBox, tryAddOtherBox, isAutoScanFlow, showScanToast]
  );

  const handleDecodeSuppressed = useCallback(() => {
    notifyDecodeSuppressedScan();
  }, []);

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: isScannerOpen,
    elementId: OUT_ENTRY_SCANNER_ID,
    onDecoded: handleCameraDecoded,
    onDecodeSuppressed: handleDecodeSuppressed,
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: () => {
      showScanToast(
        "error",
        "camera-open-failed",
        SCAN_SNACK_MSG.CAMERA_DENIED ?? SCAN_SNACK_MSG.CAMERA,
        4000
      );
      setIsScannerOpen(false);
    },
  });

  // ── UI Logic ───────────────────────────────────────────────────────────────

  // Scanned boxes for current packing
  const scannedInActive = useMemo(() => {
    if (!activeBD) return [];
    const list = [];
    activeBD.locations?.forEach(loc => {
      loc.boxes?.forEach(box => {
        if (scannedBoxIds.has(box.box_no_uid)) list.push({ ...box, location_name: loc.location_name });
      });
    });
    return list;
  }, [activeBD, scannedBoxIds]);

  const scannedStats = useMemo(() => {
    return scannedInActive.reduce((acc, b) => {
      if (isFnLooseBox(b)) { acc.loose++; acc.lQty += b.qty; }
      else { acc.box++; acc.bQty += b.qty; }
      return acc;
    }, { box: 0, bQty: 0, loose: 0, lQty: 0 });
  }, [scannedInActive]);

  const isFulfillmentComplete = useMemo(() => {
    if (isSimpleScanMode || isQcAreaMode) {
      return scannedBoxIds.size > 0;
    }
    return isOutEntryFulfillmentComplete(packingGroups, scannedBoxIds, linkedBoxes);
  }, [isSimpleScanMode, isQcAreaMode, scannedBoxIds, packingGroups, linkedBoxes]);

  const { scanned: fulfillmentScanned, required: fulfillmentRequired } = useMemo(
    () => getOutEntryGlobalScanTotals(packingProgressList),
    [packingProgressList]
  );

  const requiredBoxTotal = fulfillmentRequired;
  const scannedCount = fulfillmentScanned;

  const handleInputChange = (key, value) => {
    if (key === "approved" && value === true && !isFulfillmentComplete) {
      toast.error(OUT_ENTRY_APPROVE_BLOCKED_MSG);
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const otherScannedList = useMemo(() => {
    const holdBoxes = qcHoldDetails?.boxes || [];
    return [...scannedBoxIds].map((uid) => {
      const fromMap = otherBoxMap.get(uid);
      if (fromMap) return fromMap;
      const fromHold = holdBoxes.find((b) => b.box_no_uid === uid);
      if (fromHold) {
        return {
          box_no_uid: uid,
          packing_number: fromHold.packing_number ?? null,
          qty: Number(fromHold.qty) || 0,
          is_loose: normalizeIsLoose(fromHold.is_loose),
        };
      }
      return { box_no_uid: uid, packing_number: null, qty: 0, is_loose: false };
    });
  }, [scannedBoxIds, otherBoxMap, qcHoldDetails?.boxes]);

  const handleSave = async (statusOverride = null) => {
    const sopOk = !sopAckRef.current || sopAckRef.current.assertAcknowledged();
    if (!sopOk) return;

    if (isAutoScanFlow) {
      await scanBatchRef.current?.flushPending();
      if (displayFlushTimerRef.current) {
        clearTimeout(displayFlushTimerRef.current);
        displayFlushTimerRef.current = null;
      }
      setScannedBoxIds(new Set(scannedBoxIdsRef.current));

      if (pendingCountRef.current > 0) {
        toast.warning("Boxes are still being confirmed. Wait a moment, then try again.");
        return;
      }

      const scannedList = Array.from(scannedBoxIdsRef.current);
      if (!scannedList.length) {
        toast.error(isQcAreaMode ? "Scan at least one in-store box from the QC hold." : "Scan at least one box from store.");
        return;
      }

      const reasonValue = String(form.reason || "").trim();
      if (!reasonValue) {
        const e = { reason: "Please enter or select a reason." };
        setErrors(e);
        toast.warning("Please enter or select a reason.");
        focusFirstError(e, SIMPLE_SCAN_FIELD_ORDER, (key) =>
          formRef.current?.querySelector(`[data-field="${key}"]`)
        );
        return;
      }

      setLoading(true);
      try {
        if (isInventoryOutMode && (isEdit || isApprove)) {
          let finalApproved = false;
          if (statusOverride !== null) finalApproved = statusOverride;
          else if (isApprove) finalApproved = true;
          else if (isEdit && editData?.approved) finalApproved = false;

          const res = await outEntryService.update(editData?.out_uid, {
            entry_type: OUT_ENTRY_TYPE.INVENTORY_OUT,
            reason: reasonValue,
            remarks: form.remarks,
            approved: finalApproved,
            scanned_boxes: scannedList,
          });
          toast.success(
            res?.message ||
              (finalApproved
                ? "Inventory out authorized."
                : isEdit
                  ? "Inventory out updated."
                  : "Inventory out saved.")
          );
          onSuccess();
          onClose();
          return;
        }

        const res = await outEntryService.create({
          entry_type: entryMode,
          ...(isQcAreaMode ? { qc_hold_id: Number(selectedQcHoldId) } : {}),
          reason: reasonValue,
          remarks: form.remarks,
          approved: isInventoryOutMode ? false : true,
          scanned_boxes: scannedList,
        });
        toast.success(
          res?.message ||
            (isInventoryOutMode
              ? "Inventory out submitted. Awaiting approval."
              : isQcAreaMode
                ? "QC area out completed."
                : "Boxes moved to packing area.")
        );
        onSuccess();
        onClose();
      } catch (err) {
        toast.error(err?.message || "Failed");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!form.fuid) return;

    await scanBatchRef.current?.flushPending();
    if (displayFlushTimerRef.current) {
      clearTimeout(displayFlushTimerRef.current);
      displayFlushTimerRef.current = null;
    }
    setScannedBoxIds(new Set(scannedBoxIdsRef.current));

    if (pendingCountRef.current > 0) {
      toast.warning("Boxes are still being confirmed. Wait a moment, then try again.");
      return;
    }

    setLoading(true);
    try {
      let finalApproved = form.approved;
      if (statusOverride !== null) finalApproved = statusOverride;
      else if (isEdit && editData?.approved) finalApproved = false;

      if (!isFulfillmentComplete) {
        finalApproved = false;
      }

      if (finalApproved && !isFulfillmentComplete) {
        toast.error(OUT_ENTRY_APPROVE_BLOCKED_MSG);
        setLoading(false);
        return;
      }

      const payload = {
        ...form,
        fuid: Number(form.fuid),
        approved: finalApproved,
        scanned_boxes: Array.from(scannedBoxIdsRef.current).filter((uid) =>
          collectForwardingNoteBoxUids(packingGroups).has(uid)
        ),
      };
      const request =
        isEdit || isApprove
          ? outEntryService.update(editData?.out_uid, payload)
          : outEntryService.create(payload);
      const res = await request;
      const saved = res?.data;
      const complete = saved?.scan_complete ?? isFulfillmentComplete;
      const req = Number(saved?.boxes_required) || requiredBoxTotal;
      const scn = Number(saved?.boxes_scanned) ?? scannedCount;

      if (complete) {
        toast.success(
          res?.message ||
            (finalApproved
              ? "Store out authorized."
              : isApprove
                ? "Out entry kept pending."
                : "Out entry submitted. Approve it from the Out Entry list when ready.")
        );
      } else {
        toast.success(
          res?.message ||
            `Saved as draft (${scn}/${req} boxes). Complete all scans on any device, then submit.`
        );
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const isBlockingDataLoad =
    open &&
    (!formReady ||
      (fetchingFuid && ((isEdit || isApprove) || (isConfirmed && isForwardingMode))) ||
      (fetchingQcHold && ((isEdit || isApprove) || (isQcAreaMode && isConfirmed))));

  const showModePicker = !isEdit && !isApprove && entryMode == null;
  const otherScannedCount = scannedBoxIds.size;
  const qcHoldBoxRows = useMemo(() => {
    if (!qcHoldDetails?.boxes?.length) return [];
    return qcHoldDetails.boxes.map((box) => ({
      ...box,
      is_scanned: scannedBoxIds.has(box.box_no_uid),
    }));
  }, [qcHoldDetails, scannedBoxIds]);

  const activePickerOption = useMemo(() => {
    if (isForwardingMode) return OUT_ENTRY_MODE_PICKER_OPTIONS[0];
    if (isSimpleScanMode || isQcAreaMode) {
      return (
        getOutEntryModePickerOption(pickerChoiceId) ||
        OUT_ENTRY_MODE_PICKER_OPTIONS.find((o) => o.id === "inventory_out")
      );
    }
    return null;
  }, [isForwardingMode, isSimpleScanMode, isQcAreaMode, pickerChoiceId]);

  const drawerDescription = useMemo(() => {
    if (showModePicker) return "Select out type";
    const hint = isAutoScanFlow
      ? isQcAreaMode
        ? "Select QC hold, scan & submit"
        : "Scan boxes & submit"
      : isQcAreaMode
        ? "Select QC hold"
        : isForwardingMode
          ? "Select FUID, scan & submit"
          : "Select out type";
    if (!isEdit && !isApprove) {
      return (
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 normal-case tracking-normal font-semibold">
          <span className="uppercase tracking-tight font-bold">{hint}</span>
          <span className="text-slate-300 font-normal" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={handleChangeEntryType}
            className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 font-bold"
          >
            Change type
          </button>
        </span>
      );
    }
    return hint;
  }, [
    showModePicker,
    isAutoScanFlow,
    isQcAreaMode,
    isForwardingMode,
    isEdit,
    isApprove,
    handleChangeEntryType,
  ]);

  return (
    <>
    <Drawer 
      isOpen={open} 
      onClose={onClose} 
      onSubmit={() => {
        if (isAutoScanFlow) {
          handleSave();
          return;
        }
        if (isApprove) {
          handleSave(isFulfillmentComplete ? true : false);
          return;
        }
        handleSave();
      }}
      title={
        isApprove
          ? isInventoryOutMode
            ? "Special Approve — Inventory Out"
            : "Approve Store Out"
          : isEdit
            ? "Edit Out Entry"
            : isAutoScanFlow
              ? `Out Entry — ${activePickerOption?.title || "Inventory Out"}`
              : isQcAreaMode
                ? "Out Entry — QC Area"
                : isForwardingMode
                ? "Out Entry — Forwarding Note"
                : "New Out Entry"
      }
      description={drawerDescription}
      footer={(
        <div className="flex justify-end gap-3 w-full">
          <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-500">Cancel</button>
          {isApprove ? (
            <>
              <button
                onClick={() => handleSave(false)}
                disabled={loading || isBlockingDataLoad || pendingScanCount > 0}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-40"
              >
                Keep Pending
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={loading || isBlockingDataLoad || pendingScanCount > 0 || !isFulfillmentComplete}
                title={!isFulfillmentComplete ? OUT_ENTRY_APPROVE_BLOCKED_MSG : undefined}
                className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
                {isInventoryOutMode ? "Approve Inventory" : "Approve"}
              </button>
            </>
          ) : isAutoScanFlow || (isQcAreaMode && (fetchingQcHold || loading)) ? (
            <button
              onClick={() => handleSave()}
              disabled={loading || !isConfirmed || isBlockingDataLoad || pendingScanCount > 0 || otherScannedCount === 0}
              className={`min-w-[140px] px-6 py-2 text-sm font-bold text-white rounded-xl shadow-lg disabled:bg-slate-300 transition-all active:scale-95 ${PICKER_ACCENT[activePickerOption?.accent || "red"].submit}`}
            >
              {loading ? "Processing..." : `Submit (${otherScannedCount})`}
            </button>
          ) : (
            <button
              onClick={() => handleSave()}
              disabled={loading || !isConfirmed || isBlockingDataLoad || pendingScanCount > 0}
              className={`min-w-[140px] px-6 py-2 text-sm font-bold text-white rounded-xl shadow-lg disabled:bg-slate-300 transition-all active:scale-95 ${PICKER_ACCENT.red.submit}`}
            >
              {loading
                ? "Processing..."
                : isFulfillmentComplete
                  ? "Submit"
                  : `Save draft (${scannedCount}/${requiredBoxTotal || "?"})`}
            </button>
          )}
        </div>
      )} 
      maxWidth="max-w-5xl"
    >
      <div ref={formRef} className="space-y-3 pb-2">
        <QrScannerOverlay
          open={isScannerOpen}
          onClose={closeScanner}
          readerId={OUT_ENTRY_SCANNER_ID}
          hint="Scanning sticker / box QR"
          torchSupported={torchSupported}
          torchOn={torchOn}
          onToggleTorch={toggleTorch}
        />

        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized entry will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}

        {isBlockingDataLoad ? (
          <FormPanelLoader
            label={formReady ? "Refreshing outward data..." : "Loading out entry..."}
            hint={
              formReady
                ? "Updating scanned boxes and stock details."
                : "Preparing the form and box scan state."
            }
          />
        ) : showModePicker ? (
          <div className="space-y-3 py-2">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Select out type</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {OUT_ENTRY_MODE_PICKER_OPTIONS.filter((option) => {
                if (option.id === "inventory_out") {
                  return canCreateInventoryOut(user);
                }
                return true;
              }).map((option) => {
                const accent = PICKER_ACCENT[option.accent] || PICKER_ACCENT.red;
                const Icon = PICKER_ICONS[option.icon] || Package;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectEntryMode(option.mode, option.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${accent.card}`}
                  >
                    <div className={`flex items-center gap-2 ${accent.title}`}>
                      <Icon size={17} />
                      <span className="text-sm font-black uppercase tracking-wide">{option.title}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : isQcAreaMode && !isConfirmed ? (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="space-y-2 min-w-0 w-full" data-field="qc_hold_id">
              <SearchableSelect
                className="min-w-0 w-full"
                label="QC Hold"
                value={form.qc_hold_id}
                onChange={(id) => {
                  const nextId = id ? String(id) : "";
                  setForm((prev) => ({ ...prev, qc_hold_id: nextId }));
                  if (errors.qc_hold_id) setErrors((prev) => ({ ...prev, qc_hold_id: "" }));
                  void handleConfirmQcHold(nextId || null);
                }}
                fetchService={async (params) => {
                  const res = await qcHoldMaterialService.getActiveHolds(params?.search, {
                    requireInStoreBoxes: true,
                  });
                  const rows = (res?.data || []).map((row) => mapQcHoldSelectRow(row));
                  return { data: rows, total: rows.length };
                }}
                getByIdService={async (id) => {
                  const res = await qcHoldMaterialService.getById(id);
                  const row = res?.data;
                  return row ? mapQcHoldSelectRow(row) : null;
                }}
                dataKey="hold_id"
                labelKey="label"
                placeholder="Search hold # or packing…"
                error={errors.qc_hold_id}
                required
                disabled={isEdit && isConfirmed || loading || fetchingQcHold}
              />
            </div>
            {loading || fetchingQcHold ? (
              <FormPanelLoader
                label="Loading QC hold..."
                hint="Fetching in-store boxes for this hold."
              />
            ) : (
              <div className="p-3 bg-indigo-50 rounded-lg border border-dashed border-indigo-200 flex items-center gap-2">
                <Shield size={16} className="text-indigo-600 shrink-0" />
                <p className="text-[10px] text-indigo-800 italic leading-relaxed">
                  Select an active QC hold — scan in-store boxes (with location) to move them to QC area. Packing-area boxes on the hold are already in QC area.
                </p>
              </div>
            )}
          </div>
        ) : isAutoScanFlow ? (
          <div className="space-y-3 animate-in fade-in duration-300">
            {isQcAreaMode && qcHoldDetails ? (
              <CollapsibleQcHoldBoxes
                hold={qcHoldDetails}
                boxes={qcHoldBoxRows}
                scannedCount={otherScannedCount}
                packingAreaBoxCount={qcHoldDetails.packing_area_box_count ?? 0}
              />
            ) : null}
            <div className="space-y-1 relative min-w-0" data-field="reason">
              <label className={FORM_LABEL_CLASS}>
                Reason <span className="text-rose-500">*</span>
              </label>
              <input
                value={form.reason}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    reason: v,
                  }));
                  loadReasonSuggestions(v);
                  setReasonOpen(true);
                  setReasonHighlight(-1);
                  if (errors.reason) setErrors((prev) => ({ ...prev, reason: "" }));
                }}
                placeholder="Type or pick from previous reasons…"
                className={`w-full min-w-0 ${errors.reason ? ERR_INPUT : OK_INPUT}`}
                onFocus={() => setReasonOpen(true)}
                onBlur={() => setTimeout(() => setReasonOpen(false), 120)}
                onKeyDown={(e) => {
                  if (!reasonOpen || reasonOpts.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setReasonHighlight((prev) => Math.min(prev + 1, reasonOpts.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setReasonHighlight((prev) => Math.max(prev - 1, 0));
                  } else if (e.key === "Enter" && reasonHighlight >= 0) {
                    e.preventDefault();
                    handleReasonPick(reasonOpts[reasonHighlight]);
                    setReasonOpen(false);
                    setReasonHighlight(-1);
                  } else if (e.key === "Escape") {
                    setReasonOpen(false);
                    setReasonHighlight(-1);
                  }
                }}
              />
              {errors.reason ? (
                <p className="text-[10px] font-bold text-rose-600 ml-1">{errors.reason}</p>
              ) : null}
              {reasonOpen && reasonOpts.length > 0 ? (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-[80] max-h-56 overflow-auto">
                  {reasonOpts.map((o, idx) => (
                    <button
                      key={o.id ?? o.reason}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleReasonPick(o);
                        setReasonOpen(false);
                        setReasonHighlight(-1);
                      }}
                      onMouseEnter={() => setReasonHighlight(idx)}
                      className={`w-full text-left px-3 py-2 ${
                        reasonHighlight === idx ? "bg-indigo-50" : "hover:bg-indigo-50/40"
                      }`}
                    >
                      <div className="text-xs sm:text-sm font-bold text-slate-700">{o.reason}</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {isInventoryOutMode ? (
              <div className="space-y-2" data-field="item_dcode">
                <SearchableSelect
                  className="min-w-0 w-full"
                  label="Item Search (Code / Description)"
                  value={form.item_dcode}
                  onChange={handleInventoryItemChange}
                  fetchService={(params) =>
                    masterService.getItemsViews({
                      ...params,
                      permission_module: "out_entry",
                      permission_action: "view",
                      filters: { in_hand_inventory: true },
                    })
                  }
                  getByIdService={(id) =>
                    masterService.getItemViewById(id, {
                      permission_module: "out_entry",
                      permission_action: "view",
                    })
                  }
                  dataKey="id"
                  labelKey="item_code"
                  subLabelKey="itemdesc"
                  placeholder="Search Item"
                  error={errors.item_dcode}
                  disabled={isApprove || (isEdit && editData?.approved)}
                  usePortal={false}
                />
                {form.item_dcode || fetchingInventoryBoxes ? (
                  <CollapsibleInventoryItemBoxes
                    itemLabel={inventoryItemLabel || form.item_dcode}
                    boxes={inventoryItemBoxes}
                    scannedIds={scannedBoxIds}
                    loading={fetchingInventoryBoxes}
                  />
                ) : !isApprove ? (
                  <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <p className="text-[10px] text-slate-500 italic leading-relaxed">
                      Optional: pick an item to preview its in-stock boxes. You can still type or scan any store box_no_uid and Add without selecting an item.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2 bg-indigo-50/30 p-2 rounded-lg border border-indigo-100 shadow-sm">
                {(showPhoneQr || laserScan) ? (
                  <div className="flex items-stretch gap-2 w-full min-w-0">
                    {showPhoneQr && (
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          const prep = await prepareQrScanSession();
                          if (!prep.cameraOk) {
                            showScanToast(
                              "error",
                              "other-camera-permission",
                              prep.cameraDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA,
                              4000
                            );
                            return;
                          }
                          setIsScannerOpen(true);
                        })();
                      }}
                      disabled={isScannerOpen}
                      className={`h-9 px-3 bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${scanBtnFill}`}
                    >
                      <QrCode size={14} />
                      <span className="text-[10px] font-black uppercase">QR</span>
                    </button>
                    )}
                    {laserScan && (
                      <LaserScanField
                        key={`other-out-scan-${laserScanSessionKey}`}
                        active={otherLaserActive}
                        onScanned={handleOtherLaserScan}
                        onScanRejected={handleLaserScanRejected}
                        formatPreview={boxNoUidDisplayLabel}
                        compact
                        heightClass="h-9"
                        fill={scanBtnCount > 0}
                        armButtonLabel="Scan"
                      />
                    )}
                  </div>
                ) : null}
                {!laserScan && keyboardType ? (
                <div className="flex w-full min-w-0 gap-1.5">
                  <input
                    type="text"
                    value={manualOtherBoxId}
                    onChange={(e) => setManualOtherBoxId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (manualOtherBoxId.trim()) {
                          tryAddOtherBox(manualOtherBoxId);
                          setManualOtherBoxId("");
                        }
                      }
                    }}
                    placeholder="Type or paste box_no_uid…"
                    className={`${OK_INPUT} flex-1 min-w-0 font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (manualOtherBoxId.trim()) {
                        tryAddOtherBox(manualOtherBoxId);
                        setManualOtherBoxId("");
                      }
                    }}
                    className="h-9 px-3 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase shrink-0"
                  >
                    Add
                  </button>
                </div>
                ) : !showPhoneQr && !laserScan && !keyboardType ? (
                  <p className="text-[10px] text-slate-500 px-1">Enable scan mode in Settings.</p>
                ) : null}

              {pendingScanCount > 0 && (
                <div className="flex items-center gap-2 px-2 py-1 bg-white border border-indigo-100 rounded-lg">
                  <Loader2 size={12} className="animate-spin text-indigo-600" />
                  <p className="text-[9px] font-bold text-indigo-600 uppercase">
                    Confirming {pendingScanCount} box{pendingScanCount === 1 ? "" : "es"}…
                  </p>
                </div>
              )}

              <div className="bg-white/60 rounded-lg border border-indigo-50 overflow-hidden">
                <div className="px-3 py-1.5 bg-indigo-100/50 border-b border-indigo-100 flex justify-between items-center gap-2">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">Scanned boxes</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[8px] font-semibold text-slate-400 hidden sm:inline">B = Full · L = Loose</span>
                    <span className="text-[9px] font-black text-indigo-600/50 uppercase">{otherScannedCount} total</span>
                  </div>
                </div>
                <div className="max-h-[min(40dvh,280px)] overflow-y-auto overscroll-y-contain p-2 custom-scrollbar">
                  {otherScannedList.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {otherScannedList.map((box) => (
                        <div
                          key={box.box_no_uid}
                          className="bg-white p-2 rounded-lg border border-emerald-100 flex items-center justify-between shadow-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <BoxKindBadge isLoose={box.is_loose} />
                            <div className="flex flex-col leading-tight min-w-0">
                              <span className="text-[11px] font-mono font-black text-slate-700 truncate">
                                {boxNoUidDisplayLabel(box.box_no_uid) || box.box_no_uid}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase truncate">
                                #{box.packing_number || "—"} · Qty: {box.qty ?? 0}
                                {normalizeIsLoose(box.is_loose) ? " · Loose" : " · Full"}
                                {box.location_no ? ` · ${box.location_no}` : ""}
                              </span>
                            </div>
                          </div>
                          {!isEdit && canRemoveScannedBox ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveScannedBox(box.box_no_uid)}
                              className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg shrink-0"
                            >
                              <X size={16} />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                      <ScanLine size={32} className="opacity-20 mb-3" />
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        {isQcAreaMode ? "Scan in-store boxes" : "Scan store boxes"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <FormTextarea
              label="Security Remarks"
              value={form.remarks}
              onChange={(e) => handleChange("remarks", e.target.value)}
              placeholder="Reason, vehicle, escort…"
              rows={3}
            />

            <ModuleSopAcknowledgment
              ref={sopAckRef}
              key={`${open}-${sopPermissionType}-other`}
              moduleSlug="out_entry"
              permissionType={sopPermissionType}
              isOpen={open}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2 min-w-0 w-full" data-field="fuid">
              <div className="flex flex-col sm:flex-row sm:items-end gap-2 min-w-0 w-full">
                <div className="flex-1 min-w-0 w-full">
                  <SearchableSelect
                    className="min-w-0 w-full"
                    label="Forwarding Note (FUID)"
                    value={form.fuid}
                    onChange={(id) => handleChange("fuid", id)}
                    fetchService={(params) =>
                      fetchApprovedForwardingNotes({
                        ...params,
                        permission_module: "out_entry",
                        permission_action: "view",
                      })
                    }
                    getByIdService={(id) =>
                      forwardingNoteService.getViews({
                        id,
                        permission_module: "out_entry",
                        permission_action: "view",
                        filters: { approved: true },
                      })
                    }
                    dataKey="fuid"
                    labelKey="fuid"
                    subLabelKey="acc_name"
                    error={errors.fuid}
                    required
                    disabled={isConfirmed && !isEdit}
                  />
                </div>
                {!isConfirmed && (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={loading || fetchingFuid || !form.fuid}
                    title={
                      !form.fuid
                        ? "Select an approved forwarding note"
                        : fetchingFuid
                          ? "Loading forwarding note…"
                          : undefined
                    }
                    className="h-9 w-full sm:w-auto sm:min-w-[5.5rem] shrink-0 px-4 bg-indigo-600 text-white font-bold text-[11px] rounded-lg disabled:opacity-60 whitespace-nowrap sm:self-end"
                  >
                    {loading ? "…" : "Confirm"}
                  </button>
                )}
              </div>
            </div>

            {fuidDetails && isConfirmed && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                aria-expanded={dispatchDetailsOpen}
                aria-label={dispatchDetailsOpen ? "Collapse dispatch details" : "Expand dispatch details"}
                onClick={() => setDispatchDetailsOpen((o) => !o)}
                className="w-full px-2.5 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 min-h-[40px]"
              >
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide min-w-0 flex-1">
                  Dispatch details
                </span>
                <span
                  className={`shrink-0 px-2 py-0.5 text-[8px] font-black uppercase border ${
                    fuidDetails.approved === true || fuidDetails.approved === "true" || fuidDetails.approved === 1
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  {fuidDetails.approved === true || fuidDetails.approved === "true" || fuidDetails.approved === 1
                    ? "FN approved"
                    : "FN not approved"}
                </span>
                <ChevronRight
                  className={`text-slate-400 shrink-0 ml-auto transition-transform ${dispatchDetailsOpen ? "rotate-90" : ""}`}
                  size={16}
                />
              </button>
              {dispatchDetailsOpen && (
                <div className="px-2.5 pb-2">
                  <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-2 pt-2 text-[11px] leading-snug">
                    <div className="min-w-0">
                      <dt className="text-[8px] font-bold text-slate-400 uppercase">Vehicle</dt>
                      <dd className="font-semibold text-slate-800 break-words">{fuidDetails.vehicle_number || "—"}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[8px] font-bold text-slate-400 uppercase">Transporter</dt>
                      <dd className="font-semibold text-slate-800 break-words">{fuidDetails.transporter_name || "—"}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[8px] font-bold text-slate-400 uppercase">Transporter ID</dt>
                      <dd className="font-semibold text-slate-800 break-words">{fuidDetails.transporter_id || "—"}</dd>
                    </div>
                    <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                      <dt className="text-[8px] font-bold text-slate-400 uppercase">Customer</dt>
                      <dd className="font-semibold text-slate-800 break-words" title={fuidDetails.acc_name}>
                        {fuidDetails.acc_name || "—"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[8px] font-bold text-slate-400 uppercase">PO / Bill</dt>
                      <dd className="font-semibold text-slate-800 break-words">{fuidDetails.po_number || "—"}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>

            <div className="px-1">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Packing numbers to dispatch
                {hasMultiplePackings ? (
                  <span className="text-slate-400 font-medium normal-case ml-1">
                    — scan each tab in order; click any tab (including ✓) to review boxes
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex gap-1.5 overflow-x-auto overflow-y-visible px-0.5 pt-1 pb-2.5 no-scrollbar border-b border-slate-200">
              {packingGroups?.map((bd, idx) => {
                const progress = packingProgressList[idx];
                const isComplete = Boolean(progress?.complete && (progress?.required_total || 0) > 0);
                const isActive = activePackingIdx === idx;
                const needsScan = !isComplete && (progress?.required_total || 0) > 0;
                return (
                  <button
                    key={String(bd.packing_number ?? idx)}
                    type="button"
                    onClick={() => setActivePackingIdx(idx)}
                    title={
                      isComplete
                        ? `Packing #${bd.packing_number} — complete (${progress?.scanned_total ?? 0}/${progress?.required_total ?? 0}). Click to review.`
                        : `Packing #${bd.packing_number} — ${progress?.scanned_total ?? 0}/${progress?.required_total ?? 0} boxes`
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-t-lg text-[10px] font-bold shrink-0 transition-colors cursor-pointer ${
                      isComplete && isActive
                        ? "border-2 bg-emerald-200 border-emerald-600 text-emerald-900 shadow-sm ring-1 ring-emerald-300/60"
                        : isComplete
                          ? "border bg-emerald-100 border-emerald-400 text-emerald-800 hover:bg-emerald-200 hover:border-emerald-500"
                          : isActive && needsScan
                            ? "out-entry-packing-tab-active shadow-sm"
                            : needsScan && hasMultiplePackings
                              ? "border border-dashed bg-indigo-50/50 border-indigo-200 text-indigo-900 hover:bg-indigo-50 hover:border-indigo-300"
                              : "border bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300"
                    }`}
                  >
                    {isComplete ? <CheckCircle size={12} className="shrink-0" strokeWidth={3} /> : null}
                    <span>#{bd.packing_number}</span>
                    {(progress?.required_total || 0) > 0 ? (
                      <span
                        className={`tabular-nums text-[9px] font-black ${
                          isActive && !isComplete ? "text-indigo-100" : isComplete ? "text-emerald-700" : "text-slate-400"
                        }`}
                      >
                        {progress.scanned_total}/{progress.required_total}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {activeBD && (
              <div className="space-y-3">
                {/* Locations: summary row (item + qty + expand), then list */}
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={expandedLocations.size > 0}
                    aria-label={expandedLocations.size > 0 ? "Collapse location list" : "Expand location list"}
                    onClick={() =>
                      setExpandedLocations((prev) =>
                        prev.size === 0
                          ? new Set((activeBD.locations || []).map((l, idx) => `${activeBD.packing_number}-${l.location_id ?? idx}`))
                          : new Set()
                      )
                    }
                    className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 min-h-[40px]"
                  >
                    <div className="flex flex-1 min-w-0 items-center gap-2 sm:gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide shrink-0">Item code</span>
                        <span className="text-[11px] font-semibold text-slate-800 truncate" title={activeBD.item_code_text}>
                          {activeBD.item_code_text}
                        </span>
                      </div>
                      <span className="text-slate-300 shrink-0 select-none hidden sm:inline" aria-hidden>
                        ·
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="text-[9px] font-bold text-slate-500 uppercase tracking-wide shrink-0 sm:hidden"
                          title="Total qty to dispatch"
                        >
                          Total qty
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide shrink-0 hidden sm:inline">
                          Total qty to dispatch
                        </span>
                        <span className="text-[11px] font-semibold text-slate-800 tabular-nums">
                          {activeBD.total_qty ?? ((Number(activeBD.box_qty || 0) + Number(activeBD.loose_box_qty || 0)) || 0)}
                        </span>
                      </div>
                      <span className="text-slate-300 shrink-0 select-none hidden sm:inline" aria-hidden>
                        ·
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide shrink-0">Scanned</span>
                        <span className="text-[11px] font-semibold text-indigo-700 tabular-nums">
                          {scannedStats.box + scannedStats.loose} / {(Number(activeBD.box) || 0) + (Number(activeBD.loose_box) || 0)} boxes
                        </span>
                      </div>
                      <span className="text-slate-300 shrink-0 select-none hidden md:inline" aria-hidden>
                        ·
                      </span>
                      <div className="hidden md:flex items-center gap-1.5 min-w-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide shrink-0">Scanned qty</span>
                        <span className="text-[11px] font-semibold text-indigo-700 tabular-nums">
                          {scannedStats.bQty + scannedStats.lQty} / {activeBD.total_qty ?? ((Number(activeBD.box_qty || 0) + Number(activeBD.loose_box_qty || 0)) || 0)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className={`text-slate-400 shrink-0 transition-transform ${expandedLocations.size > 0 ? "rotate-90" : ""}`} />
                  </button>

                  <div className="px-2 pb-2 pt-1.5 space-y-1.5 max-h-[260px] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                    {activeBD.locations?.map((loc, lidx) => {
                      const isPackingArea =
                        Boolean(loc.is_packing_area) ||
                        (loc.location_id == null &&
                          String(loc.location_name || "")
                            .toLowerCase()
                            .includes("packing area"));
                      const locKey = isPackingArea
                        ? `${activeBD.packing_number}-packing-area`
                        : `${activeBD.packing_number}-${loc.location_id ?? lidx}`;
                      const isLocOpen = expandedLocations.has(locKey);
                      const locStats = (loc.boxes || []).reduce(
                        (acc, box) => {
                          if (isFnLooseBox(box)) acc.loose += 1;
                          else acc.full += 1;
                          return acc;
                        },
                        { full: 0, loose: 0 }
                      );
                      return (
                        <div
                          key={locKey}
                          className={`rounded-lg border overflow-hidden ${
                            isPackingArea
                              ? "border-amber-200 bg-amber-50/40"
                              : "border-slate-200 bg-slate-50/30"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleLocation(locKey)}
                            className="w-full px-2 py-1.5 flex justify-between items-center gap-2 hover:bg-slate-100/80 transition-colors text-left"
                          >
                            <span
                              className={`text-[10px] font-bold flex items-center gap-1.5 min-w-0 ${
                                isPackingArea ? "text-amber-800" : "text-indigo-600"
                              }`}
                            >
                              {isPackingArea ? (
                                <Package size={11} className="shrink-0" aria-hidden />
                              ) : (
                                <MapPin size={11} className="shrink-0" aria-hidden />
                              )}
                              <span className="truncate">{loc.location_name}</span>
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-1.5 py-0.5 rounded text-[7px] font-bold text-slate-500 uppercase bg-white border border-slate-200">
                                Full {locStats.full}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[7px] font-bold text-slate-500 uppercase bg-white border border-slate-200">
                                Loose {locStats.loose}
                              </span>
                              <ChevronRight size={14} className={`text-slate-400 transition-transform ${isLocOpen ? "rotate-90" : ""}`} />
                            </div>
                          </button>
                          {isLocOpen && (
                            <div className="px-1.5 pb-1.5 pt-0 flex flex-wrap gap-1">
                              {loc.boxes?.map((box, bidx) => {
                                const invStatus = boxInventoryStatus(box);
                                const scannable = isBoxAvailableForOutEntryScan(box, { forOutUid: scopedOutUid });
                                const isScanned = scannedBoxIds.has(box.box_no_uid);
                                return (
                                <div
                                  key={bidx}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border transition-all flex items-center gap-1 flex-wrap ${
                                    isScanned
                                      ? "bg-slate-50 text-slate-300 border-slate-100 opacity-70"
                                      : !scannable && invStatus === "stock_adjustment"
                                        ? "bg-orange-50 text-orange-700 border-orange-200 opacity-90"
                                        : !scannable && invStatus === "outward"
                                          ? "bg-rose-50 text-rose-600 border-rose-200 opacity-90"
                                          : isFnLooseBox(box)
                                            ? "bg-amber-50 text-amber-600 border-amber-200"
                                            : "bg-white text-slate-600 border-slate-200"
                                  }`}
                                  title={isScanned ? "Already scanned" : outEntryBoxStatusLabel(box)}
                                >
                                  {box.box_no_uid}
                                  {isFnLooseBox(box) && <span className="text-[7px] bg-amber-200 px-1 rounded-sm">L</span>}
                                </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Scanned boxes for the active packing */}
                <div className="space-y-2 bg-indigo-50/30 p-2 rounded-lg border border-indigo-100 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-indigo-600 min-w-0">
                      <CheckCircle2 size={16} className="shrink-0" />
                      <span className="text-[11px] font-black uppercase tracking-widest">Your Scanned Progress</span>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto shrink-0">
                      {/* Full Boxes Comparison */}
                      <div className={`px-3 py-1 rounded-lg text-center shadow-sm transition-all ${scannedStats.box === activeBD.box ? "bg-emerald-600 text-white" : "bg-white border border-emerald-100 text-emerald-700"}`}>
                        <p className="text-[7px] font-bold uppercase opacity-80">Full Boxes</p>
                        <p className="text-xs font-black">{scannedStats.box} / {activeBD.box}</p>
                      </div>
                      {/* Loose Boxes Comparison */}
                      <div className={`px-3 py-1 rounded-lg text-center shadow-sm transition-all ${scannedStats.loose === activeBD.loose_box ? "bg-amber-500 text-white" : "bg-white border border-amber-100 text-amber-700"}`}>
                        <p className="text-[7px] font-bold uppercase opacity-80">Loose Boxes</p>
                        <p className="text-xs font-black">{scannedStats.loose} / {activeBD.loose_box}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 p-1.5 bg-white border border-indigo-100 rounded-lg w-full min-w-0">
                    {(showPhoneQr || laserScan) ? (
                      <div className="flex items-stretch gap-2 w-full min-w-0">
                        {showPhoneQr && (
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              const prep = await prepareQrScanSession();
                              if (!prep.cameraOk) {
                                showScanToast(
                                  "error",
                                  "camera-permission",
                                  prep.cameraDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA,
                                  4000
                                );
                                return;
                              }
                              setIsScannerOpen(true);
                            })();
                          }}
                          disabled={isScannerOpen}
                          className={`h-9 px-3 bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${scanBtnFill}`}
                        >
                          <QrCode size={14} />
                          <span className="text-[10px] font-black uppercase">QR</span>
                        </button>
                        )}
                        {laserScan && (
                          <LaserScanField
                            key={`packing-out-scan-${laserScanSessionKey}`}
                            active={packingLaserActive}
                            onScanned={handlePackingLaserScan}
                            onScanRejected={handleLaserScanRejected}
                            formatPreview={boxNoUidDisplayLabel}
                            compact
                            heightClass="h-9"
                            fill={scanBtnCount > 0}
                            armButtonLabel="Scan"
                          />
                        )}
                      </div>
                    ) : (
                      <p className="text-[9px] font-bold uppercase tracking-wide text-indigo-600 px-1">
                        Scan-only mode: scanned boxes appear in the list below
                      </p>
                    )}
                  </div>
                  {pendingScanCount > 0 && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-white border border-indigo-100 rounded-lg">
                      <Loader2 size={12} className="animate-spin text-indigo-600" />
                      <p className="text-[9px] font-bold text-indigo-600 uppercase">
                        Confirming {pendingScanCount} box{pendingScanCount === 1 ? "" : "es"}…
                      </p>
                    </div>
                  )}

                  {/*
                    Manual testing block (keep commented):
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualBoxId}
                        onChange={(e) => setManualBoxId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            tryAddBox(manualBoxId);
                            setManualBoxId("");
                          }
                        }}
                        placeholder="Type box_no_uid for testing..."
                        className="w-full pl-3 pr-3 py-3 text-xs font-mono border-2 border-indigo-100 rounded-xl"
                      />
                      <button
                        onClick={() => {
                          tryAddBox(manualBoxId);
                          setManualBoxId("");
                        }}
                        className="px-6 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase"
                      >
                        Add
                      </button>
                    </div>
                  */}

                  {/* SCANNED LIST - Optimized Grid */}
                  <div className="bg-white/60 rounded-lg border border-indigo-50 overflow-hidden">
                    <div className="px-3 py-1.5 bg-indigo-100/50 border-b border-indigo-100 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase">Scanned Item List</span>
                      <span className="text-[9px] font-black text-indigo-600/50 uppercase tracking-tighter">
                        Boxes: {scannedStats.box + scannedStats.loose} · Qty: {scannedStats.bQty + scannedStats.lQty}
                      </span>
                    </div>
                    <div className="max-h-[min(40dvh,280px)] overflow-y-auto overscroll-y-contain p-2 custom-scrollbar">
                      {scannedInActive.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {scannedInActive.map((box, bidx) => (
                            <div key={bidx} className="bg-white p-2 rounded-lg border border-emerald-100 flex items-center justify-between shadow-sm hover:border-emerald-300 transition-all group">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${isFnLooseBox(box) ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                                  {isFnLooseBox(box) ? "L" : "B"}
                                </div>
                                <div className="flex flex-col leading-tight">
                                  <span className="text-[11px] font-mono font-black text-slate-700">
                                    {boxNoUidDisplayLabel(box.box_no_uid) || box.box_no_uid}
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">{box.location_name} • Qty: {box.qty}</span>
                                </div>
                              </div>
                              {canRemoveScannedBox ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveScannedBox(box.box_no_uid)}
                                  title="Remove from scan list"
                                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                >
                                  <X size={16} />
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-slate-200">
                            <ScanLine size={32} className="opacity-20" />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-widest">Ready for Scanning</p>
                          <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Scan boxes for Packing #{activeBD.packing_number}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="min-w-0">
              <FormTextarea
                label="Security Remarks"
                value={form.remarks}
                onChange={(e) => handleChange("remarks", e.target.value)}
                placeholder="Driver name, vehicle details, seal no., escort…"
                rows={3}
              />
            </div>
          </div>
            )}

        {isConfirmed && requiredBoxTotal > 0 && !isFulfillmentComplete && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-800 font-medium leading-normal">
              {OUT_ENTRY_APPROVE_BLOCKED_MSG} Scans are saved as a draft; inventory is not updated until this out entry is authorized.
            </p>
          </div>
        )}

        {/* ── Approval Status Toggle (only when all boxes scanned) ── */}
        {showApproval && isFulfillmentComplete ? (
          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${form.approved ? "bg-emerald-600 border-emerald-700 shadow-sm" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${form.approved ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
                <Shield size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${form.approved ? "text-white" : "text-slate-700"}`}>Approval Status</p>
                <p className={`text-[9px] uppercase font-bold tracking-tight ${form.approved ? "text-emerald-100" : "text-slate-400"}`}>
                  {form.approved ? "Out entry authorized" : "Out entry draft / pending"}
                </p>
              </div>
            </div>
            <label className={`relative inline-flex items-center ${!isFulfillmentComplete && !form.approved ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              <input type="checkbox" checked={form.approved} disabled={!isFulfillmentComplete && !form.approved} onChange={(e) => handleInputChange("approved", e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
            </label>
          </div>
        ) : isConfirmed && requiredBoxTotal > 0 && !isFulfillmentComplete ? (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-500 shrink-0" />
            <p className="text-[10px] text-amber-800 font-medium italic leading-relaxed">
              Draft: scan all {requiredBoxTotal} boxes, then click Submit. Stock is updated only when you authorize this entry from the list.
            </p>
          </div>
        ) : isConfirmed && isFulfillmentComplete && !isApprove ? (
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <p className="text-[10px] text-emerald-800 font-medium leading-relaxed">
              All boxes scanned. Click <span className="font-bold">Submit</span> below, then authorize from the Out Entry list when ready.
            </p>
          </div>
        ) : isAutoScanFlow ? (
          <div className="p-3 bg-emerald-50 rounded-lg border border-dashed border-emerald-200 flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600" />
            <p className="text-[10px] text-emerald-700 italic">
              {isInventoryOutMode
                ? "Inventory out requires approval from a user with Inventory Approve permission. Stock will update only after authorization from the Store Out list."
                : isQcAreaMode
                  ? "QC area out is auto-authorized. Scanned in-store boxes move to QC area and are logged in box transactions."
                  : "This entry will be automatically authorized on submission."}
            </p>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">This entry will require authorization before becoming active.</p>
          </div>
        )}

        {(!isAutoScanFlow || isApprove || (isEdit && isInventoryOutMode)) ? (
          <ModuleSopAcknowledgment
            ref={sopAckRef}
            key={`${open}-${sopPermissionType}`}
            moduleSlug="out_entry"
            permissionType={sopPermissionType}
            isOpen={open}
          />
        ) : null}

          </>
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

