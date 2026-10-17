"use client";

import { useState, useCallback, useMemo, useEffect, useDeferredValue, useRef } from "react";
import { AlertTriangle, RefreshCcw, CheckCircle, Undo2 } from "lucide-react";
import ActionButton from "@/ui/primitives/ActionButton";
import AppListFooter, { ListPageFooterContextStrip } from "@/ui/common/list/listPageFooter";
import { imsSelectionLabel } from "@/apps/ims/lib/imsSelectionLabel";
import { toast } from "react-toastify";
import dayjs from "dayjs";

import { shortageService, SHORTAGE_LIST_TYPES } from "@/apps/production/lib/services/shortage";
import { PRODUCTION_GROUP_NAME } from "@/apps/production/lib/config/groupFilter";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { useCrudList } from "@/apps/production/lib/crud/useCrudList";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import DataTable from "@/ui/primitives/DataTable";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { SCHEDULE_REPORT_FILTER, SCHEDULE_REPORT_FILTER_OPTIONS, MONTH_FILTER_OPTIONS } from "@/apps/production/lib/config/reportFilters";
import { getSelectedFinancialYear } from "@/platform/utils/global/financialYear";
import { resolveShortageListDateRange } from "@/platform/utils/core/indianFinancialYear";
import PrimeItemTab from "@/apps/production/modules/shortage/PrimeItemTab";
import { SHORTAGE_PAGE_TABS, buildShortageMasterHeaders, buildShortageItemWiseHeaders, formatShortageMonthDate, shortageYearMonthKey, shortageMasterSearchParts, shortageItemWiseSearchParts } from "@/apps/production/modules/shortage/shortageColumns";

const TYPE_FILTER_OPTIONS = [
  { label: "All Types", value: "all" },
  ...SHORTAGE_LIST_TYPES.map((t) => ({ label: t, value: t })),
];

const STATUS_FILTER_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Authorized", value: "approved" },
  { label: "Pending", value: "pending" },
];

const DEFAULT_PAGE_TAB = "prime-item";
const DEFAULT_ITEM_WISE_STATUS = "pending";
const MASTER_STATUS = "approved";

const buildShortageListFilters = (params, viewBounds = {}, groupName = null) => {
  const { from, to } = resolveShortageListDateRange(params, getSelectedFinancialYear().name, viewBounds);
  const grpname = String(groupName || "").trim();
  return {
    ...(params.type !== "all" && { type: params.type }),
    ...(params.status === "approved" && { approved: true }),
    ...(params.status === "pending" && { approved: false }),
    ...(from && { from_date: `${from} 00:00:00` }),
    ...(to && { to_date: `${to} 23:59:59` }),
    ...(grpname && { grpname }),
  };
};

export default function ShortagePage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("production_shortage", "view"), [canAccess]);
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);
  const [viewMode, handleViewMode] = useViewMode();
  const [pageTab, setPageTab] = useState(DEFAULT_PAGE_TAB);
  const [itemWiseItemdcodeFilter, setItemWiseItemdcodeFilter] = useState(null);
  const [draftReportType, setDraftReportType] = useState(SCHEDULE_REPORT_FILTER.DEFAULT);
  const [selected, setSelected] = useState(null);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterRows, setMasterRows] = useState([]);
  const [masterDisplayLimit, setMasterDisplayLimit] = useState(100);

  const isMasterTab = pageTab === "master";
  // Prime Item tab owns its own data / filters; the toolbar refresh bumps this key.
  const isPrimeTab = pageTab === "prime-item";
  const [primeRefreshKey, setPrimeRefreshKey] = useState(0);
  // Prime Item tab mounts on first open; already open when it is the default tab (else the page stays blank).
  const [primeOpened, setPrimeOpened] = useState(DEFAULT_PAGE_TAB === "prime-item");
  const primeTabRef = useRef(null);
  const [primeSelection, setPrimeSelection] = useState({ row: null, status: "pending" });

  const viewDateBounds = useMemo(
    () => ({ minDate: dateFilterDefaults.minDate, maxDate: dateFilterDefaults.maxDate }),
    [dateFilterDefaults.minDate, dateFilterDefaults.maxDate]
  );

  const shortageBuildFilters = useCallback(
    (listParams) => buildShortageListFilters(listParams, viewDateBounds, PRODUCTION_GROUP_NAME),
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
  } = useCrudList({
    service: shortageService,
    buildFilters: shortageBuildFilters,
    errorMessage: "Failed to load shortage records",
    extraParams: {
      type: "all",
      status: DEFAULT_ITEM_WISE_STATUS,
      reportType: SCHEDULE_REPORT_FILTER.DEFAULT,
      fromDate: "",
      toDate: "",
      month: "all",
    },
  });

  const deferredSearch = useDeferredValue(tempSearch);

  const fetchMasterRows = useCallback(async () => {
    setMasterLoading(true);
    try {
      // Master aggregate counts only authorized (approved) shortage entries.
      const filters = shortageBuildFilters({ ...params, status: MASTER_STATUS });
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
    if (isPrimeTab) {
      setPrimeRefreshKey((k) => k + 1);
      return;
    }
    fetchRows();
    void fetchMasterRows();
  }, [isPrimeTab, fetchRows, fetchMasterRows]);

  const isCustomReport = String(draftReportType) === SCHEDULE_REPORT_FILTER.CUSTOM;

  const handleReset = () => {
    setTempSearch("");
    setDraftReportType(SCHEDULE_REPORT_FILTER.DEFAULT);
    setItemWiseItemdcodeFilter(null);
    setPageTab(DEFAULT_PAGE_TAB);
    setSelected(null);
    setParams((prev) => ({
      ...prev,
      type: "all",
      status: DEFAULT_ITEM_WISE_STATUS,
      reportType: SCHEDULE_REPORT_FILTER.DEFAULT,
      fromDate: "",
      toDate: "",
      month: "all",
      sortKey: "year_month",
      sortDir: "desc",
    }));
  };

  const extraFilters = useMemo(() => {
    const filters = [
      { label: "Type", key: "typeFilter", value: params.type, options: TYPE_FILTER_OPTIONS },
      { label: "Report", key: "reportType", value: draftReportType, options: SCHEDULE_REPORT_FILTER_OPTIONS, preserveOrder: false },
    ];
    if (!isMasterTab) {
      filters.splice(1, 0, {
        label: "Status",
        key: "approvedStatus",
        value: params.status,
        options: STATUS_FILTER_OPTIONS,
      });
    }
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
  }, [params.type, params.status, params.month, draftReportType, isCustomReport, isMasterTab]);

  const extraFiltersBeforeDate = useMemo(() => {
    const keys = isMasterTab ? ["typeFilter", "reportType"] : ["typeFilter", "approvedStatus", "reportType"];
    if (isCustomReport) keys.push("month");
    return keys;
  }, [isCustomReport, isMasterTab]);

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
        status: MASTER_STATUS,
        sortKey: "id",
        sortDir: "desc",
      }));
    }
    setPageTab("item-wise");
    setSelected(null);
  }, [setParams]);

  const lockedGroup = PRODUCTION_GROUP_NAME.toLowerCase();

  const masterFilteredRows = useMemo(() => {
    let data = lockedGroup
      ? masterRows.filter((row) => String(row?.grpname || "").trim().toLowerCase() === lockedGroup)
      : masterRows;
    if (String(deferredSearch || "").trim()) {
      data = applyClientSearch(data, deferredSearch, {
        getParts: shortageMasterSearchParts,
        skipSort: true,
      });
    }
    return sortRowsByKey(data, params.sortKey || "year_month", params.sortDir || "desc");
  }, [masterRows, deferredSearch, params.sortKey, params.sortDir, lockedGroup]);

  const masterItems = useMemo(
    () => masterFilteredRows.slice(0, masterDisplayLimit),
    [masterFilteredRows, masterDisplayLimit]
  );

  const itemFilteredRows = useMemo(() => {
    let data = lockedGroup
      ? allRows.filter((row) => String(row?.grpname || "").trim().toLowerCase() === lockedGroup)
      : allRows;
    if (itemWiseItemdcodeFilter) {
      const code = String(itemWiseItemdcodeFilter).trim();
      const ym = shortageYearMonthKey(params.fromDate || params.toDate);
      data = data.filter((row) => {
        if (String(row.itemdcode ?? "").trim() !== code) return false;
        return !ym || shortageYearMonthKey(row.month) === ym;
      });
    }
    if (String(deferredSearch || "").trim()) {
      data = applyClientSearch(data, deferredSearch, {
        getParts: shortageItemWiseSearchParts,
        skipSort: true,
      });
    }
    return sortRowsByKey(data, params.sortKey || "id", params.sortDir || "desc");
  }, [allRows, itemWiseItemdcodeFilter, params.fromDate, params.toDate, deferredSearch, params.sortKey, params.sortDir, lockedGroup]);

  const [itemDisplayLimit, setItemDisplayLimit] = useState(100);
  useEffect(() => {
    setItemDisplayLimit(100);
  }, [deferredSearch, pageTab, itemWiseItemdcodeFilter, params.type, params.status, params.reportType, params.month, params.fromDate, params.toDate]);

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
  const tableHotkeyProps = { hotkeysDisabled: true };

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

  // Prime Item tab sends its filtered rows + headers up (onDataChange) so the same Export button works there.
  const [primeData, setPrimeData] = useState({ rows: [], headers: [] });
  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isPrimeTab ? "Shortage Prime Item" : isMasterTab ? "Shortage Master" : "Shortage",
    rows: isPrimeTab ? primeData.rows : isMasterTab ? masterFilteredRows : itemFilteredRows,
    headers: isPrimeTab ? primeData.headers : HEADERS,
  });

  const drillBannerText = useMemo(() => {
    if (!itemWiseItemdcodeFilter) return "";
    const code = String(itemWiseItemdcodeFilter).trim();
    const hit = masterRows.find((r) => String(r.itemdcode).trim() === code) || allRows.find((r) => String(r.itemdcode).trim() === code);
    const label = hit?.item_code || hit?.itemcode || itemWiseItemdcodeFilter;
    const month = formatShortageMonthDate(params.fromDate || params.toDate);
    return month !== "—" ? `${label} · ${month}` : label;
  }, [itemWiseItemdcodeFilter, masterRows, allRows, params.fromDate, params.toDate]);

  const shortageFooterContext = useMemo(() => {
    if (isMasterTab || !itemWiseItemdcodeFilter) return null;
    return (
      <ListPageFooterContextStrip
        tone="cyan"
        onClear={() => setItemWiseItemdcodeFilter(null)}
        clearLabel="Show all entries"
      >
        {`Item-wise · ${drillBannerText}`}
      </ListPageFooterContextStrip>
    );
  }, [isMasterTab, itemWiseItemdcodeFilter, drillBannerText]);

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
                  // Prime Item has its own data — don't touch list params (that would re-fetch Master / Item-wise).
                  if (id === "prime-item") {
                    setPrimeOpened(true);
                    return;
                  }
                  if (id === "master") setItemWiseItemdcodeFilter(null);
                  setParams((prev) => ({
                    ...prev,
                    sortKey: id === "master" ? "year_month" : "id",
                    sortDir: "desc",
                    ...(id !== "master" ? { status: DEFAULT_ITEM_WISE_STATUS } : {}),
                  }));
                }}
                tabs={SHORTAGE_PAGE_TABS}
              />
            }
            actions={
              <>
                {/* Prime Item tab — select a pending row → one button → drawer: details, Approve / Reject, remark, Save. Hidden without authorize. */}
                {isPrimeTab && primeSelection.status === "pending" ? (
                  <ActionButton
                    module="production_shortage"
                    action="authorize"
                    variant="outline"
                    label="Approve / Reject"
                    icon={CheckCircle}
                    disabled={!primeSelection.row}
                    onClick={() => primeTabRef.current?.openAction("decide")}
                    className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
                  />
                ) : null}
                {isPrimeTab && primeSelection.status === "rejected" ? (
                  <ActionButton
                    module="production_shortage"
                    action="authorize"
                    variant="outline"
                    label="Move to Pending"
                    icon={Undo2}
                    disabled={!primeSelection.row}
                    onClick={() => primeTabRef.current?.openAction("reset")}
                    className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-amber-600 shadow-none shrink-0"
                  />
                ) : null}
                {isPrimeTab ? <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" /> : null}
                <button onClick={refreshAll} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase shadow-none shrink-0">
                  <RefreshCcw size={14} className={tableLoading ? "animate-spin" : ""} />
                </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle viewMode={viewMode} setMode={handleViewMode} exporting={exporting} disabled={(!isPrimeTab && tableLoading) || exportDisabled} onExport={handleExport} />
            }
          />

        </ListPageToolbar>

        {/* Mounted on first open, then only hidden — switching tabs back does not call the API again. */}
        {primeOpened ? (
          <div className={isPrimeTab ? "contents" : "hidden"}>
            <PrimeItemTab ref={primeTabRef} refreshKey={primeRefreshKey} active={isPrimeTab} viewMode={viewMode} onSelectionChange={setPrimeSelection} onDataChange={setPrimeData} />
          </div>
        ) : null}

        {isPrimeTab ? null : (
        <>
        <ListPageFilterStrip>
          <DateRangeFilter
            key={draftReportType}
            showDate={isCustomReport}
            fromDate={isCustomReport ? (params.fromDate ?? "") : ""}
            toDate={isCustomReport ? (params.toDate ?? "") : ""}
            extraFilters={extraFilters}
            extraFiltersBeforeDate={extraFiltersBeforeDate}
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
                ...(!isMasterTab ? { status: data.approvedStatus || prev.status } : {}),
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

        <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
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
                ? { titleKey: "item_code", badgeIndices: [4, 7], detailIndices: [3, 6, 8, 9], footerKey: "entry_count" }
                : { titleKey: "item_code", badgeIndices: [3, 8], detailIndices: [4, 5, 7], footerKey: "created_at" }
            }
          />
        </div>

        <AppListFooter
          shown={tableRows.length}
          total={tableTotal}
          noun={isMasterTab ? "Items" : "Shortage Records"}
          searchHint={isMasterTab ? "Master aggregate" : "Entry snapshot"}
          contextHint={shortageFooterContext}
          selected={!isMasterTab ? selected : null}
          selectedRecord={!isMasterTab ? selectedRecord : null}
          selectionLabel={imsSelectionLabel.shortage}
          onClearSelection={() => setSelected(null)}
        />
        </>
        )}
      </div>
    </div>
  );
}
