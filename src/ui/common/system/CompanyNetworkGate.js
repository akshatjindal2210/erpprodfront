"use client";

import { WifiOff } from "lucide-react";
import { useCompanyNetworkGuard } from "@/platform/hooks/auth/useCompanyNetworkGuard";
import { COMPANY_WIFI_CHECKING, COMPANY_WIFI_HINT, COMPANY_WIFI_MESSAGE, COMPANY_WIFI_TITLE, COMPANY_WIFI_TRY_AGAIN } from "@/platform/utils/global/messages";

export default function CompanyNetworkGate({ children }) {
  const { blocked, checking, retry } = useCompanyNetworkGuard();

  if (!blocked) return children;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f8fafc] p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md border border-slate-300 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 border border-amber-200">
          <WifiOff className="text-amber-600" size={28} aria-hidden />
        </div>
        <h1 className="text-sm font-bold uppercase tracking-wider text-slate-800">{COMPANY_WIFI_TITLE}</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">{COMPANY_WIFI_MESSAGE}</p>
        <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">{COMPANY_WIFI_HINT}</p>
        <button
          type="button"
          disabled={checking}
          onClick={() => void retry()}
          className="mt-6 w-full border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-800 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {checking ? COMPANY_WIFI_CHECKING : COMPANY_WIFI_TRY_AGAIN}
        </button>
      </div>
    </div>
  );
}
