"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCcw, Activity } from "lucide-react";
import { toast } from "react-toastify";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";

import { activityLogService } from "@/common/services/activityLogService";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_DATE, IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import DataTable from "@/ui/primitives/DataTable";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import RmStoreListFooter from "@/apps/rmstore/lib/helpers/RmStoreListFooter";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { formatActivityLogValue, getActivityLogSections, getActivityLogMoreSections, hasActivityLogDetails, formatActivityLogActionLabel, getActivityLogActionBadgeClass } from "@/platform/utils/core/activityLogDisplay";
import ActivityLogModuleEntityCell from "@/ui/common/list/ActivityLogModuleEntityCell";

const MODULE = "rm_activity_logs";

export default function ActivityLogPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [tempSearch, setTempSearch] = useState("");
  const [expandedLogId, setExpandedLogId] = useState(null);

  const [params, setParams] = useState({
    page: 1,
    pageSize: 100,
    search: "",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "created_at",
    sortDir: "desc",
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setParams((prev) => ({ ...prev, search: tempSearch, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [tempSearch]);

  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setParams((prev) => ({
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to,
      }));
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const fetchLogs = useCallback(async (isLoadMore = false) => {
    const append = isLoadMore === true;
    if (!append) setLoading(true);
    try {
      const currentPage = append ? params.page + 1 : 1;

      const response = await activityLogService.getLogs({
        app_type: "rmstore",
        page: currentPage,
        limit: params.pageSize,
        search: params.search || undefined,
        date_from: params.fromDate ? `${params.fromDate} 00:00:00` : undefined,
        date_to: params.toDate ? `${params.toDate} 23:59:59` : undefined,
        all_users: "true",
      });

      if (response.success) {
        const newItems = response.data ?? [];
        if (append) {
          setItems((prev) => [...prev, ...newItems]);
          setParams((prev) => ({ ...prev, page: currentPage }));
        } else {
          setItems(newItems);
          setParams((prev) => ({ ...prev, page: 1 }));
        }
        setTotalItems(response.pagination?.total ?? 0);
      }
    } catch (err) {
      toast.error(err?.message || "Could not load the activity logs. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.search, params.fromDate, params.toDate, params.page]);

  useEffect(() => {
    void fetchLogs(false);
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, fetchLogs]);

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      void fetchLogs(true);
    }
  }, [loading, items.length, totalItems, fetchLogs]);

  const handleSearch = (data) => {
    setParams((prev) => ({ ...prev, page: 1, search: tempSearch, fromDate: data.fromDate, toDate: data.toDate }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams((prev) => ({ ...prev, page: 1, search: "", fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to }));
  };

  const HEADERS = [
    ["#", "id", (_v, _row, i) => <span className={IMS_TABLE_CELL_TEXT}>{i + 1}</span>, { fixed: true, width: "50px", align: "center" }],
    ["Action", "action_type", (v) => {
      const cls = getActivityLogActionBadgeClass(v);
      return (
        <span className={`px-2 py-0.5 border text-[9px] font-black uppercase tracking-widest ${cls}`}>
          {formatActivityLogActionLabel(v)}
        </span>
      );
    }, { width: "100px", align: "center" }],
    ["Module / Entity", "module", (_v, row) => (
      <ActivityLogModuleEntityCell row={row} appType="rmstore" />
    ), { width: "180px" }],
    ["Details", "log_data", (v, row) => {
      const isOpen = expandedLogId === row.id;
      const hasDetails = hasActivityLogDetails(v);
      const sections = isOpen ? [...getActivityLogSections(v), ...getActivityLogMoreSections(v)] : [];

      const renderSection = (section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500">
            {section.title}
          </span>
          <div className="flex flex-wrap gap-1">
            {Object.entries(section.data || {}).map(([key, value]) => (
              <div
                key={`${section.title}-${key}`}
                className="flex flex-col bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-sm min-w-[60px] max-w-full"
              >
                <span className="text-[7px] text-slate-400 uppercase font-black leading-none mb-0.5">
                  {key}
                </span>
                <span className="text-[9px] text-slate-700 font-bold break-words whitespace-pre-wrap">
                  {formatActivityLogValue(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

      return (
        <div className="flex flex-col gap-1 py-1">
          <span className={IMS_TABLE_CELL_TEXT}>{row.description}</span>
          {hasDetails ? (
            <button
              type="button"
              onClick={() => setExpandedLogId(isOpen ? null : row.id)}
              className="self-start text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wide"
            >
              {isOpen ? "Hide details" : "View details"}
            </button>
          ) : (
            <span className="text-[10px] text-slate-400 italic">No extra details</span>
          )}
          {isOpen && sections.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1">{sections.map(renderSection)}</div>
          )}
        </div>
      );
    }, { width: "350px" }],
    ["Created By", "user_name", (v) => <span className={IMS_TABLE_CELL_TEXT}>{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className={IMS_TABLE_CELL_DATE}>{v ? formatDateTime(v) : "—"}</span>, { width: "150px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "RM Store Activity Log",
    rows: items,
    headers: HEADERS,
    onExport: async () => {
      try {
        const response = await activityLogService.getLogs({
          app_type: "rmstore",
          page: 1,
          limit: 100000,
          isExport: "true",
          search: params.search || undefined,
          date_from: params.fromDate ? `${params.fromDate} 00:00:00` : undefined,
          date_to: params.toDate ? `${params.toDate} 23:59:59` : undefined,
          all_users: "true",
        });
        return response.data || [];
      } catch (_err) {
        toast.error("Could not load the data for export. Please try again.");
        return [];
      }
    },
  });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={(
              <button
                type="button"
                onClick={() => void fetchLogs(false)}
                disabled={loading}
                className="h-9 shrink-0 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60 touch-manipulation"
                aria-label="Refresh"
              >
                {loading ? (
                  <RefreshCcw size={14} className="shrink-0 animate-spin text-indigo-600" aria-hidden />
                ) : (
                  <RefreshCcw size={14} className="shrink-0" aria-hidden />
                )}
              </button>
            )}
            viewToggle={(
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={loading || exportDisabled}
                onExport={handleExport}
              />
            )}
          />
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate}
            toDate={params.toDate}
            onApply={handleSearch}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search by user, module, or action"
            searchLabel="Filter Logs"
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
            onSort={(key) => setParams((p) => ({
              ...p,
              sortKey: key,
              sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              page: 1,
            }))}
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            showSelection={false}
            idKey="id"
            emptyIcon={Activity}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{
              titleKey: "user_name",
              badgeIndices: [1],
              detailIndices: [2, 3, 4],
              footerKey: "created_at",
              className: "rounded-none border border-slate-200 shadow-none",
            }}
          />
        </div>

        <RmStoreListFooter
          shown={items.length}
          total={totalItems}
          label="Activity Logs"
          isFiltered={Boolean(String(params.search || "").trim())}
          showLive={false}
        />
      </div>
    </div>
  );
}
