import { RefreshCw, SlidersHorizontal, RotateCcw } from "lucide-react";
import { TASK_STATUSES, PRIORITIES, TASK_STATUS_CONFIG, PRIORITY_CONFIG } from "@/features/apps/task/components/common/Constants";
import { useEffect, useState } from "react";
import { categoryService } from "@/features/apps/task/services/categoryApi";
import SearchableSelect from "../common/SearchableSelect";
import { mapTaskUserToOption, extractList } from "@/features/apps/task/helpers/utilHelper";
import { userService } from "@/features/apps/task/services/userApi";
import { LIST_PAGE_FILTER_FIELD_WRAP_CLASS, LIST_PAGE_FILTER_SERVER_LABEL_CLASS, LIST_PAGE_FILTER_SERVER_BOX_CLASS, LIST_PAGE_FILTER_VALUE_CLASS } from "@/core/components/common/ListPageSearchField";

const FILTER_SELECT_CLS = [
  LIST_PAGE_FILTER_SERVER_BOX_CLASS,
  LIST_PAGE_FILTER_VALUE_CLASS,
  "flex items-center gap-1.5 cursor-pointer !p-0 !min-h-0 !rounded-none !border-slate-300",
].join(" ");

const pillBase =
  "h-7 px-2.5 text-[10px] font-bold uppercase tracking-wide border rounded-none transition-colors whitespace-nowrap";

// ─────────────────────────────────────────────────────────────────────────────
// TaskFilterButtons
// ─────────────────────────────────────────────────────────────────────────────
export function TaskFilterButtons({ showFilters, onToggleFilters, hasActiveFilter, onRefresh, onReset }) {
  const btnBase =
    "h-9 px-3 inline-flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider border rounded-none shadow-none transition-colors whitespace-nowrap";
  return (
    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
      <button
        type="button"
        onClick={onToggleFilters}
        className={`${btnBase} ${
          showFilters
            ? "bg-indigo-50 border-indigo-300 text-indigo-700"
            : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
        }`}
      >
        <SlidersHorizontal size={14} />
        <span>Filters</span>
        {hasActiveFilter && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
      </button>

      <button
        type="button"
        onClick={onRefresh}
        className={`${btnBase} bg-white border-slate-300 text-slate-600 hover:bg-slate-50`}
        title="Refresh data"
      >
        <RefreshCw size={14} />
        <span className="hidden sm:inline">Refresh</span>
      </button>

      <button
        type="button"
        onClick={onReset}
        className={`${btnBase} bg-white border-slate-300 text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50`}
        title="Reset all filters"
      >
        <RotateCcw size={14} />
        <span className="hidden sm:inline">Reset</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskFilterPanel — IMS list-filter chrome, Task indigo accents
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
          categoryService.getViews({
            permission_module: "tasks",
            permission_action: "view",
            limit: 500,
          }),
          userService.getViews(),
        ]);
        setCategory(extractList(categoryRes));
        setUserList(extractList(userRes));
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
    <div className="flex flex-col gap-2.5 px-0 py-0 bg-transparent border-0 rounded-none">
      <div className="flex flex-col xl:flex-row xl:flex-wrap xl:items-end gap-2.5 min-w-0">
        {/* Status */}
        <div className={`${LIST_PAGE_FILTER_FIELD_WRAP_CLASS} min-w-0`}>
          <span className={LIST_PAGE_FILTER_SERVER_LABEL_CLASS}>Status</span>
          <div className="flex gap-1 flex-wrap min-w-0">
            {["All", ...TASK_STATUSES].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStatusChange(s)}
                className={`${pillBase} ${
                  statusFilter === s
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700"
                }`}
              >
                {s === "All" ? "All" : (TASK_STATUS_CONFIG[s]?.label ?? s)}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div className={`${LIST_PAGE_FILTER_FIELD_WRAP_CLASS} min-w-0`}>
          <span className={LIST_PAGE_FILTER_SERVER_LABEL_CLASS}>Priority</span>
          <div className="flex gap-1 flex-wrap min-w-0">
            {["All", ...PRIORITIES].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPriorityChange(p)}
                className={`${pillBase} ${
                  priorityFilter === p
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700"
                }`}
              >
                {p === "All" ? "All" : (PRIORITY_CONFIG[p]?.label ?? p)}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className={`${LIST_PAGE_FILTER_FIELD_WRAP_CLASS} w-full sm:w-[11rem] shrink-0`}>
          <span className={LIST_PAGE_FILTER_SERVER_LABEL_CLASS}>Category</span>
          <SearchableSelect
            options={category.map((c) => ({ id: c.id, name: c.name }))}
            value={categoryFilter === "All" ? "" : categoryFilter}
            onChange={(val) => onCategoryChange(val || "All")}
            placeholder={categoryLoading ? "Loading…" : "All Categories"}
            selectCls={FILTER_SELECT_CLS}
          />
        </div>

        {/* Assigned By */}
        <div className={`${LIST_PAGE_FILTER_FIELD_WRAP_CLASS} w-full sm:w-[11rem] shrink-0`}>
          <span className={LIST_PAGE_FILTER_SERVER_LABEL_CLASS}>Assigned By</span>
          <SearchableSelect
            options={userList.map(mapTaskUserToOption)}
            value={userFilter === "All" ? "" : userFilter}
            onChange={(val) => onUserChange(val || "All")}
            placeholder={userListLoading ? "Loading…" : "All Users"}
            selectCls={FILTER_SELECT_CLS}
          />
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={onReset}
            className="h-8 md:h-9 px-3 inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold uppercase tracking-wide text-rose-600 border border-rose-200 bg-white hover:bg-rose-50 rounded-none self-start xl:self-end shrink-0"
          >
            <RotateCcw size={12} /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
