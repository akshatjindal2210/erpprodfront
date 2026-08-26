"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, RefreshCw, Edit3, Trash2, CheckCircle, X, Truck, FileText, Info, List, Package, Lock, Unlock, Printer, CalendarClock, CheckCircle2 } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import { forwardingNoteService } from "@/apps/ims/lib/services/forwardingNote";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";

// Components
import ForwardingModal from "@/apps/ims/modules/forwarding-note/ForwardingModal"; 
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import ActionButton from "@/ui/primitives/ActionButton";
import PrintActionButton from "@/ui/primitives/PrintActionButton";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { printFromBackendHtml } from "@/apps/ims/lib/utils/printHtmlDocument";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { LIST_PAGE_SEARCH_LABEL_CLASS } from "@/ui/common/list/ListPageSearchField";
import { fetchBillOptions, getBillByNo, billHelperItemFromRow, isBlankForwardingBill } from "@/apps/ims/lib/utils/forwardingBillOptions";
import TodayDispatchPlanTab from "@/apps/ims/modules/forwarding-note/TodayDispatchPlanTab";
import { buildScheduleItemWiseHeaders } from "@/apps/ims/modules/schedule-planning/schedulePlanningColumns";
import { SCHEDULE_PLAN_STATUS } from "@/apps/ims/modules/schedule-planning/schedulePlanStatus";
import { selectUser } from "@/platform/store/slices/authSlice";
import { canCreateDirectForwardingNote } from "@/apps/ims/lib/utils/imsSpecialPermissions";

/** Master FUID only — never item-wise row `id` (that is a different PK). */
function resolveMasterFuid(row) {
  if (!row || typeof row !== "object") return null;
  const raw = row.fuid;
  if (raw === undefined || raw === null || raw === "") return null;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function resolveMasterModalItem(record, summaryRows = []) {
  if (!record) return null;
  const fuid = resolveMasterFuid(record);
  if (!fuid) return null;
  const master = summaryRows.find((r) => resolveMasterFuid(r) === fuid);
  if (master) return master;
  return {
    fuid,
    approved: record.approved,
    out_entry_locked: record.out_entry_locked,
    po_number: record.po_number,
    billno: record.billno,
    acc_name: record.acc_name,
    acc_code: record.acc_code,
  };
}

function forwardingDrillButton(row, label, onDrill, title) {
  if (!onDrill || !resolveMasterFuid(row)) return label;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onDrill(row);
      }}
      className="font-mono text-indigo-600 font-bold text-[10px] uppercase hover:underline cursor-pointer text-left"
      title={title}
    >
      {label}
    </button>
  );
}

/** Search matches visible table cells (raw + formatted labels). */
function forwardingTableSearchParts(row, reportType = "summary") {
  const parts = [];
  const push = (...vals) => {
    for (const v of vals) {
      if (v == null || v === "") continue;
      parts.push(String(v));
    }
  };
  const pushNum = (...vals) => {
    for (const v of vals) {
      if (v == null || v === "") continue;
      parts.push(String(v));
      const n = Number(v);
      if (Number.isFinite(n)) parts.push(n.toLocaleString());
    }
  };
  const pushDate = (...vals) => {
    for (const v of vals) {
      if (!v) continue;
      const formatted = formatDateTime(v);
      if (formatted && formatted !== "—") parts.push(formatted);
    }
  };

  push(row.fuid);
  if (reportType === "item_wise") {
    push(row.schno, row.item_code, row.item_dcode, row.packing_number);
    pushNum(row.box, row.box_qty, row.loose_box, row.loose_box_qty, row.total_qty);
    push(`${row.box || 0} Boxes`, `Qty: ${Number(row.box_qty || 0).toLocaleString()}`);
    push(`${row.loose_box || 0} Boxes`, `Qty: ${Number(row.loose_box_qty || 0).toLocaleString()}`);
  }

  // Hub / external + saved line bills
  push(row.billno, row.billdt, row.status, row.line_bill_no);
  push(row.bill_made_by, row.bill_updated_by, row.line_bill_updated_by, row.bill_updated_by_name);
  push(row.acc_name, row.acc_code);
  pushNum(reportType === "item_wise" ? row.total_qty : row.total_items);
  pushDate(row.timestamp, row.created_at, row.updated_at, row.approved_at, row.out_entry_locked_at, row.line_bill_updated_at, row.bill_updated_at);

  push(
    row.approved ? "AUTHORIZED" : "PENDING",
    row.approved ? "● AUTHORIZED" : "○ PENDING"
  );
  push(formatLockStatusCell(row).text);

  push(row.transporter_name, row.transporter_name ? null : "Direct Party");
  push(row.vehicle_number, row.vehicle_number ? null : "NO VEHICLE");

  push(row.po_number, row.po_number ? null : "—");
  pushNum(row.cartage);

  push(
    row.created_by_name,
    row.updated_by_name,
    row.approved_by_name,
    row.out_entry_locked_by_name,
    row.line_bill_updated_by,
    row.bill_updated_by_name
  );

  return parts;
}

/** Lock Status: out entry complete → COMPLETE, else locked / unlocked. */
function formatLockStatusCell(row) {
  const complete =
    row?.out_entry_complete === true || row?.out_entry_scan_complete === true;
  if (complete) {
    return { text: "COMPLETE", className: "bg-emerald-50 text-emerald-600 border-emerald-100" };
  }
  if (row?.out_entry_locked) {
    return { text: "LOCKED", className: "bg-rose-50 text-rose-600 border-rose-100" };
  }
  return { text: "UNLOCKED", className: "bg-slate-50 text-slate-500 border-slate-100" };
}

function LockStatusBadge({ row }) {
  const { text, className } = formatLockStatusCell(row);
  return (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${className}`}>
      {text}
    </span>
  );
}

function formatExternalBillStatus(status) {
  const raw = String(status ?? "").trim();
  const key = raw.toLowerCase();
  if (!raw) return { text: "-", className: "bg-slate-50 text-slate-400 border-slate-100", textClass: "text-slate-400" };

  const palette = {
    green: { badge: "bg-emerald-50 text-emerald-600 border-emerald-100", text: "text-emerald-600" },
    yellow: { badge: "bg-amber-50 text-amber-700 border-amber-100", text: "text-amber-700" },
    red: { badge: "bg-rose-50 text-rose-700 border-rose-100", text: "text-rose-700" },
    blue: { badge: "bg-blue-50 text-blue-700 border-blue-100", text: "text-blue-700" },
    orange: { badge: "bg-orange-50 text-orange-700 border-orange-100", text: "text-orange-700" },
    purple: { badge: "bg-purple-50 text-purple-700 border-purple-100", text: "text-purple-700" },
    cyan: { badge: "bg-cyan-50 text-cyan-700 border-cyan-100", text: "text-cyan-700" },
    indigo: { badge: "bg-indigo-50 text-indigo-700 border-indigo-100", text: "text-indigo-700" },
    pink: { badge: "bg-pink-50 text-pink-700 border-pink-100", text: "text-pink-700" },
    slate: { badge: "bg-slate-50 text-slate-700 border-slate-200", text: "text-slate-700" },
    gray: { badge: "bg-slate-50 text-slate-700 border-slate-200", text: "text-slate-700" },
    black: { badge: "bg-slate-900 text-white border-slate-900", text: "text-slate-900" },
    white: { badge: "bg-white text-slate-700 border-slate-200", text: "text-slate-700" },
  };

  const hit = palette[key];
  return {
    text: raw,
    className: hit?.badge || "bg-slate-50 text-slate-700 border-slate-200",
    textClass: hit?.text || "text-slate-700",
  };
}

const DISPATCH_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Locked", value: "locked" },
  { label: "Unlocked", value: "unlocked" },
  { label: "Complete", value: "complete" },
];

const DISPATCH_PLAN_STATUS_OPTIONS = [
  { label: "Plan", value: "plan" },
  { label: "Complete", value: "complete" },
];

function rowMatchesApprovedStatus(row, status) {
  if (!status || status === "all") return true;
  if (status === "approved") return Boolean(row?.approved);
  if (status === "pending") return !row?.approved;
  return true;
}

function rowMatchesDispatchFilter(row, dispatchFilter) {
  if (!dispatchFilter || dispatchFilter === "all") return true;
  const complete =
    row?.out_entry_complete === true || row?.out_entry_scan_complete === true;
  const locked = Boolean(row?.out_entry_locked);
  if (dispatchFilter === "complete") return complete;
  if (dispatchFilter === "locked") return locked && !complete;
  if (dispatchFilter === "unlocked") return !locked && !complete;
  return true;
}

export default function ForwardingPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("forwarding_note_master", "view"), [canAccess]);
  const canEditBill = useMemo(() => canAccess("forwarding_note_master", "edit").allowed, [canAccess]);
  const user = useSelector(selectUser);
  const role = useSelector(state => state.auth.role);
  const canDirectCreate = useMemo(() => canCreateDirectForwardingNote(user), [user]);

  const [outerTab, setOuterTab] = useState("dispatch_plan");

  // Dispatch plan tab ref + state
  const dispatchPlanRef = useRef(null);
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState("plan");
  const [dispatchSelected, setDispatchSelected] = useState(null);
  const [dispatchRows, setDispatchRows] = useState([]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [reportType, setReportType] = useState("summary");

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    dispatchFilter: "all",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "fuid",
    sortDir: "desc",
  });

  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setParams(prev => ({
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to
      }));
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const { tempSearch, setTempSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [allRows, setAllRows] = useState([]);
  const [summaryRowsCache, setSummaryRowsCache] = useState([]);
  const [itemWiseFuidFilter, setItemWiseFuidFilter] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selectedId, setSelectedId] = useState(null); 
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [dispatchPrefill, setDispatchPrefill] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [billPrinting, setBillPrinting] = useState(false);
  const [billDraftNo, setBillDraftNo] = useState(null);
  const [billSaving, setBillSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Dates hit API; Status / Lock-Complete + Quick Search are client-side on loaded rows.
      const base = {
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
        },
      };

      const service = reportType === "summary" ? forwardingNoteService : { getAll: forwardingNoteService.getAllItems };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await service.getAll({ ...base, page, limit });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);

      setAllRows(data);
      if (reportType === "summary") setSummaryRowsCache(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load forwarding notes.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    params.pageSize,
    params.fromDate,
    params.toDate,
    reportType,
  ]);

  useEffect(() => {
    if (outerTab !== "forwarding_master") return;
    fetchData();
  }, [fetchData, outerTab]);

  const drillToItemWise = useCallback((row) => {
    const fuid = resolveMasterFuid(row);
    if (!fuid) return;
    setItemWiseFuidFilter(fuid);
    setReportType("item_wise");
    setSelectedId(null);
    setDisplayLimit(100);
  }, []);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    let data = allRows;
    if (reportType === "item_wise" && itemWiseFuidFilter != null) {
      data = data.filter((r) => resolveMasterFuid(r) === itemWiseFuidFilter);
    }
    data = data.filter(
      (r) =>
        rowMatchesApprovedStatus(r, params.status) &&
        rowMatchesDispatchFilter(r, params.dispatchFilter)
    );
    if (q) {
      data = applyClientSearch(data, tempSearch, {
        getParts: (row) => forwardingTableSearchParts(row, reportType),
        skipSort: !!params.sortKey,
      });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [
    allRows,
    tempSearch,
    params.sortKey,
    params.sortDir,
    params.status,
    params.dispatchFilter,
    reportType,
    itemWiseFuidFilter,
  ]);

  useEffect(() => {
    setDisplayLimit(100);
  }, [tempSearch, reportType, params.status, params.dispatchFilter]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const getRowId = useCallback(
    (item) => {
      if (reportType === "summary") return String(item.fuid ?? "");
      return String(item.id ?? `${item.fuid}-${item.item_dcode}-${item.packing_number}`);
    },
    [reportType]
  );

  useEffect(() => {
    if (!selectedId) return;
    if (!filteredRows.some((row) => getRowId(row) === selectedId)) setSelectedId(null);
  }, [selectedId, filteredRows, getRowId]);

  const handleFilterApply = (data) => {
    applySearchFromInput();
    setSelectedId(null);
    setItemWiseFuidFilter(null);
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
      // Status / Lock stay client-side; sync from strip on Search too.
      status: data.approvedStatus ?? prev.status,
      dispatchFilter: data.dispatchFilter ?? prev.dispatchFilter,
    }));
  };

  const handleClientExtraFilterChange = useCallback((key, value) => {
    setSelectedId(null);
    if (key === "approvedStatus") {
      setParams((prev) => ({ ...prev, status: value ?? "all" }));
      return;
    }
    if (key === "dispatchFilter") {
      setParams((prev) => ({ ...prev, dispatchFilter: value ?? "all" }));
    }
  }, []);

  const handleReset = () => {
    resetSearch();
    setItemWiseFuidFilter(null);
    setParams({
      pageSize: 1000,
      status: "all",
      dispatchFilter: "all",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "fuid",
      sortDir: "desc",
    });
  };

  const selectedRecord = useMemo(
    () => filteredRows.find((item) => getRowId(item) === selectedId) || null,
    [filteredRows, selectedId, getRowId]
  );
  const isSelectedLocked = Boolean(selectedRecord?.out_entry_locked);
  const selectedLockStatus = useMemo(
    () => (selectedRecord ? formatLockStatusCell(selectedRecord) : null),
    [selectedRecord]
  );

  const isSuperAdmin = role === "super_admin" || user?.type === "super_admin";
  const selectedBillItem = useMemo(
    () => (reportType === "item_wise" ? billHelperItemFromRow(selectedRecord) : null),
    [reportType, selectedRecord]
  );
  const hasSavedDbBill = Boolean(
    selectedRecord?.bill_source === "db" || String(selectedRecord?.line_bill_no ?? "").trim()
  );
  // Blank bill: any editor. Saved DB bill: super admin only (to change).
  const canAssignLineBill = Boolean(
    reportType === "item_wise" &&
      canEditBill &&
      selectedRecord?.id &&
      selectedBillItem &&
      selectedRecord?.out_entry_complete === true &&
      (isBlankForwardingBill(selectedRecord) || (hasSavedDbBill && isSuperAdmin))
  );

  useEffect(() => {
    const saved =
      String(selectedRecord?.billno ?? selectedRecord?.line_bill_no ?? "").trim() || null;
    // Prefill dropdown with existing saved bill when super admin re-opens to change
    setBillDraftNo(hasSavedDbBill && isSuperAdmin ? saved : null);
  }, [selectedRecord?.id, selectedRecord?.fuid, selectedRecord?.billno, selectedRecord?.line_bill_no, reportType, hasSavedDbBill, isSuperAdmin]);

  const fetchBillOptionsForRow = useCallback(
    (params) =>
      fetchBillOptions({
        ...params,
        items: selectedBillItem ? [selectedBillItem] : [],
      }),
    [selectedBillItem]
  );

  const getBillByNoForRow = useCallback(
    (billNo) => getBillByNo(billNo, { items: selectedBillItem ? [selectedBillItem] : [] }),
    [selectedBillItem]
  );

  const openModal = useCallback((mode) => {
    setModalMode(mode);
    setModalOpen(true);
  }, []);

  const openDispatchPlanNew = useCallback(() => {
    if (!dispatchSelected) {
      // Blank FN modal — pick customer → category → schedule items in Item Breakdown.
      setDispatchPrefill(null);
      setModalMode("add");
      setModalOpen(true);
      return;
    }
    // Same customer — plan lines with balance + FG (one row per item — no duplicate item_dcode).
    const acc = String(dispatchSelected.acc_code ?? "").trim();
    const qualifying = dispatchRows.filter((r) => {
      if (String(r.acc_code ?? "").trim() !== acc) return false;
      const fgStock = Number(r.fg_stock_qty ?? r.in_hand_qty ?? 0);
      const balance = Number(r.balance_qty ?? r.totalqty ?? 0);
      return fgStock > 0 && balance > 0;
    });
    if (!qualifying.length) {
      toast.info("No items with remaining balance and FG stock for this customer.");
      return;
    }
    // Prefer the selected row first, then other lines — keep first occurrence per item.
    const ordered = [
      ...qualifying.filter((r) => r === dispatchSelected),
      ...qualifying.filter((r) => r !== dispatchSelected),
    ];
    const seenItems = new Set();
    const uniqueByItem = [];
    for (const row of ordered) {
      const dcode = String(row?.itemdcode ?? row?.item_dcode ?? "").trim();
      if (!dcode || seenItems.has(dcode)) continue;
      seenItems.add(dcode);
      uniqueByItem.push(row);
    }
    setDispatchPrefill({ anchorRow: dispatchSelected, rows: uniqueByItem });
    setModalMode("add");
    setModalOpen(true);
  }, [dispatchSelected, dispatchRows]);

  const clearDispatchSelection = useCallback(() => {
    setDispatchSelected(null);
    dispatchPlanRef.current?.clearSelection?.();
  }, []);

  /** Forwarding Master New — direct create only with special permission; otherwise same as Today Dispatch Plan → New. */
  const openMasterNew = useCallback(() => {
    if (canDirectCreate) {
      setDispatchPrefill(null);
      openModal("add");
      return;
    }
    // toast.info("Switch to Today's Dispatch Plan, then click New (with or without a row selected).");   // Commented out because the user does not open the form on the Forwarding Note page.
    openDispatchPlanNew(); // Uncommented for the Forwarding Note page: on New button click, check permission; if not permitted, show a toast, otherwise open the same modal as Today's Dispatch New.
  }, [canDirectCreate, openModal, openDispatchPlanNew]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setDispatchPrefill(null);
    setSelectedId(null);
  }, []);

  const handleModalSuccess = useCallback(() => {
    if (dispatchPrefill) {
      dispatchPlanRef.current?.refresh();
      setDispatchSelected(null);
      setDispatchPrefill(null);
    } else {
      fetchData();
    }
    setSelectedId(null);
  }, [dispatchPrefill, fetchData]);

  const getSelectedRow = useCallback(() => selectedRecord, [selectedRecord]);

  const handlePrintBill = useCallback(async (rowOrEvent) => {
    // Prefer explicit row.fuid; ignore click events; never use item-wise `id` as fuid.
    const fuid =
      resolveMasterFuid(rowOrEvent) ??
      resolveMasterFuid(selectedRecord);
    if (!fuid) {
      toast.info("Select an Item-wise or Summary row with a valid FUID to print the master bill.");
      return;
    }
    if (billPrinting) return;
    setBillPrinting(true);
    try {
      const res = await forwardingNoteService.printBill({ fuid });
      if (!res?.success || !res?.html) throw new Error(res?.message || "Bill HTML missing");
      const ok = printFromBackendHtml(res.html);
      if (!ok) toast.error("Could not open print preview. Try again.");
    } catch (err) {
      toast.error(err?.message || "Failed to generate bill.");
    } finally {
      setBillPrinting(false);
    }
  }, [selectedRecord, billPrinting]);

  const canPrintMasterBill = Boolean(resolveMasterFuid(selectedRecord)) && !billPrinting;

  const { openEditModal, openPrintModal, openApproveModal, openDeleteModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "forwarding_note_master",
    modalOpen: modalOpen || isDeleting,
    selectedId: selectedId,
    getSelectedRow,
    openAdd: useCallback(() => {
      if (outerTab === "dispatch_plan") {
        openDispatchPlanNew();
        return;
      }
      openMasterNew();
    }, [outerTab, openDispatchPlanNew, openMasterNew]),
    openEdit: useCallback(() => {
      openModal("edit");
    }, [openModal]),
    canEditSelection: useCallback(() => Boolean(selectedId) && !isSelectedLocked, [selectedId, isSelectedLocked]),
    onPrint: handlePrintBill,
    canPrintSelection: useCallback(() => canPrintMasterBill, [canPrintMasterBill]),
    printBlockedMessage: "Select a forwarding note (Summary or Item-wise) to print the master bill (Ctrl+P).",
    printModule: "forwarding_note_master",
    printAction: "view",
    openApprove: useCallback(() => {
      openModal("approve");
    }, [openModal]),
    canApproveSelection: useCallback(
      () => Boolean(selectedId) && !isSelectedLocked,
      [selectedId, isSelectedLocked]
    ),
    onApproveBlocked: useCallback(() => {
      if (!selectedId) toast.info("Select a row to approve (Ctrl+A).");
      else if (isSelectedLocked) toast.info("This forwarding note is locked for out entry.");
    }, [selectedId, isSelectedLocked]),
    openDelete: useCallback(() => {
      setIsDeleting(true);
    }, []),
    canDeleteSelection: useCallback(() => Boolean(selectedId) && !isSelectedLocked, [selectedId, isSelectedLocked]),
  });

  const modalRecord = useMemo(
    () => resolveMasterModalItem(selectedRecord, summaryRowsCache),
    [selectedRecord, summaryRowsCache]
  );

  const handleUnlock = async () => {
    if (!selectedRecord?.fuid) return;
    try {
      await forwardingNoteService.unlockLock(selectedRecord.fuid);
      toast.success("Forwarding note unlocked successfully.");
      fetchData();
      setSelectedId(null);
    } catch (err) {
      toast.error(err?.message || "Failed to unlock forwarding note.");
    }
  };

  const handleLock = async () => {
    if (!selectedRecord?.fuid) return;
    try {
      await forwardingNoteService.lockLock(selectedRecord.fuid);
      toast.success("Forwarding note locked successfully.");
      fetchData();
      setSelectedId(null);
    } catch (err) {
      toast.error(err?.message || "Failed to lock forwarding note.");
    }
  };

  const handleSaveLineBill = async () => {
    const itemId = selectedRecord?.id;
    const billNo = String(billDraftNo ?? "").trim();
    if (!itemId || !billNo || !canAssignLineBill) return;

    setBillSaving(true);
    try {
      const looked = await getBillByNoForRow(billNo);
      const opt = looked?.data || {};
      const res = await forwardingNoteService.assignItemBill({
        item_ids: [itemId],
        billno: opt.billno || opt.bill_no || billNo,
        billdt: opt.billdt || null,
      });
      if (!res?.success) throw new Error(res?.message || "Failed to save bill");

      const saved = Array.isArray(res?.data) ? res.data[0] : res?.data;
      toast.success("Bill assigned successfully.");
      setBillDraftNo(null);
      if (saved) {
        setAllRows((prev) =>
          (prev || []).map((row) =>
            String(row?.id) === String(itemId)
              ? {
                  ...row,
                  billno: saved.billno || billNo,
                  billdt: saved.billdt || opt.billdt || null,
                  line_bill_no: saved.billno || billNo,
                  bill_source: "db",
                  bill_updated_by_name: saved.bill_updated_by_name || saved.line_bill_updated_by || null,
                  line_bill_updated_by: saved.line_bill_updated_by || saved.bill_updated_by_name || null,
                  line_bill_updated_at: saved.line_bill_updated_at || saved.bill_updated_at || null,
                }
              : row
          )
        );
      } else {
        await fetchData();
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save bill.");
    } finally {
      setBillSaving(false);
    }
  };

  const extraFilters = useMemo(() => [
    { 
      label: "Status",
      key: "approvedStatus",
      value: params.status,
      variant: "quick",
      options: [
        { label: "All Status", value: "all" }, 
        { label: "Authorized", value: "approved" }, 
        { label: "Pending", value: "pending" }
      ]
    },
    {
      label: "Lock / Complete",
      key: "dispatchFilter",
      value: params.dispatchFilter,
      variant: "quick",
      options: DISPATCH_FILTER_OPTIONS,
    },
  ], [params.status, params.dispatchFilter]);

  const HEADERS = useMemo(() => {
    const baseHeaders = [
      [
        "FUID",
        "fuid",
        (v, row) =>
          forwardingDrillButton(
            row,
            <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>,
            drillToItemWise,
            reportType === "summary"
              ? `View ${row.total_items ?? 0} item line(s) in Item-wise`
              : "Show all item lines for this forwarding note"
          ),
        { fixed: true, width: "80px" },
      ],
    ];

    // Schedule belongs on Item-wise only — one FN master can link many schedules.
    const itemCols = reportType === "item_wise" ? [
      ["Sch No", "schno", (v) => <span className="font-bold text-slate-600 text-[11px]">{v || "—"}</span>, { width: "100px" }],
      ["Item Code", "item_code", (v) => <span className="font-bold text-blue-700 text-[11px]">{v || "—"}</span>, { width: "160px" }],
      ["Packing", "packing_number", (v) => <span className="font-bold text-slate-600 text-[11px]">{v || "—"}</span>, { width: "100px" }],
      ["Open Boxes", "box", (v, row) => (
        <div className="flex flex-col leading-tight">
          <span className="font-black text-indigo-600 text-[11px]">{v || 0} Boxes</span>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Qty: {row.box_qty?.toLocaleString() || 0}</span>
        </div>
      ), { width: "110px" }],
      ["Loose Boxes", "loose_box", (v, row) => (
        <div className="flex flex-col leading-tight">
          <span className="font-black text-amber-600 text-[11px]">{v || 0} Boxes</span>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Qty: {row.loose_box_qty?.toLocaleString() || 0}</span>
        </div>
      ), { width: "120px" }],
      ["Total Qty", "total_qty", (v) => <span className="font-black text-slate-800 text-[11px]">{v?.toLocaleString() || 0}</span>, { width: "100px" }],
    ] : [];

    const masterHeaders = [
      ["Bill No.", "billno", (v, row) => {
        const color = row?.bill_source === "db" ? "text-emerald-600" : formatExternalBillStatus(row?.status).textClass;
        return <span className={`font-bold uppercase text-[11px] whitespace-normal break-words leading-snug ${color}`} title={v || ""}>{v || "-"}</span>;
      }, { width: reportType === "summary" ? "200px" : "140px", wrap: true }],
      ["Bill Date", "billdt", (v, row) => {
        const color = row?.bill_source === "db" ? "text-emerald-600" : formatExternalBillStatus(row?.status).textClass;
        return <span className={`text-[10px] font-semibold whitespace-normal break-words leading-snug ${color}`} title={v || ""}>{v || "-"}</span>;
      }, { width: reportType === "summary" ? "160px" : "110px", wrap: true }],
      ["Customer", "acc_name", (v) => <span className="text-[10px] font-medium text-slate-500 uppercase italic whitespace-normal break-words leading-snug block" title={v}>{v || "—"}</span>, { width: "250px", wrap: true }],
      [
        "Total Qty",
        "total_items",
        (v, row) =>
          reportType === "summary"
            ? forwardingDrillButton(
                row,
                <span className="font-black text-slate-700 text-[11px]">{v}</span>,
                drillToItemWise,
                `Open ${v ?? 0} item line(s) in Item-wise`
              )
            : <span className="font-black text-slate-700 text-[11px]">{v}</span>,
        { width: "120px" },
      ],
      ["Timestamp", "timestamp", (v) => <span className="text-[10px] text-slate-500">{formatDateTime(v)}</span>, { width : "150px" }],
      ["Status", "approved", (v) => (
        <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
          {v ? "● AUTHORIZED" : "○ PENDING"}
        </span>
      ), { width: "120px" }],
      [
        "Lock Status",
        "out_entry_locked",
        (_v, row) => <LockStatusBadge row={row} />,
        { width: "120px" }
      ],
      ["Logistics", "transporter_name", (v, row) => (
        <div className="flex flex-col leading-tight min-w-[160px]">
          <div className="flex items-center gap-1 text-slate-700">
            <Truck size={10} />
            <span className="font-bold text-[11px]">{v || "Direct Party"}</span>
          </div>
          <span className="text-indigo-500 font-black text-[9px] ml-3 uppercase tracking-wider">{row.vehicle_number || "NO VEHICLE"}</span>
        </div>
      ), { width: "280px" }],
      ["PO Number", "po_number", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { width: "120px" }],
      ["Cartage", "cartage", (v) => <span className="text-slate-700 font-bold text-[10px]">{v?.toLocaleString() || 0}</span>, { width: "150px" }],
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
      ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
      ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Locked By", "out_entry_locked_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "130px" }],
      ["Locked At", "out_entry_locked_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Bill By", reportType === "summary" ? "bill_made_by" : "bill_updated_by_name", (v, row) => (
        <span className="text-[10px] text-slate-500">{v || row?.line_bill_updated_by || row?.bill_updated_by || "—"}</span>
      ), { width: "110px" }],
      ["Bill At", reportType === "summary" ? "bill_updated_at" : "line_bill_updated_at", (v) => (
        <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>
      ), { width: "150px" }],
    ];

    return [...baseHeaders, ...itemCols, ...masterHeaders];
  }, [reportType, drillToItemWise]);

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: reportType === "summary" ? "Forwarding Note" : "Forwarding Note Items",
    rows: filteredRows,
    headers: HEADERS,
  });

  const DISPATCH_HEADERS = useMemo(() => buildScheduleItemWiseHeaders({}), []);
  const { exporting: dispatchExporting, handleExport: handleDispatchExport, exportDisabled: dispatchExportDisabled } = useListPageExport({
    moduleName: "Today Dispatch Plan",
    rows: dispatchRows,
    headers: DISPATCH_HEADERS,
  });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                className="mr-2"
                active={outerTab}
                onChange={(id) => {
                  setOuterTab(id);
                  setSelectedId(null);
                  setDispatchSelected(null);
                }}
                tabs={[
                  { id: "forwarding_master", label: "Forwarding Master", icon: FileText },
                  { id: "dispatch_plan", label: "Today Dispatch Plan", icon: CalendarClock },
                ]}
              />
            }
            subTabs={
              outerTab === "forwarding_master" ? (
                <ImsSegmentedTabs
                  className="mr-2"
                  active={reportType}
                  onChange={(id) => {
                    setReportType(id);
                    setSelectedId(null);
                    setDisplayLimit(100);
                    if (id === "summary") setItemWiseFuidFilter(null);
                  }}
                  tabs={[
                    { id: "summary", label: "Summary", icon: List },
                    { id: "item_wise", label: "Item-wise", icon: Package },
                  ]}
                />
              ) : null
            }
            actions={
              outerTab === "dispatch_plan" ? (
                <>
                  <ActionButton module="forwarding_note_master" action="add" label="New" icon={Plus} onClick={openDispatchPlanNew} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" /> 
                  {canAccess("schedule_planning", "add").allowed && dispatchSelected && (
                    <>
                      {Number(dispatchSelected?.db_is_planned ?? dispatchSelected?.is_planned) ===
                        SCHEDULE_PLAN_STATUS.PLANNED ||
                      Number(dispatchSelected?.db_is_planned ?? dispatchSelected?.is_planned) ===
                        SCHEDULE_PLAN_STATUS.RUNNING ? (
                        <button
                          type="button"
                          onClick={() => dispatchPlanRef.current?.completeSelected()}
                          disabled={dispatchPlanRef.current?.completing}
                          className="h-9 px-4 border border-emerald-400 bg-emerald-600 text-white hover:bg-emerald-700 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shrink-0 disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          Complete
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => dispatchPlanRef.current?.openRescheduleForSelected()}
                        disabled={dispatchPlanRef.current?.completing || dispatchPlanRef.current?.rejecting}
                        className="h-9 px-4 border border-amber-400 bg-amber-500 text-white hover:bg-amber-600 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shrink-0 disabled:opacity-50"
                      >
                        <CalendarClock size={14} />
                        Reschedule
                      </button>
                    </>
                  )}
                  <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                  <button
                    type="button"
                    onClick={() => dispatchPlanRef.current?.refresh()}
                    className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center transition-all shrink-0"
                  >
                    <RefreshCw size={14} />
                  </button>
                </>
              ) : (
                <>
                  <ActionButton module="forwarding_note_master" action="add" label="New" icon={Plus} onClick={openMasterNew} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" />
                  <ActionButton module="forwarding_note_master" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selectedId || isSelectedLocked} record={modalRecord} onClick={openEditModal} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0" />
                  <ActionButton module="forwarding_note_master" action="authorize" variant="outline" label="Approve" icon={CheckCircle} disabled={!selectedId || isSelectedLocked} onClick={() => openModal("approve")} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0" />
                  <ActionButton module="forwarding_note_master" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selectedId || isSelectedLocked} onClick={() => setIsDeleting(true)} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" />
                  <PrintActionButton
                    module="forwarding_note_master"
                    variant="outline"
                    label={billPrinting ? "…" : "Print Bill"}
                    icon={Printer}
                    disabled={!canPrintMasterBill}
                    onClick={() => handlePrintBill(selectedRecord)}
                    title="Print full master bill for this FUID (works from Item-wise too)"
                    className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-3 border-slate-300 shadow-none shrink-0"
                  />
                  {role === "super_admin" && (
                    <>
                      <button
                        type="button"
                        onClick={handleLock}
                        disabled={!selectedId || isSelectedLocked}
                        className="h-9 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        title="Super Admin: lock for out entry"
                      >
                        <Lock size={14} />
                        Lock
                      </button>
                      <button
                        type="button"
                        onClick={handleUnlock}
                        disabled={!selectedId || !isSelectedLocked}
                        className="h-9 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        title="Super Admin: unlock out-entry lock"
                      >
                        <Unlock size={14} />
                        Unlock
                      </button>
                    </>
                  )}
                  <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                  <button type="button" onClick={() => fetchData()} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center transition-all shrink-0">
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  </button>
                </>
              )
            }
            viewToggle={
              outerTab === "dispatch_plan" ? (
                <ListPageExportToggle
                  viewMode={viewMode}
                  setMode={handleViewMode}
                  exporting={dispatchExporting}
                  disabled={dispatchExportDisabled}
                  onExport={handleDispatchExport}
                />
              ) : (
                <ListPageExportToggle
                  viewMode={viewMode}
                  setMode={handleViewMode}
                  exporting={exporting}
                  disabled={loading || exportDisabled}
                  onExport={handleExport}
                />
              )
            }
          />

          {outerTab === "dispatch_plan" && dispatchSelected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide break-all min-w-0">
                Selected: {dispatchSelected.schno || "—"}
                {dispatchSelected.item_code ? ` · ${dispatchSelected.item_code}` : ""}
                {dispatchSelected.acc_name ? ` · ${dispatchSelected.acc_name}` : ""}
              </span>
              <button
                type="button"
                onClick={clearDispatchSelection}
                className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase shrink-0"
              >
                <X size={14} /> Clear
              </button>
            </div>
          )}

          {outerTab === "forwarding_master" && itemWiseFuidFilter != null && reportType === "item_wise" ? (
            <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-50 border border-cyan-100">
              <span className="text-[10px] font-bold text-cyan-800 uppercase flex items-center gap-2">
                <Info size={12} /> Showing items for FUID {itemWiseFuidFilter}
              </span>
              <button
                type="button"
                onClick={() => setItemWiseFuidFilter(null)}
                className="text-cyan-600 hover:text-cyan-800 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Show all items
              </button>
            </div>
          ) : null}

          {outerTab === "forwarding_master" && selectedId && (
            <div className="border-b border-indigo-100 bg-indigo-50 px-3 py-2 space-y-2">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <span className="text-[10px] font-bold text-indigo-600 uppercase flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0 flex-1 leading-snug">
                  <Info size={12} className="shrink-0" />
                  <span className="break-all">
                    Selected: FUID{" "}
                    {reportType === "summary" ? selectedRecord?.fuid : `${selectedRecord?.fuid} · ${selectedRecord?.item_code || "—"}`}
                  </span>
                  <span className="text-indigo-400 font-semibold normal-case break-all">
                    PO {selectedRecord?.po_number || "—"}
                  </span>
                  {selectedLockStatus ? (
                    <span
                      className={`px-1.5 py-0.5 border text-[8px] font-black uppercase ${selectedLockStatus.className}`}
                    >
                      {selectedLockStatus.text}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase shrink-0 pt-0.5"
                >
                  <X size={14} /> Clear
                </button>
              </div>

              {canAssignLineBill ? (
                <div className="w-full min-w-0" data-compact-form-bar>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2">
                    <span className={`${LIST_PAGE_SEARCH_LABEL_CLASS} shrink-0 pt-1.5 sm:pt-2`}>Bill</span>
                    <div className="w-full min-w-0 flex-1" title="Matching packing bills only">
                      <SearchableSelect
                        variant="toolbar"
                        heightClass="h-8"
                        value={billDraftNo}
                        onChange={(v) => setBillDraftNo(v || null)}
                        fetchService={fetchBillOptionsForRow}
                        getByIdService={getBillByNoForRow}
                        dataKey="bill_no"
                        labelKey="bill_no"
                        labelOnlyDisplay
                        placeholder="Select bill..."
                        emptyMessage="No matching bills"
                        usePortal
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveLineBill}
                      disabled={billSaving || !billDraftNo}
                      className="h-9 w-full sm:w-auto sm:shrink-0 px-3 border border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold uppercase disabled:opacity-50"
                    >
                      {billSaving ? "…" : "Save Bill"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </ListPageToolbar>

        {outerTab === "dispatch_plan" ? (
          <>
            <ListPageFilterStrip>
              <DateRangeFilter
                showDate={false}
                instantClientExtras
                extraFilters={[
                  {
                    label: "Status",
                    key: "status",
                    value: dispatchStatusFilter,
                    options: DISPATCH_PLAN_STATUS_OPTIONS,
                    preserveOrder: false,
                    variant: "quick",
                  },
                ]}
                searchValue={dispatchSearch}
                onSearchChange={setDispatchSearch}
                onApply={(data) => {
                  setDispatchStatusFilter(data.status ?? "plan");
                }}
                searchPlaceholder="Quick search items, party, sch no..."
                searchLabel="Quick Search"
                onReset={() => {
                  setDispatchSearch("");
                  setDispatchStatusFilter("plan");
                }}
              />
            </ListPageFilterStrip>
            <TodayDispatchPlanTab
              ref={dispatchPlanRef}
              search={dispatchSearch}
              statusFilter={dispatchStatusFilter}
              onSelectedChange={setDispatchSelected}
              onRowsChange={setDispatchRows}
              viewMode={viewMode}
            />
          </>
        ) : (
          <>
            <ListPageFilterStrip>
              <DateRangeFilter
                key={`${params.fromDate}-${params.toDate}`}
                fromDate={params.fromDate}
                toDate={params.toDate}
                extraFilters={extraFilters}
                onApply={handleFilterApply}
                onReset={handleReset}
                onExtraFilterChange={handleClientExtraFilterChange}
                searchValue={tempSearch}
                onSearchChange={setTempSearch}
                searchPlaceholder="Search table..."
                searchLabel="Quick Search"
                minDate={dateFilterDefaults.minDate}
                maxDate={dateFilterDefaults.maxDate}
              />
            </ListPageFilterStrip>

            <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
              <DataTable
                key={reportType}
                headers={HEADERS}
                data={items}
                allowCopy={true}
                loading={loading}
                viewMode={viewMode}
                {...tableHotkeyProps}
                onSort={(key) => setParams(p => ({ ...p, sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc" }))}
                sortKey={params.sortKey}
                sortDir={params.sortDir}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onLoadMore={handleLoadMore}
                hasMore={items.length < totalItems}
                totalItems={totalItems}
                getRowId={getRowId}
                emptyIcon={FileText}
                cardConfig={{ 
                  titleKey: reportType === "summary" ? "po_number" : "item_code", 
                  badgeIndices: [reportType === 'summary' ? 7 : 9], 
                  detailIndices: [2, 3, 4, 5], 
                  footerKey: "created_at",
                  className: "rounded-none border border-slate-200" 
                }}
              />
            </div>

            <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Showing {items.length} of {totalItems} {reportType === 'summary' ? 'Notes' : 'Items'}
              </span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
              </div>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <ForwardingModal 
            open={modalOpen} 
            onClose={closeModal} 
            onSuccess={handleModalSuccess} 
            editData={modalMode === "add" ? null : modalRecord} 
            mode={modalMode}
            dispatchPrefill={dispatchPrefill}
            customerSchedulePicker={
              // Blank New from Dispatch Plan, or Master New without direct-create permission
              // (same schedule-catalog flow — no need to switch tabs).
              (modalMode === "add" && !dispatchPrefill && (outerTab === "dispatch_plan" || !canDirectCreate)) ||
              ((modalMode === "edit" || modalMode === "approve") &&
                Boolean(String(selectedRecord?.schno ?? "").trim()))
            }
        />
      )}
      
      {isDeleting && (
        <DeleteModal 
            item={modalRecord} 
            onClose={() => setIsDeleting(false)} 
            onSuccess={() => { fetchData(); setSelectedId(null); setIsDeleting(false); }} 
            service={forwardingNoteService} 
            entityLabel="Forwarding Note" 
            idKey="fuid"
            moduleSlug="forwarding_note_master"
        />
      )}
    </div>
  );
}

