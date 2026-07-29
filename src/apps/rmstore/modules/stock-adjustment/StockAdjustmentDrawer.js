"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Check,
  Loader2,
  Package,
  Layers,
  Shield,
  MessageSquareQuote,
  AlertCircle,
  Box,
  User,
  ClipboardList,
} from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import RemarksTextarea from "@/ui/common/forms/RemarksTextarea";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";

import { stockAdjustmentService } from "@/apps/rmstore/lib/services/stockAdjustment";
import { mrnService } from "@/apps/rmstore/lib/services/mrn";
import { erpMasterHelpers } from "@/apps/rmstore/lib/services/erpMasterHelpers";
import {
  getCurrentIndianFinancialYearStartYear,
  rowInIndianFinancialYear,
} from "@/platform/utils/core/indianFinancialYear";

const MODULE = "rm_stock_adjustment";
const PERMS = { permission_module: MODULE, permission_action: "view" };

const FIELD_LABEL = "block text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-1 leading-none";
const FIELD_LABEL_ROW =
  "flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-1 leading-none";
const FIELD_CONTROL =
  "h-8 lg:h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 lg:px-2.5 text-[10px] font-semibold text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500";
const READOUT_BOX =
  "min-h-[2rem] lg:min-h-[2.5rem] rounded-lg border border-slate-200 bg-slate-50 px-2 lg:px-2.5 flex flex-col justify-center shadow-sm";

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

function fyStartYear(fyStr) {
  const m = String(fyStr ?? "")
    .trim()
    .match(/^(\d{4})-\d{4}$/);
  return m ? Number(m[1]) : null;
}

/** True if MRN belongs to selected Indian FY (fyid year and/or mrn_dt). */
function mrnMatchesFinancialYear(mrn, fyStr) {
  if (!fyStr) return true;
  const start = fyStartYear(fyStr);
  const fyid = Number(mrn?.fyid);
  if (Number.isFinite(fyid) && fyid >= 2000 && fyid <= 2100 && start != null) {
    return fyid === start;
  }
  const dt =
    mrn?.mrn_dt ||
    mrn?.mrndt ||
    mrn?.doc_dt ||
    null;
  if (dt) {
    const iso = String(dt).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return rowInIndianFinancialYear({ doc_dt: iso }, fyStr);
    }
  }
  // No FY signal on MRN — allow load (UID/no still required)
  return true;
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

function previewCoilUid(adjId, total, index) {
  const adj = adjId != null ? String(adjId) : "?";
  const tb = String(Math.max(1, total)).padStart(2, "0");
  const bi = String(Math.max(1, index)).padStart(2, "0");
  return `SA_${adj}_${tb}_${bi}`;
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
  const [mrnUid, setMrnUid] = useState("");
  const [mrnNo, setMrnNo] = useState("");
  const [heatNo, setHeatNo] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [itemId, setItemId] = useState(null);
  const [itemRow, setItemRow] = useState(null);
  const [supplierId, setSupplierId] = useState(null);
  const [supplierRow, setSupplierRow] = useState(null);
  const [coilCount, setCoilCount] = useState("1");
  const [perCoilQty, setPerCoilQty] = useState("");
  const [remarks, setRemarks] = useState("");
  const [approveOnSave, setApproveOnSave] = useState(false);
  const [selectedCoils, setSelectedCoils] = useState([]);
  const [coilSearch, setCoilSearch] = useState("");
  const [coilOptions, setCoilOptions] = useState([]);
  const [loadingCoils, setLoadingCoils] = useState(false);
  const [linkedCoils, setLinkedCoils] = useState([]);
  const [mobileTab, setMobileTab] = useState("details");
  const [gateReady, setGateReady] = useState(false);

  const sopAckRef = useRef(null);
  const editId = editData?.adjustment_id ?? null;

  const resetForm = useCallback(() => {
    setEntryType("");
    setFinancialYear(defaultFinancialYear());
    setMrnInput("");
    setMrnUid("");
    setMrnNo("");
    setHeatNo("");
    setGateLoading(false);
    setItemId(null);
    setItemRow(null);
    setSupplierId(null);
    setSupplierRow(null);
    setCoilCount("1");
    setPerCoilQty("");
    setRemarks("");
    setApproveOnSave(false);
    setSelectedCoils([]);
    setCoilSearch("");
    setCoilOptions([]);
    setLinkedCoils([]);
    setGateReady(false);
    setMobileTab("details");
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
        setEntryType(d.entry_type === "minus" ? "minus" : "add");
        setRemarks(d.remarks || "");
        setHeatNo(d.heat_no != null ? String(d.heat_no) : d.coils?.[0]?.heat_no || "");
        setCoilCount(String(d.coil_count_impact || 1));
        setPerCoilQty(d.per_coil_qty != null ? String(d.per_coil_qty) : "");
        setApproveOnSave(isApprove ? true : false);
        const seedMrnUid = String(d.mrn_uid || d.coils?.[0]?.mrn_uid || "").trim();
        const seedMrnNo = d.mrn_no ?? d.coils?.[0]?.mrn_no ?? null;
        if (seedMrnUid || seedMrnNo != null) {
          setMrnUid(seedMrnUid);
          setMrnNo(seedMrnNo != null ? String(seedMrnNo) : "");
          setMrnInput(seedMrnUid || String(seedMrnNo));
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
        }
        setLinkedCoils(Array.isArray(d.coils) ? d.coils : []);
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
  }, [open, editId, isAddMode, resetForm]);

  const fetchLedgers = useCallback(async (params) => {
    return erpMasterHelpers.getLedgersViews({ ...params, ...PERMS });
  }, []);

  const getLedgerById = useCallback(async (id) => {
    return erpMasterHelpers.getLedgerViewById(id, PERMS);
  }, []);

  const applyMrnToForm = useCallback((mrn) => {
    const uid = String(mrn?.uid || mrn?.mrn_uid || "").trim();
    const no = mrn?.mrn_no != null ? String(mrn.mrn_no) : "";
    setMrnUid(uid);
    setMrnNo(no);
    setMrnInput(uid || no);
    setHeatNo(mrn?.heat_no != null ? String(mrn.heat_no) : "");
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

  const resolveMrn = useCallback(async (raw, fyStr = "") => {
    const key = String(raw || "").trim();
    if (!key) {
      const err = new Error("Enter an MRN number or MRN UID.");
      throw err;
    }

    const pickMatching = (rows) => {
      const list = Array.isArray(rows) ? rows : [];
      const exact =
        list.find((r) => String(r.uid || r.mrn_uid || "").trim() === key) ||
        list.find((r) => String(r.mrn_no ?? "").trim() === key);
      const candidates = exact ? [exact, ...list.filter((r) => r !== exact)] : list;
      if (!fyStr) return candidates[0] || null;
      return candidates.find((r) => mrnMatchesFinancialYear(r, fyStr)) || null;
    };

    try {
      const byUid = await mrnService.getDetail(key);
      if (byUid?.data) {
        if (fyStr && !mrnMatchesFinancialYear(byUid.data, fyStr)) {
          const err = new Error(`No MRN was found in FY ${fyStr}.`);
          throw err;
        }
        return byUid.data;
      }
    } catch (err) {
      if (err?.message?.includes("FY ")) throw err;
      /* try search */
    }

    const list = await mrnService.getAll({
      search: key,
      page: 1,
      limit: 50,
      filters: { status: "generated" },
    });
    let rows = Array.isArray(list?.data) ? list.data : [];
    if (!rows.length) {
      const allList = await mrnService.getAll({
        search: key,
        page: 1,
        limit: 50,
        filters: { status: "all" },
      });
      rows = Array.isArray(allList?.data) ? allList.data : [];
    }
    const hit = pickMatching(rows);
    if (!hit?.uid && !hit?.mrn_uid) {
      const err = new Error(
        fyStr ? `No MRN was found in FY ${fyStr}.` : "MRN not found."
      );
      throw err;
    }
    const uid = String(hit.uid || hit.mrn_uid).trim();
    try {
      const detail = await mrnService.getDetail(uid);
      if (detail?.data) {
        if (fyStr && !mrnMatchesFinancialYear(detail.data, fyStr)) {
          const err = new Error(`No MRN was found in FY ${fyStr}.`);
          throw err;
        }
        return detail.data;
      }
    } catch (err) {
      if (err?.message?.includes("FY ")) throw err;
      /* pending MRN may not be in DB yet — use list row */
    }
    return hit;
  }, []);

  const loadActiveCoils = useCallback(
    async (search = "", opts = {}) => {
      setLoadingCoils(true);
      try {
        const res = await stockAdjustmentService.getActiveCoils({
          page: 1,
          limit: 200,
          search: search || undefined,
          ...(opts.mrn_uid ? { mrn_uid: opts.mrn_uid } : {}),
          ...(opts.mrn_no ? { mrn_no: opts.mrn_no } : {}),
        });
        setCoilOptions(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        toast.error(err?.message || "Could not load the coils. Please try again.");
        setCoilOptions([]);
      } finally {
        setLoadingCoils(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!open || entryType !== "minus" || readOnly || !gateReady) return;
    void loadActiveCoils(coilSearch, { mrn_uid: mrnUid || undefined, mrn_no: mrnNo || undefined });
  }, [open, entryType, readOnly, gateReady, loadActiveCoils, mrnUid, mrnNo]);

  const toggleCoil = (coil) => {
    const uid = String(coil.coil_no_uid);
    setSelectedCoils((prev) => {
      const exists = prev.some((c) => String(c.coil_no_uid) === uid);
      if (exists) return prev.filter((c) => String(c.coil_no_uid) !== uid);
      return [...prev, coil];
    });
  };

  const addPreviewQty = useMemo(() => {
    const n = parseInt(coilCount, 10);
    const p = Number(perCoilQty);
    if (!Number.isFinite(n) || n < 1 || !Number.isFinite(p) || p <= 0) return 0;
    return n * p;
  }, [coilCount, perCoilQty]);

  const minusPreviewQty = useMemo(
    () => selectedCoils.reduce((s, c) => s + (Number(c.qty) || 0), 0),
    [selectedCoils]
  );

  const addPreviewRows = useMemo(() => {
    if (entryType !== "add") return [];
    if (linkedCoils.length && (readOnly || (isEdit && editData?.approved))) {
      return linkedCoils.map((c, i) => ({
        idx: i + 1,
        coil_no_uid: c.coil_no_uid,
        qty: Number(c.qty) || 0,
      }));
    }
    const n = parseInt(coilCount, 10);
    const p = Number(perCoilQty);
    if (!Number.isFinite(n) || n < 1 || !Number.isFinite(p) || p <= 0) return [];
    return Array.from({ length: n }, (_, i) => ({
      idx: i + 1,
      coil_no_uid: previewCoilUid(editId, n, i + 1),
      qty: p,
    }));
  }, [entryType, coilCount, perCoilQty, linkedCoils, readOnly, isEdit, editData?.approved, editId]);

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
    return [...byUid.values()];
  }, [readOnly, selectedCoils, coilOptions]);

  const previewSigned =
    entryType === "add" ? addPreviewQty : entryType === "minus" ? -minusPreviewQty : 0;

  const drawerTitle =
    isApprove
      ? "Approve Stock Adjustment"
      : isView
        ? "View Stock Adjustment"
        : isEdit
          ? "Edit Stock Adjustment"
          : "Stock Adjustment";

  const handleGateLoad = async () => {
    if (!entryType) {
      toast.error("Select Add (+) or Minus (−).");
      return;
    }
    if (entryType === "add" && !String(financialYear || "").trim()) {
      toast.error("Select a financial year.");
      return;
    }
    setGateLoading(true);
    try {
      const fy = entryType === "add" ? String(financialYear).trim() : "";
      const mrn = await resolveMrn(mrnInput, fy);
      applyMrnToForm(mrn);
      setGateReady(true);
      if (entryType === "minus") {
        const uid = String(mrn.uid || mrn.mrn_uid || "").trim();
        const no = mrn.mrn_no != null ? String(mrn.mrn_no) : "";
        await loadActiveCoils("", { mrn_uid: uid || undefined, mrn_no: no || undefined });
      }
      toast.success(`MRN ${mrn.mrn_no ?? mrn.uid} loaded.`);
    } catch (err) {
      toast.error(err?.message || "Could not load the MRN. Please try again.");
    } finally {
      setGateLoading(false);
    }
  };

  const handleSave = async ({ approve } = {}) => {
    if (readOnly && !isApprove) return;
    if (!sopAckRef.current?.assertAcknowledged()) return;
    if (!entryType) {
      toast.error("Choose Add (+) or Minus (−).");
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
        await stockAdjustmentService.update(editId, { approved: true });
        toast.success("Stock adjustment approved.");
        onSuccess?.();
        onClose?.();
        return;
      }

      const doApprove = Boolean((approve || approveOnSave) && canAuthorize);

      if (entryType === "add") {
        if (!itemRow?.item_dcode && !itemRow?.item_code && !itemId) {
          toast.error("Load an MRN first. The item details are missing.");
          setSaving(false);
          return;
        }
        const n = parseInt(coilCount, 10);
        const p = Number(perCoilQty);
        if (!Number.isFinite(n) || n < 1) {
          toast.error("Enter the number of coils.");
          setSaving(false);
          return;
        }
        if (!Number.isFinite(p) || p <= 0) {
          toast.error("Enter the quantity per coil.");
          setSaving(false);
          return;
        }

        const payload = {
          entry_type: "add",
          item_dcode: itemRow?.item_dcode ?? itemRow?.id ?? itemId,
          item_code: itemRow?.item_code || null,
          item_desc: itemRow?.item_desc || null,
          heat_no: heatNo.trim() || null,
          mrn_uid: mrnUid || null,
          mrn_no: (() => {
            const n = Number(mrnNo);
            return Number.isFinite(n) ? n : null;
          })(),
          acc_code: supplierRow?.acc_code ?? supplierId ?? null,
          acc_name: supplierRow?.acc_name || null,
          no_of_coils: n,
          coil_count_impact: n,
          per_coil_qty: p,
          unit: "KG",
          remarks: remarks.trim() || null,
          approved: doApprove,
        };

        if (isEdit && editId) {
          await stockAdjustmentService.update(editId, { ...payload, approved: false });
          if (doApprove) await stockAdjustmentService.update(editId, { approved: true });
          toast.success(doApprove ? "Updated and approved." : "Updated and set to pending.");
        } else {
          await stockAdjustmentService.create(payload);
          toast.success(
            doApprove
              ? "Created and approved. You can print the stickers from the list."
              : "Saved as pending. Approve it to create the coils."
          );
        }
      } else {
        if (!selectedCoils.length) {
          toast.error("Select at least one coil.");
          setSaving(false);
          return;
        }
        const payload = {
          entry_type: "minus",
          removed_coil_uids: selectedCoils.map((c) => c.coil_no_uid),
          mrn_uid: mrnUid || null,
          mrn_no: (() => {
            const n = Number(mrnNo);
            return Number.isFinite(n) ? n : null;
          })(),
          heat_no: heatNo.trim() || null,
          unit: "KG",
          remarks: remarks.trim() || null,
          approved: doApprove,
        };
        if (isEdit && editId) {
          await stockAdjustmentService.update(editId, { ...payload, approved: false });
          if (doApprove) await stockAdjustmentService.update(editId, { approved: true });
          toast.success(doApprove ? "Updated and approved." : "Updated and set to pending.");
        } else {
          await stockAdjustmentService.create(payload);
          toast.success(doApprove ? "Created and approved." : "Saved as pending.");
        }
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not save the stock adjustment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const approvedFlag = isView
    ? Boolean(editData?.approved)
    : Boolean((isApprove || approveOnSave) && canAuthorize);

  const detailCards = (
    <div className="p-2 lg:p-3 space-y-2 lg:space-y-3">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2 rounded-t-lg">
          <Box className="w-3.5 h-3.5 shrink-0 text-blue-600" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Item Details
          </span>
        </div>
        <div className="p-3 lg:p-4 space-y-2">
          {entryType === "add" && !readOnly ? (
            <div className="text-[11px] space-y-2">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  Item Code
                </p>
                <p className="text-[12px] font-black text-blue-600 leading-none truncate">
                  {itemRow?.item_code || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  Description
                </p>
                <p className="text-[11px] font-medium text-slate-600 leading-tight line-clamp-2">
                  {itemRow?.item_desc || "—"}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  Item Code
                </p>
                <p className="text-[12px] font-black text-blue-600 leading-none truncate">
                  {itemRow?.item_code ||
                    selectedCoils[0]?.item_code ||
                    editData?.item_code ||
                    "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  Description
                </p>
                <p className="text-[11px] font-medium text-slate-600 leading-tight line-clamp-2">
                  {itemRow?.item_desc ||
                    selectedCoils[0]?.item_desc ||
                    editData?.item_desc ||
                    "—"}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {entryType === "add" && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2 rounded-t-lg">
            <User className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Supplier
            </span>
          </div>
          <div className="p-3 lg:p-4 space-y-2">
            {!readOnly ? (
              <SearchableSelect
                label="Supplier"
                value={supplierId || ""}
                onChange={(id, row) => {
                  setSupplierId(id);
                  setSupplierRow(
                    row
                      ? {
                          id: row.acc_code ?? row.id,
                          acc_code: row.acc_code ?? row.id,
                          acc_name: row.acc_name,
                        }
                      : null
                  );
                }}
                fetchService={fetchLedgers}
                getByIdService={getLedgerById}
                dataKey="acc_code"
                labelKey="acc_name"
                usePortal={false}
              />
            ) : (
              <p className="text-[12px] font-bold text-slate-700 uppercase">
                {supplierRow?.acc_name || editData?.acc_name || "—"}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2 rounded-t-lg">
          <ClipboardList className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Coil Info
          </span>
        </div>
        <div className="p-3 lg:p-4 grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Heat No.</p>
            <p className="font-bold text-slate-800 font-mono break-all">{heatNo || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">MRN UID</p>
            <p className="font-bold text-slate-800 font-mono break-all">{mrnUid || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">MRN No.</p>
            <p className="font-bold text-slate-800 tabular-nums">{mrnNo || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Unit</p>
            <p className="font-bold text-slate-800">KG</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Coils</p>
            <p className="font-black tabular-nums text-slate-800">
              {entryType === "add" ? coilCount || "—" : selectedCoils.length}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              {entryType === "add" ? "Qty per Coil" : "Selected Qty"}
            </p>
            <p className="font-black tabular-nums text-slate-800">
              {entryType === "add"
                ? perCoilQty || "—"
                : minusPreviewQty.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const breakdownBlock = (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden bg-white">
      <div className="shrink-0 px-2 py-1.5 lg:px-4 lg:py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Layers className="w-4 h-4 shrink-0 text-slate-600" aria-hidden />
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight text-slate-800 truncate">
            {entryType === "add" ? "Coil Breakdown" : "Select Coils"}
          </span>
        </div>
        <div className="flex items-baseline gap-2 shrink-0 pr-1">
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
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {entryType === "add" ? (
          !addPreviewRows.length ? (
            <div className="py-12 text-center text-[10px] font-bold uppercase text-slate-400 px-4">
              Enter the number of coils and the quantity per coil to see the breakdown here.
            </div>
          ) : (
            <table className="w-full min-w-[420px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-[9px] font-black uppercase text-slate-500">#</th>
                  <th className="px-3 py-2 text-[9px] font-black uppercase text-slate-500">Coil</th>
                  <th className="px-3 py-2 text-[9px] font-black uppercase text-slate-500">MRN</th>
                  <th className="px-3 py-2 text-[9px] font-black uppercase text-slate-500">Qty</th>
                </tr>
              </thead>
              <tbody>
                {addPreviewRows.map((r) => (
                  <tr key={r.coil_no_uid} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-[11px] font-bold text-slate-600 tabular-nums">
                      {r.idx}
                    </td>
                    <td className="px-3 py-2 text-[11px] font-mono font-bold text-blue-700 break-all">
                      {r.coil_no_uid}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-600 font-mono">
                      {mrnUid || mrnNo || "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] font-bold tabular-nums">
                      {Number(r.qty).toLocaleString()} KG
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <div className="p-2 space-y-2">
            {!readOnly && (
              <div className="flex gap-2">
                <input
                  value={coilSearch}
                  onChange={(e) => setCoilSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      void loadActiveCoils(coilSearch, {
                        mrn_uid: mrnUid || undefined,
                        mrn_no: mrnNo || undefined,
                      });
                  }}
                  className={FIELD_CONTROL}
                  placeholder="Search by coil UID or item"
                />
                <button
                  type="button"
                  onClick={() =>
                    loadActiveCoils(coilSearch, {
                      mrn_uid: mrnUid || undefined,
                      mrn_no: mrnNo || undefined,
                    })
                  }
                  className="h-8 lg:h-9 px-3 bg-slate-800 text-white text-[9px] font-bold uppercase rounded-lg shrink-0"
                >
                  Search
                </button>
              </div>
            )}
            {loadingCoils && (
              <p className="text-[10px] text-slate-400 flex items-center gap-2 px-1">
                <Loader2 size={12} className="animate-spin" /> Loading coils…
              </p>
            )}
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-50 max-h-[min(48vh,420px)] overflow-y-auto">
              {minusCoilList.map((c) => {
                const uid = String(c.coil_no_uid);
                const checked = selectedCoils.some((x) => String(x.coil_no_uid) === uid);
                return (
                  <label
                    key={uid}
                    className={`flex items-center gap-3 px-3 py-2 text-[11px] cursor-pointer ${
                      checked ? "bg-rose-50" : "hover:bg-slate-50"
                    }`}
                  >
                    {!readOnly && (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCoil(c)}
                        className="rounded border-slate-300"
                      />
                    )}
                    <span className="font-mono font-black text-slate-800 break-all">{uid}</span>
                    <span className="text-slate-400">{c.item_code || "—"}</span>
                    <span className="ml-auto font-bold tabular-nums text-slate-700">
                      {Number(c.qty || 0).toLocaleString()}
                    </span>
                  </label>
                );
              })}
              {!loadingCoils && !minusCoilList.length && (
                <p className="py-8 text-center text-[10px] text-slate-400 uppercase font-bold">
                  No coils available
                </p>
              )}
            </div>
          </div>
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
          className="col-span-2 h-8 lg:h-9 w-full rounded-lg text-[9px] lg:text-[10px] font-black uppercase border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 px-3 transition-all sm:col-span-1 sm:w-auto"
        >
          Reset
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="h-8 lg:h-9 w-full inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 text-[9px] lg:text-[10px] font-black uppercase shadow-sm hover:bg-slate-50 px-3 lg:px-4 transition-all disabled:opacity-50 sm:w-auto"
      >
        {isView && !isApprove ? "Close" : "Cancel"}
      </button>
      {!isView && gateReady ? (
        <button
          type="button"
          onClick={() =>
            handleSave({
              approve: Boolean((isApprove || approveOnSave) && canAuthorize),
            })
          }
          disabled={
            !formReady ||
            saving ||
            (!isApprove && !entryType) ||
            (isApprove && !canAuthorize)
          }
          className="h-8 lg:h-9 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 text-white text-[9px] lg:text-[10px] font-black uppercase shadow-sm hover:bg-black disabled:bg-slate-400 px-3 lg:px-4 transition-all sm:w-auto"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin shrink-0" aria-hidden />
          ) : (
            <Check className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" aria-hidden />
          )}
          {isEdit ? "Update" : "Save"}
        </button>
      ) : null}
    </>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() =>
        handleSave({
          approve: Boolean((isApprove || approveOnSave) && canAuthorize),
        })
      }
      title={drawerTitle}
      description={
        isApprove
          ? "Confirm the coils, then save to authorize the adjustment."
          : "MRN-based stock adjustment for adding or removing coils"
      }
      footer={null}
      maxWidth="max-w-full xl:max-w-7xl"
      noPadding
      bodyScrollable={false}
    >
      <div className="flex h-full min-h-0 flex-col w-full max-w-full min-w-0 overflow-hidden bg-slate-50 antialiased">
        {!formReady ? (
          <FormPanelLoader
            className="flex-1 border-0 rounded-none min-h-0"
            minHeight="min-h-0 flex-1"
            label="Loading stock adjustment..."
            hint="Preparing adjustment details."
          />
        ) : (
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden w-full min-w-0">
            {/* Gate / type toolbar — IMS chrome; logic = MRN */}
            <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 lg:px-4 flex flex-wrap items-end gap-2 lg:gap-3">
              <div className="min-w-[120px]">
                <span className={FIELD_LABEL}>Type</span>
                <select
                  value={entryType || ""}
                  disabled={readOnly || isEdit || gateReady}
                  onChange={(e) => {
                    setEntryType(e.target.value);
                    setGateReady(false);
                    setMrnUid("");
                    setMrnNo("");
                    setHeatNo("");
                    setItemId(null);
                    setItemRow(null);
                    setSupplierId(null);
                    setSupplierRow(null);
                    setSelectedCoils([]);
                    setCoilOptions([]);
                  }}
                  className={FIELD_CONTROL}
                >
                  <option value="">Select…</option>
                  <option value="add">Add (+)</option>
                  <option value="minus">Minus (−)</option>
                </select>
              </div>
              {entryType === "add" && (
                <div className="min-w-[140px]">
                  <label htmlFor="rm-sa-gate-fy" className={FIELD_LABEL}>
                    Financial year
                  </label>
                  <select
                    id="rm-sa-gate-fy"
                    value={financialYear}
                    onChange={(e) => setFinancialYear(e.target.value)}
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
              <div className="min-w-0 w-full sm:flex-1 sm:min-w-[200px] sm:max-w-lg">
                <label htmlFor="rm-sa-gate-mrn" className={FIELD_LABEL}>
                  MRN number or UID
                </label>
                <input
                  id="rm-sa-gate-mrn"
                  type="text"
                  value={mrnInput}
                  onChange={(e) => setMrnInput(e.target.value)}
                  disabled={gateReady || readOnly || isEdit || !entryType}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !gateReady && !readOnly && !isEdit && entryType) {
                      e.preventDefault();
                      void handleGateLoad();
                    }
                  }}
                  placeholder="e.g. 3701 or 3701_3"
                  className={FIELD_CONTROL}
                  autoComplete="off"
                />
              </div>
              {!gateReady && !readOnly && !isEdit && (
                <button
                  type="button"
                  onClick={() => void handleGateLoad()}
                  disabled={gateLoading || !entryType}
                  className="h-8 lg:h-9 w-full sm:w-auto px-4 shrink-0 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wide shadow-sm hover:bg-indigo-700 disabled:opacity-55 inline-flex items-center justify-center gap-2 border border-indigo-700/20"
                >
                  {gateLoading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> : null}
                  Load
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
                {toolbarActionButtons}
              </div>
            </div>

            {isApprove ? (
              <div className="shrink-0 px-3 py-2 lg:px-4 bg-emerald-50 border-b border-emerald-100 text-[10px] font-medium text-emerald-900">
                Approve mode: review the MRN coils, then save to authorize the stock movement.
              </div>
            ) : isEdit && editData?.approved ? (
              <div className="shrink-0 px-3 py-2 lg:px-4 bg-amber-50 border-b border-amber-100 text-[10px] font-medium text-amber-900">
                Editing an authorized adjustment resets it to Pending. Turn on Approve before saving to authorize it again.
              </div>
            ) : null}

            {!gateReady ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 px-4 text-center py-10">
                <Package className="w-8 h-8 opacity-30" />
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {!entryType
                    ? "Select Add (+) or Minus (−), then load an MRN"
                    : entryType === "add"
                      ? "Select a financial year and MRN, then select Load"
                      : "Enter an MRN number or UID, then select Load"}
                </p>
                <p className="text-[10px] text-slate-400 max-w-md">
                  The financial year narrows an Add entry, the MRN fills in the item, supplier, and
                  heat number, and a Minus entry loads that MRN&apos;s active coils.
                </p>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 flex-col w-full overflow-hidden">
                {/* Inputs row */}
                <div className="shrink-0 border-b border-slate-200 bg-slate-50/50 px-3 py-2 lg:px-4">
                  <div className="grid grid-cols-2 lg:grid-cols-12 gap-2 lg:gap-3 items-start">
                    {entryType === "add" ? (
                      <>
                        <div className="lg:col-span-2">
                          <span className={FIELD_LABEL}>Coils *</span>
                          <input
                            type="number"
                            min={1}
                            value={coilCount}
                            disabled={readOnly}
                            onChange={(e) => setCoilCount(e.target.value)}
                            className={FIELD_CONTROL}
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <span className={FIELD_LABEL}>Qty per coil *</span>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={perCoilQty}
                            disabled={readOnly}
                            onChange={(e) => setPerCoilQty(e.target.value)}
                            className={FIELD_CONTROL}
                            placeholder="KG"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <span className={FIELD_LABEL}>Heat No.</span>
                          <input
                            type="text"
                            value={heatNo}
                            disabled={readOnly}
                            onChange={(e) => setHeatNo(e.target.value)}
                            className={FIELD_CONTROL}
                            placeholder="From MRN, or enter manually"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <span className={FIELD_LABEL}>MRN</span>
                          <div className={READOUT_BOX}>
                            <p className="text-[11px] font-mono font-bold text-slate-900 leading-tight truncate">
                              {mrnUid || mrnNo || "—"}
                            </p>
                            <p className="text-[9px] font-semibold text-slate-500 mt-0.5 truncate">
                              {mrnNo ? `No. ${mrnNo}` : ""}
                              {financialYear ? `${mrnNo ? " · " : ""}FY ${financialYear}` : ""}
                              {!mrnNo && !financialYear ? "—" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="lg:col-span-2">
                          <span className={FIELD_LABEL}>Impact</span>
                          <div className={READOUT_BOX}>
                            <p className="text-[11px] font-bold text-emerald-800 tabular-nums leading-tight">
                              +{addPreviewQty.toLocaleString()} KG
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="lg:col-span-2">
                        <span className={FIELD_LABEL}>Selected</span>
                        <div className="min-h-[2rem] lg:min-h-[2.5rem] rounded-lg border border-rose-200/80 bg-rose-50/60 px-2 flex flex-col justify-center shadow-sm">
                          <p className="text-[11px] font-bold text-rose-950 tabular-nums leading-tight">
                            {selectedCoils.length} Coils · −{minusPreviewQty.toLocaleString()} KG
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="col-span-2 lg:col-span-4">
                      <RemarksTextarea
                        label="Reason"
                        labelIcon={<MessageSquareQuote size={12} className="text-indigo-500 shrink-0" />}
                        value={remarks}
                        onChange={(e) => setRemarks(e?.target?.value ?? e ?? "")}
                        placeholder="Enter a reason"
                        readOnly={readOnly && !isApprove}
                        disabled={readOnly && !isApprove}
                        rows={1}
                        labelClassName="text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-1 ml-0 flex flex-wrap items-center gap-1"
                        className="[&_textarea]:!min-h-[2rem] [&_textarea]:!max-h-[2rem] lg:[&_textarea]:!min-h-[2.25rem] lg:[&_textarea]:!max-h-[2.25rem] [&_textarea]:!py-1 [&_textarea]:!text-[10px] lg:[&_textarea]:!text-[11px] [&_textarea]:resize-none [&_textarea]:rounded-lg [&_textarea]:border-slate-200 flex min-h-0 w-full flex-col"
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <span className={FIELD_LABEL_ROW}>
                        <Shield className="w-3 h-3 text-slate-400 shrink-0" aria-hidden />
                        Approve
                      </span>
                      {canAuthorize || isView || isEdit || isApprove ? (
                        <div
                          className={`min-h-[2rem] lg:min-h-[2.25rem] rounded-lg border px-2 flex items-center justify-between gap-1.5 shadow-sm ${
                            approvedFlag
                              ? "border-emerald-700 bg-emerald-600 text-white"
                              : "border-amber-200 bg-amber-50"
                          }`}
                        >
                          <p
                            className={`truncate text-[9px] font-black uppercase ${
                              approvedFlag ? "text-white" : "text-amber-900"
                            }`}
                          >
                            {approvedFlag ? "Authorized" : "Pending"}
                          </p>
                          {!isView && canAuthorize ? (
                            <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                              <input
                                type="checkbox"
                                checked={isApprove ? true : approveOnSave}
                                onChange={(e) => setApproveOnSave(e.target.checked)}
                                disabled={isApprove}
                                className="peer sr-only"
                              />
                              <span className="pointer-events-none absolute inset-0 z-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-400" />
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

                {/* Details + breakdown */}
                <div className="flex flex-1 min-h-0 flex-col overflow-hidden border-t border-slate-200/80">
                  <div className="flex flex-1 flex-col min-h-0 lg:hidden bg-slate-100/80">
                    <div className="grid w-full grid-cols-2 gap-1 shrink-0 px-2 py-1 border-b border-slate-200 bg-white">
                      {[
                        { id: "details", label: "Details" },
                        { id: "coils", label: "Coils" },
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
