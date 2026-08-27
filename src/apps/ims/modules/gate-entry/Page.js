"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Edit3, Trash2, X, LogOut, ClipboardList, FileEdit, Truck, CheckCircle } from "lucide-react";
import { toast } from "react-toastify";

import { gateEntryService } from "@/apps/ims/lib/services/gateEntry";
import GateEntryModal from "@/apps/ims/modules/gate-entry/GateEntryModal";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";

import ActionButton from "@/ui/primitives/ActionButton";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import DataTable from "@/ui/primitives/DataTable";
import DeleteModal from "@/ui/common/modals/DeleteModal";

const PAGE_TABS = {
  REGISTER: "register",
  PENDING: "pending",
};

const STATUS_FILTER_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Scan complete", value: "scan_done" },
  { label: "Approved", value: "approved" },
];

function isGateApproved(row) {
  return row?.approved === true || row?.approved === "true" || row?.approved === 1;
}

function isGateDraft(row) {
  if (!row || isGateApproved(row)) return false;
  return row.scan_complete === false || row.scan_complete === "false" || row.scan_complete === 0 || row.scan_complete == null;
}

function isGateOpen(row) {
  return Boolean(row?.uid) && !isGateApproved(row);
}

function gateStatusLabel(row) {
  if (isGateApproved(row)) {
    return { text: "APPROVED", className: "bg-emerald-50 text-emerald-600 border-emerald-100" };
  }
  if (isGateDraft(row)) {
    return { text: "DRAFT", className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  return { text: "SCAN COMPLETE", className: "bg-indigo-50 text-indigo-600 border-indigo-100" };
}

function pendingGateStatus(row) {
  if (row?.gate_approved === true || row?.gate_approved === 1) {
    return { text: "APPROVED", className: "bg-emerald-50 text-emerald-600 border-emerald-100" };
  }
  if (row?.uid && (row.gate_scan_complete === false || row.gate_scan_complete === "false" || row.gate_scan_complete === 0 || row.gate_scan_complete == null)) {
    return { text: "DRAFT", className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (row?.uid && row.gate_scan_complete) {
    return { text: "SCAN COMPLETE", className: "bg-indigo-50 text-indigo-600 border-indigo-100" };
  }
  return { text: "READY", className: "bg-indigo-50 text-indigo-600 border-indigo-100" };
}

export default function GateEntryPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("gate_entry", "view"), [canAccess]);
  const [pageTab, setPageTab] = useState(PAGE_TABS.PENDING);
  const isRegister = pageTab === PAGE_TABS.REGISTER;

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "uid",
    sortDir: "desc",
  });
  const [pendingParams, setPendingParams] = useState({
    pageSize: 1000,
    sortKey: "out_uid",
    sortDir: "desc",
  });

  useEffect(() => {
    if (!dateFilterDefaults.from && !dateFilterDefaults.to) return;
    setParams((prev) => {
      if (prev.fromDate === dateFilterDefaults.from && prev.toDate === dateFilterDefaults.to) return prev;
      return { ...prev, fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to };
    });
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const { tempSearch, setTempSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [allRows, setAllRows] = useState([]);
  const [pendingRows, setPendingRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const fetchRegister = useCallback(async () => {
    setLoading(true);
    try {
      const body = await gateEntryService.getAll();
      setAllRows(Array.isArray(body?.data) ? body.data : []);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load gate entries.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const body = await gateEntryService.listPending();
      setPendingRows(Array.isArray(body?.data) ? body.data : []);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load pending store-outs.");
      setPendingRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isRegister) fetchRegister();
    else fetchPending();
  }, [isRegister, fetchRegister, fetchPending]);

  const sourceRows = isRegister ? allRows : pendingRows;

  const filteredRows = useMemo(() => {
    let rows = sourceRows;
    if (isRegister && params.status && params.status !== "all") {
      rows = rows.filter((r) => {
        if (params.status === "draft") return isGateDraft(r);
        if (params.status === "scan_done") return isGateOpen(r) && !isGateDraft(r);
        if (params.status === "approved") return isGateApproved(r);
        return true;
      });
    }
    if (isRegister && (params.fromDate || params.toDate)) {
      rows = rows.filter((r) => {
        const d = r.created_at ? new Date(r.created_at) : null;
        if (!d || Number.isNaN(d.getTime())) return true;
        if (params.fromDate && d < new Date(params.fromDate)) return false;
        if (params.toDate) {
          const to = new Date(params.toDate);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
        return true;
      });
    }
    rows = applyClientSearch(rows, tempSearch);
    const sortKey = isRegister ? params.sortKey : pendingParams.sortKey;
    const sortDir = isRegister ? params.sortDir : pendingParams.sortDir;
    return sortRowsByKey(rows, sortKey, sortDir);
  }, [sourceRows, isRegister, params, pendingParams, tempSearch]);

  const totalItems = filteredRows.length;
  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
  }, [loading, items.length, totalItems]);

  const getRowId = useCallback((item) => (isRegister ? item.uid : item.out_uid), [isRegister]);
  const selectedRecord = useMemo(
    () => filteredRows.find((i) => getRowId(i) === selected),
    [filteredRows, selected, getRowId]
  );

  const selectedGateRecord = useMemo(() => {
    if (!selectedRecord) return null;
    if (isRegister) return selectedRecord;
    if (selectedRecord.uid) {
      return {
        uid: selectedRecord.uid,
        out_uid: selectedRecord.out_uid,
        fuid: selectedRecord.fuid,
        bill_no: selectedRecord.bill_no,
        bill_dt: selectedRecord.bill_dt,
        scan_complete: selectedRecord.gate_scan_complete,
        approved: selectedRecord.gate_approved,
      };
    }
    return null;
  }, [isRegister, selectedRecord]);

  const selectedIsDraft = useMemo(() => {
    if (isRegister) return isGateOpen(selectedRecord);
    return isGateOpen(selectedGateRecord);
  }, [isRegister, selectedRecord, selectedGateRecord]);

  const getSelectedRow = useCallback(
    () => filteredRows.find((i) => getRowId(i) === selected),
    [filteredRows, selected, getRowId]
  );

  const openScanModal = useCallback((row = null, mode = "add") => {
    setEditItem(row);
    setModalMode(mode);
    setModalOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    if (isRegister) fetchRegister();
    else fetchPending();
  }, [isRegister, fetchRegister, fetchPending]);

  const { openNewModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "gate_entry",
    modalOpen,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => openScanModal(null, "add"), [openScanModal]),
    openEdit: useCallback((row) => {
      if (isRegister) {
        if (isGateOpen(row)) openScanModal(row, "edit");
        else toast.info("Approved entries are view-only.");
        return;
      }
      if (row.uid) {
        openScanModal(
          {
            uid: row.uid,
            out_uid: row.out_uid,
            fuid: row.fuid,
            bill_no: row.bill_no,
            bill_dt: row.bill_dt,
            scan_complete: row.gate_scan_complete,
            approved: row.gate_approved,
          },
          "edit"
        );
      } else {
        openScanModal({ out_uid: row.out_uid, fuid: row.fuid, bill_no: row.bill_no, bill_dt: row.bill_dt }, "add");
      }
    }, [isRegister, openScanModal]),
  });

  const handleDraftClick = useCallback(() => {
    if (!selectedIsDraft || !selectedGateRecord) {
      toast.info("Select a draft row, then click Draft.");
      return;
    }
    openScanModal(selectedGateRecord, "edit");
  }, [selectedIsDraft, selectedGateRecord, openScanModal]);

  const handleNewClick = useCallback(() => {
    if (isRegister) {
      openNewModal();
      return;
    }
    if (!selectedRecord) {
      openScanModal(null, "add");
      return;
    }
    if (selectedRecord.uid) {
      openScanModal(
        {
          uid: selectedRecord.uid,
          out_uid: selectedRecord.out_uid,
          fuid: selectedRecord.fuid,
          bill_no: selectedRecord.bill_no,
          bill_dt: selectedRecord.bill_dt,
          scan_complete: selectedRecord.gate_scan_complete,
          approved: selectedRecord.gate_approved,
        },
        "edit"
      );
      return;
    }
    openScanModal(
      { out_uid: selectedRecord.out_uid, fuid: selectedRecord.fuid, bill_no: selectedRecord.bill_no, bill_dt: selectedRecord.bill_dt },
      "add"
    );
  }, [isRegister, openNewModal, selectedRecord, openScanModal]);

  const handleApproveClick = useCallback(() => {
    const rec = selectedGateRecord;
    if (!rec?.uid || isGateApproved(rec)) {
      toast.info("Select a draft or scan-complete row to approve.");
      return;
    }
    openScanModal(rec, "approve");
  }, [selectedGateRecord, openScanModal]);

  const handleFilterApply = (data) => {
    if (!isRegister) {
      applySearchFromInput();
      return;
    }
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
      status: data.approvedStatus || prev.status,
    }));
  };

  const handleReset = () => {
    resetSearch();
    if (isRegister) {
      setParams({
        pageSize: 1000,
        status: "all",
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to,
        sortKey: "uid",
        sortDir: "desc",
      });
    } else {
      setPendingParams({ pageSize: 1000, sortKey: "out_uid", sortDir: "desc" });
    }
  };

  const extraFilters = useMemo(
    () =>
      isRegister
        ? [
            {
              label: "Status",
              key: "approvedStatus",
              value: params.status,
              options: STATUS_FILTER_OPTIONS,
            },
          ]
        : [],
    [isRegister, params.status]
  );

  const REGISTER_HEADERS = [
    ["UID", "uid", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "90px" }],
    ["OUT UID", "out_uid", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { width: "90px" }],
    ["FUID", "fuid", (v) => (
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-[11px] text-slate-800 uppercase tracking-tighter">{v ?? "—"}</span>
      </div>
    ), { width: "100px" }],
    ["Bill No", "bill_no", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { width: "160px" }],
    ["Bill Date", "bill_dt", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "120px" }],
    ["Customer", "acc_name", (v, row) => <span className="text-[10px] font-medium text-slate-500 uppercase italic whitespace-normal break-words leading-snug block" title={v || row?.acc_code}>{v || row?.acc_code || "—"}</span>, { width: "220px", wrap: true }],
    ["Logistics", "transporter_name", (v, row) => (
      <div className="flex flex-col leading-tight min-w-[160px]">
        <div className="flex items-center gap-1 text-slate-700">
          <Truck size={10} />
          <span className="font-bold text-[11px]">{v || "Direct Party"}</span>
        </div>
        <span className="text-indigo-500 font-black text-[9px] ml-3 uppercase tracking-wider">{row.vehicle_number || "NO VEHICLE"}</span>
      </div>
    ), { width: "220px" }],
    ["Total Qty", "total_qty", (v) => (
      <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
        {v != null ? Number(v).toLocaleString() : "0"}
      </span>
    ), { width: "100px" }],
    ["Status", "scan_complete", (_v, row) => {
      const st = gateStatusLabel(row);
      return <span className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${st.className}`}>{st.text}</span>;
    }, { width: "120px" }],
    ["Created By", "created_by", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Updated By", "updated_by", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const PENDING_HEADERS = [
    ["FUID", "fuid", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "80px" }],
    ["Bill Number", "bill_no", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { width: "160px" }],
    ["Bill Date", "bill_dt", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "120px" }],
    ["Customer", "acc_name", (v, row) => <span className="text-[10px] font-medium text-slate-500 uppercase italic whitespace-normal break-words leading-snug block" title={v || row?.acc_code}>{v || row?.acc_code || "—"}</span>, { width: "250px", wrap: true }],
    ["OUT UID", "out_uid", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { width: "90px" }],
    ["Total Qty", "total_items", (v, row) => <span className="font-black text-slate-700 text-[11px]">{v ?? row?.total_qty ?? "—"}</span>, { width: "120px" }],
    ["Timestamp", "timestamp", (v, row) => <span className="text-[10px] text-slate-500">{formatDateTime(v || row?.approved_at)}</span>, { width: "150px" }],
    ["Status", "uid", (_v, row) => {
      const st = pendingGateStatus(row);
      return <span className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${st.className}`}>{st.text}</span>;
    }, { width: "120px" }],
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
    ["Cartage", "cartage", (v) => <span className="text-slate-700 font-bold text-[10px]">{v?.toLocaleString?.() || v || 0}</span>, { width: "120px" }],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
    ["Approved At", "fn_approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isRegister ? "Gate Entry" : "Gate Entry Pending",
    rows: filteredRows,
    headers: isRegister ? REGISTER_HEADERS : PENDING_HEADERS,
  });

  const handleTabChange = (tab) => {
    setPageTab(tab);
    setSelected(null);
    setTempSearch("");
    setDisplayLimit(100);
  };

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                active={pageTab}
                onChange={handleTabChange}
                tabs={[
                  { id: PAGE_TABS.REGISTER, label: "Gate Entry", icon: LogOut },
                  {
                    id: PAGE_TABS.PENDING,
                    label: "Pending Store Out",
                    shortLabel: "Pending",
                    icon: ClipboardList,
                  },
                ]}
              />
            }
            actions={
              <>
                <ActionButton
                  module="gate_entry"
                  action="add"
                  label="New"
                  icon={Plus}
                  onClick={handleNewClick}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4`}
                />
                <ActionButton
                  module="gate_entry"
                  action="edit"
                  variant="outline"
                  label="Draft"
                  icon={FileEdit}
                  disabled={!selectedIsDraft || modalOpen}
                  record={selectedGateRecord}
                  onClick={handleDraftClick}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border-amber-300 text-amber-800`}
                />
                <ActionButton
                  module="gate_entry"
                  action="edit"
                  variant="outline"
                  label="Edit"
                  icon={Edit3}
                  disabled={!selectedGateRecord || !isGateOpen(selectedGateRecord)}
                  record={selectedGateRecord}
                  onClick={() => selectedGateRecord && openScanModal(selectedGateRecord, "edit")}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border-slate-300`}
                />
                <button
                  type="button"
                  onClick={handleApproveClick}
                  disabled={!selectedGateRecord || isGateApproved(selectedGateRecord) || modalOpen}
                  title="Approve selected gate entry"
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
                >
                  <CheckCircle size={16} strokeWidth={2} />
                  <span>Approve</span>
                </button>
                <ActionButton
                  module="gate_entry"
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!selectedGateRecord || isGateApproved(selectedGateRecord)}
                  onClick={() => selectedGateRecord && setDeleteItem(selectedGateRecord)}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4`}
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-0.5 shrink-0" />
                <button
                  type="button"
                  onClick={handleRefresh}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center`}
                  aria-label="Refresh"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={loading || exportDisabled}
                onExport={handleExport}
              />
            }
          />

          {selected ? (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in fade-in duration-200">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">
                Selected:{" "}
                {isRegister
                  ? `GE-#${selected} (OUT: ${selectedRecord?.out_uid ?? "—"} · FUID: ${selectedRecord?.fuid ?? "—"})`
                  : `OUT-#${selected} (FUID: ${selectedRecord?.fuid ?? "—"})`}
                {selectedIsDraft ? <span className="ml-2 text-amber-700 font-semibold normal-case">· Open</span> : null}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Clear Selection
              </button>
            </div>
          ) : null}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${pageTab}-${isRegister ? `${params.fromDate}-${params.toDate}` : "all"}`}
            fromDate={isRegister ? params.fromDate : ""}
            toDate={isRegister ? params.toDate : ""}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onSearchEnter={() => {
              if (isRegister) return;
              applySearchFromInput();
            }}
            searchPlaceholder={isRegister ? "Search gate, bill, FUID, OUT..." : "Search FUID, Bill, Customer, PO..."}
            searchLabel="Quick Search"
            minDate={isRegister ? dateFilterDefaults.minDate : undefined}
            maxDate={isRegister ? dateFilterDefaults.maxDate : undefined}
            showDate={isRegister}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            key={`${pageTab}-${viewMode}`}
            headers={isRegister ? REGISTER_HEADERS : PENDING_HEADERS}
            data={items}
            allowCopy={true}
            loading={loading}
            viewMode={viewMode}
            {...tableHotkeyProps}
            hotkeysDisabled={modalOpen || tableHotkeyProps.hotkeysDisabled}
            onSort={(key) => {
              setDisplayLimit(100);
              if (isRegister) {
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              } else {
                setPendingParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }
            }}
            sortKey={isRegister ? params.sortKey : pendingParams.sortKey}
            sortDir={isRegister ? params.sortDir : pendingParams.sortDir}
            selectedId={selected}
            onSelect={setSelected}
            onRowClick={(_row, id) => setSelected(id)}
            getRowId={getRowId}
            emptyIcon={LogOut}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={
              isRegister
                ? {
                    titleKey: "uid",
                    badgeIndices: [8],
                    detailIndices: [3, 4, 5, 6],
                    footerKey: "created_at",
                    className: "rounded-none border border-slate-200 shadow-none",
                  }
                : {
                    titleKey: "fuid",
                    badgeIndices: [7],
                    detailKeys: ["acc_name", "bill_no", "po_number", "transporter_name", "total_items"],
                    footerKey: "timestamp",
                    className: "rounded-none border border-slate-200 shadow-none",
                  }
            }
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {isRegister
              ? `Showing ${items.length} of ${totalItems} Gate Entries`
              : `Showing ${items.length} of ${totalItems} Pending Store Outs`}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <GateEntryModal
        open={modalOpen}
        mode={modalMode}
        initial={editItem}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
        }}
        onSaved={({ approve }) => {
          setSelected(null);
          if (approve) setPageTab(PAGE_TABS.REGISTER);
          handleRefresh();
        }}
      />

      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => {
          handleRefresh();
          setSelected(null);
        }}
        service={gateEntryService}
        entityLabel="Gate Entry"
        idKey="uid"
        moduleSlug="gate_entry"
      />
    </div>
  );
}
