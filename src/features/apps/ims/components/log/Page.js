"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCcw, Activity, Globe, Clock, Shield, User, Layers, X } from "lucide-react";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";

import { activityLogService } from "@/features/shared/services/activityLogService";
import { useViewMode } from "@/core/hooks/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";

// Components
import DataTable from "@/core/components/ui/DataTable";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { formatDateTime } from "@/core/utils/utilHelper";
import {
  formatActivityLogValue,
  getActivityLogSections,
  getActivityLogMoreSections,
  hasActivityLogDetails,
} from "@/core/utils/activityLogDisplay";

export default function LogsPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("activity_logs", "view"), [canAccess]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  // Unified Params State
  const [params, setParams] = useState({
    page: 1,
    pageSize: 50,
    search: "",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "created_at",
    sortDir: "desc"
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
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = useCallback(async (isLoadMore = false) => {
    const append = isLoadMore === true;
    if (!append) setLoading(true);
    try {
      const currentPage = append ? params.page + 1 : 1;
      
      const response = await activityLogService.getLogs({
        app_type: "ims",
        page: currentPage,
        limit: params.pageSize,
        search: params.search || undefined,
        date_from: params.fromDate ? `${params.fromDate} 00:00:00` : undefined,
        date_to: params.toDate ? `${params.toDate} 23:59:59` : undefined,
        all_users: "true"
      });

      if (response.success) {
        const newItems = response.data ?? [];
        if (append) {
          setItems(prev => [...prev, ...newItems]);
          setParams(prev => ({ ...prev, page: currentPage }));
        } else {
          setItems(newItems);
          setParams(prev => ({ ...prev, page: 1 }));
        }
        setTotalItems(response.pagination?.total ?? 0);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.search, params.fromDate, params.toDate, params.page]);

  useEffect(() => { 
    fetchLogs(false); 
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate]);

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      fetchLogs(true);
    }
  }, [loading, items.length, totalItems, fetchLogs]);

  const handleSearch = (data) => {
    setParams(prev => ({ ...prev, page: 1, search: tempSearch, fromDate: data.fromDate, toDate: data.toDate }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams(prev => ({ ...prev, page: 1, search: "", fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to }));
  };

  const HEADERS = [
    ["#", "id", (v, row, i) => i + 1, { fixed: true, width: '50px', align: 'center'}],

    ["Action", "action_type", (v) => {
        const colors = {
          CREATE: "bg-indigo-50 text-indigo-600 border-indigo-100",
          UPDATE: "bg-blue-50 text-blue-600 border-blue-100",
          DELETE: "bg-rose-50 text-rose-600 border-rose-100",
          APPROVE: "bg-emerald-50 text-emerald-600 border-emerald-100",
        };
        const cls = colors[v] || "bg-slate-50 text-slate-600 border-slate-100";
        return (
          <span className={`px-2 py-0.5 border text-[9px] font-black uppercase tracking-widest ${cls}`}>
            {v}
          </span>
        );
      }, { width: '100px', align: 'center' }
    ],

    ["Module / Entity", "module", (v, row) => (
        <div className="flex flex-col leading-tight min-w-[140px]">
          <div className="flex items-center gap-1 text-slate-700">
            <Layers size={10} />
            <span className="font-bold capitalize text-[11px]">{v?.replace(/_/g, ' ')}</span>
          </div>
          <span className="text-[9px] text-indigo-500 font-mono ml-3">REF: {row.entity_id || '—'}</span>
        </div>
      ), { width: '180px' }
    ],

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
            <span className="text-[11px] text-slate-700 font-medium">{row.description}</span>
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
      }, { width: '350px' }
    ],

    ["Created By", "user_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Activity Log",
    rows: items,
    headers: HEADERS,
  });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
              <button 
                type="button"
                onClick={() => fetchLogs(false)}
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
        </ListPageToolbar>

        {/* SEARCH BAR AREA */}
        <ListPageFilterStrip>
          <DateRangeFilter 
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate} 
            toDate={params.toDate} 
            onApply={handleSearch} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search by User, Module, Action..."
            searchLabel="Filter Logs"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        {/* DATA TABLE AREA */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            onSort={(key) => setParams(p => ({ 
                ...p, 
                sortKey: key, 
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc", 
                page: 1 
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
              className: "rounded-none border border-slate-200 shadow-none"
            }}
          />
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Activity Logs
          </span>
        </div>
      </div>
    </div>
  );
}
