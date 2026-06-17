"use client";

import { RefreshCcw, WifiOff } from "lucide-react";
import { useCompanyNetworkGuard } from "@/core/hooks/useCompanyNetworkGuard";
import { COMPANY_WIFI_HINT, COMPANY_WIFI_MESSAGE, COMPANY_WIFI_TITLE } from "@/core/utils/global/messages";

export default function CompanyNetworkGate({ children }) {
  const { blocked, checking, retry } = useCompanyNetworkGuard();

  if (!blocked) return children;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f8fafc] p-6">
      <div className="w-full max-w-md rounded-none border border-slate-300 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 border border-amber-200">
          <WifiOff className="text-amber-600" size={28} aria-hidden />
        </div>
        <h1 className="text-sm font-bold uppercase tracking-wider text-slate-800">{COMPANY_WIFI_TITLE}</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">{COMPANY_WIFI_MESSAGE}</p>
        <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">{COMPANY_WIFI_HINT}</p>
        <button
          type="button"
          onClick={() => void retry()}
          disabled={checking}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-none border border-slate-300 bg-white px-5 h-10 text-[11px] font-bold uppercase tracking-wider text-indigo-600 hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          <RefreshCcw size={14} className={checking ? "animate-spin" : ""} />
          {checking ? "Checking…" : "Try again"}
        </button>
      </div>
    </div>
  );
}
