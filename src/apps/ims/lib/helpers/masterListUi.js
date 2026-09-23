"use client";

import { RefreshCcw, Loader2 } from "lucide-react";

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

export const IMS_DRAWER_FOOTER_WRAP =
  "flex flex-row flex-nowrap items-center justify-end gap-3 w-full";

export const IMS_DRAWER_BTN_CANCEL =
  "shrink-0 px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-all disabled:opacity-50 bg-transparent border-0";

export const IMS_DRAWER_BTN_CLOSE =
  "shrink-0 px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-all disabled:opacity-50 bg-transparent border-0";

export const IMS_DRAWER_BTN_PRIMARY =
  "shrink-0 min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:bg-indigo-400";

export const IMS_DRAWER_BTN_AMBER =
  "shrink-0 min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-amber-100 disabled:opacity-50";

export const IMS_DRAWER_BTN_KEEP_PENDING =
  "shrink-0 px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50";

export const IMS_DRAWER_BTN_APPROVE =
  "shrink-0 min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50";
