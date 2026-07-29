"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Edit3, Trash2, CheckCircle, X, Eye } from "lucide-react";
import { toast } from "react-toastify";

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
import ActionButton from "@/ui/primitives/ActionButton";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { formatDateTime } from "@/platform/utils/core/utilHelper";

const MODULE = "rm_issue_request";

export default function IssueRequestPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 500,
    status: "all",
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
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await issueRequestService.getAll({
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
      toast.error(err?.message || "Could not load the issue requests. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.status, appliedSearch]);

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
    () => filteredRows.find((r) => r.issue_uid === selected) || null,
    [filteredRows, selected]
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((u) => u.issue_uid === selected),
    [filteredRows, selected]
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
      setEditItem(row);
      setModalMode("edit");
      setModalOpen(true);
    }, []),
    openApprove: useCallback((row) => {
      setEditItem(row);
      setModalMode("approve");
      setModalOpen(true);
    }, []),
    canApproveSelection: useCallback(
      () => Boolean(selected && selectedRecord),
      [selected, selectedRecord]
    ),
    onApproveBlocked: useCallback(() => {
      toast.info("Select a row to approve (Ctrl+A).");
    }, []),
    openDelete: useCallback((row) => {
      setDeleteItem(row);
    }, []),
    canDeleteSelection: useCallback(() => !!selected, [selected]),
  });

  const openViewModal = () => {
    if (!selectedRecord) return;
    setEditItem(selectedRecord);
    setModalMode("view");
    setModalOpen(true);
  };

  const headers = useMemo(
    () => [
      [
        "Issue UID",
        "issue_uid",
        (v) => <span className="font-bold text-teal-700 text-[10px]">{v}</span>,
        { fixed: true, width: "100px" },
      ],
      [
        "Production",
        "production_name",
        (v) => <span className="text-[10px] font-bold text-slate-700 truncate block">{v || "—"}</span>,
        { width: "140px" },
      ],
      [
        "RM Item",
        "rm_item_code",
        (v, row) => (
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-800 uppercase truncate">{v || "—"}</div>
            <div className="text-[9px] text-slate-400 truncate">{row.rm_item_desc || ""}</div>
          </div>
        ),
        { width: "160px" },
      ],
      [
        "Shift",
        "shift",
        (v) => <span className="text-[10px] font-bold text-slate-600 uppercase">{v || "—"}</span>,
        { width: "80px" },
      ],
      [
        "Job Cards",
        "job_cards",
        (v) => {
          const label = Array.isArray(v)
            ? v
                .map((c) => c?.pjobcardno || c?.job_card_no || c)
                .filter(Boolean)
                .join(", ")
            : v || "";
          return (
            <span className="text-[10px] text-slate-600 truncate block" title={label}>
              {label || "—"}
            </span>
          );
        },
        { width: "140px" },
      ],
      [
        "Required Qty",
        "req_qty",
        (v) => (
          <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
            {v != null ? Number(v).toLocaleString() : "0"}
          </span>
        ),
        { width: "100px" },
      ],
      [
        "Coil Qty",
        "coil_qty",
        (v) => <span className="font-bold tabular-nums text-[11px]">{v != null ? Number(v).toLocaleString() : "—"}</span>,
        { width: "90px" },
      ],
      [
        "Coils",
        "coil_count",
        (v) => <span className="font-bold tabular-nums text-[11px]">{v ?? 0}</span>,
        { width: "70px" },
      ],
      [
        "Status",
        "approved",
        (v) => (
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
        { width: "120px" },
      ],
      [
        "Created By",
        "created_by_name",
        (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>,
        { width: "110px" },
      ],
      [
        "Created At",
        "created_at",
        (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>,
        { width: "150px" },
      ],
      [
        "Approved By",
        "approved_by_name",
        (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>,
        { width: "110px" },
      ],
      [
        "Approved At",
        "approved_at",
        (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>,
        { width: "150px" },
      ],
    ],
    []
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "RM Issue Request",
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
    ],
    [params.status]
  );

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
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
                  disabled={!selectedRecord}
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
                  disabled={!selectedRecord}
                  onClick={() => {
                    setEditItem(selectedRecord);
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
                  disabled={!selectedRecord}
                  onClick={() => setDeleteItem(selectedRecord)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
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
                Selected: Issue #{selectedRecord.issue_uid} · {selectedRecord.rm_item_code || "—"}
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
              }));
            }}
            onReset={() => {
              resetSearch();
              setParams({
                pageSize: 500,
                status: "all",
                fromDate: dateFilterDefaults.from,
                toDate: dateFilterDefaults.to,
                sortKey: "issue_uid",
                sortDir: "desc",
              });
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search by issue UID, item, or RM item"
            searchLabel="Search Issue Request"
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
            idKey="issue_uid"
            onRowDoubleClick={(row) => {
              setSelected(row.issue_uid);
              setEditItem(row);
              setModalMode("view");
              setModalOpen(true);
            }}
            emptyMessage="No issue requests found"
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
      </div>

      <IssueRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchRows}
        editData={editItem}
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
