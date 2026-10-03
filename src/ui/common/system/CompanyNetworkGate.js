"use client";

import { WifiOff } from "lucide-react";
import { useCompanyNetworkGuard } from "@/platform/hooks/auth/useCompanyNetworkGuard";
import { COMPANY_WIFI_HINT, COMPANY_WIFI_MESSAGE, COMPANY_WIFI_TITLE, OFFLINE_INTERNET_MESSAGE, OFFLINE_INTERNET_TITLE } from "@/platform/utils/global/messages";

export default function CompanyNetworkGate({ children }) {
  const { blocked, checking, offline, retry } = useCompanyNetworkGuard();

  if (!blocked) return children;

  const title = offline ? OFFLINE_INTERNET_TITLE : COMPANY_WIFI_TITLE;
  const message = offline ? OFFLINE_INTERNET_MESSAGE : COMPANY_WIFI_MESSAGE;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f8fafc] p-6">
      <div className="w-full max-w-md rounded-none border border-slate-300 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 border border-amber-200">
          <WifiOff className="text-amber-600" size={28} aria-hidden />
        </div>
        <h1 className="text-sm font-bold uppercase tracking-wider text-slate-800">{title}</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">{message}</p>
        {!offline && (
          <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">{COMPANY_WIFI_HINT}</p>
        )}
        <button
          type="button"
          disabled={checking}
          onClick={() => void retry()}
          className="mt-6 w-full border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {checking ? "Checking…" : "Retry"}
        </button>
      </div>
    </div>
  );
}
