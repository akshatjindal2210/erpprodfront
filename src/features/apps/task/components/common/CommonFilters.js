import { SlidersHorizontal, RefreshCw, RotateCcw, ChevronDown, Download, Trash2 } from "lucide-react";
import { useCanAccess } from "@/core/hooks/useCanAccess";

const PAGE_SIZES = [5, 10, 25, 50];

// ── Filter Buttons ────────────────────────────────────────────────────────────
export function FilterButtons({showFilters, onToggleFilters, hasActiveFilter, onExport, onRefresh, onReset, accentColor = "indigo"}) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">

      <button onClick={onToggleFilters}
        className={`flex items-center gap-2 px-3 py-2.5 text-sm border rounded-xl transition-all whitespace-nowrap ${showFilters || hasActiveFilter? `bg-${accentColor}-50 border-${accentColor}-200 text-${accentColor}-700` : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
        <SlidersHorizontal size={14} />
        <span>Filters</span>
        {hasActiveFilter && <span className={`w-1.5 h-1.5 rounded-full bg-${accentColor}-500`} />}
      </button>

      <button onClick={onExport}
        className="flex items-center gap-2 px-3 py-2.5 text-sm bg-white border border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 rounded-xl transition-all whitespace-nowrap"
        title="Export CSV">
        <Download size={14} />
        <span className="hidden sm:inline">Export</span>
      </button>

      <button onClick={onRefresh}
        className="flex items-center gap-2 px-3 py-2.5 text-sm bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 rounded-xl transition-all whitespace-nowrap"
        title="Refresh">
        <RefreshCw size={14} />
        <span className="hidden sm:inline">Refresh</span>
      </button>

      <button onClick={onReset}
        className="flex items-center gap-2 px-3 py-2.5 text-sm bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 rounded-xl transition-all whitespace-nowrap"
        title="Reset">
        <RotateCcw size={14} />
        <span className="hidden sm:inline">Reset</span>
      </button>

    </div>
  );
}

export function FilterButtonsRecurrence({showFilters, onToggleFilters, hasActiveFilter, onExport, onRefresh, onReset, accentColor = "indigo"}) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">

      {/* <button onClick={onToggleFilters}
        className={`flex items-center gap-2 px-3 py-2.5 text-sm border rounded-xl transition-all whitespace-nowrap ${showFilters || hasActiveFilter? `bg-${accentColor}-50 border-${accentColor}-200 text-${accentColor}-700` : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
        <SlidersHorizontal size={14} />
        <span>Filters</span>
        {hasActiveFilter && <span className={`w-1.5 h-1.5 rounded-full bg-${accentColor}-500`} />}
      </button> */}

      {/* <button onClick={onExport}
        className="flex items-center gap-2 px-3 py-2.5 text-sm bg-white border border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 rounded-xl transition-all whitespace-nowrap"
        title="Export CSV">
        <Download size={14} />
        <span className="hidden sm:inline">Export</span>
      </button> */}

      <button onClick={onRefresh}
        className="flex items-center gap-2 px-3 py-2.5 text-sm bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 rounded-xl transition-all whitespace-nowrap"
        title="Refresh">
        <RefreshCw size={14} />
        <span className="hidden sm:inline">Refresh</span>
      </button>

      <button onClick={onReset}
        className="flex items-center gap-2 px-3 py-2.5 text-sm bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 rounded-xl transition-all whitespace-nowrap"
        title="Reset">
        <RotateCcw size={14} />
        <span className="hidden sm:inline">Reset</span>
      </button>

    </div>
  );
}

// ── Filter Panel ──────────────────────────────────────────────────────────────
/**
 * sortOptions — custom sort buttons, default: A→Z / Z→A
 * dateLabel   — label for date range, default: "Created"
 */
export function FilterPanel({
  sortDir, onSortChange,
  dateFrom, onDateFromChange,
  dateTo,   onDateToChange,
  pageSize, onPageSizeChange,
  onReset,
  accentColor  = "indigo",
  dateLabel    = "Created",
  sortOptions  = [{ value: "asc", label: "A → Z" }, { value: "desc", label: "Z → A" }],
  defaultSortDir = "asc",
}) {
  const hasActiveFilter = sortDir !== defaultSortDir || dateFrom !== "" || dateTo !== "";

  const focusCls = `focus:border-${accentColor}-400 focus:ring-2 focus:ring-${accentColor}-100`;
  const inputCls = `appearance-none bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none ${focusCls} transition-all`;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">

      {/* Sort */}
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Sort:</span>
        <div className="flex gap-1">
          {sortOptions.map((s) => (
            <button key={s.value} onClick={() => onSortChange(s.value)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                sortDir === s.value
                  ? `bg-${accentColor}-600 border-${accentColor}-600 text-white font-medium`
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-5 w-px bg-slate-200 hidden sm:block" />

      {/* Date range */}
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{dateLabel}:</span>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className={inputCls} />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" value={dateTo} min={dateFrom || undefined}
            onChange={(e) => onDateToChange(e.target.value)}
            className={inputCls} />
        </div>
      </div>

      <div className="h-5 w-px bg-slate-200 hidden sm:block" />

      {/* Page size */}
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Show:</span>
        <div className="relative">
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={`appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 text-xs text-slate-700 outline-none ${focusCls} transition-all`}>
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} per page</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {hasActiveFilter && (
        <button onClick={onReset}
          className="ml-auto flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 font-medium transition-colors">
          <RotateCcw size={11} /> Clear filters
        </button>
      )}
    </div>
  );
}

// ── Bulk Action Bar ───────────────────────────────────────────────────────────
/*
export function BulkActionBar({ count, onBulkDelete, onClearSelection, accentColor = "indigo" }) {
  if (count === 0) return null;
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 bg-${accentColor}-50 border border-${accentColor}-200 rounded-xl`}>
      <span className={`text-sm font-medium text-${accentColor}-700`}>
        {count} item{count > 1 ? "s" : ""} selected
      </span>
      <div className="flex items-center gap-2">
        <button onClick={onClearSelection}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-all">
          Clear
        </button>
        <button onClick={onBulkDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all">
          <Trash2 size={12} /> Delete Selected
        </button>
      </div>
    </div>
  );
}
*/

export function BulkActionBar({ count, onBulkDelete, onClearSelection, accentColor = "indigo", entity = "users" }) {
  const canAccess = useCanAccess();
  const canDelete = canAccess(entity, "delete").allowed;

  if (count === 0) return null;

  return (
    <div className={`flex items-center justify-between px-4 py-2.5 bg-${accentColor}-50 border border-${accentColor}-200 rounded-xl`}>
      
      <span className={`text-sm font-medium text-${accentColor}-700`}>
        {count} item{count > 1 ? "s" : ""} selected
      </span>

      <div className="flex items-center gap-2">
        
        <button
          onClick={onClearSelection}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-all"
        >
          Clear
        </button>

        {/* ✅ Permission-based delete */}
        {canDelete && (
          <button
            onClick={onBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all"
          >
            <Trash2 size={12} /> Delete Selected
          </button>
        )}

      </div>
    </div>
  );
}
