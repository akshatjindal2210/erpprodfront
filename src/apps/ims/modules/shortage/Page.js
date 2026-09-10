"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSelector } from "react-redux";
import { Plus, AlertTriangle, RefreshCcw, Edit3, Trash2, X, CheckCircle, Info } from "lucide-react";
import { toast } from "react-toastify";
import dayjs from "dayjs";

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
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { SCHEDULE_REPORT_FILTER, SCHEDULE_REPORT_FILTER_OPTIONS } from "@/apps/ims/modules/schedule-planning/schedulePlanStatus";
import { MONTH_FILTER_OPTIONS } from "@/apps/ims/modules/schedule-planning/schedulePlanningColumns";
import { getSelectedFinancialYear } from "@/platform/utils/global/financialYear";
import { clampRangeToIndianFy, defaultRangeInIndianFy, indianFyMonthRange } from "@/platform/utils/core/indianFinancialYear";
import { SHORTAGE_PAGE_TABS, buildShortageMasterHeaders, buildShortageItemWiseHeaders, formatShortageMonthDate, shortageYearMonthKey, shortageMasterSearchParts, shortageItemWiseSearchParts } from "@/apps/ims/modules/shortage/shortageColumns";

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

function resolveShortageDateFilters(params, viewBounds = {}) {
  const fy = getSelectedFinancialYear().name;
  const custom = String(params.reportType ?? SCHEDULE_REPORT_FILTER.DEFAULT).toLowerCase() === SCHEDULE_REPORT_FILTER.CUSTOM;
  let range = defaultRangeInIndianFy(fy);
  if (custom) {
    const month = params.month;
    const fromDate = String(params.fromDate ?? "").trim();
    const toDate = String(params.toDate ?? "").trim();
    const hasMonth = month && String(month).toLowerCase() !== "all";
    const hasDate = Boolean(fromDate) || Boolean(toDate);
    if (hasMonth && !hasDate) range = indianFyMonthRange(month, fy);
    else {
      let from = fromDate;
      let to = toDate || fromDate;
      if (hasMonth && hasDate) {
        const b = indianFyMonthRange(month, fy);
        from = (fromDate || b.from) > b.from ? (fromDate || b.from) : b.from;
        to = (toDate || fromDate || b.to) < b.to ? (toDate || fromDate || b.to) : b.to;
      }
      range = { from, to };
    }
  }
  return clampYmdRange(clampRangeToIndianFy(range, fy), viewBounds);
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
  const [pageTab, setPageTab] = useState("item-wise");
  const [itemWiseItemdcodeFilter, setItemWiseItemdcodeFilter] = useState(null);
  const [draftReportType, setDraftReportType] = useState(SCHEDULE_REPORT_FILTER.DEFAULT);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterRows, setMasterRows] = useState([]);
  const [masterDisplayLimit, setMasterDisplayLimit] = useState(100);

  const isMasterTab = pageTab === "master";

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
    allRows,
    fetchRows,
    handleSort: handleItemSort,
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

  const fetchMasterRows = useCallback(async () => {
    setMasterLoading(true);
    try {
      const filters = shortageBuildFilters(params);
      const res = await shortageService.getMasterList({ filters });
      setMasterRows(Array.isArray(res?.data) ? res.data : []);
      setMasterDisplayLimit(100);
      if (res && res.success === false) {
        toast.warning(res?.message || "Could not load master shortage report.");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to load master shortage report");
      setMasterRows([]);
    } finally {
      setMasterLoading(false);
    }
  }, [params, shortageBuildFilters]);

  useEffect(() => {
    void fetchMasterRows();
  }, [fetchMasterRows]);

  const refreshAll = useCallback(() => {
    fetchRows();
    void fetchMasterRows();
  }, [fetchRows, fetchMasterRows]);

  const isCustomReport = String(draftReportType) === SCHEDULE_REPORT_FILTER.CUSTOM;

  const handleReset = () => {
    setTempSearch("");
    setDraftReportType(SCHEDULE_REPORT_FILTER.DEFAULT);
    setItemWiseItemdcodeFilter(null);
    setParams((prev) => ({
      ...prev,
      type: "all",
      status: "all",
      reportType: SCHEDULE_REPORT_FILTER.DEFAULT,
      fromDate: "",
      toDate: "",
      month: "all",
      sortKey: isMasterTab ? "year_month" : "id",
      sortDir: isMasterTab ? "desc" : "desc",
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

  const drillToItemWise = useCallback((masterRow) => {
    const code = masterRow?.itemdcode;
    const ym = String(masterRow?.year_month ?? "").trim();
    if (code == null || String(code).trim() === "") return;
    setItemWiseItemdcodeFilter(String(code).trim());
    if (/^\d{4}-\d{2}$/.test(ym)) {
      const from = `${ym}-01`;
      const to = dayjs(from).endOf("month").format("YYYY-MM-DD");
      setDraftReportType(SCHEDULE_REPORT_FILTER.CUSTOM);
      setParams((prev) => ({
        ...prev,
        reportType: SCHEDULE_REPORT_FILTER.CUSTOM,
        month: "all",
        fromDate: from,
        toDate: to,
      }));
    }
    setPageTab("item-wise");
    setSelected(null);
  }, [setParams]);

  const masterFilteredRows = useMemo(() => {
    let data = masterRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(masterRows, tempSearch, {
        getParts: shortageMasterSearchParts,
        skipSort: !!params.sortKey,
      });
    }
    return sortRowsByKey(data, params.sortKey || "year_month", params.sortDir || "desc");
  }, [masterRows, tempSearch, params.sortKey, params.sortDir]);

  const masterItems = useMemo(
    () => masterFilteredRows.slice(0, masterDisplayLimit),
    [masterFilteredRows, masterDisplayLimit]
  );

  const itemFilteredRows = useMemo(() => {
    let data = allRows;
    if (itemWiseItemdcodeFilter) {
      const code = String(itemWiseItemdcodeFilter).trim();
      const ym = shortageYearMonthKey(params.fromDate || params.toDate);
      data = allRows.filter((row) => {
        if (String(row.itemdcode ?? "").trim() !== code) return false;
        return !ym || shortageYearMonthKey(row.month) === ym;
      });
    }
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, {
        getParts: shortageItemWiseSearchParts,
        skipSort: !!params.sortKey,
      });
    }
    return sortRowsByKey(data, params.sortKey || "id", params.sortDir || "desc");
  }, [allRows, itemWiseItemdcodeFilter, params.fromDate, params.toDate, tempSearch, params.sortKey, params.sortDir]);

  const [itemDisplayLimit, setItemDisplayLimit] = useState(100);
  useEffect(() => {
    setItemDisplayLimit(100);
  }, [tempSearch, pageTab, itemWiseItemdcodeFilter, params.type, params.status, params.reportType, params.month, params.fromDate, params.toDate]);

  const itemItems = useMemo(
    () => itemFilteredRows.slice(0, itemDisplayLimit),
    [itemFilteredRows, itemDisplayLimit]
  );

  const tableRows = isMasterTab ? masterItems : itemItems;
  const tableTotal = isMasterTab ? masterFilteredRows.length : itemFilteredRows.length;
  const tableLoading = isMasterTab ? masterLoading : loading;

  const selectedRecord = useMemo(() => {
    if (isMasterTab) return masterFilteredRows.find((row) => row.id === selected);
    return itemFilteredRows.find((row) => row.id === selected);
  }, [isMasterTab, masterFilteredRows, itemFilteredRows, selected]);

  const getSelectedRow = useCallback(() => {
    if (isMasterTab) return masterFilteredRows.find((row) => row.id === selected);
    return itemFilteredRows.find((row) => row.id === selected);
  }, [isMasterTab, masterFilteredRows, itemFilteredRows, selected]);

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "shortage",
    modalOpen: modalOpen || bulkImportOpen || !!deleteItem,
    selectedId: isMasterTab ? null : selected,
    getSelectedRow: isMasterTab ? () => null : getSelectedRow,
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
      () => !isMasterTab && Boolean(selected && selectedRecord),
      [isMasterTab, selected, selectedRecord]
    ),
    onApproveBlocked: useCallback(() => {
      toast.info(isMasterTab ? "Switch to Item-wise to approve an entry." : "Select a row to open approve (Ctrl+A).");
    }, [isMasterTab]),
    openDelete: useCallback((row) => setDeleteItem(row), []),
    canDeleteSelection: useCallback(() => !isMasterTab && !!selected, [isMasterTab, selected]),
  });

  const masterHeaders = useMemo(
    () => buildShortageMasterHeaders({ onDrillToItems: drillToItemWise }),
    [drillToItemWise]
  );
  const itemHeaders = useMemo(() => buildShortageItemWiseHeaders(), []);
  const HEADERS = isMasterTab ? masterHeaders : itemHeaders;

  const handleSort = useCallback(
    (key) => {
      if (isMasterTab) {
        setMasterDisplayLimit(100);
        setParams((p) => ({
          ...p,
          sortKey: key,
          sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
        }));
        return;
      }
      setItemDisplayLimit(100);
      handleItemSort(key);
    },
    [isMasterTab, handleItemSort, setParams]
  );

  const handleLoadMore = useCallback(() => {
    if (tableLoading || tableRows.length >= tableTotal) return;
    if (isMasterTab) {
      setMasterDisplayLimit((n) => n + 100);
    } else {
      setItemDisplayLimit((n) => n + 100);
    }
  }, [tableLoading, tableRows.length, tableTotal, isMasterTab]);

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isMasterTab ? "Shortage Master" : "Shortage",
    rows: isMasterTab ? masterFilteredRows : itemFilteredRows,
    headers: HEADERS,
  });

  const onSaved = () => {
    refreshAll();
    setSelected(null);
  };

  const drillBannerText = useMemo(() => {
    if (!itemWiseItemdcodeFilter) return "";
    const code = String(itemWiseItemdcodeFilter).trim();
    const hit = masterRows.find((r) => String(r.itemdcode).trim() === code) || allRows.find((r) => String(r.itemdcode).trim() === code);
    const label = hit?.item_code || hit?.itemcode || itemWiseItemdcodeFilter;
    const month = formatShortageMonthDate(params.fromDate || params.toDate);
    return month !== "—" ? `${label} · ${month}` : label;
  }, [itemWiseItemdcodeFilter, masterRows, allRows, params.fromDate, params.toDate]);

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                active={pageTab}
                onChange={(id) => {
                  setPageTab(id);
                  setSelected(null);
                  if (id === "master") setItemWiseItemdcodeFilter(null);
                  setParams((prev) => ({
                    ...prev,
                    sortKey: id === "master" ? "year_month" : "id",
                    sortDir: "desc",
                  }));
                }}
                tabs={SHORTAGE_PAGE_TABS}
              />
            }
            actions={
              <>
                <ActionButton module="shortage" action="add" label="New" icon={Plus} onClick={openNewModal} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" />
                {canBulkImport ? (
                  <ShortageBulkImport
                    onOpenChange={setBulkImportOpen}
                    onSuccess={() => {
                      refreshAll();
                      setSelected(null);
                    }}
                  />
                ) : null}
                <ActionButton
                  module="shortage"
                  action="edit"
                  variant="outline"
                  label="Edit"
                  icon={Edit3}
                  disabled={isMasterTab || !selected}
                  record={isMasterTab ? null : selectedRecord}
                  onClick={openEditModal}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <ActionButton
                  module="shortage"
                  action="authorize"
                  variant="outline"
                  label="Approve"
                  icon={CheckCircle}
                  disabled={isMasterTab || !selected}
                  onClick={() => {
                    setEditItem(selectedRecord);
                    setModalMode("approve");
                    setModalOpen(true);
                  }}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
                />
                <ActionButton
                  module="shortage"
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={isMasterTab || !selected}
                  onClick={() => setDeleteItem(selectedRecord)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                <button onClick={refreshAll} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase shadow-none shrink-0">
                  <RefreshCcw size={14} className={tableLoading ? "animate-spin" : ""} />
                </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle viewMode={viewMode} setMode={handleViewMode} exporting={exporting} disabled={tableLoading || exportDisabled} onExport={handleExport} />
            }
          />

          {!isMasterTab && itemWiseItemdcodeFilter ? (
            <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-50 border border-cyan-100">
              <span className="text-[10px] font-bold text-cyan-800 uppercase flex items-center gap-2">
                <Info size={12} /> Item-wise entries for {drillBannerText}
              </span>
              <button
                type="button"
                onClick={() => setItemWiseItemdcodeFilter(null)}
                className="text-cyan-600 hover:text-cyan-800 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Show all entries
              </button>
            </div>
          ) : null}

          {!isMasterTab && selected ? (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">
                Selected: {selectedRecord?.item_code || selectedRecord?.itemcode || selectedRecord?.id}
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          ) : null}
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
            searchPlaceholder={isMasterTab ? "Search item, group..." : "Search item, type..."}
            searchLabel={isMasterTab ? "Search Master" : "Search Shortage"}
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={tableRows}
            loading={tableLoading}
            viewMode={viewMode}
            allowCopy
            {...(isMasterTab ? {} : tableHotkeyProps)}
            showSelection={!isMasterTab}
            skeletonCount={params.pageSize || 100}
            emptyIcon={AlertTriangle}
            sortKey={params.sortKey ?? ""}
            sortDir={params.sortDir}
            onSort={handleSort}
            selectedId={isMasterTab ? null : selected}
            onSelect={isMasterTab ? undefined : setSelected}
            getRowId={(row) => row.id}
            onLoadMore={handleLoadMore}
            hasMore={tableRows.length < tableTotal}
            totalItems={tableTotal}
            cardConfig={
              isMasterTab
                ? { titleKey: "item_code", badgeIndices: [4, 6], detailIndices: [3, 7, 8], footerKey: "entry_count" }
                : { titleKey: "item_code", badgeIndices: [3, 7], detailIndices: [4, 5, 6], footerKey: "created_at" }
            }
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {tableRows.length} of {tableTotal} {isMasterTab ? "Items" : "Shortage Records"}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              {isMasterTab ? "Master Aggregate" : "Entry Snapshot"}
            </span>
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
