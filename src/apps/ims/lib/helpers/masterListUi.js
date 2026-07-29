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

/** IMS drawer footer — same as Location / Stock Adjustment modals. */
export const IMS_DRAWER_FOOTER_WRAP =
  "flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 sm:gap-3 w-full";

export const IMS_DRAWER_BTN_CANCEL =
  "w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl bg-white disabled:opacity-50 transition-colors";

export const IMS_DRAWER_BTN_CLOSE =
  "w-full sm:w-auto px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50";

export const IMS_DRAWER_BTN_PRIMARY =
  "w-full sm:w-auto sm:min-w-[160px] px-5 sm:px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:bg-indigo-400";

export const IMS_DRAWER_BTN_AMBER =
  "w-full sm:w-auto sm:min-w-[140px] px-5 sm:px-6 py-2.5 text-sm font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-100 disabled:opacity-50";
