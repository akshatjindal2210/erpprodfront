"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Edit3, Trash2, CheckCircle, X, Truck, FileText, Info, List, Package, Lock, Unlock, Printer } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import { forwardingNoteService } from "@/features/apps/ims/services/forwardingNote";
import { useViewMode } from "@/core/hooks/useViewMode";
import { formatDateTime } from "@/core/utils/utilHelper";

// Components
import ForwardingModal from "@/features/apps/ims/components/forwarding-note/ForwardingModal"; 
import DeleteModal from "@/core/components/common/DeleteModal";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import DataTable from "@/core/components/ui/DataTable";
import ViewToggle from "@/core/components/ui/ViewToggle";
import ActionButton from "@/core/components/ui/ActionButton";
import PrintActionButton from "@/core/components/ui/PrintActionButton";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";
import { printFromBackendHtml } from "@/features/apps/ims/utils/printHtmlDocument";

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

  push(row.bill_no, row.bill_no ? null : "N/A");
  push(row.acc_name, row.acc_code);
  pushNum(reportType === "item_wise" ? row.total_qty : row.total_items);
  pushDate(row.timestamp, row.created_at, row.updated_at, row.approved_at, row.out_entry_locked_at, row.bill_updated_at);

  push(
    row.approved ? "AUTHORIZED" : "PENDING",
    row.approved ? "● AUTHORIZED" : "○ PENDING"
  );
  push(row.out_entry_locked ? "LOCKED" : "UNLOCKED");

  push(row.transporter_name, row.transporter_name ? null : "Direct Party");
  push(row.vehicle_number, row.vehicle_number ? null : "NO VEHICLE");

  push(row.po_number, row.po_number ? null : "N/A");
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

export default function ForwardingPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("forwarding_note_master", "view"), [canAccess]);
  const canEditBill = useMemo(() => canAccess("forwarding_note_master", "edit").allowed, [canAccess]);
  const role = useSelector(state => state.auth.role);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [reportType, setReportType] = useState("summary");

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 1000, status: "all", lockStatus: "all",
    fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to, sortKey: "fuid", sortDir: "desc"
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

  const [tempSearch, setTempSearch] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selectedId, setSelectedId] = useState(null); 
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [isDeleting, setIsDeleting] = useState(false);
  const [billPrinting, setBillPrinting] = useState(false);
  const [billDraft, setBillDraft] = useState("");
  const [billSaving, setBillSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey || undefined,
        order: params.sortDir.toUpperCase(),
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...(params.status !== "all" && { approved: params.status === "approved" }),
          ...(params.lockStatus !== "all" && { out_entry_locked: params.lockStatus === "locked" })
        }
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
  }, [params.pageSize, params.sortKey, params.sortDir, params.fromDate, params.toDate, params.status, params.lockStatus, reportType]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    if (q) {
      return applyClientSearch(allRows, tempSearch, {
        getParts: (row) => forwardingTableSearchParts(row, reportType),
      });
    }
    return sortRowsByKey(allRows, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir, reportType]);

  useEffect(() => {
    setDisplayLimit(100);
  }, [tempSearch]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const handleFilterApply = (data) => {
    setParams(prev => ({ 
      ...prev, 
      fromDate: data.fromDate, 
      toDate: data.toDate, 
      status: data.approvedStatus || prev.status,
      lockStatus: data.lockStatus || prev.lockStatus
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({
      pageSize: 1000,
      status: "all",
      lockStatus: "all",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "fuid",
      sortDir: "desc"
    });
  };

  const selectedRecord = useMemo(() => {
    return items.find((item, index) => {
      let rowId;
      if (reportType === "summary") {
        rowId = `sum-${item.fuid || 'no-fuid'}-${index}`;
      } else {
        const uniqueId = item.id || `${item.fuid || 'no-fuid'}-${item.item_dcode || 'no-dcode'}`;
        rowId = `itm-${uniqueId}-${index}`;
      }
      return rowId === selectedId;
    }) || null;
  }, [items, selectedId, reportType]);
  const isSelectedLocked = Boolean(selectedRecord?.out_entry_locked);

  useEffect(() => {
    if (selectedRecord?.fuid != null) {
      setBillDraft(
        selectedRecord.bill_no != null && selectedRecord.bill_no !== ""
          ? String(selectedRecord.bill_no)
          : ""
      );
    } else {
      setBillDraft("");
    }
  }, [selectedRecord?.fuid, selectedRecord?.bill_no]);

  const openModal = useCallback((mode) => {
    setModalMode(mode);
    setModalOpen(true);
  }, []);

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

  const { openNewModal, openEditModal, openPrintModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "forwarding_note_master",
    modalOpen: modalOpen || isDeleting,
    selectedId: selectedId,
    getSelectedRow,
    openAdd: useCallback(() => openModal("add"), [openModal]),
    openEdit: useCallback(() => openModal("edit"), [openModal]),
    canEditSelection: useCallback(() => Boolean(selectedId) && !isSelectedLocked, [selectedId, isSelectedLocked]),
    onPrint: useCallback(() => {
      handlePrintBill();
    }, [handlePrintBill]),
    canPrintSelection: useCallback(
      () => Boolean(selectedRecord?.fuid) && !billPrinting,
      [selectedRecord?.fuid, billPrinting]
    ),
    printBlockedMessage: "Select a forwarding note row with FUID to print bill (Ctrl+Alt+P).",
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
    setBillSaving(true);
    try {
      const res = await forwardingNoteService.updateBill(fuid, billDraft.trim() || null);
      const saved = res?.data;
      if (saved?.bill_no != null) setBillDraft(String(saved.bill_no));
      else if (billDraft.trim() === "") setBillDraft("");
      toast.success(
        saved?.bill_no
          ? "Bill number saved"
          : "Bill number cleared"
      );
      const auditPatch = {
        bill_no: saved?.bill_no ?? (billDraft.trim() || null),
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

  const savedBillNo = useMemo(() => {
    if (selectedRecord?.bill_no == null || selectedRecord.bill_no === "") return "";
    return String(selectedRecord.bill_no).trim();
  }, [selectedRecord?.bill_no]);

  const billDirty = useMemo(
    () => billDraft.trim() !== savedBillNo,
    [billDraft, savedBillNo]
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
      label: "Lock Status", key: "lockStatus", value: params.lockStatus,
      options: [
        { label: "All Locks", value: "all" },
        { label: "Locked", value: "locked" },
        { label: "Unlocked", value: "unlocked" }
      ]
    },
  ], [params.status, params.lockStatus]);

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
      ["Bill Number", "bill_no", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "N/A"}</span>, { width: "110px" }],
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
        (v) => (
          <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-slate-50 text-slate-500 border-slate-100"}`}>
            {v ? "LOCKED" : "UNLOCKED"}
          </span>
        ),
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
      ["PO Number", "po_number", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "N/A"}</span>, { width: "120px" }],
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

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              
              <div className="flex bg-slate-100 p-1 border border-slate-200 mr-2">
                <button 
                  onClick={() => { setReportType("summary"); setSelectedId(null); }}
                  className={`px-3 py-1 text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all ${reportType === 'summary' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                  <List size={14} /> Summary
                </button>
                <button 
                  onClick={() => { setReportType("item_wise"); setSelectedId(null); }}
                  className={`px-3 py-1 text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all ${reportType === 'item_wise' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                  <Package size={14} /> Item-wise
                </button>
              </div>

              <ActionButton module="forwarding_note_master" action="add" label="New" icon={Plus} onClick={openNewModal} className="rounded-none h-9 text-[11px]" />
              <ActionButton module="forwarding_note_master" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selectedId || isSelectedLocked} record={selectedRecord} onClick={openEditModal} className="rounded-none h-9 bg-white text-[11px]" />
              <ActionButton module="forwarding_note_master" action="authorize" variant="outline" label="Approve" icon={CheckCircle} disabled={!selectedId || isSelectedLocked} onClick={() => openModal("approve")} className="rounded-none h-9 bg-white text-[11px] text-emerald-600" />
              <ActionButton module="forwarding_note_master" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selectedId || isSelectedLocked} onClick={() => setIsDeleting(true)} className="rounded-none h-9 text-[11px]" />
              <PrintActionButton
                module="forwarding_note_master"
                variant="outline"
                label={billPrinting ? "…" : "Print Bill"}
                icon={Printer}
                disabled={!selectedId || !selectedRecord?.fuid || billPrinting}
                onClick={openPrintModal}
                title="Print bill (Ctrl+Alt+P / Ctrl+P in app)"
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-3 border-slate-300 shadow-none"
              />
              {role === "super_admin" && (
                <>
                  <button
                    onClick={handleLock}
                    disabled={!selectedId || isSelectedLocked}
                    className="rounded-none h-9 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Super Admin: lock for out entry"
                  >
                    <Lock size={14} />
                    Lock
                  </button>
                  <button
                    onClick={handleUnlock}
                    disabled={!selectedId || !isSelectedLocked}
                    className="rounded-none h-9 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Super Admin: unlock out-entry lock"
                  >
                    <Unlock size={14} />
                    Unlock
                  </button>
                </>
              )}
              
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              
              <button onClick={() => fetchData()} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
            </div>

            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>

          {selectedId && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-1.5 shrink-0">
                <Info size={12} className="shrink-0" />
                FUID {reportType === "summary" ? selectedRecord?.fuid : `${selectedRecord?.fuid} · ${selectedRecord?.item_code || "—"}`}
                <span className="text-indigo-400 font-semibold normal-case">PO {selectedRecord?.po_number || "—"}</span>
                {isSelectedLocked ? (
                  <span className="px-1.5 py-0.5 border border-rose-200 bg-rose-50 text-rose-600 text-[8px] font-black uppercase">
                    Locked
                  </span>
                ) : null}
              </span>

              {selectedRecord?.fuid && canEditBill ? (
                <>
                  <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Bill</span>
                  <input
                    type="text"
                    value={billDraft}
                    onChange={(e) => setBillDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && billDirty && !billSaving) {
                        e.preventDefault();
                        handleSaveBillNo();
                      }
                    }}
                    placeholder="Bill number"
                    title={isSelectedLocked ? "Editable after out entry lock" : undefined}
                    className="h-8 w-36 sm:w-44 px-2 bg-white border border-slate-200 text-[11px] font-semibold text-slate-800 focus:outline-none focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveBillNo}
                    disabled={billSaving || !billDirty}
                    className="h-8 px-2.5 border border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-700 text-[10px] font-bold uppercase disabled:opacity-50 shrink-0"
                  >
                    {billSaving ? "…" : "Save"}
                  </button>
                  {billLastUpdatedLabel ? (
                    <span className="text-[9px] text-slate-500 truncate max-w-[12rem]" title={billLastUpdatedLabel}>
                      {billLastUpdatedLabel}
                    </span>
                  ) : null}
                </>
              ) : selectedRecord?.bill_no ? (
                <span className="text-[10px] font-bold text-slate-700 uppercase">
                  Bill {selectedRecord.bill_no}
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="ml-auto text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase shrink-0"
              >
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        <ListPageFilterStrip>
          <DateRangeFilter 
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate} 
            toDate={params.toDate} 
            extraFilters={extraFilters} 
            onApply={handleFilterApply} 
            onReset={handleReset}
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
            getRowId={(item, index) => {
              if (reportType === "summary") {
                return `sum-${item.fuid || 'no-fuid'}-${index}`;
              }
              const uniqueId = item.id || `${item.fuid || 'no-fuid'}-${item.item_dcode || 'no-dcode'}`;
              return `itm-${uniqueId}-${index}`;
            }}
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
      </div>

      {modalOpen && (
        <ForwardingModal 
            open={modalOpen} 
            onClose={() => { setModalOpen(false); setSelectedId(null); }} 
            onSuccess={() => { fetchData(); setSelectedId(null); }} 
            editData={modalMode === "add" ? null : modalRecord} 
            mode={modalMode} 
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

