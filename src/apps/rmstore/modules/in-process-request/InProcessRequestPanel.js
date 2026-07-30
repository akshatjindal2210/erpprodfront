"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Edit3, Trash2, CheckCircle, X, Eye } from "lucide-react";
import { toast } from "react-toastify";

import {
  inProcessRequestService,
  IPR_REQUEST_TYPE,
  IPR_DOWNSTREAM,
  IPR_REQUEST_TYPE_LABEL,
  IPR_REJECTION_SCOPE_LABEL,
  IPR_REQUEST_TYPE_FILTER_OPTIONS,
} from "@/apps/rmstore/lib/services/inProcessRequest";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import InProcessRequestModal from "@/apps/rmstore/modules/in-process-request/InProcessRequestModal";
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
import RmStoreListFooter, { rmStoreFooterFromClientFilter } from "@/apps/rmstore/lib/helpers/RmStoreListFooter";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { formatDateTime } from "@/platform/utils/core/utilHelper";

const MODULE = "rm_issue_request";

const DOWNSTREAM_LABEL = {
  [IPR_DOWNSTREAM.PENDING_STORE_OUT]: "Rejection Pending",
  [IPR_DOWNSTREAM.STORE_OUT_DONE]: "Store Out Done",
  [IPR_DOWNSTREAM.PENDING_STORE_IN]: "Store In Pending",
  [IPR_DOWNSTREAM.CONSUMED]: "Consumed",
};

function qtyCell(v) {
  return (
    <span className="font-bold tabular-nums text-[11px] text-slate-800">
      {v != null ? Number(v).toLocaleString() : "0"}
    </span>
  );
}

const REQUEST_TYPE_BADGE = {
  [IPR_REQUEST_TYPE.STORE_IN]: {
    label: IPR_REQUEST_TYPE_LABEL[IPR_REQUEST_TYPE.STORE_IN],
    className: "bg-teal-50 text-teal-800 border-teal-200",
  },
  [IPR_REQUEST_TYPE.CONSUME]: {
    label: IPR_REQUEST_TYPE_LABEL[IPR_REQUEST_TYPE.CONSUME],
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  [IPR_REQUEST_TYPE.REJECTION]: {
    label: IPR_REQUEST_TYPE_LABEL[IPR_REQUEST_TYPE.REJECTION],
    className: "bg-rose-50 text-rose-800 border-rose-200",
  },
};

const REJECTION_SCOPE_BADGE = {
  coil: {
    label: IPR_REJECTION_SCOPE_LABEL.coil,
    className: "bg-amber-50 text-amber-900 border-amber-300",
  },
  lot: {
    label: IPR_REJECTION_SCOPE_LABEL.lot,
    className: "bg-yellow-50 text-yellow-900 border-yellow-300",
  },
};

function IprRequestTypeCell({ requestType, rejectionType, inline = false }) {
  const type = requestType || IPR_REQUEST_TYPE.REJECTION;
  const badge = REQUEST_TYPE_BADGE[type] || REQUEST_TYPE_BADGE[IPR_REQUEST_TYPE.REJECTION];
  const scopeKey = rejectionType === "lot" ? "lot" : "coil";
  const scopeBadge = REJECTION_SCOPE_BADGE[scopeKey];

  return (
    <div
      className={`flex min-w-0 py-0.5 ${
        inline ? "flex-row flex-wrap items-center gap-1" : "flex-col items-start gap-1"
      }`}
    >
      <span
        className={`inline-block max-w-full px-1.5 py-0.5 text-[8px] font-bold border rounded-sm leading-snug ${badge.className}`}
      >
        {badge.label}
      </span>
      {type === IPR_REQUEST_TYPE.REJECTION && (
        <span
          className={`inline-flex items-center px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider border rounded-sm ${scopeBadge.className}`}
        >
          {scopeBadge.label}
        </span>
      )}
    </div>
  );
}

const DEFAULT_PARAMS = {
  pageSize: 500,
  status: "all",
  requestType: "all",
  sortKey: "ipr_uid",
  sortDir: "desc",
};

export default function InProcessRequestPanel() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    ...DEFAULT_PARAMS,
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
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

  const [tempSearch, setTempSearch] = useState("");
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
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await inProcessRequestService.getAll({
          ...base,
          page,
          limit,
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the in-process requests. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (params.requestType !== "all") {
      data = data.filter((row) => row.request_type === params.requestType);
    }
    if (params.status !== "all") {
      data = data.filter((row) => row.approved === (params.status === "approved"));
    }
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, params.requestType, params.status, tempSearch, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const selectedRecord = useMemo(
    () => filteredRows.find((r) => r.ipr_uid === selected) || null,
    [filteredRows, selected]
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((u) => u.ipr_uid === selected),
    [filteredRows, selected]
  );

  const footerFilter = useMemo(
    () =>
      rmStoreFooterFromClientFilter({
        tempSearch,
        sourceRows: allRows,
        filteredRows,
        serverFiltered: Boolean(params.fromDate) || Boolean(params.toDate),
      }),
    [tempSearch, allRows, filteredRows, params.fromDate, params.toDate, params.status, params.requestType]
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
      ["IPR UID", "ipr_uid", (v) => <span className="font-bold text-teal-700 text-[10px]">{v}</span>, { fixed: true, width: "90px" }],
      ["Type", "request_type", (_v, row) => (
          <IprRequestTypeCell requestType={row.request_type} rejectionType={row.rejection_type} />
        ),
        { width: "138px" },
      ],
      ["Item Code", "item_code", (v) => (
          <span className="font-bold text-slate-800 uppercase text-[11px] truncate block">{v || "—"}</span>
        ),
        { width: "120px" },
      ],
      ["Description", "item_desc", (v) => (
          <span className="text-[11px] text-slate-600 truncate block" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "160px" },
      ],
      ["MRN / Lot", "mrn_label", (v, row) => (
          <span
            className="font-bold text-indigo-700 text-[10px] truncate block"
            title={row.lot_label ? `Lot ${row.lot_label}` : row.mrn_uid || ""}
          >
            {row.lot_label ? `Lot ${row.lot_label}` : v || row.mrn_uid || "—"}
          </span>
        ),
        { width: "110px" },
      ],
      ["Heat No", "heat_label", (v) => (
          <span className="text-[10px] font-semibold text-slate-700 truncate block" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "100px" },
      ],
      [
        "Coil",
        "coil_label",
        (v) => (
          <span className="text-[10px] font-bold text-slate-600 uppercase truncate block" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "120px" },
      ],
      [
        "Reason",
        "reason",
        (v) => (
          <span className="text-[10px] text-slate-600 truncate block" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "150px" },
      ],
      ["Qty", "total_qty", qtyCell, { width: "80px" }],
      [
        "Coils",
        "coil_count",
        (v) => <span className="font-bold tabular-nums text-[11px]">{v ?? 0}</span>,
        { width: "65px" },
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
        { width: "110px" },
      ],
      [
        "Next Step",
        "downstream",
        (v) => (
          <span className="text-[10px] font-bold text-slate-600 uppercase">
            {DOWNSTREAM_LABEL[v] || "—"}
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
    moduleName: "RM In-process Request",
    rows: filteredRows,
    headers,
  });

  const extraFilters = useMemo(
    () => [
      {
        label: "Request Type",
        key: "requestType",
        value: params.requestType,
        options: IPR_REQUEST_TYPE_FILTER_OPTIONS,
      },
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
    [params.requestType, params.status]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-teal-50 border border-teal-100 animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-[10px] font-bold text-teal-800 shrink-0">
                Selected: IPR #{selectedRecord.ipr_uid}
              </span>
              <IprRequestTypeCell
                requestType={selectedRecord.request_type}
                rejectionType={selectedRecord.rejection_type}
                inline
              />
              <span className="text-[10px] font-bold text-slate-600 truncate">
                {selectedRecord.item_code || "—"}
              </span>
            </div>
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
          applyExtrasOnChange
          showSearchButton={false}
          applyOnSearchEnter={false}
          searchVariant="quick"
          onApply={(data) => {
            setParams((prev) => ({
              ...prev,
              fromDate: data.fromDate,
              toDate: data.toDate,
              status: data.approvedStatus || prev.status,
              requestType: data.requestType || prev.requestType,
            }));
          }}
          onReset={() => {
            setTempSearch("");
            setParams({
              ...DEFAULT_PARAMS,
              fromDate: dateFilterDefaults.from,
              toDate: dateFilterDefaults.to,
            });
          }}
          searchValue={tempSearch}
          onSearchChange={setTempSearch}
          searchPlaceholder="Search by request, coil, item, or MRN"
          searchLabel="Search In-process Request"
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
          idKey="ipr_uid"
          onRowDoubleClick={(row) => {
            setSelected(row.ipr_uid);
            setEditItem(row);
            setModalMode("view");
            setModalOpen(true);
          }}
          emptyMessage="No in-process requests found"
          cardConfig={{
            titleKey: "ipr_uid",
            badgeIndices: [10],
            detailKeys: ["item_code", "item_desc", "mrn_label", "heat_label", "reason", "total_qty"],
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
        label="In-Process Requests"
        {...footerFilter}
      />

      <InProcessRequestModal
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
        service={inProcessRequestService}
        entityLabel="In-process Request"
        idKey="ipr_uid"
        titleKey="ipr_uid"
        moduleSlug={MODULE}
      />
    </div>
  );
}
