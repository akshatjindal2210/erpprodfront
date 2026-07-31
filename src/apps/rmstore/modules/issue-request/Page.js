"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Edit3, Trash2, CheckCircle, X, Eye, List, ClipboardList, Lock, Unlock } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import { issueRequestService } from "@/apps/rmstore/lib/services/issueRequest";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import IssueRequestModal from "@/apps/rmstore/modules/issue-request/IssueRequestModal";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import ActionButton from "@/ui/primitives/ActionButton";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import RmStoreListFooter, { rmStoreFooterFromClientFilter } from "@/apps/rmstore/lib/helpers/RmStoreListFooter";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { formatDateTime } from "@/platform/utils/core/utilHelper";

const MODULE = "rm_issue_request";

/** Master-wise = one row per issue request. Job-card-wise = one row per JC (like FN item-wise). */
const REPORT_TYPES = {
  SUMMARY: "summary",
  JOB_CARD: "job_card_wise",
};

const STORE_OUT_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Locked", value: "locked" },
  { label: "Unlocked", value: "unlocked" },
  { label: "Complete", value: "complete" },
];

function formatLockStatusCell(row) {
  if (row?.out_entry_complete === true || row?.out_entry_complete === "t") {
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

function buildStoreOutApiFilters(storeOutFilter) {
  switch (storeOutFilter) {
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

function resolveMasterIssueUid(row) {
  const raw = row?.issue_uid;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseJobCards(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** List row — parse job_cards + stable qty fields for table/export. */
function enrichIssueRow(row) {
  const jobCards = parseJobCards(row?.job_cards);
  const jobCardLabel = jobCards
    .map((jc) => {
      const no = String(jc?.pjobcardno || jc?.job_card_no || "").trim();
      if (!no) return "";
      const qty = Number(jc?.issue_qty);
      const mac = String(jc?.macname || "").trim();
      const base =
        Number.isFinite(qty) && qty > 0 ? `${no} (${qty.toLocaleString()})` : no;
      return mac ? `${base} · ${mac}` : base;
    })
    .filter(Boolean)
    .join(" · ");

  const machineLabel = [
    ...new Set(
      jobCards.map((jc) => String(jc?.macname || "").trim()).filter(Boolean)
    ),
  ].join(" · ");

  return {
    ...row,
    job_cards_parsed: jobCards,
    job_card_label: jobCardLabel,
    machine_label: machineLabel,
    requested_qty: Number(row?.requested_qty) || 0,
    coil_count: Number(row?.coil_count) || 0,
  };
}

const qtyCell = (v) => (
  <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
    {v != null ? Number(v).toLocaleString() : "0"}
  </span>
);

export default function IssueRequestPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const role = useSelector((state) => state.auth.role);

  const [reportType, setReportType] = useState(REPORT_TYPES.JOB_CARD);
  const isSummary = reportType === REPORT_TYPES.SUMMARY;

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 500,
    status: "all",
    storeOutFilter: "all",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "issue_uid",
    sortDir: "desc",
  });

  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setParams((prev) => ({
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to,
      }));
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } =
    useAppliedListSearch();
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...(params.status !== "all" && { approved: params.status === "approved" }),
          ...buildStoreOutApiFilters(params.storeOutFilter),
        },
      };
      const apiSearch = isSummary ? appliedSearch : "";
      const service = isSummary ? issueRequestService : { getAll: issueRequestService.getAllJobCards };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await service.getAll({
          ...base,
          page,
          limit,
          ...(apiSearch && { search: apiSearch }),
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the issue requests. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.status, params.storeOutFilter, appliedSearch, isSummary]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filteredRows = useMemo(() => {
    let data = isSummary ? allRows.map(enrichIssueRow) : allRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir, isSummary]);

  const getRowId = useCallback(
    (row) => {
      if (isSummary) return row.issue_uid;
      return `${row.issue_uid}-${String(row.pjobcardno || "").trim()}`;
    },
    [isSummary]
  );

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const selectedRecord = useMemo(
    () => filteredRows.find((r) => getRowId(r) === selected) || null,
    [filteredRows, selected, getRowId]
  );
  const isSelectedLocked = Boolean(selectedRecord?.out_entry_locked);
  const selectedIssueUid = useMemo(() => resolveMasterIssueUid(selectedRecord), [selectedRecord]);

  const getSelectedRow = useCallback(
    () => filteredRows.find((u) => getRowId(u) === selected),
    [filteredRows, selected, getRowId]
  );

  const footerFilter = useMemo(
    () =>
      rmStoreFooterFromClientFilter({
        tempSearch,
        sourceRows: allRows,
        filteredRows,
        serverFiltered: params.status !== "all" || Boolean(appliedSearch),
      }),
    [tempSearch, allRows, filteredRows, params.status, appliedSearch]
  );

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => {
      setEditItem(null);
      setModalMode("add");
      setModalOpen(true);
    }, []),
    openEdit: useCallback((row) => {
      if (!isSummary || row?.out_entry_locked) return;
      setEditItem(row);
      setModalMode("edit");
      setModalOpen(true);
    }, [isSummary]),
    openApprove: useCallback((row) => {
      if (!isSummary || row?.out_entry_locked) return;
      setEditItem(row);
      setModalMode("approve");
      setModalOpen(true);
    }, [isSummary]),
    canApproveSelection: useCallback(
      () => isSummary && Boolean(selected && selectedRecord) && !isSelectedLocked,
      [isSummary, selected, selectedRecord, isSelectedLocked]
    ),
    onApproveBlocked: useCallback(() => {
      if (!isSummary) toast.info("Switch to Master-wise to approve.");
      else if (isSelectedLocked) toast.info("This issue request is locked for store out.");
      else toast.info("Select a row to approve (Ctrl+A).");
    }, [isSummary, isSelectedLocked]),
    openDelete: useCallback((row) => {
      if (!isSummary || row?.out_entry_locked) return;
      setDeleteItem(row);
    }, [isSummary]),
    canDeleteSelection: useCallback(() => isSummary && !!selected && !isSelectedLocked, [isSummary, selected, isSelectedLocked]),
  });

  const handleLock = async () => {
    if (!selectedIssueUid || isSelectedLocked) return;
    try {
      await issueRequestService.lockStoreOut(selectedIssueUid);
      toast.success("Issue request locked successfully.");
      fetchRows();
      setSelected(null);
    } catch (err) {
      toast.error(err?.message || "Failed to lock issue request.");
    }
  };

  const handleUnlock = async () => {
    if (!selectedIssueUid || !isSelectedLocked) return;
    try {
      await issueRequestService.unlockStoreOut(selectedIssueUid);
      toast.success("Issue request unlocked successfully.");
      fetchRows();
      setSelected(null);
    } catch (err) {
      toast.error(err?.message || "Failed to unlock issue request.");
    }
  };

  const modalRecord = useMemo(() => {
    if (!selectedRecord) return null;
    if (isSummary) return selectedRecord;
    return { issue_uid: selectedRecord.issue_uid, approved: selectedRecord.approved };
  }, [selectedRecord, isSummary]);

  const openViewModal = () => {
    if (!selectedRecord) return;
    setEditItem(isSummary ? selectedRecord : { issue_uid: selectedRecord.issue_uid });
    setModalMode("view");
    setModalOpen(true);
  };

  const MASTER_HEADERS = useMemo(
    () => [
      ["Issue UID", "issue_uid", (v) => <span className="font-bold text-teal-700 text-[10px]">{v}</span>, { fixed: true, width: "90px" }],
      ["FG Item Code", "item_code", (v) => <span className="font-bold text-slate-800 uppercase text-[11px] truncate block">{v || "—"}</span>, { width: "120px" }],
      ["FG Description", "item_desc", (v) => (
          <span className="text-[11px] text-slate-600 truncate block" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "180px" },
      ],
      ["RM Item Code", "rm_item_code", (v) => <span className="font-bold text-slate-800 uppercase text-[11px] truncate block">{v || "—"}</span>, { width: "120px" }],
      ["RM Description", "rm_item_desc", (v) => (
          <span className="text-[11px] text-slate-600 truncate block" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "180px" },
      ],
      ["Shift", "shift", (v) => <span className="text-[10px] font-bold text-slate-600 uppercase">{v || "—"}</span>, { width: "60px" }],
      ["Machine", "machine_label", (v) => (
          <span className="text-[10px] font-bold text-slate-700 uppercase truncate block" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "110px" },
      ],
      ["Job Cards", "job_card_label", (v) => (
          <span className="text-[10px] text-slate-700 truncate block font-medium" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "180px" },
      ],
      ["Qty", "requested_qty", (v) => qtyCell(v), { width: "90px" }],
      ["Coils", "coil_count", (v) => <span className="font-bold tabular-nums text-[11px]">{v ?? 0}</span>, { width: "65px" }],
      ["Status", "approved", (v) => (
          <span
            className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
              v
                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                : "bg-amber-50 text-amber-600 border-amber-100"
            }`}
          >
            {v ? "● AUTHORIZED" : "○ PENDING"}
          </span>
        ),
        { width: "110px" },
      ],
      ["Lock Status", "out_entry_locked", (_v, row) => <LockStatusBadge row={row} />, { width: "110px" }],
      ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-500 truncate block" title={v || ""}>{v || "—"}</span>, { width: "140px" }],
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Updated At", "updated_at", (v, row) => (
        <span className="text-[10px] text-slate-400 font-medium">
          {row?.updated_by_name ? formatDateTime(v) : "—"}
        </span>
      ), { width: "150px" }],
      ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
      ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Locked By", "out_entry_locked_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "130px" }],
      ["Locked At", "out_entry_locked_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ],
    []
  );

  const JOB_CARD_HEADERS = useMemo(
    () => [
      ["Issue UID", "issue_uid", (v) => <span className="font-bold text-teal-700 text-[10px]">{v}</span>, { fixed: true, width: "90px" }],
      ["Job Card", "pjobcardno", (v) => <span className="font-bold text-indigo-700 text-[11px]">{v || "—"}</span>, { width: "120px" }],
      ["Plan Date", "pldt", (v) => <span className="text-[10px] text-slate-500">{v ? formatDateTime(v) : "—"}</span>, { width: "130px" }],
      ["Machine", "macname", (v) => <span className="text-[10px] font-bold text-slate-700 uppercase truncate block" title={v || ""}>{v || "—"}</span>, { width: "110px" }],
      ["FG Item", "item_code", (v) => <span className="font-bold text-slate-800 uppercase text-[11px] truncate block">{v || "—"}</span>, { width: "110px" }],
      ["FG Description", "item_desc", (v) => <span className="text-[11px] text-slate-600 truncate block" title={v || ""}>{v || "—"}</span>, { width: "160px" }],
      ["RM Item", "rm_item_code", (v) => <span className="font-bold text-slate-800 uppercase text-[11px] truncate block">{v || "—"}</span>, { width: "110px" }],
      ["RM Description", "rm_item_desc", (v) => <span className="text-[11px] text-slate-600 truncate block" title={v || ""}>{v || "—"}</span>, { width: "160px" }],
      // ["Plan Qty", "planqty", (v) => qtyCell(v), { width: "85px" }],
      ["Issue Qty", "issue_qty", (v) => qtyCell(v), { width: "85px" }],
      ["Coils", "coil_count", (v) => <span className="font-bold tabular-nums text-[11px]">{v ?? 0}</span>, { width: "65px" }],
      ["Shift", "shift", (v) => <span className="text-[10px] font-bold text-slate-600 uppercase">{v || "—"}</span>, { width: "55px" }],
      [
        "Status",
        "approved",
        (v) => (
          <span
            className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
              v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
            }`}
          >
            {v ? "● AUTHORIZED" : "○ PENDING"}
          </span>
        ),
        { width: "110px" },
      ],
      [
        "Lock Status",
        "out_entry_locked",
        (_v, row) => <LockStatusBadge row={row} />,
        { width: "110px" },
      ],
      ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-500 truncate block" title={v || ""}>{v || "—"}</span>, { width: "140px" }],
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Updated At", "updated_at", (v, row) => (
        <span className="text-[10px] text-slate-400 font-medium">
          {row?.updated_by_name ? formatDateTime(v) : "—"}
        </span>
      ), { width: "150px" }],
      ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
      ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Locked By", "out_entry_locked_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "130px" }],
      ["Locked At", "out_entry_locked_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ],
    []
  );

  const headers = isSummary ? MASTER_HEADERS : JOB_CARD_HEADERS;

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isSummary ? "RM Issue Request" : "RM Issue Request Job Cards",
    rows: filteredRows,
    headers,
  });

  const extraFilters = useMemo(
    () => [
      {
        label: "Status",
        key: "approvedStatus",
        value: params.status,
        options: [
          { label: "All Status", value: "all" },
          { label: "Approved", value: "approved" },
          { label: "Pending", value: "pending" },
        ],
      },
      {
        label: "Lock / Complete",
        key: "storeOutFilter",
        value: params.storeOutFilter,
        options: STORE_OUT_FILTER_OPTIONS,
      },
    ],
    [params.status, params.storeOutFilter]
  );

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            subTabs={
              <ImsSegmentedTabs
                className="mr-2"
                active={reportType}
                onChange={(id) => {
                  setReportType(id);
                  setSelected(null);
                  setDisplayLimit(100);
                }}
                tabs={[
                  { id: REPORT_TYPES.SUMMARY, label: "Master-wise", icon: List },
                  { id: REPORT_TYPES.JOB_CARD, label: "Job Card-wise", icon: ClipboardList },
                ]}
              />
            }
            actions={
              <>
                <ActionButton
                  module={MODULE}
                  action="add"
                  label="New"
                  icon={Plus}
                  onClick={openNewModal}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="view"
                  variant="outline"
                  label="View"
                  icon={Eye}
                  disabled={!selectedRecord}
                  onClick={openViewModal}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="edit"
                  variant="outline"
                  label="Edit"
                  icon={Edit3}
                  disabled={!selectedRecord || !isSummary || isSelectedLocked}
                  record={modalRecord}
                  onClick={openEditModal}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="authorize"
                  variant="outline"
                  label="Approve"
                  icon={CheckCircle}
                  disabled={!selectedRecord || !isSummary || isSelectedLocked}
                  onClick={() => {
                    setEditItem(modalRecord);
                    setModalMode("approve");
                    setModalOpen(true);
                  }}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!selectedRecord || !isSummary || isSelectedLocked}
                  onClick={() => setDeleteItem(modalRecord)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                {String(role || "").toLowerCase() === "super_admin" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleLock()}
                      disabled={!selectedIssueUid || isSelectedLocked}
                      className="h-9 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      title="Super Admin: lock for store out"
                    >
                      <Lock size={14} />
                      Lock
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUnlock()}
                      disabled={!selectedIssueUid || !isSelectedLocked}
                      className="h-9 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      title="Super Admin: unlock store-out lock"
                    >
                      <Unlock size={14} />
                      Unlock
                    </button>
                  </>
                )}
                <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={fetchRows}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center transition-all shrink-0"
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

          {selectedRecord && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-teal-50 border border-teal-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-teal-700 uppercase truncate">
                {isSummary ? (
                  <>
                    Selected: Issue #{selectedRecord.issue_uid} · {selectedRecord.item_code || "—"} · RM{" "}
                    {selectedRecord.rm_item_code || "—"} · Qty {Number(selectedRecord.requested_qty || 0).toLocaleString()} ·{" "}
                    {selectedRecord.coil_count ?? 0} coil(s)
                  </>
                ) : (
                  <>
                    Selected: Issue #{selectedRecord.issue_uid} · JC {selectedRecord.pjobcardno || "—"} · Issue Qty{" "}
                    {Number(selectedRecord.issue_qty || 0).toLocaleString()} · {selectedRecord.coil_count ?? 0} coil(s)
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-teal-400 hover:text-teal-700 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate
            fromDate={params.fromDate}
            toDate={params.toDate}
            extraFilters={extraFilters}
            onApply={(data) => {
              applySearchFromInput();
              setParams((prev) => ({
                ...prev,
                fromDate: data.fromDate,
                toDate: data.toDate,
                status: data.approvedStatus || prev.status,
                storeOutFilter: data.storeOutFilter || prev.storeOutFilter,
              }));
            }}
            onReset={() => {
              resetSearch();
              setParams({
                pageSize: 500,
                status: "all",
                storeOutFilter: "all",
                fromDate: dateFilterDefaults.from,
                toDate: dateFilterDefaults.to,
                sortKey: "issue_uid",
                sortDir: "desc",
              });
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder={
              isSummary
                ? "Search by issue UID, item, or RM item"
                : "Search by issue UID, job card, or item"
            }
            searchLabel={isSummary ? "Search Issue Request" : "Search Job Cards"}
            searchVariant="quick"
            applyOnSearchEnter={false}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={headers}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy
            showSelection
            sortKey={params.sortKey ?? ""}
            sortDir={params.sortDir}
            onSort={(key) => {
              setDisplayLimit(100);
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }));
            }}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={getRowId}
            onRowDoubleClick={(row) => {
              setSelected(getRowId(row));
              setEditItem(isSummary ? row : { issue_uid: row.issue_uid });
              setModalMode("view");
              setModalOpen(true);
            }}
            emptyMessage={isSummary ? "No issue requests found" : "No job card lines found"}
            cardConfig={{
              titleKey: isSummary ? "issue_uid" : "pjobcardno",
              badgeIndices: [isSummary ? 9 : 9],
              detailKeys: isSummary
                ? ["item_code", "item_desc", "rm_item_code", "rm_item_desc", "machine_label", "job_card_label", "requested_qty", "coil_count"]
                : ["macname", "item_code", "rm_item_code", "issue_qty", "coil_count", "shift"],
              footerKey: "created_at",
            }}
            {...tableHotkeyProps}
          />
          {totalItems > displayLimit && (
            <div className="border-t border-slate-200 px-3 py-2 flex justify-center">
              <button
                type="button"
                onClick={() => setDisplayLimit((n) => n + 100)}
                className="text-[11px] font-bold uppercase text-indigo-600 hover:text-indigo-800"
              >
                Show more ({displayLimit}/{totalItems})
              </button>
            </div>
          )}
        </div>

        <RmStoreListFooter
          shown={items.length}
          total={totalItems}
          label={isSummary ? "Issue Requests" : "Job Card Lines"}
          {...footerFilter}
        />
      </div>

      <IssueRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchRows}
        editData={editItem || modalRecord}
        mode={modalMode}
      />

      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => {
          fetchRows();
          setSelected(null);
        }}
        service={issueRequestService}
        entityLabel="Issue Request"
        idKey="issue_uid"
        titleKey="issue_uid"
        moduleSlug={MODULE}
      />
    </div>
  );
}
