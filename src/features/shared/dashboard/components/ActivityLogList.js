"use client";
import React, { useEffect, useState, useCallback } from "react";
import { activityLogService } from "../../services/activityLogService";
import { Clock, User, Box, Activity, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Search, Calendar, Filter, X, RefreshCcw } from "lucide-react";
import dayjs from "dayjs";
import { formatActivityLogValue, getActivityLogSections } from "@/core/utils/activityLogDisplay";

export default function ActivityLogList({ appType = null, title = "Recent Activity" }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, limit: 15 });
  const [expandedLog, setExpandedLog] = useState(null);
  
  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async (page = 1, limit = pagination.limit) => {
    setLoading(true);
    try {
      const response = await activityLogService.getLogs({
        app_type: appType,
        page,
        limit,
        all_users: "true",
        search: search || undefined,
        date_from: dateFrom ? `${dateFrom} 00:00:00` : undefined,
        date_to: dateTo ? `${dateTo} 23:59:59` : undefined,
      });
      if (response.success) {
        setLogs(response.data);
        setPagination({
          page: response.pagination.page,
          pages: response.pagination.pages,
          limit: response.pagination.limit
        });
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  }, [appType, search, dateFrom, dateTo, pagination.limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs(1);
    }, 500); // Debounce search
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const handleReset = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    fetchLogs(1);
  };

  const getActionColor = (action) => {
    switch (action) {
      case "CREATE": return "text-green-600 bg-green-50 border-green-100";
      case "UPDATE": return "text-blue-600 bg-blue-50 border-blue-100";
      case "DELETE": return "text-red-600 bg-red-50 border-red-100";
      case "APPROVE": return "text-amber-600 bg-amber-50 border-amber-100";
      default: return "text-slate-600 bg-slate-50 border-slate-100";
    }
  };

  const toggleExpand = (id) => {
    setExpandedLog(expandedLog === id ? null : id);
  };

  const renderLogData = (data) => {
    const sections = getActivityLogSections(data);
    if (!sections.length) return null;

    return (
      <div className="mt-3 space-y-3">
        {sections.map((section) => (
          <div key={section.title} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/30">
            <div className="px-3 py-1.5 bg-slate-100/80 border-b border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {section.title}
              </span>
            </div>
            <div className="p-3">
              {section.kind === "updated_fields" && Array.isArray(section.data) ? (
                <div className="flex flex-wrap gap-1.5">
                  {section.data.map((field) => (
                    <span key={field} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-semibold uppercase">
                      {String(field)}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  {Object.entries(section.data || {}).map(([key, value]) => (
                    <div key={`${section.title}-${key}`} className="flex flex-col min-w-0">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate mb-0.5">
                        {key.replace(/_/g, " ")}
                      </span>
                      <div className="text-[12px] text-slate-700 font-medium break-words leading-relaxed">
                        {formatActivityLogValue(value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading && pagination.page === 1 && logs.length === 0) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 w-full bg-slate-100 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Activity size={20} className="text-blue-600" />
          {title}
        </h2>
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-xl border transition-all ${showFilters ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            title="Filters"
          >
            <Filter size={18} />
          </button>
          
          <button
            onClick={() => fetchLogs(pagination.page)}
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all"
            title="Refresh"
          >
            <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">From Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">To Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-rose-600 transition-colors"
            >
              <X size={16} />
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Logs List */}
      <div className="space-y-3 relative">
        {loading && logs.length > 0 && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-2xl">
            <RefreshCcw className="animate-spin text-blue-500" size={32} />
          </div>
        )}

        {logs.length === 0 && !loading ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">No activity logs found matching your criteria.</p>
            {(search || dateFrom || dateTo) && (
              <button onClick={handleReset} className="mt-4 text-blue-600 hover:underline text-sm font-semibold">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className={`group bg-white p-4 rounded-2xl border transition-all ${
                expandedLog === log.id ? "border-blue-300 shadow-md ring-4 ring-blue-50" : "border-slate-200 hover:border-blue-200 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`mt-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getActionColor(log.action_type)}`}>
                  {log.action_type}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-bold text-slate-800 leading-snug capitalize">
                      {log.description.toLowerCase()}
                    </p>
                    <button 
                      onClick={() => toggleExpand(log.id)}
                      className={`p-1.5 rounded-lg transition-all ${expandedLog === log.id ? "bg-blue-600 text-white" : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"}`}
                    >
                      {expandedLog === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                      <Clock size={12} className="text-slate-400" />
                      {dayjs(log.created_at).format("MMM D, YYYY • h:mm A")}
                    </span>
                    <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                      <User size={12} className="text-slate-400" />
                      {log.user_name || "System"}
                    </span>
                    <span className="flex items-center gap-1 capitalize bg-slate-100 px-2 py-0.5 rounded-md">
                      <Box size={12} className="text-slate-400" />
                      {log.app_type} • {log.module}
                    </span>
                  </div>

                  {expandedLog === log.id && renderLogData(log.log_data)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 0 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Show</span>
            <select
              value={pagination.limit}
              onChange={(e) => fetchLogs(1, parseInt(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {[15, 30, 50, 100].map(size => (
                <option key={size} value={size}>{size} rows</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs(pagination.page - 1)}
              disabled={pagination.page === 1 || loading}
              className="p-2 text-slate-600 disabled:opacity-30 hover:bg-slate-50 rounded-xl transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.pages) }).map((_, i) => {
                let pageNum;
                if (pagination.pages <= 5) pageNum = i + 1;
                else if (pagination.page <= 3) pageNum = i + 1;
                else if (pagination.page >= pagination.pages - 2) pageNum = pagination.pages - 4 + i;
                else pageNum = pagination.page - 2 + i;

                return (
                  <button
                    key={pageNum}
                    onClick={() => fetchLogs(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm transition-all ${
                      pagination.page === pageNum ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => fetchLogs(pagination.page + 1)}
              disabled={pagination.page === pagination.pages || loading}
              className="p-2 text-slate-600 disabled:opacity-30 hover:bg-slate-50 rounded-xl transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Page {pagination.page} of {pagination.pages}
          </div>
        </div>
      )}
    </div>
  );
}
