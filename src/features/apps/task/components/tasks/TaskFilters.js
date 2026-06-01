import { Download, RefreshCw, SlidersHorizontal, Trash2, ChevronDown, RotateCcw } from "lucide-react";
import { TASK_STATUSES, PRIORITIES, TASK_STATUS_CONFIG, PRIORITY_CONFIG } from "@/features/apps/task/components/common/Constants";
import { useEffect, useState } from "react";
import { categoryService } from "@/features/apps/task/services/categoryApi";
import SearchableSelect from "../common/SearchableSelect";
import { mapTaskUserToOption } from "@/features/apps/task/helpers/utilHelper";
import { userService } from "@/features/apps/task/services/userApi";

// ─────────────────────────────────────────────────────────────────────────────
// TaskFilterButtons
// ─────────────────────────────────────────────────────────────────────────────
export function TaskFilterButtons({ showFilters, onToggleFilters, hasActiveFilter, onExport, onRefresh, onReset }) {
  return (
    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
      <button
        onClick={onToggleFilters}
        className={`flex items-center justify-center gap-2 px-3 py-2.5 text-sm border rounded-xl transition-all whitespace-nowrap min-w-[108px] ${
          showFilters
            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
            : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300"
        }`}
      >
        <SlidersHorizontal size={14} />
        <span>Filters</span>
        {hasActiveFilter && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
      </button>

      {/* <button
        onClick={onExport}
        className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 rounded-xl transition-all whitespace-nowrap min-w-[108px]"
      >
        <Download size={14} />
        <span className="hidden sm:inline">Export</span>
      </button> */}

      <button
        onClick={onRefresh}
        className="flex items-center gap-2 px-3 py-2.5 text-sm bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 rounded-xl transition-all whitespace-nowrap"
        title="Refresh data"
      >
        <RefreshCw size={14} />
        <span className="hidden sm:inline">Refresh</span>
      </button>

      <button
        onClick={onReset}
        className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 rounded-xl transition-all whitespace-nowrap min-w-[108px]"
        title="Reset all filters"
      >
        <RotateCcw size={14} />
        <span className="hidden sm:inline">Reset</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskFilterPanel
// ─────────────────────────────────────────────────────────────────────────────
export function TaskFilterPanel({
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  categoryFilter,
  onCategoryChange,
  userFilter,
  onUserChange,
  categories,
  onReset,
}) {
  const hasActiveFilter =
    statusFilter !== "All" ||
    priorityFilter !== "All" ||
    categoryFilter !== "All" ||
    userFilter !== "All";

  const [category, setCategory] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [userList, setUserList] = useState([]);
  const [userListLoading, setUserListLoading] = useState(true);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [categoryRes, userRes] = await Promise.all([
          categoryService.getAll({ limit: 500 }),
          userService.getViews(),
        ]);
        setCategory(
          categoryRes.data?.data?.data   ??
          categoryRes.data?.data         ??
          categoryRes.data               ?? []
        );
        setUserList(
          userRes.data?.data ??
          userRes.data         ?? []
        );
      } catch (err) {
        console.error("Master data fetch failed:", err);
      } finally {
        setCategoryLoading(false);
        setUserListLoading(false);
      }
    };
    fetchMasterData();
  }, []);

  return (
    <div className="flex flex-col md:flex-row md:flex-wrap md:items-start gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">

      {/* Status pills */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0">
        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap sm:flex-shrink-0">Status:</span>
        <div className="flex gap-1 flex-wrap min-w-0">
          {["All", ...TASK_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                statusFilter === s
                  ? "bg-indigo-600 border-indigo-600 text-white font-medium"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {s === "All" ? "All" : (TASK_STATUS_CONFIG[s]?.label ?? s)}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px w-full bg-slate-200 md:hidden" />
      <div className="h-5 w-px bg-slate-200 hidden md:block" />

      {/* Priority pills */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0">
        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap sm:flex-shrink-0">Priority:</span>
        <div className="flex gap-1 flex-wrap min-w-0">
          {["All", ...PRIORITIES].map((p) => (
            <button
              key={p}
              onClick={() => onPriorityChange(p)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                priorityFilter === p
                  ? "bg-indigo-600 border-indigo-600 text-white font-medium"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {p === "All" ? "All" : (PRIORITY_CONFIG[p]?.label ?? p)}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px w-full bg-slate-200 md:hidden" />
      <div className="h-5 w-px bg-slate-200 hidden md:block" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center gap-3 xl:gap-4 min-w-0 md:ml-auto w-full md:w-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap sm:flex-shrink-0">Category:</span>
          <div className="w-full sm:min-w-[210px] sm:w-[210px] xl:w-56">
            <SearchableSelect
              options={category.map((c) => ({ id: c.id, name: c.name }))}
              value={categoryFilter === "All" ? "" : categoryFilter}
              onChange={(val) => onCategoryChange(val || "All")}
              placeholder={categoryLoading ? "Loading…" : "All Categories"}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap sm:flex-shrink-0">Assigned By:</span>
          <div className="w-full sm:min-w-[210px] sm:w-[210px] xl:w-56">
            <SearchableSelect
              options={userList.map(mapTaskUserToOption)}
              value={userFilter === "All" ? "" : userFilter}
              onChange={(val) => onUserChange(val || "All")}
              placeholder={userListLoading ? "Loading…" : "All Users"}
            />
          </div>
        </div>
      </div>

      {hasActiveFilter && (
        <button
          onClick={onReset}
          className="md:ml-auto xl:ml-2 flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 font-medium transition-colors self-start md:self-center"
        >
          <RotateCcw size={11} /> Clear filters
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BulkActionBar
// ─────────────────────────────────────────────────────────────────────────────
export function BulkActionBar({ count, onBulkDelete, onClearSelection }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
      <span className="text-xs text-indigo-700 font-semibold">{count} selected</span>
      <button
        onClick={onBulkDelete}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 rounded-lg transition-all"
      >
        <Trash2 size={12} /> Delete Selected
      </button>
      <button
        onClick={onClearSelection}
        className="text-xs text-slate-400 hover:text-slate-600 ml-auto transition-colors"
      >
        Clear
      </button>
    </div>
  );
}
