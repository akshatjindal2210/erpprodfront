"use client";

import { X, RefreshCcw, Loader2 } from "lucide-react";
import { LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";

/** Outer + inner card shell for all list pages. */
export function ListPageShell({ children }) {
  return (
    <div className={LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/** Scrollable table region inside list shell. */
export function ListPageTableArea({ children }) {
  return (
    <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
      {children}
    </div>
  );
}

export function ListPageSelectionBanner({ children, onClear }) {
  if (!children) return null;
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
      <span className="text-[10px] font-bold text-indigo-600 uppercase">{children}</span>
      <button
        type="button"
        onClick={onClear}
        className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase shrink-0"
      >
        <X size={14} /> Clear
      </button>
    </div>
  );
}

export function ListPageFooter({ shown, total, noun = "Records", extra = null }) {
  return (
    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        Showing {shown} of {total} {noun}
        {extra ? ` · ${extra}` : ""}
      </span>
    </div>
  );
}

export function ListPageServerFooter({ shown, total, page, pageSize, loading, onPrev, onNext }) {
  return (
    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        Showing {shown} of {total} Records
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={onPrev}
          className="text-[10px] font-bold uppercase text-indigo-600 disabled:text-slate-300"
        >
          Previous
        </button>
        <span className="text-[10px] font-bold text-slate-500 uppercase">Page {page}</span>
        <button
          type="button"
          disabled={page * pageSize >= total || loading}
          onClick={onNext}
          className="text-[10px] font-bold uppercase text-indigo-600 disabled:text-slate-300"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function ListPageRefreshButton({ loading, onClick, iconOnly = true }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none shrink-0 disabled:opacity-70"
    >
      {loading ? <Loader2 size={14} className="animate-spin text-indigo-600" /> : <RefreshCcw size={14} />}
      {!iconOnly ? <span>Refresh</span> : null}
    </button>
  );
}
