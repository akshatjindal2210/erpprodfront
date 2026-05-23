"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCcw, Activity, Globe, Clock, ShieldCheck, User, Layers, Info, X } from "lucide-react";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import { useViewDateFilterDefaults } from "@/helpers/dateFilterDefaults";

import { logService } from "@/services/log";
import { useViewMode } from "@/hooks/useViewMode";

// Components
import DataTable from "@/components/ui/DataTable";
import DateRangeFilter from "@/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/components/common/ListPageFilterStrip";
import ViewToggle from "@/components/ui/ViewToggle";
import { useCanAccess } from "@/hooks/useCanAccess";
import { formatDateTime } from "@/helpers/utilHelper";

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
    pageSize: 500, // Increased to 500 for massive data loading
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

  const fetchLogs = useCallback(async (isLoadMore = false) => {
    const append = isLoadMore === true;
    if (!append) setLoading(true);
    try {
      const currentPage = append ? params.page + 1 : 1;
      const apiParams = {
        page: currentPage,
        limit: params.pageSize,
        sortBy: params.sortKey,
        order: params.sortDir.toUpperCase(),
        search: params.search || undefined,
        filters: {
          fromDate: params.fromDate ? `${params.fromDate} 00:00:00` : undefined,
          toDate: params.toDate ? `${params.toDate} 23:59:59` : undefined,
        }
      };

      const body = await logService.getAll(apiParams);
      const newItems = body.data ?? [];

      if (append) {
        setItems(prev => [...prev, ...newItems]);
        setParams(prev => ({ ...prev, page: currentPage }));
      } else {
        setItems(newItems);
        setParams(prev => ({ ...prev, page: 1 }));
      }
      setTotalItems(body.total ?? 0);
    } catch (err) {
      toast.error(err?.message || "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, params.page]);

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

    ["Action", "action", (v) => {
        const colors = {
          login: "bg-emerald-50 text-emerald-600 border-emerald-100",
          logout: "bg-amber-50 text-amber-600 border-amber-100",
          update: "bg-blue-50 text-blue-600 border-blue-100",
          delete: "bg-rose-50 text-rose-600 border-rose-100",
          create: "bg-indigo-50 text-indigo-600 border-indigo-100",
        };
        const cls = colors[v?.toLowerCase()] || "bg-slate-50 text-slate-600 border-slate-100";
        return (
          <span className={`px-2 py-0.5 border text-[9px] font-black uppercase tracking-widest ${cls}`}>
            {v}
          </span>
        );
      }, { width: '100px', align: 'center' }
    ],

    ["Module / Entity", "entity", (v, row) => (
        <div className="flex flex-col leading-tight min-w-[140px]">
          <div className="flex items-center gap-1 text-slate-700">
            <Layers size={10} />
            <span className="font-bold capitalize text-[11px]">{v?.replace('_', ' ')}</span>
          </div>
          <span className="text-[9px] text-indigo-500 font-mono ml-3">REF: {row.entity_id || 'N/A'}</span>
        </div>
      ), { width: '180px' }
    ],

    ["Details", "details", (v) => {
        const details = v?.updated_fields || v?.details || v;
        
        if (!details || (typeof details === 'object' && Object.keys(details).length === 0)) {
          return (
            <div className="flex items-center gap-1 text-slate-400 italic text-[10px]">
              <Info size={10} />
              <span>Generic system action</span>
            </div>
          );
        }

        // Handle Array of field names
        if (Array.isArray(details)) {
          return (
            <div className="flex flex-wrap gap-1 py-1">
              {details.map(f => (
                <span key={f} className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 border border-indigo-100 uppercase font-bold">
                  {f}
                </span>
              ))}
            </div>
          );
        }

        // Handle Object with key-value pairs
        if (typeof details === 'object') {
          return (
            <div className="flex flex-wrap gap-1 py-1">
              {Object.entries(details).map(([key, value]) => {
                // Skip internal fields that aren't useful for display
                if (['updated_at', 'updated_by', 'approved_at', 'approved_by', 'success'].includes(key)) return null;
                
                return (
                  <div key={key} className="flex flex-col bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-sm min-w-[60px] max-w-full">
                    <span className="text-[7px] text-slate-400 uppercase font-black leading-none mb-0.5">{key.replace('_', ' ')}</span>
                    <span className="text-[9px] text-slate-700 font-bold break-words whitespace-pre-wrap">
                      {String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }

        return <span className="text-[10px] text-slate-600">{String(details)}</span>;
      }, { width: '350px' }
    ],

    ["Connectivity", "ip_address", (v) => (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1 text-slate-500 font-mono text-[10px]">
            <Globe size={10} className="text-slate-300" /> {v || '0.0.0.0'}
          </div>
          <span className="text-[8px] text-slate-400 uppercase font-medium ml-3 truncate max-w-[100px]">
            Cloud Client
          </span>
        </div>
      ), { width: '140px' }
    ],

    [
        "User Name",
        "user_name",
        (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>,
        {
          width: "110px",
          copyValue: (row) => row.user_name || "System",
        },
      ],
      [
        "Created At",
        "created_at",
        (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>,
        {
          width: "150px",
          align: "right",
          copyValue: (row) => formatDateTime(row.created_at) || "—",
        },
      ],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        {/* TOP BAR / AUDIT HEADER */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            <div className="flex items-center gap-2">
              
              <div className="w-px h-6 bg-slate-200 mx-2" />

              <button 
                type="button"
                onClick={() => fetchLogs(false)}
                disabled={loading}
                className="h-8 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-600">
                    <RefreshCcw size={14} className="shrink-0 animate-spin text-indigo-600" aria-hidden />
                  </span>
                ) : (
                  <RefreshCcw size={14} className="shrink-0" aria-hidden />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
               <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-8" />
            </div>
          </div>
        </div>

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
            searchPlaceholder="Search by User, Module, Action or IP..."
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
              badgeIndices: [2], 
              detailIndices: [3, 4, 5], 
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