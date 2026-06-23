"use client";

import { WifiOff } from "lucide-react";
import { useCompanyNetworkGuard } from "@/core/hooks/useCompanyNetworkGuard";
import { COMPANY_WIFI_HINT, COMPANY_WIFI_MESSAGE, COMPANY_WIFI_TITLE } from "@/core/utils/global/messages";

export default function CompanyNetworkGate({ children }) {
  const { blocked, checking } = useCompanyNetworkGuard();

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
        {checking && (
          <p className="mt-6 text-[11px] font-medium uppercase tracking-wider text-indigo-600">
            Checking connection…
          </p>
        )}
      </div>
    </div>
  );
}
