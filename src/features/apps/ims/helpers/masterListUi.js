"use client";

import { X, RefreshCcw, Loader2 } from "lucide-react";

export function MasterSelectionBanner({ children, onClear }) {
  if (!children) return null;
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
      <span className="text-[10px] font-bold text-indigo-600 uppercase italic whitespace-normal break-words text-left leading-snug">
        {children}
      </span>
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

export function MasterListFooter({ shown, total, noun = "entries" }) {
  return (
    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 shrink-0">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        Showing {shown} of {total} {noun}
      </span>
    </div>
  );
}

export function MasterRefreshButton({ loading, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center gap-2 transition-all disabled:opacity-70 rounded-none shadow-none ${className}`.trim()}
    >
      {loading ? (
        <Loader2 size={14} className="shrink-0 animate-spin text-indigo-600" aria-hidden />
      ) : (
        <RefreshCcw size={14} className="shrink-0" aria-hidden />
      )}
      <span className="hidden xs:inline text-[11px] font-semibold">Refresh</span>
    </button>
  );
}
