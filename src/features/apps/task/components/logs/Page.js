"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ScrollText, Activity, Loader2, Eye, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import { activityLogService } from "@/features/shared/services/activityLogService";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import StatCard          from "@/features/apps/task/components/common/StatCard";
import SearchBar         from "@/features/apps/task/components/common/SearchBar";
import Pagination        from "@/features/apps/task/components/common/Pagination";
import { FilterButtons, BulkActionBar } from "@/features/apps/task/components/common/CommonFilters";
import LogDetailModal    from "@/features/apps/task/components/logs/DetailModal";

// ── Badges ────────────────────────────────────────────────────────────────────
const ROLE_STYLE = {
  super_admin: "bg-violet-50 text-violet-700 border-violet-200",
  admin:       "bg-amber-50 text-amber-700 border-amber-200",
  user:        "bg-slate-100 text-slate-500 border-slate-200",
};
const ACTION_STYLE = {
  CREATE:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATE:    "bg-blue-50 text-blue-700 border-blue-200",
  MODIFY:  "bg-blue-50 text-blue-700 border-blue-200",
  DELETE: "bg-rose-50 text-rose-600 border-rose-200",
  APPROVE: "bg-indigo-50 text-indigo-700 border-indigo-200",
};
const ROLE_LABEL = { super_admin: "Super Admin", admin: "Admin", user: "User" };

const SortIcon = ({ sortKey, k, sortDir }) => {
  if (sortKey !== k) return <span className="ml-1 text-xs text-slate-300">↕</span>;
  return <span className="ml-1 text-xs text-violet-500">{sortDir === "asc" ? "↑" : "↓"}</span>;
};

const PAGE_SIZES = [5, 10, 25, 50];

export default function LogsPage() {
  const canAccess = useCanAccess();
  const canView   = canAccess("activity_logs", "view").allowed;

  // ── Data ──────────────────────────────────────────────────────────────────
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState("");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(10);
  const [sortKey,     setSortKey]     = useState("created_at");
  const [sortDir,     setSortDir]     = useState("desc");
  const [showFilters, setShowFilters] = useState(false);

  // ── Selection + Modals ────────────────────────────────────────────────────
  const [selected,   setSelected]   = useState([]);
  const [viewItem,   setViewItem]   = useState(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await activityLogService.getLogs({
        app_type: "task",
        page,
        limit: pageSize,
        search: search || undefined,
        date_from: dateFrom ? `${dateFrom} 00:00:00` : undefined,
        date_to: dateTo ? `${dateTo} 23:59:59` : undefined,
        all_users: "true"
      });

      if (response.success) {
        setItems(response.data || []);
        setTotalItems(response.pagination?.total ?? 0);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, dateFrom, dateTo, sortKey, sortDir]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total:     totalItems,
      today:     items.filter(i => new Date(i.created_at).toDateString() === now.toDateString()).length,
      thisMonth: items.filter(i => {
        const d = new Date(i.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
    };
  }, [items, totalItems]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  // ── Selection ─────────────────────────────────────────────────────────────
  const allSelected = items.length > 0 && items.every(i => selected.includes(i.id));
  const toggleAll   = () => setSelected(allSelected
    ? selected.filter(id => !items.find(i => i.id === id))
    : [...new Set([...selected, ...items.map(i => i.id)])]);
  const toggleOne   = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const csv = [
      ["ID","User","Username","Action Type","Module","Description","Created At"],
      ...items.map(i => [
        i.id, i.user_name ?? `User #${i.user_id}`, i.user_username ?? "",
        i.action_type ?? "", i.module ?? "",
        i.description ?? "", i.created_at,
      ].map(v => `"${v ?? ""}"`).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "task_activity_logs.csv" }).click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setSearch(""); setDateFrom(""); setDateTo("");
    setPage(1); setSortKey("created_at"); setSortDir("desc");
    setShowFilters(false);
  };

  const hasActiveFilter = dateFrom !== "" || dateTo !== "";
  const totalPages      = Math.max(1, Math.ceil(totalItems / pageSize));

  const HEADERS = [
    ["#",           "id"],
    ["User",        "user_id"],
    ["Action Type", "action_type"],
    ["Module",      "module"],
    ["Description", "description"],
    ["Created At",  "created_at"],
  ];

  return (
    <div className="p-4 md:p-6 bg-slate-100 min-h-screen">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <span>Dashboard</span><span>/</span>
            <span className="text-slate-600 font-medium">Activity Logs</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Activity Logs</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <StatCard label="Total Logs"  value={stats.total}     icon={ScrollText} iconBg="bg-violet-50" iconText="text-violet-600" borderColor="border-violet-100" />
        <StatCard label="Today"       value={stats.today}     icon={Activity}   iconBg="bg-blue-50"   iconText="text-blue-500"   borderColor="border-blue-100"   />
        <StatCard label="This Month"  value={stats.thisMonth} icon={ScrollText} iconBg="bg-indigo-50" iconText="text-indigo-600" borderColor="border-indigo-100" />
      </div>

      {/* Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 space-y-3">

          {/* Row 1 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <SearchBar value={search}
                onChange={val => { setSearch(val); setPage(1); }}
                placeholder="Search action, module, user…" />
            </div>
            <FilterButtons
              showFilters={showFilters}
              onToggleFilters={() => setShowFilters(v => !v)}
              hasActiveFilter={hasActiveFilter}
              onExport={handleExport}
              onRefresh={fetchItems}
              onReset={handleReset}
              accentColor="violet"
            />
          </div>

          {/* Row 2 — Filter panel (custom for logs — date + order + pagesize) */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">

              {/* Date range */}
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Date:</span>
                <div className="flex items-center gap-2">
                  <input type="date" value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                    className="appearance-none bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
                  <span className="text-xs text-slate-400">to</span>
                  <input type="date" value={dateTo} min={dateFrom || undefined}
                    onChange={e => { setDateTo(e.target.value); setPage(1); }}
                    className="appearance-none bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
                </div>
              </div>

              <div className="h-5 w-px bg-slate-200 hidden sm:block" />

              {/* Sort order */}
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Sort:</span>
                <div className="flex gap-1">
                  {[{ value: "desc", label: "Newest" }, { value: "asc", label: "Oldest" }].map(s => (
                    <button key={s.value} onClick={() => { setSortDir(s.value); setPage(1); }}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                        sortDir === s.value
                          ? "bg-violet-600 border-violet-600 text-white font-medium"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-5 w-px bg-slate-200 hidden sm:block" />

              {/* Page size */}
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Show:</span>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="appearance-none bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all">
                  {PAGE_SIZES.map(s => <option key={s} value={s}>{s} per page</option>)}
                </select>
              </div>

              {hasActiveFilter && (
                <button onClick={handleReset}
                  className="ml-auto flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 font-medium transition-colors">
                  ✕ Clear filters
                </button>
              )}
            </div>
          )}

          {/* Row 3 — Bulk bar */}
          <BulkActionBar
            count={selected.length}
            onBulkDelete={() => {}} // Disabled for now as per requirements
            onClearSelection={() => setSelected([])}
            accentColor="violet"
            showDelete={false}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3.5 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="w-4 h-4 rounded border-slate-300 accent-violet-600 cursor-pointer" />
                </th>
                {HEADERS.map(([label, key]) => (
                  <th key={key} onClick={() => toggleSort(key)}
                    className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer select-none whitespace-nowrap hover:text-slate-600 transition-colors">
                    {label}<SortIcon sortKey={sortKey} k={key} sortDir={sortDir} />
                  </th>
                ))}
                <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-3.5 bg-slate-100 rounded-full animate-pulse"
                          style={{ width: `${50 + (i * j % 4) * 12}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <ScrollText size={24} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-medium">No logs found</p>
                      {hasActiveFilter && (
                        <button onClick={handleReset} className="text-xs text-violet-500 hover:underline">
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : items.map((item, i) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">

                  {/* Checkbox */}
                  <td className="px-4 py-3 w-10">
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleOne(item.id)}
                      className="w-4 h-4 rounded border-slate-300 accent-violet-600 cursor-pointer" />
                  </td>

                  {/* # */}
                  <td className="px-3 py-3 text-xs text-slate-400 font-medium">
                    {(page - 1) * pageSize + i + 1}
                  </td>

                  {/* User */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-violet-600">
                          {(item.user_name ?? "?")?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 leading-tight truncate">
                          {item.user_name ?? `User #${item.user_id}`}
                        </p>
                        {item.user_username && (
                          <p className="text-[11px] text-slate-400">@{item.user_username}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Action Type */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${ACTION_STYLE[item.action_type] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                      {item.action_type ?? "—"}
                    </span>
                  </td>

                  {/* Module */}
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 capitalize">
                      {item.module ?? "—"}
                    </span>
                  </td>

                  {/* Description */}
                  <td className="px-4 py-3 max-w-xs">
                    <span className="text-sm text-slate-600 line-clamp-1 block" title={item.description}>
                      {item.description ?? "—"}
                    </span>
                  </td>

                  {/* Created At */}
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {canView && (
                        <button onClick={() => setViewItem(item)} title="View"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                          <Eye size={14} />
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && (
          <Pagination
            page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems}
            onPageChange={p => setPage(p)}
            onPageSizeChange={s => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>

      <LogDetailModal item={viewItem} onClose={() => setViewItem(null)} />
    </div>
  );
}
