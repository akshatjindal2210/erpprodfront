"use client";

import { useState, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { Plus, AlertTriangle, RefreshCcw, Edit3, Trash2, X, CheckCircle } from "lucide-react";
import { toast } from "react-toastify";
import dayjs from "dayjs";

import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { shortageService, SHORTAGE_TYPES } from "@/apps/ims/lib/services/shortage";
import { isImsSuperAdmin } from "@/apps/ims/lib/utils/imsSpecialPermissions";
import { selectUser } from "@/platform/store/slices/authSlice";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { useImsCrudList } from "@/apps/ims/lib/crud/useImsCrudList";
import ActionButton from "@/ui/primitives/ActionButton";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DataTable from "@/ui/primitives/DataTable";
import ShortageModal from "@/apps/ims/modules/shortage/ShortageModal";
import ShortageBulkImport from "@/apps/ims/modules/shortage/ShortageBulkImport";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { SCHEDULE_REPORT_FILTER, SCHEDULE_REPORT_FILTER_OPTIONS } from "@/apps/ims/modules/schedule-planning/schedulePlanStatus";
import { MONTH_FILTER_OPTIONS } from "@/apps/ims/modules/schedule-planning/schedulePlanningColumns";

const TYPE_FILTER_OPTIONS = [
  { label: "All Types", value: "all" },
  ...SHORTAGE_TYPES.map((t) => ({ label: t, value: t })),
];

const STATUS_FILTER_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Authorized", value: "approved" },
  { label: "Pending", value: "pending" },
];

function clampYmdRange(range, bounds = {}) {
  let from = String(range?.from ?? "").trim();
  let to = String(range?.to ?? "").trim();
  const minDate = String(bounds?.minDate ?? "").trim();
  const maxDate = String(bounds?.maxDate ?? "").trim();
  if (minDate && from && from < minDate) from = minDate;
  if (maxDate && to && to > maxDate) to = maxDate;
  if (minDate && !from) from = minDate;
  if (maxDate && !to) to = maxDate;
  if (from && to && from > to) from = to;
  return { from, to };
}

function buildShortageDefaultMonthRange() {
  const from = dayjs().startOf("month");
  const to = dayjs().endOf("month");
  return { from: from.format("YYYY-MM-DD"), to: to.format("YYYY-MM-DD") };
}

function monthBoundsInCurrentYear(monthNum) {
  const m = Number(monthNum);
  if (!Number.isFinite(m) || m < 1 || m > 12) return { from: "", to: "" };
  const from = dayjs().month(m - 1).startOf("month");
  return { from: from.format("YYYY-MM-DD"), to: from.endOf("month").format("YYYY-MM-DD") };
}

function resolveShortageDateFilters(params, viewBounds = {}) {
  const reportType = String(params.reportType ?? SCHEDULE_REPORT_FILTER.DEFAULT).toLowerCase();
  if (reportType !== SCHEDULE_REPORT_FILTER.CUSTOM) {
    return clampYmdRange(buildShortageDefaultMonthRange(), viewBounds);
  }

  const month = params.month;
  const fromDate = String(params.fromDate ?? "").trim();
  const toDate = String(params.toDate ?? "").trim();
  const hasMonth = month && String(month).toLowerCase() !== "all";
  const hasDate = Boolean(fromDate) || Boolean(toDate);

  if (hasMonth && !hasDate) {
    return clampYmdRange(monthBoundsInCurrentYear(month), viewBounds);
  }

  let from = fromDate;
  let to = toDate || fromDate;
  if (hasMonth && hasDate) {
    const bounds = monthBoundsInCurrentYear(month);
    const userFrom = fromDate || bounds.from;
    const userTo = toDate || fromDate || bounds.to;
    from = userFrom > bounds.from ? userFrom : bounds.from;
    to = userTo < bounds.to ? userTo : bounds.to;
  }
  return clampYmdRange({ from, to }, viewBounds);
}

const buildShortageListFilters = (params, viewBounds = {}) => {
  const filters = {
    ...(params.type !== "all" && { type: params.type }),
    ...(params.status === "approved" && { approved: true }),
    ...(params.status === "pending" && { approved: false }),
  };

  const { from, to } = resolveShortageDateFilters(params, viewBounds);
  if (from) filters.from_date = `${from} 00:00:00`;
  if (to) filters.to_date = `${to} 23:59:59`;
  return filters;
};

export default function ShortagePage() {
  const user = useSelector(selectUser);
  const canBulkImport = isImsSuperAdmin(user);
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("shortage", "view"), [canAccess]);
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);
  const [viewMode, handleViewMode] = useViewMode();
  const [draftReportType, setDraftReportType] = useState(SCHEDULE_REPORT_FILTER.DEFAULT);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const viewDateBounds = useMemo(
    () => ({ minDate: dateFilterDefaults.minDate, maxDate: dateFilterDefaults.maxDate }),
    [dateFilterDefaults.minDate, dateFilterDefaults.maxDate]
  );

  const shortageBuildFilters = useCallback(
    (listParams) => buildShortageListFilters(listParams, viewDateBounds),
    [viewDateBounds]
  );

  const {
    loading,
    params,
    setParams,
    tempSearch,
    setTempSearch,
    filteredRows,
    items,
    totalItems,
    fetchRows,
    handleLoadMore,
    handleSort,
  } = useImsCrudList({
    service: shortageService,
    buildFilters: shortageBuildFilters,
    errorMessage: "Failed to load shortage records",
    extraParams: {
      type: "all",
      status: "all",
      reportType: SCHEDULE_REPORT_FILTER.DEFAULT,
      fromDate: "",
      toDate: "",
      month: "all",
    },
  });

  const isCustomReport = String(draftReportType) === SCHEDULE_REPORT_FILTER.CUSTOM;

  const handleReset = () => {
    setTempSearch("");
    setDraftReportType(SCHEDULE_REPORT_FILTER.DEFAULT);
    setParams((prev) => ({
      ...prev,
      type: "all",
      status: "all",
      reportType: SCHEDULE_REPORT_FILTER.DEFAULT,
      fromDate: "",
      toDate: "",
      month: "all",
      sortKey: "id",
      sortDir: "desc",
    }));
  };

  const extraFilters = useMemo(() => {
    const filters = [
      { label: "Type", key: "typeFilter", value: params.type, options: TYPE_FILTER_OPTIONS },
      { label: "Status", key: "approvedStatus", value: params.status, options: STATUS_FILTER_OPTIONS },
      { label: "Report", key: "reportType", value: draftReportType, options: SCHEDULE_REPORT_FILTER_OPTIONS, preserveOrder: false },
    ];
    if (isCustomReport) {
      filters.push({
        label: "Month",
        key: "month",
        value: params.month ?? "all",
        options: MONTH_FILTER_OPTIONS,
        preserveOrder: true,
      });
    }
    return filters;
  }, [params.type, params.status, params.month, draftReportType, isCustomReport]);

  const selectedRecord = useMemo(
    () => filteredRows.find((row) => row.id === selected),
    [filteredRows, selected]
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((row) => row.id === selected),
    [filteredRows, selected]
  );

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "shortage",
    modalOpen: modalOpen || bulkImportOpen || !!deleteItem,
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
      toast.info("Select a row to open approve (Ctrl+A).");
    }, []),
    openDelete: useCallback((row) => setDeleteItem(row), []),
    canDeleteSelection: useCallback(() => !!selected, [selected]),
  });

  const HEADERS = [
    ["Shortage No", "id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "80px" }],
    ["Item Code", "item_code", (v, row) => (
      <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v || row.itemcode || "—"}</span>
    ), { fixed: true, width: "140px" }],
    ["Primary", "primitem_code", (v) => (
      <span className="text-[10px] font-semibold text-slate-600 uppercase">{v || "—"}</span>
    ), { width: "120px" }],
    ["Group", "grpname", (v) => (
      <span className="text-[10px] font-medium text-slate-500 uppercase">{v || "—"}</span>
    ), { width: "120px" }],
    ["Description", "item_desc", (v) => <span className="text-[10px] text-slate-500 truncate block italic">{v || "—"}</span>, { width: "180px" }],
    ["Type", "type", (v) => (
      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
        v === "Deviation" ? "bg-amber-50 text-amber-700 border border-amber-200"
          : v === "PPC" ? "bg-blue-50 text-blue-700 border border-blue-200"
            : v === "WIP" ? "bg-violet-50 text-violet-700 border border-violet-200"
              : "bg-slate-50 text-slate-600 border border-slate-200"
      }`}>{v}</span>
    ), { width: "110px" }],
    ["Qty", "qty", (v) => <span className="font-black text-slate-700 text-[11px]">{v}</span>, { width: "80px", align: "center" }],
    ["Month", "month", (v) => (
      <span className="text-[10px] font-bold text-indigo-700 tabular-nums">
        {v ? String(v).slice(0, 10) : "—"}
      </span>
    ), { width: "110px" }],
    ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-500 truncate block">{v || "—"}</span>, { width: "160px" }],
    ["Status", "approved", (v) => (
      <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
        {v ? "● AUTHORIZED" : "○ PENDING"}
      </span>
    ), { width: "120px" }],
    ["Created By", "created_by_name", (v, row) => <span className="text-[10px] text-slate-500">{v || row?.created_by || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Updated By", "updated_by_name", (v, row) => <span className="text-[10px] text-slate-500">{v || row?.updated_by || "—"}</span>, { width: "110px" }],
    ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Approved By", "approved_by_name", (v, row) => <span className="text-[10px] text-slate-500">{v || row?.approved_by || "—"}</span>, { width: "110px" }],
    ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Shortage",
    rows: filteredRows,
    headers: HEADERS,
  });

  const onSaved = () => {
    fetchRows();
    setSelected(null);
  };

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <ActionButton module="shortage" action="add" label="New" icon={Plus} onClick={openNewModal} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" />
                {canBulkImport ? (
                  <ShortageBulkImport
                    onOpenChange={setBulkImportOpen}
                    onSuccess={() => {
                      fetchRows();
                      setSelected(null);
                    }}
                  />
                ) : null}
                <ActionButton module="shortage" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selected} record={selectedRecord} onClick={openEditModal} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0" />
                <ActionButton
                  module="shortage"
                  action="authorize"
                  variant="outline"
                  label="Approve"
                  icon={CheckCircle}
                  disabled={!selected}
                  onClick={() => {
                    setEditItem(selectedRecord);
                    setModalMode("approve");
                    setModalOpen(true);
                  }}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
                />
                <ActionButton module="shortage" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selected} onClick={() => setDeleteItem(selectedRecord)} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                <button onClick={fetchRows} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase shadow-none shrink-0">
                  <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle viewMode={viewMode} setMode={handleViewMode} exporting={exporting} disabled={loading || exportDisabled} onExport={handleExport} />
            }
          />

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">
                Selected: {selectedRecord?.item_code || selectedRecord?.itemcode || selectedRecord?.id}
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={draftReportType}
            fromDate={isCustomReport ? (params.fromDate ?? "") : ""}
            toDate={isCustomReport ? (params.toDate ?? "") : ""}
            dateDisabled={!isCustomReport}
            extraFilters={extraFilters}
            extraFiltersBeforeDate={isCustomReport ? ["month"] : []}
            applyOnSearchEnter={false}
            searchVariant="quick"
            onExtraFilterChange={(key, value) => {
              if (key === "reportType") {
                const next = value ?? SCHEDULE_REPORT_FILTER.DEFAULT;
                setDraftReportType(next);
                if (next === SCHEDULE_REPORT_FILTER.DEFAULT) {
                  setParams((prev) => ({
                    ...prev,
                    reportType: SCHEDULE_REPORT_FILTER.DEFAULT,
                    month: "all",
                    fromDate: "",
                    toDate: "",
                  }));
                }
              }
            }}
            onApply={(data) => {
              const reportType = data.reportType ?? SCHEDULE_REPORT_FILTER.DEFAULT;
              const isCustom = reportType === SCHEDULE_REPORT_FILTER.CUSTOM;
              const month = data.month ?? "all";
              const fromDate = data.fromDate || "";
              const toDate = data.toDate || "";
              const hasMonth = month && String(month).toLowerCase() !== "all";
              const hasDate = Boolean(fromDate.trim()) || Boolean(toDate.trim());

              if (isCustom && !hasMonth && !hasDate) {
                toast.warning("Custom report: select Month or Date (From/To), or both.");
                return;
              }

              setDraftReportType(reportType);
              setParams((prev) => ({
                ...prev,
                reportType,
                type: data.typeFilter || prev.type,
                status: data.approvedStatus || prev.status,
                ...(isCustom
                  ? { month, fromDate: hasDate ? fromDate : "", toDate: hasDate ? toDate : "" }
                  : { month: "all", fromDate: "", toDate: "" }),
              }));
            }}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search item, type..."
            searchLabel="Search Shortage"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy
            {...tableHotkeyProps}
            showSelection
            skeletonCount={params.pageSize}
            emptyIcon={AlertTriangle}
            sortKey={params.sortKey ?? ""}
            sortDir={params.sortDir}
            onSort={handleSort}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={(row) => row.id}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{ titleKey: "item_code", badgeIndices: [3, 7], detailIndices: [4, 5, 6], footerKey: "created_at" }}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Shortage Records
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ShortageModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={onSaved} editData={editItem} mode={modalMode} />
      )}
      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={onSaved}
          service={shortageService}
          entityLabel="Shortage"
          idKey="id"
          titleKey="itemcode"
          moduleSlug="shortage"
        />
      )}
    </div>
  );
}
