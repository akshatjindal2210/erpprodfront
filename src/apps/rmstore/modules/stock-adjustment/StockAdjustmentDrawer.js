"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import { Check, Loader2, Package, Layers, Shield, MessageSquareQuote, AlertCircle, AlertTriangle, Box, FileText, Upload, RefreshCw } from "lucide-react";
import { notify } from "@/apps/rmstore/lib/utils/notify";

import Drawer from "@/ui/primitives/Drawer";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";

import { stockAdjustmentService } from "@/apps/rmstore/lib/services/stockAdjustment";
import { specService } from "@/apps/rmstore/lib/services/spec";
import { mrnService } from "@/apps/rmstore/lib/services/mrn";
import { splitQtyAcrossCoils, equalSplitQtyAcrossCoils, roundQty3, QTY_EPS } from "@/apps/rmstore/lib/helpers/coilUid";
import { formatStockAdjustmentCoilUid } from "@/apps/rmstore/lib/coilUidFormat";
import { resolveSerialNoForUid } from "@/apps/rmstore/lib/coilUidHelpers";
import FilePreviewLink from "@/ui/common/system/FilePreviewLink";
import { FILE_BASE_URL } from "@/platform/utils/core/lib";
import { getCurrentIndianFinancialYearStartYear } from "@/platform/utils/core/indianFinancialYear";
import { formatDocDate } from "@/platform/utils/core/utilHelper";
import { getBoxNoUidPrefix } from "@/platform/utils/global";
import RmMinusCoilBreakdownTable from "./RmMinusCoilBreakdownTable";
import RmAddCoilBreakdownTable from "./RmAddCoilBreakdownTable";
import RmStockAdjustmentDetailCards, { resolveUploadUrl } from "./RmStockAdjustmentDetailCards";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { isSaAddLike, usesLotGate, needsFinancialYear, normalizeSaEntryType } from "@/apps/rmstore/lib/utils/stockAdjustmentEntryTypes";

const MODULE = "rm_stock_adjustment";

const FIELD_LABEL = "block text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-1 leading-none";
const FIELD_LABEL_ROW =
  "flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-1 leading-none";
const FIELD_CONTROL =
  "h-8 lg:h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 lg:px-2.5 text-[10px] font-semibold text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500";
const READOUT_BOX =
  "min-h-[2rem] lg:min-h-[2.5rem] rounded-lg border border-slate-200 bg-slate-50 px-2 lg:px-2.5 flex flex-col justify-center shadow-sm";
const READOUT_BOX_MINUS =
  "min-h-[2rem] lg:min-h-[2.25rem] rounded-lg border border-rose-200/80 bg-rose-50/60 px-2 flex flex-col justify-center shadow-sm";

/** Stock Adjustment heat no — uppercase alphanumeric (e.g. 7H26F62191). */
function sanitizeStockAdjustmentHeatNo(raw) {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hasSavedDoc(path) {
  return Boolean(String(path || "").trim());
}

/** Prevent mouse wheel from changing number inputs while scrolling the panel (MRN sticker pattern). */
const preventNumberInputWheel = (e) => {
  e.preventDefault();
};

/** Past FY options in Add gate dropdown (current FY + this many previous years). */
const FINANCIAL_YEAR_RANGE_PAST = 9;
const FINANCIAL_YEAR_RANGE_FUTURE = 0;

function getFinancialYearOptions() {
  const currentFyStart = getCurrentIndianFinancialYearStartYear();
  const out = [];
  for (
    let y = currentFyStart - FINANCIAL_YEAR_RANGE_PAST;
    y <= currentFyStart + FINANCIAL_YEAR_RANGE_FUTURE;
    y++
  ) {
    const v = `${y}-${y + 1}`;
    out.push({ value: v, label: v });
  }
  return out;
}

function defaultFinancialYear() {
  const y = getCurrentIndianFinancialYearStartYear();
  return `${y}-${y + 1}`;
}

function formatMrnPickOptionParts(row, { showRemaining = false, showBill = false } = {}) {
  const rem = showRemaining ? resolveMrnRemainingQty(row) : null;
  const base = `${row?.label || formatItemLabel(row)} · ${row.uid || "—"}`;
  const main = rem != null ? `${base} · ${rem.toLocaleString()} KG left` : base;
  let billSub = "";
  if (showBill) {
    const billNo = String(row?.bill_no ?? row?.picker_bill_no ?? "").trim();
    const billDt = formatDocDate(row?.bill_dt ?? row?.picker_bill_dt);
    const billParts = [];
    if (billNo && billNo !== "—") billParts.push(`Bill ${billNo}`);
    if (billDt) billParts.push(billDt);
    billSub = billParts.join(" · ");
  }
  return { main, billSub };
}

function formatMrnPickOptionLabel(row, opts = {}) {
  const { main, billSub } = formatMrnPickOptionParts(row, opts);
  return billSub ? `${main} · ${billSub}` : main;
}

function mrnPickOptionFlags(entryType) {
  return {
    showRemaining: isSaAddLike(entryType),
    showBill: entryType === "old",
  };
}

function mapMrnPickSelectRow(row, entryType) {
  const flags = mrnPickOptionFlags(entryType);
  const { main, billSub } = formatMrnPickOptionParts(row, flags);
  return {
    id: String(row.uid || "").trim(),
    name: main,
    bill_sub: billSub,
  };
}

function formatItemLabel(row) {
  const desc = String(row?.item_desc || "").trim() || "—";
  const code = String(row?.item_code || "").trim() || "—";
  return `${desc} (${code})`;
}

function formatQty(v) {
  const n = roundQty3(v);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

function parseRemovedUids(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const p = JSON.parse(String(raw));
    if (Array.isArray(p)) return p.map(String);
    if (p?.uids) return p.uids.map(String);
  } catch {
    /* ignore */
  }
  return String(raw)
    .split(/[,|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveSerialNo(mrn) {
  return resolveSerialNoForUid({
    serial_no: mrn?.serial_no,
    mrn_uid: mrn?.uid || mrn?.mrn_uid,
    uid: mrn?.uid || mrn?.mrn_uid,
  });
}

function resolveMrnMetaForDisplay(mrnDetail, editData) {
  return {
    bill_no: mrnDetail?.bill_no ?? editData?.bill_no ?? null,
    bill_dt: mrnDetail?.bill_dt ?? editData?.bill_dt ?? null,
    mrn_dt: mrnDetail?.mrn_dt ?? editData?.mrn_dt ?? null,
  };
}

function mrnMetaSavePayload(mrnDetail, editData) {
  const meta = resolveMrnMetaForDisplay(mrnDetail, editData);
  return {
    bill_no: meta.bill_no ?? null,
    bill_dt: meta.bill_dt ?? null,
    mrn_dt: meta.mrn_dt ?? null,
  };
}

/** Remaining MRN receipt qty available for Stock Adjustment Add. */
function resolveMrnRemainingQty(mrn) {
  const remaining = Number(mrn?.remaining_qty);
  if (Number.isFinite(remaining) && remaining >= 0) return roundQty3(remaining);
  const receipt = Number(mrn?.it_recp_qty);
  const prior = Number(mrn?.prior_add_qty);
  if (Number.isFinite(receipt) && receipt > 0) {
    const used = Number.isFinite(prior) && prior >= 0 ? prior : 0;
    return roundQty3(Math.max(0, receipt - used));
  }
  return 0;
}

function coilRowType(row) {
  if (row?.sa_id != null && String(row?.sa_entry_type || "").toLowerCase() === "stock_in") {
    return "SA ADD";
  }
  return "MRN";
}

/** Minus breakdown: SA ADD coils first, then MRN — each group by coil_index. */
function sortMinusCoilRows(rows) {
  const typeRank = (row) => (coilRowType(row) === "SA ADD" ? 0 : 1);
  return [...rows].sort((a, b) => {
    const byType = typeRank(a) - typeRank(b);
    if (byType !== 0) return byType;
    return (Number(a.coil_index) || 0) - (Number(b.coil_index) || 0);
  });
}

function previewCoilUid({ mrnNo, serialNo, adjustmentId, total, index }) {
  return formatStockAdjustmentCoilUid({
    prefix: getBoxNoUidPrefix(),
    mrn_no: mrnNo,
    serial_no: serialNo,
    adjustment_id: adjustmentId,
    total,
    index,
  });
}

function SaDocFileInput({ label, file, onChange, disabled, savedPath, savedName, required = false }) {
  const localUrl = file instanceof File ? URL.createObjectURL(file) : "";
  const savedUrl = resolveUploadUrl(savedPath, FILE_BASE_URL);
  const previewUrl = localUrl || savedUrl;
  const displayName = file?.name || savedName || "";

  return (
    <div className="space-y-1 min-w-0">
      <span className={FIELD_LABEL}>
        {label}
        {required ? <span className="text-rose-500 ml-0.5">*</span> : null}
      </span>
      <div className={`flex items-center gap-1.5 h-9 px-2.5 border border-slate-200 rounded-lg bg-white min-w-0 ${disabled && !previewUrl ? "opacity-50" : ""}`}>
        <FileText size={14} className={`shrink-0 ${previewUrl ? "text-emerald-600" : "text-slate-500"}`} />
        {disabled ? (
          previewUrl ? (
            <FilePreviewLink href={previewUrl} fileName={displayName || label} className="text-[11px] font-medium text-indigo-700 truncate min-w-0 flex-1 hover:underline">
              {displayName || label}
            </FilePreviewLink>
          ) : (
            <span className="text-[11px] text-slate-400 truncate">—</span>
          )
        ) : previewUrl ? (
          <>
            <FilePreviewLink href={previewUrl} fileName={displayName || label} className="text-[11px] font-medium text-indigo-700 truncate min-w-0 flex-1 hover:underline">
              {displayName || label}
            </FilePreviewLink>
            <label className="shrink-0 text-[9px] font-bold text-indigo-600 cursor-pointer hover:underline">
              Change
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { onChange?.(e.target.files?.[0] || null); e.target.value = ""; }} />
            </label>
          </>
        ) : (
          <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
            <Upload size={14} className="text-slate-500 shrink-0" />
            <span className="text-[11px] font-medium text-slate-800 truncate">Choose file…</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { onChange?.(e.target.files?.[0] || null); e.target.value = ""; }} />
          </label>
        )}
      </div>
    </div>
  );
}

export default function StockAdjustmentDrawer({
  open,
  onClose,
  onSuccess,
  mode = "add",
  editData = null,
}) {
  const canAccess = useCanAccess();
  const canAuthorize = canAccess(MODULE, "authorize").allowed;
  const isView = mode === "view";
  const isApprove = mode === "approve";
  const isEdit = mode === "edit";
  const isAddMode = mode === "add";
  const readOnly = isView || isApprove;
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";

  const [formReady, setFormReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entryType, setEntryType] = useState("");
  const [financialYear, setFinancialYear] = useState(() => defaultFinancialYear());
  const [mrnInput, setMrnInput] = useState("");
  const [lotInput, setLotInput] = useState("");
  const [mrnUid, setMrnUid] = useState("");
  const [mrnNo, setMrnNo] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [mrnDetail, setMrnDetail] = useState(null);
  const [heatNo, setHeatNo] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [itemId, setItemId] = useState(null);
  const [itemRow, setItemRow] = useState(null);
  const [supplierId, setSupplierId] = useState(null);
  const [supplierRow, setSupplierRow] = useState(null);
  const [coilCount, setCoilCount] = useState("1");
  const [totalQty, setTotalQty] = useState("");
  const [coilQtys, setCoilQtys] = useState([0]);
  const [tcFile, setTcFile] = useState(null);
  const [rmtcFile, setRmtcFile] = useState(null);
  const [savedDocs, setSavedDocs] = useState({ tc_file_path: null, tc_file_name: null, rmtc_file_path: null, rmtc_file_name: null });
  const [remarks, setRemarks] = useState("");
  const [approveOnSave, setApproveOnSave] = useState(false);
  const [selectedCoils, setSelectedCoils] = useState([]);
  const [coilOptions, setCoilOptions] = useState([]);
  const [loadingCoils, setLoadingCoils] = useState(false);
  const [linkedCoils, setLinkedCoils] = useState([]);
  const [mobileTab, setMobileTab] = useState("details");
  const [gateReady, setGateReady] = useState(false);
  const [mrnPickOptions, setMrnPickOptions] = useState([]);
  const [mrnPickUid, setMrnPickUid] = useState("");
  const [editingWasApproved, setEditingWasApproved] = useState(false);
  const [addExtraCoils, setAddExtraCoils] = useState("0");
  const [addRemoveUids, setAddRemoveUids] = useState(() => new Set());
  const [perCoilQtyEdit, setPerCoilQtyEdit] = useState("");
  const [keptCoilQtyEdits, setKeptCoilQtyEdits] = useState({});
  const [specInfo, setSpecInfo] = useState(null);
  const [specChecked, setSpecChecked] = useState(false);

  const sopAckRef = useRef(null);
  const editId = editData?.adjustment_id ?? null;

  const resetForm = useCallback(() => {
    setEntryType("");
    setFinancialYear(defaultFinancialYear());
    setMrnInput("");
    setLotInput("");
    setMrnUid("");
    setMrnNo("");
    setSerialNo("");
    setMrnDetail(null);
    setHeatNo("");
    setGateLoading(false);
    setItemId(null);
    setItemRow(null);
    setSupplierId(null);
    setSupplierRow(null);
    setCoilCount("1");
    setTotalQty("");
    setCoilQtys([0]);
    setTcFile(null);
    setRmtcFile(null);
    setSavedDocs({ tc_file_path: null, tc_file_name: null, rmtc_file_path: null, rmtc_file_name: null });
    setRemarks("");
    setApproveOnSave(false);
    setSelectedCoils([]);
    setCoilOptions([]);
    setLinkedCoils([]);
    setGateReady(false);
    setEditingWasApproved(false);
    setAddExtraCoils("0");
    setAddRemoveUids(new Set());
    setPerCoilQtyEdit("");
    setKeptCoilQtyEdits({});
    setMobileTab("details");
    setMrnPickOptions([]);
    setMrnPickUid("");
    setSpecInfo(null);
    setSpecChecked(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!open) {
      setFormReady(false);
      resetForm();
      return undefined;
    }

    const boot = async () => {
      setFormReady(false);
      resetForm();
      if (isAddMode) {
        if (!cancelled) {
          setGateReady(false);
          setFormReady(true);
        }
        return;
      }
      try {
        const res = await stockAdjustmentService.getById(editId);
        if (cancelled) return;
        const d = res?.data;
        if (!d) {
          toast.error("Could not load the stock adjustment. Please try again.");
          return;
        }
        setEntryType(normalizeSaEntryType(d.entry_type) ?? "add");
        if (d.financial_year) setFinancialYear(String(d.financial_year));
        setLotInput(d.it_lot_no != null ? String(d.it_lot_no) : d.heat_no != null ? String(d.heat_no) : "");
        setRemarks(d.remarks || "");
        setHeatNo(d.heat_no != null ? String(d.heat_no) : d.coils?.[0]?.heat_no || "");
        setCoilCount(String(d.coil_count_impact || 1));
        const qtys = Array.isArray(d.coil_qtys) && d.coil_qtys.length
          ? d.coil_qtys.map((q) => roundQty3(q))
          : d.coils?.length
            ? d.coils.map((c) => roundQty3(c.qty))
            : d.per_coil_qty != null
              ? Array.from({ length: Number(d.coil_count_impact) || 1 }, () => roundQty3(d.per_coil_qty))
              : [0];
        setCoilQtys(qtys.length ? qtys : [0]);
        const loadedQty = roundQty3(d.qty ?? qtys.reduce((s, q) => s + (Number(q) || 0), 0));
        setTotalQty(
          String(
            d.entry_type === "minus" && loadedQty < 0 ? Math.abs(loadedQty) : loadedQty
          ) || ""
        );
        setSavedDocs({
          tc_file_path: d.tc_file_path ?? null,
          tc_file_name: d.tc_file_name ?? null,
          rmtc_file_path: d.rmtc_file_path ?? null,
          rmtc_file_name: d.rmtc_file_name ?? null,
        });
        setApproveOnSave(isApprove ? true : false);
        setEditingWasApproved(Boolean(d.approved));
        setAddExtraCoils("0");
        setAddRemoveUids(new Set());
        setPerCoilQtyEdit(
          d.per_coil_qty != null ? String(roundQty3(d.per_coil_qty)) : ""
        );
        const seedMrnUid = String(d.mrn_uid || d.coils?.[0]?.mrn_uid || "").trim();
        const seedMrnNo = d.mrn_no ?? d.coils?.[0]?.mrn_no ?? null;
        if (seedMrnUid || seedMrnNo != null) {
          setMrnUid(seedMrnUid);
          setMrnNo(seedMrnNo != null ? String(seedMrnNo) : "");
          setSerialNo(d.serial_no != null ? String(d.serial_no) : "");
          setMrnInput(seedMrnNo != null ? String(seedMrnNo) : seedMrnUid);
        }
        if (d.item_dcode || d.item_code) {
          setItemId(d.item_dcode ?? d.item_code);
          setItemRow({
            id: d.item_dcode ?? d.item_code,
            item_dcode: d.item_dcode,
            item_code: d.item_code,
            item_desc: d.item_desc,
          });
        }
        if (d.acc_code || d.acc_name) {
          setSupplierId(d.acc_code ?? null);
          setSupplierRow({
            id: d.acc_code,
            acc_code: d.acc_code,
            acc_name: d.acc_name,
          });
        }
        if (d.entry_type === "minus") {
          const uids = parseRemovedUids(d.removed_coil_uids);
          const coils =
            Array.isArray(d.coils) && d.coils.length
              ? d.coils
              : uids.map((uid) => ({ coil_no_uid: uid }));
          setSelectedCoils(coils);
          if (seedMrnUid) {
            try {
              const mrnRes = await mrnService.getDetail(seedMrnUid);
              if (mrnRes?.data) {
                setMrnDetail(mrnRes.data);
                if (mrnRes.data.serial_no != null) setSerialNo(String(mrnRes.data.serial_no));
                if (!d.acc_name && mrnRes.data.acc_name) {
                  setSupplierId(mrnRes.data.acc_code ?? null);
                  setSupplierRow({
                    id: mrnRes.data.acc_code,
                    acc_code: mrnRes.data.acc_code,
                    acc_name: mrnRes.data.acc_name,
                  });
                }
                const resolvedHeat =
                  d.heat_no != null && String(d.heat_no).trim()
                    ? String(d.heat_no)
                    : mrnRes.data.heat_no ?? mrnRes.data.it_lot_no ?? coils[0]?.heat_no ?? "";
                if (resolvedHeat) setHeatNo(String(resolvedHeat));
              }
            } catch {
              /* MRN may exist in ERP only */
            }
          }
          if (!d.acc_name && coils[0]?.acc_name) {
            setSupplierId(coils[0].acc_code ?? null);
            setSupplierRow({
              id: coils[0].acc_code,
              acc_code: coils[0].acc_code,
              acc_name: coils[0].acc_name,
            });
          }
        }
        setLinkedCoils(Array.isArray(d.coils) ? d.coils : []);
        if (isSaAddLike(d.entry_type) && seedMrnUid) {
          let mrnLoaded = false;
          const fy = d.financial_year || defaultFinancialYear();
          const lotKey = String(d.it_lot_no || d.heat_no || "").trim();
          const lotGate = usesLotGate(d.entry_type);
          try {
            const erpRes = await mrnService.searchErp({
              entry_type: d.entry_type,
              search_mode: lotGate ? "lot" : "mrn",
              financial_year: fy,
              ...(lotGate && lotKey
                ? { lot_no: lotKey, search: lotKey }
                : { search: seedMrnUid }),
              exclude_adjustment_id: editId ?? undefined,
            });
            const hit = Array.isArray(erpRes?.data) ? erpRes.data[0] : erpRes?.data;
            if (hit) {
              setMrnDetail(hit);
              setSerialNo(resolveSerialNo(hit));
              mrnLoaded = true;
            }
          } catch {
            /* try local detail */
          }
          if (!mrnLoaded) {
            try {
              const mrnRes = await mrnService.getDetail(seedMrnUid);
              if (mrnRes?.data) {
                setMrnDetail(mrnRes.data);
                if (mrnRes.data.serial_no != null) setSerialNo(String(mrnRes.data.serial_no));
                mrnLoaded = true;
              }
            } catch {
              /* MRN may exist in ERP only */
            }
          }
          if (!mrnLoaded) {
            setMrnDetail({
              uid: seedMrnUid,
              mrn_no: seedMrnNo,
              serial_no: d.serial_no ?? resolveSerialNo({ uid: seedMrnUid, mrn_uid: seedMrnUid }),
              mrn_dt: d.mrn_dt ?? null,
              bill_no: d.bill_no ?? null,
              bill_dt: d.bill_dt ?? null,
              qty_editable: true,
              qty_auto_calc: true,
            });
          }
        }
        if (d.mrn_dt || d.bill_no || d.bill_dt) {
          setMrnDetail((prev) => ({
            ...(prev || {}),
            mrn_dt: d.mrn_dt ?? prev?.mrn_dt ?? null,
            bill_no: d.bill_no ?? prev?.bill_no ?? null,
            bill_dt: d.bill_dt ?? prev?.bill_dt ?? null,
          }));
        }
        setGateReady(true);
      } catch (err) {
        if (!cancelled)
          toast.error(err?.message || "Could not load the stock adjustment. Please try again.");
      } finally {
        if (!cancelled) setFormReady(true);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [open, editId, isAddMode, isApprove, resetForm]);

  const applyMrnToForm = useCallback((mrn) => {
    setMrnDetail(mrn);
    const uid = String(mrn?.uid || mrn?.mrn_uid || "").trim();
    const no = mrn?.mrn_no != null ? String(mrn.mrn_no) : "";
    setMrnUid(uid);
    setMrnNo(no);
    setSerialNo(resolveSerialNo(mrn));
    setMrnInput(no || "");
    const lot =
      mrn?.it_lot_no != null
        ? String(mrn.it_lot_no)
        : mrn?.heat_no != null
          ? String(mrn.heat_no)
          : "";
    setLotInput(lot);
    setHeatNo(lot);
    if (mrn?.financial_year) setFinancialYear(String(mrn.financial_year));
    const startTotal = resolveMrnRemainingQty(mrn);
    setTotalQty(String(startTotal || ""));
    const autoCalc = mrn?.qty_auto_calc !== false;
    const editable = mrn?.qty_editable !== false;
    setCoilCount("1");
    setCoilQtys(startTotal > 0 ? (autoCalc || !editable ? splitQtyAcrossCoils(startTotal, 1) : [startTotal]) : []);
    if (mrn?.item_dcode || mrn?.item_code) {
      setItemId(mrn.item_dcode ?? mrn.item_code);
      setItemRow({
        id: mrn.item_dcode ?? mrn.item_code,
        item_dcode: mrn.item_dcode,
        item_code: mrn.item_code,
        item_desc: mrn.item_desc,
      });
    }
    if (mrn?.acc_code || mrn?.acc_name) {
      setSupplierId(mrn.acc_code ?? null);
      setSupplierRow({
        id: mrn.acc_code,
        acc_code: mrn.acc_code,
        acc_name: mrn.acc_name,
      });
    }
  }, []);

  const loadActiveCoils = useCallback(async (opts = {}) => {
    setLoadingCoils(true);
    try {
      const apiOpts = {
        page: 1,
        limit: 500,
        ...(opts.mrn_uid ? { mrn_uid: opts.mrn_uid } : {}),
        ...(opts.mrn_no ? { mrn_no: opts.mrn_no } : {}),
        ...(opts.item_code ? { item_code: opts.item_code } : {}),
        ...(opts.item_dcode ? { item_dcode: opts.item_dcode } : {}),
      };

      const mrnUid = opts.mrn_uid ? String(opts.mrn_uid).trim() : "";

      const [saRes, mrnRes] = await Promise.all([
        stockAdjustmentService.getActiveCoils(apiOpts),
        mrnUid ? mrnService.getCoils(mrnUid).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);

      const activeOnly = (rows) =>
        (Array.isArray(rows) ? rows : []).filter(
          (c) => String(c?.status || "active").toLowerCase() === "active"
        );

      const merged = new Map();
      for (const row of [...activeOnly(saRes?.data), ...activeOnly(mrnRes?.data)]) {
        const uid = String(row?.coil_no_uid || "").trim();
        if (uid) merged.set(uid, row);
      }
      const rows = sortMinusCoilRows([...merged.values()]);

      setCoilOptions(rows);
      if (!rows.length && mrnUid) {
        toast.info(
          "No active coils for this MRN. Generate MRN Portal stickers or approve a Stock Adjustment Add first.",
          { autoClose: 6000 }
        );
      }
    } catch (err) {
      toast.error(err?.message || "Could not load the coils. Please try again.");
      setCoilOptions([]);
    } finally {
      setLoadingCoils(false);
    }
  }, []);

  const applyLoadedMrn = useCallback(
    async (mrn, type) => {
      if (isSaAddLike(type)) {
        const remaining = resolveMrnRemainingQty(mrn);
        if (remaining <= 0) {
          const uid = String(mrn?.uid || mrn?.mrn_uid || "").trim();
          const receipt = Number(mrn?.it_recp_qty);
          const used = Number(mrn?.prior_add_qty);
          const detail =
            Number.isFinite(receipt) && receipt > 0
              ? ` Receipt ${roundQty3(receipt)} KG${Number.isFinite(used) && used > 0 ? ` — used ${roundQty3(used)} KG` : ""}.`
              : "";
          toast.error(
            `${uid || formatItemLabel(mrn)} has no remaining qty — cannot add stock.${detail}`,
            { autoClose: 8000 }
          );
          setGateReady(false);
          setMrnPickOptions([]);
          setMrnPickUid("");
          return;
        }
      }
      applyMrnToForm(mrn);
      setGateReady(true);
      setMrnPickOptions([]);
      setMrnPickUid("");
      if (type === "minus") {
        await loadActiveCoils({
          mrn_uid: String(mrn.uid || mrn.mrn_uid).trim(),
          mrn_no: mrn.mrn_no != null ? String(mrn.mrn_no) : undefined,
          item_code: mrn.item_code || undefined,
          item_dcode: mrn.item_dcode ?? undefined,
        });
      }
      toast.success(`${formatItemLabel(mrn)} · UID ${mrn.uid || mrn.mrn_uid}`);
    },
    [applyMrnToForm, loadActiveCoils]
  );

  const handleMrnPickSelect = useCallback(
    async (uid) => {
      const picked = mrnPickOptions.find((r) => String(r.uid).trim() === String(uid).trim());
      if (!picked) return;
      setMrnPickUid(String(uid).trim());
      setGateLoading(true);
      try {
        await applyLoadedMrn(picked, entryType);
      } catch (err) {
        toast.error(err?.message || "Could not load the selected MRN.");
        setGateReady(false);
      } finally {
        setGateLoading(false);
      }
    },
    [mrnPickOptions, applyLoadedMrn, entryType]
  );

  const fetchLotOptions = useCallback(
    async ({ search = "" } = {}) => {
      const fy = String(financialYear || "").trim();
      if (!fy) return { data: [], total: 0 };
      const res = await mrnService.listErpLots({
        financial_year: fy,
        search: sanitizeStockAdjustmentHeatNo(search),
      });
      const rows = Array.isArray(res?.data) ? res.data : [];
      const data = rows
        .map((row) => {
          const lot = String(row?.lot_no ?? "").trim();
          if (!lot) return null;
          return { id: lot, name: lot };
        })
        .filter(Boolean);
      return { data, total: data.length };
    },
    [financialYear]
  );

  const getLotById = useCallback(async (id) => {
    const lot = sanitizeStockAdjustmentHeatNo(id);
    return lot ? { id: lot, name: lot } : null;
  }, []);

  const fetchMrnPickOptions = useCallback(
    async ({ search = "" } = {}) => {
      const q = String(search || "").trim().toLowerCase();
      const data = mrnPickOptions
        .map((row) => mapMrnPickSelectRow(row, entryType))
        .filter(
          (row) =>
            row.id &&
            (!q ||
              row.name.toLowerCase().includes(q) ||
              row.id.toLowerCase().includes(q) ||
              String(row.bill_sub || "").toLowerCase().includes(q))
        );
      return { data, total: data.length };
    },
    [mrnPickOptions, entryType]
  );

  const getMrnPickById = useCallback(
    async (id) => {
      const uid = String(id || "").trim();
      const row = mrnPickOptions.find((r) => String(r.uid).trim() === uid);
      if (!row) return uid ? { id: uid, name: uid } : null;
      return mapMrnPickSelectRow(row, entryType);
    },
    [mrnPickOptions, entryType]
  );

  const handleGateLoad = useCallback(async () => {
    const lotGate = usesLotGate(entryType);
    const key = lotGate ? String(lotInput || "").trim() : String(mrnInput || "").trim();
    if (!entryType) {
      toast.error("Select adjustment type.");
      return;
    }
    if (needsFinancialYear(entryType) && !String(financialYear || "").trim()) {
      toast.error("Select a financial year.");
      return;
    }
    if (!key) {
      toast.error(lotGate ? "Enter Lot / Heat number." : "Enter MRN number.");
      return;
    }
    setGateLoading(true);
    setMrnPickOptions([]);
    setMrnPickUid("");
    try {
      const res = await mrnService.searchErp({
        entry_type: entryType,
        financial_year: needsFinancialYear(entryType) ? financialYear : undefined,
        ...(lotGate
          ? { search_mode: "lot", lot_no: key, search: key }
          : { search: key }),
        exclude_adjustment_id: editId ?? undefined,
      });
      const matches = Array.isArray(res?.data) ? res.data : [];
      if (!matches.length) {
        const scope = needsFinancialYear(entryType) ? ` in FY ${financialYear}` : "";
        throw new Error(`No MRN was found${scope}.`);
      }
      const list = isSaAddLike(entryType)
        ? matches.filter((m) => resolveMrnRemainingQty(m) > 0)
        : matches;
      if (isSaAddLike(entryType) && !list.length) {
        throw new Error(
          "Matching MRN(s) have no remaining receipt qty — stock is fully used (MRN Portal coils / prior adjustments)."
        );
      }
      if (list.length === 1) {
        await applyLoadedMrn(list[0], entryType);
      } else {
        setMrnPickOptions(list);
        setGateReady(false);
        toast.info(
          entryType === "old"
            ? `${list.length} MRN UIDs found — select one from the dropdown (bill no. & date shown).`
            : `${list.length} MRN UIDs found — select one from the dropdown.`,
          { autoClose: 5000 }
        );
      }
    } catch (err) {
      toast.error(err?.message || "Could not load MRN / lot details. Please try again.");
      setGateReady(false);
      setMrnPickOptions([]);
      setMrnPickUid("");
    } finally {
      setGateLoading(false);
    }
  }, [mrnInput, lotInput, entryType, financialYear, editId, applyLoadedMrn]);

  const minusCoilLoadOpts = useCallback(
    () => ({
      mrn_uid: mrnUid || mrnDetail?.uid || mrnDetail?.mrn_uid || undefined,
      mrn_no: mrnNo || (mrnDetail?.mrn_no != null ? String(mrnDetail.mrn_no) : undefined),
      item_code: itemRow?.item_code || mrnDetail?.item_code || editData?.item_code || undefined,
      item_dcode: itemRow?.item_dcode ?? itemRow?.id ?? itemId ?? editData?.item_dcode ?? undefined,
    }),
    [mrnUid, mrnNo, mrnDetail, itemRow, itemId, editData]
  );

  const specItemDcode = Number(itemRow?.item_dcode ?? itemRow?.id ?? itemId ?? editData?.item_dcode);
  const specItemLabel = String(
    itemRow?.item_desc || itemRow?.item_code || editData?.item_desc || editData?.item_code || specItemDcode || "this RM item"
  ).trim();

  useEffect(() => {
    if (!open || !isSaAddLike(entryType)) {
      setSpecInfo(null);
      setSpecChecked(false);
      return undefined;
    }
    if (!Number.isFinite(specItemDcode) || specItemDcode <= 0) {
      setSpecInfo(null);
      setSpecChecked(Boolean(itemRow || editData?.item_dcode));
      return undefined;
    }
    let cancelled = false;
    setSpecChecked(false);
    specService
      .getByItem(specItemDcode)
      .then((res) => {
        if (!cancelled) setSpecInfo(res?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setSpecInfo(null);
      })
      .finally(() => {
        if (!cancelled) setSpecChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entryType, specItemDcode, itemRow, editData?.item_dcode]);

  const specMissing = useMemo(() => {
    if (!isSaAddLike(entryType) || !specChecked) return false;
    if (!Number.isFinite(specItemDcode) || specItemDcode <= 0) return true;
    return !specInfo || Number(specInfo.spec_count) <= 0;
  }, [entryType, specChecked, specItemDcode, specInfo]);

  const specNotApproved = useMemo(() => {
    if (!isSaAddLike(entryType) || !specChecked || specMissing) return false;
    return specInfo?.approved !== true && specInfo?.approval_status !== "authorized";
  }, [entryType, specChecked, specMissing, specInfo]);

  const specValidationError = useMemo(() => {
    if (!isSaAddLike(entryType)) return null;
    if (!Number.isFinite(specItemDcode) || specItemDcode <= 0) {
      return "An RM item is required. Create RM Spec Master for that item first.";
    }
    if (!specChecked) return "Checking RM specifications… please try again in a moment.";
    if (specMissing) {
      return `No RM Spec Master exists for ${specItemLabel}. Create the specifications first, then save this stock adjustment.`;
    }
    if (specNotApproved) {
      return `RM specifications for ${specItemLabel} exist but are not authorized. Approve the spec first, then save.`;
    }
    return null;
  }, [entryType, specItemDcode, specChecked, specMissing, specNotApproved, specItemLabel]);

  const tcDocPath = savedDocs.tc_file_path || editData?.tc_file_path;
  const rmtcDocPath = savedDocs.rmtc_file_path || editData?.rmtc_file_path;
  const hasTcDocument = tcFile instanceof File || hasSavedDoc(tcDocPath);
  const hasRmtcDocument = rmtcFile instanceof File || hasSavedDoc(rmtcDocPath);

  useEffect(() => {
    if (!open || entryType !== "minus" || !gateReady) return;
    void loadActiveCoils(minusCoilLoadOpts());
  }, [open, entryType, gateReady, loadActiveCoils, minusCoilLoadOpts]);

  const toggleCoil = (coil) => {
    const uid = String(coil.coil_no_uid);
    setSelectedCoils((prev) => {
      const exists = prev.some((c) => String(c.coil_no_uid) === uid);
      if (exists) return prev.filter((c) => String(c.coil_no_uid) !== uid);
      return [...prev, coil];
    });
  };

  const qtyEditable = mrnDetail?.qty_editable !== false;
  const qtyAutoCalc = mrnDetail?.qty_auto_calc !== false;
  const canEditCoilQty = !readOnly && isSaAddLike(entryType);
  const canEditTotalQty = !readOnly && isSaAddLike(entryType);
  const fillQtysAuto = isSaAddLike(entryType) ? qtyAutoCalc : qtyAutoCalc || !qtyEditable;

  const mrnMeta = useMemo(
    () => resolveMrnMetaForDisplay(mrnDetail, editData),
    [mrnDetail, editData]
  );

  const originalReceiptQty = useMemo(() => {
    const mrnQty = Number(mrnDetail?.it_recp_qty);
    return Number.isFinite(mrnQty) && mrnQty > 0 ? roundQty3(mrnQty) : 0;
  }, [mrnDetail?.it_recp_qty]);

  const priorAddQty = useMemo(() => {
    const v = Number(mrnDetail?.prior_add_qty);
    return Number.isFinite(v) && v >= 0 ? roundQty3(v) : 0;
  }, [mrnDetail?.prior_add_qty]);

  const coilUsedQty = useMemo(() => {
    const v = Number(mrnDetail?.coil_used_qty);
    return Number.isFinite(v) && v >= 0 ? roundQty3(v) : 0;
  }, [mrnDetail?.coil_used_qty]);

  const pendingSaAddQty = useMemo(() => {
    const v = Number(mrnDetail?.pending_sa_add_qty);
    return Number.isFinite(v) && v >= 0 ? roundQty3(v) : 0;
  }, [mrnDetail?.pending_sa_add_qty]);

  /** Max qty allowed — MRN receipt minus coils (portal/SA) minus pending SA Add. */
  const maxRemainingQty = useMemo(() => {
    if (!isSaAddLike(entryType)) return 0;
    const remaining = Number(mrnDetail?.remaining_qty);
    if (Number.isFinite(remaining) && remaining >= 0) return roundQty3(remaining);
    if (originalReceiptQty > 0) return roundQty3(Math.max(0, originalReceiptQty - priorAddQty));
    return 0;
  }, [entryType, mrnDetail?.remaining_qty, originalReceiptQty, priorAddQty]);

  const noRemainingQty =
    isSaAddLike(entryType) && Boolean(String(mrnUid || mrnDetail?.uid || "").trim()) && maxRemainingQty <= 0;
  const canEditAddQty = canEditTotalQty && !noRemainingQty;
  const canEditAddCoils = !readOnly && isSaAddLike(entryType) && !noRemainingQty;

  const adjustmentQty = useMemo(() => {
    const v = Number(totalQty);
    return Number.isFinite(v) && v >= 0 ? roundQty3(v) : 0;
  }, [totalQty]);

  const buildCoilQtys = useCallback(
    (count, total, { autoCalc }) => {
      const n = Math.max(1, parseInt(String(count), 10) || 1);
      const t = roundQty3(total);
      if (t <= 0) return Array.from({ length: n }, () => "");
      return autoCalc ? splitQtyAcrossCoils(t, n) : equalSplitQtyAcrossCoils(t, n);
    },
    []
  );

  const savedAddCoilRows = useMemo(() => {
    if (!isSaAddLike(entryType)) return [];
    return (linkedCoils || []).filter((c) => {
      if (c?.preview || !String(c?.coil_no_uid || "").trim()) return false;
      return String(c?.status || "active").toLowerCase() === "active";
    });
  }, [entryType, linkedCoils]);

  useEffect(() => {
    if (!isSaAddLike(entryType) || !gateReady || readOnly || !fillQtysAuto) return;
    if (isEdit) return;
    const n = Math.max(1, parseInt(coilCount, 10) || 1);
    if (adjustmentQty <= 0) return;
    setCoilQtys(buildCoilQtys(n, adjustmentQty, { autoCalc: qtyAutoCalc }));
  }, [
    coilCount,
    adjustmentQty,
    entryType,
    gateReady,
    readOnly,
    fillQtysAuto,
    qtyAutoCalc,
    buildCoilQtys,
    isEdit,
  ]);

  const handleTotalQtyChange = useCallback(
    (raw) => {
      if (!canEditAddQty) return;
      if (raw === "") {
        setTotalQty("");
        setCoilQtys([]);
        return;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return;
      let next = roundQty3(n);
      if (next > maxRemainingQty + QTY_EPS) {
        next = Math.max(0, maxRemainingQty);
      }
      const nextStr = String(next);
      if (nextStr === String(totalQty).trim()) return;
      setTotalQty(nextStr);
      if (next <= 0) {
        setCoilQtys([]);
        return;
      }
      if (fillQtysAuto) {
        const count = Math.max(1, parseInt(coilCount, 10) || 1);
        setCoilQtys(buildCoilQtys(count, next, { autoCalc: qtyAutoCalc }));
      }
    },
    [
      canEditAddQty,
      maxRemainingQty,
      totalQty,
      fillQtysAuto,
      coilCount,
      buildCoilQtys,
      qtyAutoCalc,
    ]
  );

  const handleCoilCountChange = (raw) => {
    setCoilCount(raw);
    if (adjustmentQty <= 0) {
      setCoilQtys([]);
      return;
    }
    if (fillQtysAuto) {
      const n = Math.max(1, parseInt(raw, 10) || 1);
      setCoilQtys(buildCoilQtys(n, adjustmentQty, { autoCalc: qtyAutoCalc }));
      return;
    }
    const n = Math.max(1, parseInt(raw, 10) || 1);
    setCoilQtys((prev) => {
      const next = [...prev];
      while (next.length < n) next.push("");
      return next.slice(0, n);
    });
  };

  const onCoilQtyChange = (index, raw) => {
    if (!canEditCoilQty) return;
    setCoilQtys((prev) => {
      const next = [...prev];
      if (raw === "") next[index] = "";
      else {
        const n = Number(raw);
        next[index] = Number.isFinite(n) ? Math.max(0, Math.round(n)) : "";
      }
      if (!fillQtysAuto) {
        const sum = next.reduce((s, q) => s + (Number(q) || 0), 0);
        const capped =
          sum > maxRemainingQty + QTY_EPS ? Math.max(0, maxRemainingQty) : roundQty3(sum);
        setTotalQty(sum > 0 ? String(capped) : "");
      }
      return next;
    });
  };

  const coilQtySum = useMemo(
    () => coilQtys.reduce((s, q) => s + (Number(q) || 0), 0),
    [coilQtys]
  );
  const qtyMatches = Math.abs(coilQtySum - adjustmentQty) <= QTY_EPS;
  const qtyDiff = roundQty3(coilQtySum - adjustmentQty);
  const exceedsRemaining =
    isSaAddLike(entryType) &&
    Boolean(String(mrnUid || mrnDetail?.uid || "").trim()) &&
    adjustmentQty > maxRemainingQty + QTY_EPS;
  const addQtyUnit = "KG";
  const showAddQtyMismatch = isSaAddLike(entryType) && gateReady && !readOnly && adjustmentQty > 0 && coilQtys.length > 0 && !qtyMatches;
  const qtyMismatchLabel = useMemo(() => {
    if (!showAddQtyMismatch) return "";
    return qtyDiff > 0
      ? `Coil sum ${formatQty(coilQtySum)} exceeds MRN total ${formatQty(adjustmentQty)} by ${formatQty(Math.abs(qtyDiff))} ${addQtyUnit}`
      : `Coil sum ${formatQty(coilQtySum)} is short of MRN total ${formatQty(adjustmentQty)} by ${formatQty(Math.abs(qtyDiff))} ${addQtyUnit}`;
  }, [showAddQtyMismatch, qtyDiff, coilQtySum, adjustmentQty, addQtyUnit]);

  const breakdownCoilQtys = coilQtys;

  const onBreakdownCoilQtyChange = onCoilQtyChange;

  const addPreviewQty = useMemo(() => {
    if (!isSaAddLike(entryType)) return 0;
    return roundQty3(coilQtySum || adjustmentQty || 0);
  }, [entryType, coilQtySum, adjustmentQty]);

  const isApprovedAdd = isSaAddLike(entryType) && Boolean(editData?.approved);
  const canPrintStickers = isApprovedAdd && (isView || isApprove);

  const addPreviewRows = useMemo(() => {
    if (!isSaAddLike(entryType)) return [];
    if (readOnly && savedAddCoilRows.length > 0) {
      return savedAddCoilRows.map((c, i) => ({
        idx: i + 1,
        coil_no_uid: c.coil_no_uid,
        qty: Number(c.qty) || 0,
        preview: false,
        generated: true,
        is_saved: true,
        editable: false,
        coil_index: c.coil_index ?? i + 1,
        total_coils: c.total_coils ?? savedAddCoilRows.length,
      }));
    }
    if (adjustmentQty <= 0) return [];
    const n = Math.max(1, parseInt(coilCount, 10) || 1);
    const previewSerial = resolveSerialNoForUid({
      serial_no: serialNo || resolveSerialNo(mrnDetail),
      mrn_uid: mrnUid || mrnDetail?.uid || mrnDetail?.mrn_uid,
    });
    const previewMrnNo = mrnNo || mrnDetail?.mrn_no || "0";
    const previewAdjId = editData?.adjustment_id ?? editId ?? 0;
    return Array.from({ length: n }, (_, i) => ({
      idx: i + 1,
      coil_no_uid: previewCoilUid({
        mrnNo: previewMrnNo,
        serialNo: previewSerial,
        adjustmentId: previewAdjId,
        total: n,
        index: i + 1,
      }),
      qty: roundQty3(coilQtys[i] ?? 0),
      preview: !readOnly,
      editable: canEditCoilQty,
    }));
  }, [
    entryType,
    coilCount,
    coilQtys,
    adjustmentQty,
    savedAddCoilRows,
    readOnly,
    canEditCoilQty,
    mrnNo,
    serialNo,
    mrnDetail,
    editData?.adjustment_id,
    editId,
    isApprovedAdd,
  ]);

  const minusSelectedUidSet = useMemo(() => {
    return new Set(selectedCoils.map((c) => String(c.coil_no_uid || "").trim()).filter(Boolean));
  }, [selectedCoils]);

  const minusPreviewQty = useMemo(
    () => selectedCoils.reduce((s, c) => s + (Number(c.qty) || 0), 0),
    [selectedCoils]
  );

  const minusCoilList = useMemo(() => {
    if (readOnly) return selectedCoils;
    const byUid = new Map();
    selectedCoils.forEach((c) => {
      const uid = String(c?.coil_no_uid || "").trim();
      if (uid) byUid.set(uid, c);
    });
    coilOptions.forEach((c) => {
      const uid = String(c?.coil_no_uid || "").trim();
      if (uid && !byUid.has(uid)) byUid.set(uid, c);
    });
    return sortMinusCoilRows([...byUid.values()]);
  }, [readOnly, selectedCoils, coilOptions]);

  const minusBreakdownSummary = useMemo(() => {
    const list = minusCoilList;
    let mrnCount = 0;
    let saCount = 0;
    let totalKg = 0;
    for (const c of list) {
      totalKg += Number(c.qty) || 0;
      if (coilRowType(c) === "SA ADD") saCount += 1;
      else mrnCount += 1;
    }
    const n = list.length;
    return {
      totalCoils: n,
      mrnCount,
      saCount,
      totalKg: roundQty3(totalKg),
      avgPerCoil: n > 0 ? roundQty3(totalKg / n) : 0,
    };
  }, [minusCoilList]);

  const previewSigned =
    isSaAddLike(entryType) ? addPreviewQty : entryType === "minus" ? -minusPreviewQty : 0;

  const drawerTitle =
    isApprove
      ? "Approve stock adjustment"
      : isView
        ? "View stock adjustment"
        : isEdit
          ? "Edit stock adjustment"
          : "Stock adjustment";

  const finishSave = useCallback(
    ({ approvedAdd = false, savedId = null, coils = null } = {}) => {
      if (approvedAdd && savedId) {
        onSuccess?.({
          openPrintStickers: true,
          record: {
            adjustment_id: savedId,
            entry_type: entryType,
            approved: true,
            item_code: itemRow?.item_code ?? editData?.item_code ?? null,
            item_desc: itemRow?.item_desc ?? editData?.item_desc ?? null,
            acc_name: supplierRow?.acc_name ?? editData?.acc_name ?? null,
            heat_no: heatNo || editData?.heat_no || null,
            it_lot_no: editData?.it_lot_no ?? null,
            mrn_no: mrnNo ?? editData?.mrn_no ?? null,
            mrn_uid: mrnUid || editData?.mrn_uid || null,
            unit: "KG",
            ...(Array.isArray(coils) && coils.length ? { coils } : {}),
          },
        });
      } else {
        onSuccess?.();
      }
      onClose?.();
    },
    [onSuccess, onClose, itemRow, editData, supplierRow, heatNo, entryType, mrnNo, mrnUid]
  );

  const handleSave = async ({ approve } = {}) => {
    if (readOnly && !isApprove) return;
    if (!sopAckRef.current?.assertAcknowledged()) return;
    if (!entryType) {
      toast.error("Choose Add (+), Minus (-), or Old.");
      return;
    }
    if (isSaAddLike(entryType) && specValidationError) {
      toast.error(specValidationError);
      return;
    }
    if (isSaAddLike(entryType) && (!hasTcDocument || !hasRmtcDocument)) {
      toast.error("Both the TC and RMTC documents are required.");
      return;
    }

    setSaving(true);
    try {
      if (isApprove) {
        if (!canAuthorize) {
          toast.error("You do not have approval permission.");
          setSaving(false);
          return;
        }
        const approveRes = await stockAdjustmentService.update(editId, { approved: true });
        const approvedCoils = Array.isArray(approveRes?.data?.coils) ? approveRes.data.coils : [];
        toast.success(
          isSaAddLike(entryType)
            ? "Approved — coils created in inventory. Opening sticker print…"
            : "Stock adjustment approved."
        );
        finishSave({ approvedAdd: isSaAddLike(entryType), savedId: editId, coils: approvedCoils });
        return;
      }

      const doApprove = Boolean((approve || approveOnSave) && canAuthorize);

      if (isSaAddLike(entryType)) {
        if (!itemRow?.item_dcode && !itemRow?.item_code && !itemId) {
          toast.error("Load an MRN first. The item details are missing.");
          setSaving(false);
          return;
        }

        let n;
        let qtyList;
        let total;

        n = parseInt(coilCount, 10);
        total = roundQty3(Number(totalQty) || coilQtySum);
        qtyList = coilQtys.map((q) => roundQty3(Number(q) || 0));
        if (!Number.isFinite(n) || n < 1) {
          toast.error("Enter the number of coils.");
          setSaving(false);
          return;
        }
        if (!Number.isFinite(total) || total <= 0) {
          toast.error("Enter a total quantity greater than 0.");
          setSaving(false);
          return;
        }
        if (qtyList.length !== n || qtyList.some((q) => q <= 0)) {
          toast.error("Enter a quantity greater than 0 for each coil.");
          setSaving(false);
          return;
        }
        if (Math.abs(qtyList.reduce((s, q) => s + q, 0) - total) > QTY_EPS) {
          const diff = roundQty3(qtyList.reduce((s, q) => s + q, 0) - total);
          toast.error(
            diff > 0
              ? `Coil sum ${formatQty(qtyList.reduce((s, q) => s + q, 0))} exceeds MRN total ${formatQty(total)} by ${formatQty(Math.abs(diff))} KG`
              : `Coil sum ${formatQty(qtyList.reduce((s, q) => s + q, 0))} is short of MRN total ${formatQty(total)} by ${formatQty(Math.abs(diff))} KG`
          );
          setSaving(false);
          return;
        }
        if (noRemainingQty && total > QTY_EPS) {
          toast.error(
            `No remaining MRN receipt qty — cannot add ${formatQty(total)} KG.${
              originalReceiptQty > 0
                ? ` Receipt ${formatQty(originalReceiptQty)} KG is fully used (MRN Portal / prior adjustments).`
                : ""
            }`
          );
          setSaving(false);
          return;
        }
        if (total > maxRemainingQty + QTY_EPS) {
          const usedParts = [];
          if (coilUsedQty > 0) usedParts.push(`coils ${coilUsedQty}`);
          if (pendingSaAddQty > 0) usedParts.push(`pending SA ${pendingSaAddQty}`);
          const usedNote = usedParts.length ? ` Used: ${usedParts.join(", ")}.` : "";
          toast.error(
            `Total (${total}) exceeds remaining MRN qty (${maxRemainingQty} of ${originalReceiptQty}).${usedNote}`
          );
          setSaving(false);
          return;
        }

        const payload = {
          entry_type: entryType,
          ...(needsFinancialYear(entryType) ? { financial_year: financialYear || null } : {}),
          ...(usesLotGate(entryType)
            ? { it_lot_no: lotInput.trim() || heatNo.trim() || null }
            : {}),
          item_dcode: itemRow?.item_dcode ?? itemRow?.id ?? itemId,
          item_code: itemRow?.item_code || null,
          item_desc: itemRow?.item_desc || null,
          heat_no: heatNo.trim() || null,
          mrn_uid: mrnUid || null,
          mrn_no: (() => {
            const num = Number(mrnNo);
            return Number.isFinite(num) ? num : null;
          })(),
          serial_no: (() => {
            const num = Number(serialNo || resolveSerialNo(mrnDetail));
            return Number.isFinite(num) ? num : null;
          })(),
          acc_code: supplierRow?.acc_code ?? supplierId ?? null,
          acc_name: supplierRow?.acc_name || null,
          no_of_coils: n,
          coil_count_impact: n,
          coil_qtys: qtyList,
          qty: total,
          total_qty: total,
          ...(originalReceiptQty > 0 ? { it_recp_qty: originalReceiptQty, mrn_receipt_qty: originalReceiptQty } : {}),
          ...mrnMetaSavePayload(mrnDetail, editData),
          unit: "KG",
          remarks: remarks.trim() || null,
          approved: doApprove,
          ...(editId ? { adjustment_id: editId } : {}),
        };

        let savedId = editId;
        let didApproveAdd = false;
        let approvedCoils = [];
        if (isEdit && editId) {
          const { approved: _approvedFlag, ...savePayload } = payload;
          await stockAdjustmentService.update(editId, savePayload);
          if (doApprove) {
            const approveRes = await stockAdjustmentService.update(editId, { approved: true });
            approvedCoils = Array.isArray(approveRes?.data?.coils) ? approveRes.data.coils : [];
            didApproveAdd = true;
          }
          toast.success(
            doApprove
              ? "Approved — coils created in inventory. Opening sticker print…"
              : "Updated and set to pending."
          );
        } else {
          const createRes = await stockAdjustmentService.create(payload);
          savedId = createRes?.data?.adjustment_id ?? createRes?.adjustment_id ?? null;
          approvedCoils = Array.isArray(createRes?.data?.coils) ? createRes.data.coils : [];
          didApproveAdd = Boolean(doApprove);
          toast.success(
            doApprove
              ? "Approved — coils created in inventory. Opening sticker print…"
              : "Saved as pending. Approve it to create the coils."
          );
        }

        if (savedId && (tcFile || rmtcFile)) {
          try {
            await stockAdjustmentService.uploadDocs({
              adjustment_id: savedId,
              tcFile,
              rmtcFile,
            });
          } catch (upErr) {
            toast.warn(upErr?.message || "Saved, but document upload failed.");
          }
        }

        finishSave({ approvedAdd: didApproveAdd, savedId, coils: approvedCoils });
        return;
      } else {
        if (!selectedCoils.length) {
          toast.error("Select at least one coil.");
          setSaving(false);
          return;
        }
        const minusSupplierCode =
          supplierRow?.acc_code ??
          supplierId ??
          selectedCoils[0]?.acc_code ??
          mrnDetail?.acc_code ??
          null;
        const minusSupplierName =
          supplierRow?.acc_name ||
          mrnDetail?.acc_name ||
          selectedCoils[0]?.acc_name ||
          null;
        const payload = {
          entry_type: "minus",
          removed_coil_uids: selectedCoils.map((c) => c.coil_no_uid),
          mrn_uid: mrnUid || null,
          mrn_no: (() => {
            const n = Number(mrnNo);
            return Number.isFinite(n) ? n : null;
          })(),
          item_dcode: itemRow?.item_dcode ?? itemRow?.id ?? itemId ?? null,
          item_code: itemRow?.item_code || null,
          item_desc: itemRow?.item_desc || null,
          heat_no: heatNo.trim() || null,
          acc_code: minusSupplierCode,
          acc_name: minusSupplierName,
          ...mrnMetaSavePayload(mrnDetail, editData),
          unit: "KG",
          remarks: remarks.trim() || null,
          approved: doApprove,
        };
        let res;
        if (isEdit && editId) {
          const { approved: _approvedFlag, ...savePayload } = payload;
          await stockAdjustmentService.update(editId, savePayload);
          if (doApprove) {
            res = await stockAdjustmentService.update(editId, { approved: true });
          } else {
            res = { success: true };
          }
        } else {
          res = await stockAdjustmentService.create(payload);
        }

        notify(res, "Saved successfully.");
      }

      finishSave();
    } catch (err) {
      toast.error(err?.message || "Could not save the stock adjustment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const approvalDisplayApproved = isApprove
    ? Boolean(editData?.approved)
    : isEdit
      ? editingWasApproved
      : isView
        ? Boolean(editData?.approved)
        : Boolean(approveOnSave && canAuthorize);

  const approvalStatusLabel = isApprove
    ? editData?.approved
      ? "Authorized"
      : "Pending"
    : isEdit
      ? editingWasApproved
        ? "Approved"
        : "Pending"
      : approvalDisplayApproved
        ? "Authorized"
        : "Pending";

  const mrnReadoutField = (
    <div className="flex flex-col justify-start min-w-0 max-lg:col-span-1 lg:col-span-2">
      <span className={FIELD_LABEL_ROW}>
        <Package className="w-3 h-3 text-slate-400 shrink-0" aria-hidden />
        MRN
      </span>
      <div className={READOUT_BOX}>
        <p className="text-[11px] font-mono font-bold text-slate-900 leading-tight truncate tabular-nums">
          {mrnUid || "—"}
        </p>
        {/* {itemRow?.item_code || itemRow?.item_desc ? (
          <p className="text-[10px] font-semibold text-indigo-700 mt-0.5 truncate leading-snug">
            {formatItemLabel(itemRow)}
          </p>
        ) : null} */}
        {/* {(mrnNo || (isSaAddLike(entryType) && financialYear)) && (
          <p className="text-[9px] font-semibold text-slate-500 mt-0.5 truncate">
            {mrnNo ? `No. ${mrnNo}` : ""}
            {isSaAddLike(entryType) && financialYear ? `${mrnNo ? " · " : ""}FY ${financialYear}` : ""}
          </p>
        )} */}
      </div>
    </div>
  );

  const detailCards = (
    <RmStockAdjustmentDetailCards
      itemCode={itemRow?.item_code || selectedCoils[0]?.item_code || editData?.item_code}
      itemDesc={itemRow?.item_desc || selectedCoils[0]?.item_desc || editData?.item_desc}
      showSupplier={isSaAddLike(entryType) || entryType === "minus"}
      supplierName={supplierRow?.acc_name || mrnDetail?.acc_name || editData?.acc_name || "—"}
      billNo={mrnMeta.bill_no}
      billDt={mrnMeta.bill_dt}
      heatNo={heatNo}
      onHeatNoChange={!readOnly ? setHeatNo : undefined}
      heatInputClassName={`${FIELD_CONTROL} font-mono font-bold uppercase`}
      mrnUid={mrnUid}
      mrnDt={mrnMeta.mrn_dt}
      coilInfoTitle={entryType === "minus" ? "MRN Info" : "Coil Info"}
      unit="KG"
      coilCountDisplay={
        isSaAddLike(entryType)
          ? coilCount || "—"
          : `${minusCoilList.length} avail · ${selectedCoils.length} sel`
      }
      totalQtyLabel={isSaAddLike(entryType) ? "Total Qty" : "Selected Qty"}
      totalQtyNode={
        isSaAddLike(entryType) ? (
          <>
            {formatQty(adjustmentQty)} {addQtyUnit}
            {!readOnly && canEditCoilQty && coilQtys.length > 0 ? (
              <span className="block mt-1 space-y-0.5">
                <span
                  className={`text-[10px] font-bold uppercase ${
                    qtyMatches && !exceedsRemaining ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  Sum {formatQty(coilQtySum)} / {formatQty(adjustmentQty)} {addQtyUnit}
                </span>
                {!qtyMatches && qtyDiff !== 0 ? (
                  <span className="text-[10px] font-bold uppercase text-rose-600">
                    {qtyDiff > 0
                      ? `Higher by ${formatQty(Math.abs(qtyDiff))}`
                      : `Lower by ${formatQty(Math.abs(qtyDiff))}`}
                  </span>
                ) : null}
                {exceedsRemaining ? (
                  <span className="text-[10px] font-bold uppercase text-rose-600">
                    Max {formatQty(maxRemainingQty)} {addQtyUnit}
                  </span>
                ) : null}
              </span>
            ) : null}
          </>
        ) : (
          minusPreviewQty.toLocaleString()
        )
      }
      showDocuments={isSaAddLike(entryType)}
      documentsSlot={
        isSaAddLike(entryType) ? (
          <>
            <SaDocFileInput
              label="TC Document"
              file={tcFile}
              onChange={setTcFile}
              disabled={readOnly}
              required
              savedPath={savedDocs.tc_file_path || editData?.tc_file_path}
              savedName={savedDocs.tc_file_name || editData?.tc_file_name}
            />
            <SaDocFileInput
              label="RMTC Document"
              file={rmtcFile}
              onChange={setRmtcFile}
              disabled={readOnly}
              required
              savedPath={savedDocs.rmtc_file_path || editData?.rmtc_file_path}
              savedName={savedDocs.rmtc_file_name || editData?.rmtc_file_name}
            />
          </>
        ) : null
      }
      footerSlot={
        entryType === "minus" && gateReady ? (
          <div className="bg-blue-50/30 border border-blue-200 rounded-lg shadow-sm">
            <div className="bg-blue-600 px-3 py-1.5 lg:px-4 lg:py-2 flex items-center gap-2 rounded-t-lg">
              <RefreshCw className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] text-white shrink-0" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-wider text-white">Breakdown Summary</span>
            </div>
            <div className="p-3 lg:p-4 space-y-2 lg:space-y-2.5">
              <div className="flex justify-between items-center border-b border-blue-100 pb-1.5">
                <span className="text-[11px] lg:text-[13px] font-bold text-blue-800 uppercase">Avg Qty / Coil</span>
                <span className="text-[13px] font-black text-blue-700 tabular-nums">
                  {minusBreakdownSummary.avgPerCoil.toLocaleString()}{" "}
                  <span className="text-[10px] opacity-60 uppercase">KG</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 lg:gap-3">
                <div className="bg-white border border-blue-100 rounded p-1.5 lg:p-2 text-center">
                  <p className="text-base font-black text-blue-600 leading-none tabular-nums">
                    {minusBreakdownSummary.totalCoils}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Coils</p>
                </div>
                <div className="bg-white border border-violet-100 rounded p-1.5 lg:p-2 text-center">
                  <p className="text-base font-black text-violet-600 leading-none tabular-nums">
                    {minusBreakdownSummary.saCount}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">SA Add</p>
                </div>
                <div className="bg-white border border-emerald-100 rounded p-1.5 lg:p-2 text-center">
                  <p className="text-base font-black text-emerald-600 leading-none tabular-nums">
                    {minusBreakdownSummary.mrnCount}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">MRN</p>
                </div>
              </div>
            </div>
          </div>
        ) : null
      }
      readOnly={readOnly}
    />
  );

  const breakdownBlock = (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden bg-white w-full">
      <div className="shrink-0 px-2 py-1.5 lg:px-4 lg:py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-1.5 lg:gap-2 min-w-0 flex-1">
          <Box className="w-4 h-4 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-600" aria-hidden />
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight text-slate-800 truncate block">
              Breakdown
            </span>
            {isSaAddLike(entryType) && !canPrintStickers && gateReady ? (
              <p className="text-[8px] font-medium text-slate-500 leading-tight truncate">
                {noRemainingQty
                  ? "No remaining MRN qty — breakdown not available"
                  : editId && !isApprovedAdd
                    ? "Preview UIDs — final coil_no_uid is set on Approve"
                    : addPreviewRows.length > 0
                      ? `${addPreviewRows.length} coil${addPreviewRows.length === 1 ? "" : "s"} · Created in inventory only after Approve`
                      : adjustmentQty <= 0
                        ? "Enter total qty to preview coils"
                        : "Created in inventory only after Approve"}
              </p>
            ) : entryType === "minus" ? (
              <p className="text-[8px] font-medium text-slate-500 leading-tight truncate">
                Select coils to remove from inventory
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0 pr-1 text-right">
          {isSaAddLike(entryType) && gateReady && !readOnly && adjustmentQty > 0 && coilQtys.length > 0 ? (
            <>
              <span
                className={`text-[9px] sm:text-[10px] font-black uppercase tabular-nums ${
                  qtyMatches && !exceedsRemaining ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                Sum {formatQty(coilQtySum)} / {formatQty(adjustmentQty)} {addQtyUnit}
              </span>
              {!qtyMatches ? (
                <span className="text-[9px] font-bold uppercase text-rose-600">
                  {qtyDiff > 0
                    ? `Higher by ${formatQty(Math.abs(qtyDiff))}`
                    : `Lower by ${formatQty(Math.abs(qtyDiff))}`}
                </span>
              ) : null}
            </>
          ) : (
            <>
              <span className="text-[9px] font-bold text-slate-500 uppercase">Net</span>
              <span
                className={`text-[13px] font-black tabular-nums ${
                  previewSigned < 0
                    ? "text-rose-600"
                    : previewSigned > 0
                      ? "text-emerald-600"
                      : "text-slate-400"
                }`}
              >
                {previewSigned === 0
                  ? "—"
                  : previewSigned > 0
                    ? `+${previewSigned.toLocaleString()}`
                    : previewSigned.toLocaleString()}{" "}
                <span className="text-[10px] font-bold text-slate-400 uppercase">KG</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {isSaAddLike(entryType) ? (
          <RmAddCoilBreakdownTable
            rows={addPreviewRows}
            mrnNo={mrnNo}
            mrnUid={mrnUid}
            totalQty={addPreviewQty}
            editMode={false}
            viewMode={readOnly && savedAddCoilRows.length > 0}
            savedView={false}
            allowRemove={false}
            removeUids={addRemoveUids}
            onToggleRemove={undefined}
            coilQtys={breakdownCoilQtys}
            onCoilQtyChange={onBreakdownCoilQtyChange}
            canPrintStickers={canPrintStickers}
            emptyHint={
              noRemainingQty
                ? "MRN receipt qty is fully used — no coils to add"
                : adjustmentQty <= 0
                  ? "Enter total quantity above to see coil breakdown"
                  : undefined
            }
          />
        ) : (
          <RmMinusCoilBreakdownTable
            rows={minusCoilList}
            selectedUids={minusSelectedUidSet}
            onToggle={toggleCoil}
            mrnNo={mrnNo}
            mrnUid={mrnUid}
            selectedQty={minusPreviewQty}
            selectedCount={selectedCoils.length}
            readOnly={readOnly}
            allowSelect={!readOnly}
            loading={loadingCoils}
            entryApproved={Boolean(editData?.approved)}
            currentAdjustmentId={editData?.adjustment_id ?? editId ?? null}
          />
        )}
      </div>
    </div>
  );

  const toolbarActionButtons = (
    <>
      {gateReady && !readOnly && !isEdit ? (
        <button
          type="button"
          onClick={() => {
            setGateReady(false);
            setSelectedCoils([]);
            setCoilOptions([]);
            setHeatNo("");
          }}
          className="h-8 lg:h-9 w-full sm:w-auto inline-flex items-center justify-center rounded-lg text-[9px] lg:text-[10px] font-black uppercase border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 px-3 transition-all"
        >
          Reset
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="h-8 lg:h-9 w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 text-[9px] lg:text-[10px] font-black uppercase shadow-sm hover:bg-slate-50 px-3 lg:px-4 transition-all disabled:opacity-50"
      >
        {isView && !isApprove ? "Close" : "Cancel"}
      </button>
      {!isView && gateReady && !isApprove ? (
        <button
          type="button"
          onClick={() =>
            handleSave({
              approve: Boolean(approveOnSave && canAuthorize),
            })
          }
          disabled={!formReady || saving || (!isEdit && !entryType) || noRemainingQty || showAddQtyMismatch}
          className="h-8 lg:h-9 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 text-white text-[9px] lg:text-[10px] font-black uppercase shadow-sm hover:bg-black disabled:bg-slate-400 px-3 lg:px-4 transition-all"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin shrink-0" aria-hidden />
          ) : (
            <Check className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" aria-hidden />
          )}
          {isEdit ? "Update" : "Save"}
        </button>
      ) : null}
      {gateReady && isApprove ? (
        <button
          type="button"
          onClick={() => handleSave({ approve: true })}
          disabled={saving || !canAuthorize || !formReady || Boolean(editData?.approved)}
          className="h-8 lg:h-9 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white text-[9px] lg:text-[10px] font-black uppercase shadow-sm hover:bg-emerald-700 disabled:opacity-50 px-3 lg:px-4 transition-all"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin shrink-0" aria-hidden />
          ) : (
            <Shield className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" aria-hidden />
          )}
          Approve
        </button>
      ) : null}
      {readOnly && gateReady && !isApprove ? (
        <button
          type="button"
          onClick={onClose}
          className="h-8 lg:h-9 w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-slate-700 text-white text-[9px] lg:text-[10px] font-black uppercase shadow-sm hover:bg-slate-900 px-3 lg:px-4 transition-all"
        >
          Close
        </button>
      ) : null}
    </>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={
        isApprove && gateReady
          ? () => handleSave({ approve: true })
          : !readOnly && gateReady && !isApprove
            ? () => handleSave({ approve: Boolean(approveOnSave && canAuthorize) })
            : undefined
      }
      title={drawerTitle}
      description={
        isApprove
          ? "Same layout as View — confirm coils, then approve to update inventory."
          : "MRN-based stock adjustment — Add (+) creates coils; Minus (-) removes coils; Old uses Lot No."
      }
      footer={null}
      maxWidth="max-w-full xl:max-w-7xl"
      noPadding
      bodyScrollable={false}
    >
      <div className="flex h-full min-h-0 flex-col w-full max-w-full min-w-0 overflow-hidden bg-slate-50">
        {!formReady ? (
          <FormPanelLoader
            className="flex-1 border-0 rounded-none min-h-0"
            minHeight="min-h-0 flex-1"
            label="Loading stock adjustment..."
            hint="Preparing adjustment details."
          />
        ) : (
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden w-full min-w-0">
            <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 lg:px-4 flex flex-wrap items-end gap-2 lg:gap-3">
              <div className="min-w-[120px]">
                <span className={FIELD_LABEL}>Type</span>
                <select
                  value={entryType || ""}
                  disabled={readOnly || isEdit || gateReady}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEntryType(v);
                    setGateReady(false);
                    setMrnUid("");
                    setMrnNo("");
                    setSerialNo("");
                    setHeatNo("");
                    setLotInput("");
                    setMrnInput("");
                    setItemId(null);
                    setItemRow(null);
                    setSupplierId(null);
                    setSupplierRow(null);
                    setSelectedCoils([]);
                    setCoilOptions([]);
                    setMrnPickOptions([]);
                    setMrnPickUid("");
                    if (needsFinancialYear(v)) {
                      setFinancialYear(defaultFinancialYear());
                    }
                  }}
                  className={FIELD_CONTROL}
                >
                  <option value="">Select…</option>
                  <option value="old">Old</option>
                  <option value="add">Add (+)</option>
                  <option value="minus">Minus (-)</option>
                </select>
              </div>
              {needsFinancialYear(entryType) && (
                <div className="min-w-[140px]">
                  <label htmlFor="rm-sa-gate-fy" className={FIELD_LABEL}>
                    Financial year
                  </label>
                  <select
                    id="rm-sa-gate-fy"
                    value={financialYear}
                    onChange={(e) => {
                      setFinancialYear(e.target.value);
                      setGateReady(false);
                      setMrnUid("");
                      setMrnInput("");
                      setLotInput("");
                      setMrnDetail(null);
                      setMrnPickOptions([]);
                      setMrnPickUid("");
                    }}
                    disabled={gateReady || readOnly || isEdit}
                    className={FIELD_CONTROL}
                  >
                    <option value="">Select…</option>
                    {getFinancialYearOptions().map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {usesLotGate(entryType) ? (
                <div className="min-w-0 w-full sm:flex-1 sm:min-w-[160px] sm:max-w-xs">
                  <label htmlFor="rm-sa-gate-lot" className={FIELD_LABEL}>
                    Lot No.
                  </label>
                  <SearchableSelect
                    value={lotInput}
                    onChange={(id) => {
                      setLotInput(sanitizeStockAdjustmentHeatNo(id || ""));
                      setMrnPickOptions([]);
                      setMrnPickUid("");
                    }}
                    fetchService={fetchLotOptions}
                    getByIdService={getLotById}
                    dataKey="id"
                    labelKey="name"
                    allowFreeText
                    uppercase
                    preserveApiOrder
                    placeholder="Search or type lot no."
                    disabled={gateReady || readOnly || isEdit || !entryType || !financialYear}
                    heightClass="h-8 lg:h-9"
                    className="[&_input]:text-[10px] [&_input]:font-semibold"
                  />
                </div>
              ) : (
              <div className="min-w-0 w-full sm:flex-1 sm:min-w-[160px] sm:max-w-xs">
                <label htmlFor="rm-sa-gate-mrn" className={FIELD_LABEL}>
                  MRN number
                </label>
                <input
                  id="rm-sa-gate-mrn"
                  type="text"
                  value={mrnInput}
                  onChange={(e) => {
                    setMrnInput(e.target.value);
                    setMrnPickOptions([]);
                    setMrnPickUid("");
                  }}
                  disabled={
                    gateReady ||
                    readOnly ||
                    isEdit ||
                    !entryType ||
                    (needsFinancialYear(entryType) && !financialYear)
                  }
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !gateReady &&
                      !readOnly &&
                      !isEdit &&
                      entryType &&
                      (entryType === "minus" || (needsFinancialYear(entryType) && financialYear))
                    ) {
                      e.preventDefault();
                      void handleGateLoad();
                    }
                  }}
                  placeholder={entryType === "minus" ? "e.g. 3701 or MRN UID" : "e.g. 3701"}
                  className={FIELD_CONTROL}
                  autoComplete="off"
                />
                </div>
              )}
              {!gateReady && !readOnly && !isEdit && (
                <button
                  type="button"
                  onClick={() => void handleGateLoad()}
                  disabled={
                    gateLoading ||
                    !entryType ||
                    (needsFinancialYear(entryType) && !financialYear) ||
                    (usesLotGate(entryType)
                      ? !String(lotInput || "").trim()
                      : !String(mrnInput || "").trim())
                  }
                  className="h-8 lg:h-9 w-full sm:w-auto px-4 shrink-0 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wide shadow-sm hover:bg-indigo-700 disabled:opacity-55 inline-flex items-center justify-center gap-2 border border-indigo-700/20 mb-0.5"
                >
                  {gateLoading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> : null}
                  Load
                </button>
              )}
              {mrnPickOptions.length > 1 && !gateReady && !readOnly && !isEdit ? (
                <div className="w-full sm:min-w-[260px] sm:max-w-md">
                  <label htmlFor="rm-sa-gate-mrn-pick" className={FIELD_LABEL}>
                    Select MRN UID
                  </label>
                  <SearchableSelect
                    key={`mrn-pick-${mrnPickOptions.map((r) => String(r.uid || "").trim()).join("|")}`}
                    defaultOpen
                    value={mrnPickUid}
                    onChange={(uid) => {
                      const v = String(uid || "").trim();
                      setMrnPickUid(v);
                      if (v) void handleMrnPickSelect(v);
                    }}
                    fetchService={fetchMrnPickOptions}
                    getByIdService={getMrnPickById}
                    dataKey="id"
                    labelKey="name"
                    labelOnlyDisplay
                    preserveApiOrder
                    subLabelKey={entryType === "old" ? "bill_sub" : ""}
                    subLabelBold={entryType === "old"}
                    showDuplicateSubLabel
                    placeholder={
                      entryType === "old"
                        ? `Select MRN (${mrnPickOptions.length} found — bill no. & date shown)`
                        : `Search MRN UID (${mrnPickOptions.length} found)`
                    }
                    disabled={gateLoading}
                    heightClass="h-8 lg:h-9"
                    className="[&_input]:text-[10px] [&_input]:font-semibold"
                  />
                </div>
              ) : null}
              {gateReady && mrnUid ? (
                <div className="w-full sm:flex-1 sm:min-w-[200px] rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-1.5 min-w-0">
                  <p className="text-[10px] font-mono font-bold text-slate-900 truncate" title={mrnUid}>
                    {mrnUid}
                  </p>
                  <p className="text-[10px] font-semibold text-indigo-800 truncate leading-snug">
                    {formatItemLabel(itemRow || mrnDetail)}
                  </p>
                </div>
              ) : null}
              <div className="w-full shrink-0 sm:w-auto sm:ml-auto">
                <div className="flex w-full flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-1.5 rounded-xl bg-slate-50/90 p-1">
                  {toolbarActionButtons}
                </div>
              </div>
            </div>

            {showAddQtyMismatch && qtyMismatchLabel ? (
              <div className="shrink-0 flex items-start gap-2 px-3 md:px-4 py-2 bg-rose-50 border-b border-rose-200 text-rose-950">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" aria-hidden />
                <p className="text-[10px] sm:text-[11px] font-medium leading-snug">
                  <span className="font-black uppercase tracking-tight">Quantity mismatch:</span>{" "}
                  {qtyMismatchLabel}
                </p>
              </div>
            ) : null}

            {isSaAddLike(entryType) && gateReady && specChecked && specValidationError ? (
              <div className="shrink-0 flex items-start gap-2 px-3 md:px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-950">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" aria-hidden />
                <p className="text-[10px] sm:text-[11px] font-medium leading-snug">{specValidationError}</p>
              </div>
            ) : null}

            {isApprove ? (
              <div className="shrink-0 mx-3 mt-2 sm:mx-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-900">
                Review MRN and coils below, then click <span className="font-black">Approve</span>. Add creates
                coils in inventory; minus removes selected coils. To change counts, close this screen and use{" "}
                <span className="font-black">Edit</span> first.
              </div>
            ) : editingWasApproved ? (
              <div className="shrink-0 px-3 py-2 lg:px-4 bg-amber-50 border-b border-amber-100 text-[10px] font-semibold text-amber-900">
                This adjustment is <span className="font-black">Approved</span>. After you save, status becomes{" "}
                <span className="font-black">Pending</span> — use <span className="font-black">Approve</span> again to
                apply coil changes to inventory.
              </div>
            ) : isEdit && editData?.approved ? (
              <div className="shrink-0 px-3 py-2 lg:px-4 bg-amber-50 border-b border-amber-100 text-[10px] font-medium text-amber-900">
                Editing an authorized adjustment resets it to Pending. Turn on Approve before saving to authorize it again.
              </div>
            ) : null}

            {entryType === "minus" && gateReady && !readOnly ? (
              <p className="shrink-0 px-3 py-2 lg:px-4 text-[10px] text-slate-500 border-b border-slate-100 bg-slate-50/80">
                All MRN coils are listed below. Tick <span className="font-semibold">Minus</span> on rows to remove.
                Unavailable rows are already out or dispatched. Changes apply after Approve.
              </p>
            ) : null}

            {!gateReady ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 px-4 text-center py-10">
                <Package className="w-8 h-8 opacity-30" />
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {!entryType
                    ? "Select Add (+), Minus (-), or Old"
                    : mrnPickOptions.length > 1
                      ? entryType === "old"
                        ? "Select an MRN from the dropdown — bill no. and bill date are shown in each option"
                        : "Multiple MRN UIDs found — select one from the dropdown above"
                      : usesLotGate(entryType)
                        ? !financialYear
                          ? "Select financial year, then enter Lot No. and Load"
                          : "Enter Lot No. and Load"
                        : needsFinancialYear(entryType)
                          ? !financialYear
                            ? "Select financial year, then enter MRN number and Load"
                            : "Enter MRN number and Load"
                          : "Enter MRN number or UID and Load"}
                </p>
                <p className="text-[10px] text-slate-400 max-w-md">
                  {usesLotGate(entryType)
                    ? "Old loads ERP receipts by Lot No. within the selected financial year — same flow as Add after Load."
                    : isSaAddLike(entryType)
                      ? "Only MRNs with remaining receipt qty can be loaded. Fully used MRNs are blocked."
                      : "Minus uses MRN number or UID only — no financial year. Active coils load after Load."}
                </p>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 flex-col w-full overflow-hidden">
                <div className="shrink-0 border-b border-slate-200 bg-slate-50/50">
                  <div className="max-w-[1800px] mx-auto w-full min-w-0 px-3 py-2 lg:py-2.5 sm:px-4">
                  <div className="grid w-full min-w-0 grid-cols-1 max-lg:grid-cols-3 sm:grid-cols-2 lg:grid-cols-12 gap-2 max-lg:gap-2 lg:gap-3 items-end">
                    {isSaAddLike(entryType) ? (
                      <>
                        {mrnReadoutField}
                        <div className="min-w-0 w-full max-lg:col-span-1 lg:col-span-2">
                          <label htmlFor="rm-sa-coils" className={FIELD_LABEL}>
                            Coils <span className="text-rose-500">*</span>
                          </label>
                          <input
                            id="rm-sa-coils"
                            type="number"
                            min={1}
                            value={coilCount}
                            disabled={!canEditAddCoils}
                            onChange={(e) => handleCoilCountChange(e.target.value)}
                            onWheel={preventNumberInputWheel}
                            className={FIELD_CONTROL}
                          />
                        </div>
                        <div className="min-w-0 w-full max-lg:col-span-1 lg:col-span-2">
                          <label htmlFor="rm-sa-total-qty" className={FIELD_LABEL}>
                            Total qty <span className="text-rose-500">*</span>
                            {originalReceiptQty > 0 ? (
                            <p className="text-[9px] font-semibold text-slate-500 mt-0.5 truncate">
                              Receipt {originalReceiptQty.toLocaleString()} KG
                              {priorAddQty > 0 ? (
                                <>
                                  {" "}
                                  − used {priorAddQty.toLocaleString()}
                                  {/* {coilUsedQty > 0 ? ` (coils ${coilUsedQty.toLocaleString()}` : ""} */}
                                  {pendingSaAddQty > 0
                                    ? `${coilUsedQty > 0 ? ", " : " ("}pending SA ${pendingSaAddQty.toLocaleString()}`
                                    : ""}
                                  {coilUsedQty > 0 || pendingSaAddQty > 0 ? ")" : ""} ={" "}
                                  <span className="text-emerald-700 font-bold">
                                    {maxRemainingQty.toLocaleString()} remaining
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-400"> (max)</span>
                              )}
                            </p>
                          ) : null}
                          </label>
                          <input
                            id="rm-sa-total-qty"
                            type="number"
                            min={0}
                            step={1}
                            value={totalQty}
                            disabled={!canEditAddQty}
                            onChange={(e) => handleTotalQtyChange(e.target.value)}
                            onWheel={preventNumberInputWheel}
                            placeholder="0"
                            className={`${FIELD_CONTROL} tabular-nums ${
                              exceedsRemaining ? "border-rose-400 ring-1 ring-rose-200" : ""
                            }`}
                            title={
                              maxRemainingQty > 0
                                ? `Max ${maxRemainingQty} KG remaining`
                                : "Total quantity for this adjustment"
                            }
                          />
                          
                        </div>
                      </>
                    ) : (
                      <>
                        {mrnReadoutField}
                        <div className="flex flex-col justify-start min-w-0 w-full max-lg:col-span-2 lg:col-span-3">
                          <span className={FIELD_LABEL_ROW}>
                            <Layers className="w-3 h-3 text-rose-500/90 shrink-0" aria-hidden />
                            Coils
                          </span>
                          <div className={READOUT_BOX_MINUS}>
                            <p className="text-[11px] font-bold text-rose-950 tabular-nums leading-tight">
                              {selectedCoils.length} Coil{selectedCoils.length === 1 ? "" : "s"}
                            </p>
                            {selectedCoils.length > 0 ? (
                              <p className="text-[9px] font-semibold text-rose-600 mt-0.5">
                                −{minusPreviewQty.toLocaleString()} KG
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="min-w-0 w-full max-lg:col-span-2 lg:col-span-4">
                      <FormTextarea
                        label="Remark"
                        labelIcon={<MessageSquareQuote size={12} className="text-indigo-500 shrink-0" />}
                        value={remarks}
                        onChange={(e) => setRemarks(e?.target?.value ?? e ?? "")}
                        placeholder="Note…"
                        readOnly={readOnly}
                        disabled={readOnly}
                        rows={1}
                        labelClassName="text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-1 ml-0 flex flex-wrap items-center gap-1"
                        className="[&_textarea]:!min-h-[2rem] [&_textarea]:!max-h-[2rem] lg:[&_textarea]:!min-h-[2.25rem] lg:[&_textarea]:!max-h-[2.25rem] [&_textarea]:!py-1 [&_textarea]:!text-[10px] lg:[&_textarea]:!text-[11px] [&_textarea]:resize-none [&_textarea]:rounded-lg [&_textarea]:border-slate-200 flex min-h-0 w-full flex-col"
                      />
                    </div>

                    <div className="flex flex-col justify-start min-w-0 w-full max-lg:col-span-1 lg:col-span-2">
                      <span className={FIELD_LABEL_ROW}>
                        <Shield className="w-3 h-3 text-slate-400 shrink-0" aria-hidden />
                        Approve
                      </span>
                      {canAuthorize || isView || isEdit || isApprove ? (
                        <div
                          className={`min-h-[2rem] lg:min-h-[2.25rem] rounded-lg border px-2 flex items-center justify-between gap-1.5 shadow-sm ${
                            approvalDisplayApproved
                              ? "border-emerald-700 bg-emerald-600 text-white"
                              : "border-amber-200 bg-amber-50"
                          }`}
                        >
                          <p
                            className={`truncate text-[9px] font-black uppercase ${
                              approvalDisplayApproved ? "text-white" : "text-amber-900"
                            }`}
                          >
                            {approvalStatusLabel}
                          </p>
                          {!readOnly && !isApprove && canAuthorize ? (
                            <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                              <input
                                type="checkbox"
                                checked={approveOnSave}
                                onChange={(e) => setApproveOnSave(e.target.checked)}
                                className="peer sr-only"
                              />
                              <span className="pointer-events-none absolute inset-0 z-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-400 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300" />
                              <span className="pointer-events-none absolute left-[2px] top-[2px] z-10 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                            </label>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex min-h-[2.25rem] items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2">
                          <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
                          <p className="text-[7px] font-semibold text-slate-600">Not available</p>
                        </div>
                      )}
                    </div>

                    {(!readOnly || isApprove) && (
                      <div className="col-span-2 lg:col-span-12 mt-1">
                        <ModuleSopAcknowledgment
                          ref={sopAckRef}
                          key={`${open}-${sopPermissionType}`}
                          moduleSlug={MODULE}
                          permissionType={sopPermissionType}
                          isOpen={open && gateReady}
                        />
                      </div>
                    )}
                  </div>
                  </div>
                </div>

                <div className="flex flex-1 min-h-0 flex-col overflow-hidden border-t border-slate-200/80">
                  <div className="flex flex-1 flex-col min-h-0 lg:hidden bg-slate-100/80">
                    <div className="grid w-full grid-cols-2 gap-1 shrink-0 px-2 py-1 border-b border-slate-200 bg-white">
                      {[
                        { id: "details", label: "Details" },
                        {
                          id: "coils",
                          label: isSaAddLike(entryType) ? "Stickers" : "Coils",
                        },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setMobileTab(tab.id)}
                          className={`rounded-md py-1.5 px-2 text-[9px] font-black uppercase ${
                            mobileTab === tab.id
                              ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                              : "bg-slate-200/70 text-slate-600"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col mx-2 mb-2 mt-1.5 bg-white border border-slate-200 rounded-lg">
                      {mobileTab === "details" ? (
                        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50">
                          {detailCards}
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                          {breakdownBlock}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="hidden lg:flex lg:flex-row flex-1 min-h-0 w-full overflow-hidden bg-slate-50">
                    <div className="shrink-0 lg:w-80 xl:w-96 border-r border-slate-200 bg-slate-50 overflow-y-auto">
                      {detailCards}
                    </div>
                    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
                      {breakdownBlock}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
