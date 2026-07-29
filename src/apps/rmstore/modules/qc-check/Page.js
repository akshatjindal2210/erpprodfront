"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCw, X, ShieldCheck, Eye, ClipboardCheck, CheckCircle, ClipboardList, Database, Edit3, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import { qcCheckService } from "@/apps/rmstore/lib/services/qcCheck";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ActionButton from "@/ui/primitives/ActionButton";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import QcCheckModal from "./QcCheckModal";
import QcScanGateModal from "./QcScanGateModal";

const MODULE = "rm_qc_check";

/** Left = Register (DB history). Right = Pending work (default). */
const PAGE_TABS = {
  REGISTER: "register",
  PENDING: "pending",
};

function rowKey(row) {
  if (row?.is_batch_pending && row?.mrn_uid) return `batch-${row.mrn_uid}`;
  if (row?.qc_check_uid != null) return `qc-${row.qc_check_uid}`;
  return `coil-${row?.coil_no_uid || ""}`;
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  if (s === "passed") {
    return (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-emerald-50 text-emerald-700 border-emerald-200">
        ● Passed
      </span>
    );
  }
  if (s === "failed") {
    return (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-rose-50 text-rose-700 border-rose-200">
        ○ Failed
      </span>
    );
  }
  if (s === "awaiting_approval") {
    return (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-sky-50 text-sky-700 border-sky-200">
        ○ Awaiting Approval
      </span>
    );
  }
  if (s === "draft") {
    return (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-violet-50 text-violet-700 border-violet-200">
        ○ Draft
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-amber-50 text-amber-700 border-amber-200">
      ○ Pending
    </span>
  );
}

export default function QcCheckPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const canAdd = canAccess(MODULE, "add").allowed;

  const [pageTab, setPageTab] = useState(PAGE_TABS.PENDING);
  const isPendingTab = pageTab === PAGE_TABS.PENDING;

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 500,
    status: "pending",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "created_at",
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

  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState({ open: false, mode: "inspect", row: null });
  const [scanGate, setScanGate] = useState({ open: false, row: null });
  /** After batch scan unlock — remaining coils open Spec form one-by-one after each submit. */
  const [postScanQueue, setPostScanQueue] = useState([]);
  const postScanQueueRef = useRef([]);
  postScanQueueRef.current = postScanQueue;
  const closingAfterQcSuccessRef = useRef(false);
  const [deleteItem, setDeleteItem] = useState(null);

  const handleTabChange = (tab) => {
    setPageTab(tab);
    setSelected(null);
    setDisplayLimit(100);
    setParams((prev) => ({
      ...prev,
      status: tab === PAGE_TABS.PENDING ? "pending" : "all",
      sortKey: tab === PAGE_TABS.PENDING ? "created_at" : "qc_check_uid",
      sortDir: "desc",
    }));
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const listStatus = isPendingTab ? "pending" : params.status === "pending" ? "all" : params.status;
      const base = {
        filters: {
          // Pending = same work queue as Unapproved stickers — no date window (like packing list)
          ...(!isPendingTab && params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(!isPendingTab && params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          status: listStatus,
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await qcCheckService.getAll({
          ...base,
          page,
          limit,
          ...(appliedSearch && { search: appliedSearch }),
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the QC checks. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.status, appliedSearch, isPendingTab]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(allRows, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const selectedRecord = useMemo(
    () => filteredRows.find((r) => rowKey(r) === selected) || null,
    [filteredRows, selected]
  );

  const openInspect = useCallback(
    (row, forceView = false) => {
      const editable =
        ["pending", "draft"].includes(String(row?.status || "").toLowerCase()) ||
        row?.is_virtual_pending;
      if (editable && !forceView && !canAdd) {
        toast.error("You do not have permission to perform a QC check.");
        return;
      }
      setModal({ open: true, mode: forceView || !editable ? "view" : "inspect", row });
    },
    [canAdd]
  );

  /**
   * Pending Check — scan QC sticker, then Spec form.
   * Draft re-open without re-scan: uncomment the block below when needed.
   */
  const openCheckWithScan = useCallback(
    (row) => {
      if (!canAdd) {
        toast.error("You do not have permission to perform a QC check.");
        return;
      }
      const target = row || selectedRecord || null;
      // Draft = sticker already scanned once and saved — skip scan gate
      const st = String(target?.status || "").toLowerCase();
      if (target && st === "draft" && target.coil_no_uid) {
        setPostScanQueue([]);
        openInspect(target);
        return;
      }
      setPostScanQueue([]);
      setScanGate({ open: true, row: target });
    },
    [selectedRecord, canAdd]
  );

  /** Open Spec Check form for the unlocked coil (fill values → submit). */
  const openUnlockedRow = useCallback(
    (unlockedRow, remainingQueue = []) => {
      if (!unlockedRow?.coil_no_uid) {
        toast.error("The scanned coil UID is missing.");
        return;
      }
      setSelected(rowKey(unlockedRow));
      setPostScanQueue(Array.isArray(remainingQueue) ? remainingQueue : []);
      const st = String(unlockedRow.status || "").toLowerCase();
      // Close scan gate, then open Spec form (same inspect drawer as before)
      window.setTimeout(() => {
        if (st === "awaiting_approval" && unlockedRow.qc_check_uid) {
          setModal({ open: true, mode: "approve", row: unlockedRow });
          return;
        }
        openInspect(unlockedRow);
      }, 0);
    },
    [openInspect]
  );

  const handleQcModalSuccess = useCallback(
    (meta) => {
      fetchRows();
      // Draft save should not advance to the next coil
      if (meta?.isDraft) return;
      const queue = postScanQueueRef.current;
      if (!queue.length) return;
      const [next, ...rest] = queue;
      closingAfterQcSuccessRef.current = true;
      setPostScanQueue(rest);
      window.setTimeout(() => {
        closingAfterQcSuccessRef.current = false;
        if (next?.coil_no_uid) {
          toast.info(`Next coil: complete the spec check for ${next.coil_no_uid}.`);
          openInspect(next);
        }
      }, 50);
    },
    [fetchRows, openInspect]
  );

  const openApprove = useCallback((row) => {
    const target = row || selectedRecord;
    if (!target?.qc_check_uid) return;
    if (String(target.status || "").toLowerCase() !== "awaiting_approval") return;
    setModal({ open: true, mode: "approve", row: target });
  }, [selectedRecord]);

  const openEdit = useCallback((row) => {
    if (!row?.qc_check_uid) return;
    const st = String(row.status || "").toLowerCase();
    if (!["awaiting_approval", "passed", "failed"].includes(st)) return;
    setModal({ open: true, mode: "edit", row });
  }, []);

  const headers = useMemo(
    () => [
      [
        "QC #",
        "qc_check_uid",
        (v) => (
          <span className="font-bold text-sky-700 text-[10px]">{v != null ? v : "—"}</span>
        ),
        { fixed: true, width: "80px" },
      ],
      [
        "Coil UID",
        "coil_no_uid",
        (v) => (
          <span className="font-mono text-[10px] font-bold text-slate-800 truncate block" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "220px" },
      ],
      [
        "Coil Count",
        "coil_count",
        (v, row) => (
          <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-black tabular-nums border border-indigo-100">
            {v != null && v !== "" ? Number(v) : row?.is_batch_pending ? 0 : 1}
          </span>
        ),
        { width: "100px" },
      ],
      ["MRN", "mrn_no", (v) => <span className="font-bold text-slate-800 text-[10px]">{v ?? "—"}</span>, { width: "90px" }],
      [
        "Mode",
        "sticker_mode",
        (v) => {
          const batch = String(v || "coil").toLowerCase() === "batch";
          return (
            <span
              className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
                batch
                  ? "bg-violet-50 text-violet-700 border-violet-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              {batch ? "Batch" : "Coil"}
            </span>
          );
        },
        { width: "90px" },
      ],
      [
        "Heat No.",
        "heat_no",
        (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>,
        { width: "120px" },
      ],
      ["Item", "item_code", (v) => <span className="text-slate-700 text-[10px] uppercase">{v || "—"}</span>, { width: "120px" }],
      [
        "Qty",
        "qty",
        (v) => (
          <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
            {v != null ? Number(v).toLocaleString() : "0"}
          </span>
        ),
        { width: "90px" },
      ],
      ["Status", "status", (v) => <StatusBadge status={v} />, { width: "140px" }],
      [
        "Failure Reason",
        "failure_reason",
        (v) => <span className="text-rose-700 text-[10px] truncate block">{v || "—"}</span>,
        { width: "180px" },
      ],
      [
        "Inspected By",
        "inspected_by_name",
        (v, row) => <span className="text-[10px] text-slate-500">{v || row?.inspected_by || "—"}</span>,
        { width: "110px" },
      ],
      [
        "Inspected At",
        "inspected_at",
        (v) => <span className="text-[10px] text-slate-400">{v ? formatDateTime(v) : "—"}</span>,
        { width: "150px" },
      ],
      [
        "Created At",
        "created_at",
        (v) => <span className="text-[10px] text-slate-400">{v ? formatDateTime(v) : "—"}</span>,
        { width: "150px" },
      ],
    ],
    []
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isPendingTab ? "RM QC Pending" : "RM QC Register",
    rows: filteredRows,
    headers,
  });

  const extraFilters = useMemo(() => {
    if (isPendingTab) return [];
    return [
      {
        label: "Status",
        key: "qcStatus",
        value: params.status,
        options: [
          { label: "All Records", value: "all" },
          { label: "Passed", value: "passed" },
          { label: "Failed", value: "failed" },
        ],
      },
    ];
  }, [isPendingTab, params.status]);

  const canInspect = isPendingTab && canAdd;
  const canApprove =
    isPendingTab &&
    selectedRecord &&
    String(selectedRecord.status || "").toLowerCase() === "awaiting_approval";
  const canEdit =
    selectedRecord?.qc_check_uid != null &&
    ["awaiting_approval", "passed", "failed"].includes(
      String(selectedRecord.status || "").toLowerCase()
    );
  const canDelete =
    !isPendingTab &&
    selectedRecord?.qc_check_uid != null &&
    ["passed", "failed"].includes(String(selectedRecord.status || "").toLowerCase());
  const canView =
    selectedRecord &&
    selectedRecord.qc_check_uid != null &&
    ["awaiting_approval", "passed", "failed"].includes(
      String(selectedRecord.status || "").toLowerCase()
    );

  const getSelectedRow = useCallback(() => selectedRecord, [selectedRecord]);

  const { openNewModal, openEditModal, openApproveModal, openDeleteModal, tableHotkeyProps } =
    useListDrawerHotkeys({
      module: MODULE,
      modalOpen: modal.open || scanGate.open || !!deleteItem,
      selectedId: selected,
      getSelectedRow,
      openAdd: useCallback(() => {
        openCheckWithScan(selectedRecord);
      }, [selectedRecord, openCheckWithScan]),
      canOpenNew: useCallback(() => Boolean(canInspect), [canInspect]),
      newBlockedMessage: "You do not have permission to perform a QC check.",
      openEdit: useCallback(
        (row) => {
          if (!canEdit) return;
          openEdit(row);
        },
        [canEdit, openEdit]
      ),
      openApprove: useCallback(
        (row) => {
          openApprove(row || selectedRecord);
        },
        [openApprove, selectedRecord]
      ),
      canApproveSelection: useCallback(() => Boolean(canApprove), [canApprove]),
      approveBlockedMessage: "Select a row awaiting approval.",
      openDelete: useCallback(
        (row) => {
          if (!row?.qc_check_uid) return;
          setDeleteItem(row);
        },
        []
      ),
      canDeleteSelection: useCallback(() => Boolean(canDelete), [canDelete]),
      deleteBlockedMessage: "Select a QC record from the register to delete.",
    });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                className="mr-2"
                active={pageTab}
                onChange={handleTabChange}
                tabs={[
                  { id: PAGE_TABS.REGISTER, label: "Register", icon: Database },
                  { id: PAGE_TABS.PENDING, label: "Pending", icon: ClipboardList },
                ]}
              />
            }
            actions={
              <>
                {isPendingTab ? (
                  <>
                    <ActionButton
                      module={MODULE}
                      action="add"
                      label="Check"
                      icon={ClipboardCheck}
                      disabled={!canInspect}
                      onClick={openNewModal}
                      className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                    />
                    <ActionButton
                      module={MODULE}
                      action="view"
                      variant="outline"
                      label="View"
                      icon={Eye}
                      disabled={!canView}
                      onClick={() => canView && openInspect(selectedRecord, true)}
                      className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                    />
                    <ActionButton
                      module={MODULE}
                      action="edit"
                      variant="outline"
                      label="Edit"
                      icon={Edit3}
                      disabled={!canEdit || String(selectedRecord?.status || "").toLowerCase() !== "awaiting_approval"}
                      record={selectedRecord}
                      onClick={openEditModal}
                      className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                    />
                    <ActionButton
                      module={MODULE}
                      action="authorize"
                      variant="outline"
                      label="Approve"
                      icon={CheckCircle}
                      disabled={!canApprove}
                      onClick={openApproveModal}
                      className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
                    />
                  </>
                ) : (
                  <>
                    <ActionButton
                      module={MODULE}
                      action="view"
                      variant="outline"
                      label="View"
                      icon={Eye}
                      disabled={!canView}
                      onClick={() => canView && openInspect(selectedRecord, true)}
                      className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                    />
                    <ActionButton
                      module={MODULE}
                      action="edit"
                      variant="outline"
                      label="Edit"
                      icon={Edit3}
                      disabled={!canEdit}
                      record={selectedRecord}
                      onClick={openEditModal}
                      className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                    />
                    <ActionButton
                      module={MODULE}
                      action="delete"
                      variant="danger"
                      label="Delete"
                      icon={Trash2}
                      disabled={!canDelete}
                      onClick={openDeleteModal}
                      className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                    />
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
            <div className="flex items-center justify-between px-3 py-1.5 bg-sky-50 border border-sky-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-sky-700 uppercase truncate">
                Selected:{" "}
                {selectedRecord.qc_check_uid != null
                  ? `QC-${selectedRecord.qc_check_uid}`
                  : "Pending"}{" "}
                · {selectedRecord.coil_no_uid}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-sky-400 hover:text-sky-600 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={!isPendingTab}
            fromDate={params.fromDate}
            toDate={params.toDate}
            extraFilters={extraFilters}
            onApply={(data) => {
              applySearchFromInput();
              setParams((prev) => ({
                ...prev,
                fromDate: data.fromDate,
                toDate: data.toDate,
                ...(isPendingTab
                  ? { status: "pending" }
                  : { status: data.qcStatus || prev.status }),
              }));
            }}
            onReset={() => {
              resetSearch();
              setParams({
                pageSize: 500,
                status: isPendingTab ? "pending" : "all",
                fromDate: dateFilterDefaults.from,
                toDate: dateFilterDefaults.to,
                sortKey: isPendingTab ? "created_at" : "qc_check_uid",
                sortDir: "desc",
              });
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search by coil, MRN, heat, or item"
            searchLabel={isPendingTab ? "Search Pending" : "Search Register"}
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
            emptyIcon={ShieldCheck}
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
            getRowId={(row) => rowKey(row)}
            onRowDoubleClick={(row) => {
              if (isPendingTab) {
                const editable =
                  ["pending", "draft"].includes(String(row?.status || "").toLowerCase()) ||
                  row?.is_virtual_pending;
                if (editable) openCheckWithScan(row);
                else openInspect(row, true);
              } else {
                openInspect(row, true);
              }
            }}
            onLoadMore={() => {
              if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
            }}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{ titleKey: "coil_no_uid", badgeIndices: [8], detailIndices: [2, 3, 4], footerKey: "created_at" }}
            {...tableHotkeyProps}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} — {isPendingTab ? "Pending Work" : "QC Register"}
          </span>
        </div>
      </div>

      <QcScanGateModal
        open={scanGate.open}
        row={scanGate.row}
        onClose={() => {
          setScanGate({ open: false, row: null });
          setPostScanQueue([]);
        }}
        onUnlocked={(unlockedRow, remainingQueue) => {
          setScanGate({ open: false, row: null });
          openUnlockedRow(unlockedRow, remainingQueue);
        }}
      />

      <QcCheckModal
        open={modal.open}
        mode={modal.mode}
        row={modal.row}
        onClose={() => {
          setModal({ open: false, mode: "inspect", row: null });
          // Keep remaining batch coils after submit; clear only on user cancel
          if (!closingAfterQcSuccessRef.current) setPostScanQueue([]);
        }}
        onSuccess={handleQcModalSuccess}
      />

      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => {
          fetchRows();
          setSelected(null);
        }}
        service={qcCheckService}
        entityLabel="QC Check"
        idKey="qc_check_uid"
        titleKey="coil_no_uid"
        moduleSlug={MODULE}
        warningMessage="The coil will return to Pending for QC. Failed checks linked to a rejection cannot be deleted here."
      />
    </div>
  );
}
