"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, RefreshCw, Edit3, Trash2, CheckCircle, X, Truck, FileText, Info, List, Package, Lock, Unlock, Printer, CalendarClock, CheckCircle2, Ban } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import { forwardingNoteService } from "@/features/apps/ims/services/forwardingNote";
import { useViewMode } from "@/core/hooks/useViewMode";
import { formatDateTime } from "@/core/utils/utilHelper";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";

// Components
import ForwardingModal from "@/features/apps/ims/components/forwarding-note/ForwardingModal"; 
import DeleteModal from "@/core/components/common/DeleteModal";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import DataTable from "@/core/components/ui/DataTable";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ImsSegmentedTabs from "@/features/apps/ims/components/common/ImsSegmentedTabs";
import ActionButton from "@/core/components/ui/ActionButton";
import PrintActionButton from "@/core/components/ui/PrintActionButton";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";
import { useAppliedListSearch } from "@/features/apps/ims/helpers/useAppliedListSearch";
import { printFromBackendHtml } from "@/features/apps/ims/utils/printHtmlDocument";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import { LIST_PAGE_SEARCH_LABEL_CLASS } from "@/core/components/common/ListPageSearchField";
import { parseSavedBillNos, fetchBillOptions, formatBillNosForSave, getBillByNo, uniqueBillNos } from "@/features/apps/ims/utils/forwardingBillOptions";
import TodayDispatchPlanTab from "@/features/apps/ims/components/forwarding-note/TodayDispatchPlanTab";
import { buildScheduleItemWiseHeaders } from "@/features/apps/ims/components/schedule-planning/schedulePlanningColumns";

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
    push(row.item_code, row.item_dcode, row.packing_number);
    pushNum(row.box, row.box_qty, row.loose_box, row.loose_box_qty, row.total_qty);
    push(`${row.box || 0} Boxes`, `Qty: ${Number(row.box_qty || 0).toLocaleString()}`);
    push(`${row.loose_box || 0} Boxes`, `Qty: ${Number(row.loose_box_qty || 0).toLocaleString()}`);
  }

  push(...parseSavedBillNos(row.bill_no), row.bill_no ? null : "—");
  push(row.acc_name, row.acc_code);
  pushNum(reportType === "item_wise" ? row.total_qty : row.total_items);
  pushDate(row.timestamp, row.created_at, row.updated_at, row.approved_at, row.out_entry_locked_at, row.bill_updated_at);

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

const DISPATCH_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Locked", value: "locked" },
  { label: "Unlocked", value: "unlocked" },
  { label: "Complete", value: "complete" },
];

const DISPATCH_PLAN_STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Plan", value: "plan" },
  { label: "Hold", value: "hold" },
];

/** Match Lock Status column: COMPLETE → scan done; LOCKED → locked & not complete; UNLOCKED → neither. */
function buildDispatchApiFilters(dispatchFilter) {
  switch (dispatchFilter) {
    case "locked":
      return { out_entry_locked: true, out_entry_complete: false };
    case "unlocked":
      return { out_entry_locked: false, out_entry_complete: false };
    case "complete":
      return { out_entry_complete: true };
    default:
      return {};
  }
}

export default function ForwardingPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("forwarding_note_master", "view"), [canAccess]);
  const canEditBill = useMemo(() => canAccess("forwarding_note_master", "edit").allowed, [canAccess]);
  const role = useSelector(state => state.auth.role);

  const [outerTab, setOuterTab] = useState("dispatch_plan");

  // Dispatch plan tab ref + state
  const dispatchPlanRef = useRef(null);
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState("all");
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

  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selectedId, setSelectedId] = useState(null); 
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [dispatchPrefill, setDispatchPrefill] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [billPrinting, setBillPrinting] = useState(false);
  const [billDraftNos, setBillDraftNos] = useState([]);
  const [billSaving, setBillSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const apiSearch = reportType === "summary" ? appliedSearch : "";
      const base = {
        ...(apiSearch && { search: apiSearch }),
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...(params.status !== "all" && { approved: params.status === "approved" }),
          ...buildDispatchApiFilters(params.dispatchFilter),
        },
      };

      const service = reportType === "summary" ? forwardingNoteService : { getAll: forwardingNoteService.getAllItems };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await service.getAll({ ...base, page, limit });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);

      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load data");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    params.pageSize,
    params.fromDate,
    params.toDate,
    params.status,
    params.dispatchFilter,
    reportType,
    reportType === "summary" ? appliedSearch : "",
  ]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    let data = allRows;
    if (q) {
      data = applyClientSearch(allRows, tempSearch, {
        getParts: (row) => forwardingTableSearchParts(row, reportType),
        skipSort: !!params.sortKey,
      });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir, reportType]);

  useEffect(() => {
    setDisplayLimit(100);
  }, [tempSearch, reportType]);

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

  const handleFilterApply = (data) => {
    applySearchFromInput();
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
      status: data.approvedStatus ?? prev.status,
      dispatchFilter: data.dispatchFilter ?? prev.dispatchFilter,
    }));
  };

  const handleReset = () => {
    resetSearch();
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

  useEffect(() => {
    if (selectedRecord?.fuid != null) {
      setBillDraftNos(parseSavedBillNos(selectedRecord.bill_no));
    } else {
      setBillDraftNos([]);
    }
  }, [selectedRecord?.fuid, selectedRecord?.bill_no]);

  const openModal = useCallback((mode) => {
    setModalMode(mode);
    setModalOpen(true);
  }, []);

  const openDispatchPlanNew = useCallback(() => {
    if (!dispatchSelected) {
      toast.info("Select a schedule row first, then click New.");
      return;
    }
    setDispatchPrefill(dispatchSelected);
    setModalMode("add");
    setModalOpen(true);
  }, [dispatchSelected]);

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
    }
    fetchData();
    setSelectedId(null);
  }, [dispatchPrefill, fetchData]);

  const getSelectedRow = useCallback(() => selectedRecord, [selectedRecord]);

  const handlePrintBill = useCallback(async () => {
    const fuid = selectedRecord?.fuid;
    if (!fuid || billPrinting) return;
    setBillPrinting(true);
    try {
      const res = await forwardingNoteService.printBill({ fuid });
      if (!res?.success || !res?.html) throw new Error(res?.message || "Bill HTML missing");
      const ok = printFromBackendHtml(res.html);
      if (!ok) toast.error("Could not open print preview. Try again.");
    } catch (err) {
      toast.error(err?.message || "Failed to generate bill");
    } finally {
      setBillPrinting(false);
    }
  }, [selectedRecord?.fuid, billPrinting]);

  const { openNewModal, openEditModal, openPrintModal, openApproveModal, openDeleteModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "forwarding_note_master",
    modalOpen: modalOpen || isDeleting,
    selectedId: selectedId,
    getSelectedRow,
    openAdd: useCallback(() => {
      setDispatchPrefill(null);
      openModal("add");
    }, [openModal]),
    openEdit: useCallback(() => {
      if (reportType !== "summary") return;
      openModal("edit");
    }, [reportType, openModal]),
    canEditSelection: useCallback(() => reportType === "summary" && Boolean(selectedId) && !isSelectedLocked, [reportType, selectedId, isSelectedLocked]),
    onPrint: useCallback(() => {
      if (reportType !== "summary") return;
      handlePrintBill();
    }, [reportType, handlePrintBill]),
    canPrintSelection: useCallback(
      () => reportType === "summary" && Boolean(selectedRecord?.fuid) && !billPrinting,
      [reportType, selectedRecord?.fuid, billPrinting]
    ),
    printBlockedMessage: "Select a forwarding note row with FUID to print bill (Ctrl+P).",
    printModule: "forwarding_note_master",
    printAction: "view",
    openApprove: useCallback(() => {
      if (reportType !== "summary") return;
      openModal("approve");
    }, [reportType, openModal]),
    canApproveSelection: useCallback(
      () => reportType === "summary" && Boolean(selectedId) && !isSelectedLocked,
      [reportType, selectedId, isSelectedLocked]
    ),
    onApproveBlocked: useCallback(() => {
      if (reportType !== "summary") return;
      if (!selectedId) toast.info("Select a row to approve (Ctrl+A).");
      else if (isSelectedLocked) toast.info("This forwarding note is locked for out entry.");
    }, [reportType, selectedId, isSelectedLocked]),
    openDelete: useCallback(() => {
      if (reportType !== "summary") return;
      setIsDeleting(true);
    }, [reportType]),
    canDeleteSelection: useCallback(() => reportType === "summary" && Boolean(selectedId) && !isSelectedLocked, [reportType, selectedId, isSelectedLocked]),
  });

  const modalRecord = useMemo(() => {
    if (!selectedRecord) return null;
    if (reportType === "summary") return selectedRecord;
    return {
      fuid: selectedRecord.fuid,
      approved: selectedRecord.approved
    };
  }, [selectedRecord, reportType]);

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

  const handleSaveBillNo = async () => {
    const fuid = selectedRecord?.fuid;
    if (!fuid || !canEditBill) return;
    const payload = formatBillNosForSave(billDraftNos);
    setBillSaving(true);
    try {
      const res = await forwardingNoteService.updateBill(fuid, payload);
      const saved = res?.data;
      setBillDraftNos(parseSavedBillNos(saved?.bill_no ?? payload));
      toast.success(
        saved?.bill_no || payload
          ? "Bill number(s) saved"
          : "Bill number cleared"
      );
      const auditPatch = {
        bill_no: saved?.bill_no ?? payload,
        bill_updated_by_name: saved?.bill_updated_by_name ?? null,
        bill_updated_at: saved?.bill_updated_at ?? null,
      };
      setAllRows((prev) =>
        prev.map((row) => (row.fuid === fuid ? { ...row, ...auditPatch } : row))
      );
      await fetchData();
    } catch (err) {
      toast.error(err?.message || "Failed to save bill number");
    } finally {
      setBillSaving(false);
    }
  };

  const savedBillNo = useMemo(
    () => formatBillNosForSave(parseSavedBillNos(selectedRecord?.bill_no)) ?? "",
    [selectedRecord?.bill_no]
  );

  const billDraftFormatted = useMemo(
    () => formatBillNosForSave(billDraftNos) ?? "",
    [billDraftNos]
  );

  const billDirty = useMemo(
    () => billDraftFormatted !== savedBillNo,
    [billDraftFormatted, savedBillNo]
  );

  const billLastUpdatedLabel = useMemo(() => {
    if (!selectedRecord?.bill_updated_at) return null;
    const who = selectedRecord.bill_updated_by_name || "—";
    return `${who} · ${formatDateTime(selectedRecord.bill_updated_at)}`;
  }, [selectedRecord?.bill_updated_at, selectedRecord?.bill_updated_by_name]);

  const extraFilters = useMemo(() => [
    { 
      label: "Status", key: "approvedStatus", value: params.status, 
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
      options: DISPATCH_FILTER_OPTIONS,
    },
  ], [params.status, params.dispatchFilter]);

  const HEADERS = useMemo(() => {
    const baseHeaders = [
      ["FUID", "fuid", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "80px" }],
    ];

    const itemCols = reportType === "item_wise" ? [
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
      ["Bill Number", "bill_no", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { width: "110px" }],
      ["Customer", "acc_name", (v) => <span className="text-[10px] font-medium text-slate-500 uppercase italic whitespace-normal break-words leading-snug block" title={v}>{v || "—"}</span>, { width: "250px", wrap: true }],
      ["Total Qty", "total_items", (v) => <span className="font-black text-slate-700 text-[11px]">{v}</span>, { width: "120px" }],
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
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
      ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Locked By", "out_entry_locked_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "130px" }],
      ["Locked At", "out_entry_locked_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Bill By", "bill_updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Bill At", "bill_updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ];

    return [...baseHeaders, ...itemCols, ...masterHeaders];
  }, [reportType]);

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
                  { id: "dispatch_plan", label: "Today Dispatch Plan", icon: CalendarClock },
                  { id: "forwarding_master", label: "Forwarding Master", icon: FileText },
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
                      {Number(dispatchSelected?.is_planned) === 6 ? (
                        <button
                          type="button"
                          onClick={() => dispatchPlanRef.current?.rejectSelected()}
                          disabled={dispatchPlanRef.current?.rejecting}
                          className="h-9 px-4 border border-rose-400 bg-rose-600 text-white hover:bg-rose-700 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shrink-0 disabled:opacity-50"
                        >
                          <Ban size={14} />
                          Reject
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => dispatchPlanRef.current?.completeSelected()}
                          disabled={dispatchPlanRef.current?.completing}
                          className="h-9 px-4 border border-emerald-400 bg-emerald-600 text-white hover:bg-emerald-700 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shrink-0 disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          Complete
                        </button>
                      )}
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
                  <ActionButton module="forwarding_note_master" action="add" label="New" icon={Plus} onClick={openNewModal} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" />
                  <ActionButton module="forwarding_note_master" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selectedId || isSelectedLocked} record={selectedRecord} onClick={openEditModal} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0" />
                  <ActionButton module="forwarding_note_master" action="authorize" variant="outline" label="Approve" icon={CheckCircle} disabled={!selectedId || isSelectedLocked} onClick={() => openModal("approve")} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0" />
                  <ActionButton module="forwarding_note_master" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selectedId || isSelectedLocked} onClick={() => setIsDeleting(true)} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" />
                  <PrintActionButton
                    module="forwarding_note_master"
                    variant="outline"
                    label={billPrinting ? "…" : "Print Bill"}
                    icon={Printer}
                    disabled={!selectedId || !selectedRecord?.fuid || billPrinting}
                    onClick={openPrintModal}
                    title="Print bill (Ctrl+Alt+P / Ctrl+P in app)"
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

          {outerTab === "forwarding_master" && selectedId && (
            <div className="border-b border-indigo-100 bg-indigo-50 px-3 py-2 space-y-2">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <span className="text-[10px] font-bold text-indigo-600 uppercase flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0 flex-1 leading-snug">
                  <Info size={12} className="shrink-0" />
                  <span className="break-all">
                    FUID{" "}
                    {reportType === "summary"
                      ? selectedRecord?.fuid
                      : `${selectedRecord?.fuid} · ${selectedRecord?.item_code || "—"}`}
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

              {selectedRecord?.fuid && canEditBill ? (
                <div className="w-full min-w-0 space-y-1.5" data-compact-form-bar>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2">
                    <span className={`${LIST_PAGE_SEARCH_LABEL_CLASS} shrink-0 pt-1.5 sm:pt-2`}>Bill</span>
                    <div
                      className="w-full min-w-0 flex-1"
                      title={isSelectedLocked ? "Editable after out entry lock" : "Search and select bill numbers"}
                    >
                      <SearchableSelect
                        multiple
                        showTags
                        variant="toolbar"
                        heightClass="h-8"
                        value={billDraftNos}
                        onChange={(nos) => setBillDraftNos(uniqueBillNos(nos))}
                        fetchService={fetchBillOptions}
                        getByIdService={getBillByNo}
                        dataKey="bill_no"
                        labelKey="bill_no"
                        labelOnlyDisplay
                        placeholder="Bill number..."
                        emptyMessage="No bill numbers found"
                        usePortal
                        maxVisibleTags={3}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveBillNo}
                      disabled={billSaving || !billDirty}
                      className="h-9 w-full sm:w-auto sm:shrink-0 px-3 border border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold uppercase disabled:opacity-50"
                    >
                      {billSaving ? "…" : "Save Bill"}
                    </button>
                  </div>
                  {billLastUpdatedLabel ? (
                    <p className="text-[10px] text-slate-500 sm:pl-8 break-words" title={billLastUpdatedLabel}>
                      {billLastUpdatedLabel}
                    </p>
                  ) : null}
                </div>
              ) : selectedRecord?.bill_no ? (
                <p className="text-xs font-bold text-slate-700 uppercase break-all">
                  Bill {selectedRecord.bill_no}
                </p>
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
                  setDispatchStatusFilter(data.status ?? "all");
                }}
                searchPlaceholder="Quick search items, party, sch no..."
                searchLabel="Quick Search"
                onReset={() => {
                  setDispatchSearch("");
                  setDispatchStatusFilter("all");
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
                applyExtrasOnChange
                onApply={handleFilterApply}
                onReset={handleReset}
                searchValue={tempSearch}
                onSearchChange={setTempSearch}
                onSearchEnter={() =>
                  handleFilterApply({
                    fromDate: params.fromDate,
                    toDate: params.toDate,
                    approvedStatus: params.status,
                    dispatchFilter: params.dispatchFilter,
                  })
                }
                searchPlaceholder="Search table..."
                searchLabel="Quick Search"
                minDate={dateFilterDefaults.minDate}
                maxDate={dateFilterDefaults.maxDate}
              />
            </ListPageFilterStrip>

            <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
              <DataTable
                key={`${reportType}-${tempSearch}`}
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
                  badgeIndices: [reportType === 'summary' ? 8 : 10], 
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

