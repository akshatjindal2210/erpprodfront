"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { runManualPwaHandoff } from "@/core/utils/pwaGoogleSitesLaunch";

const primaryClass =
  "w-full bg-[#1e293b] hover:bg-slate-900 text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2";

export default function LaunchPage() {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#f8fafc] flex items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-sm mx-auto text-center">
        <img
          src="/logo.png"
          alt="JFL ERP"
          className="h-14 sm:h-16 w-auto max-w-[12rem] sm:max-w-[14rem] mx-auto mb-5 object-contain"
        />
        <h1 className="text-xl font-bold text-slate-900">Welcome</h1>
        <p className="text-slate-500 text-sm mt-1 mb-6">Open the installed app to continue.</p>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <button type="button" onClick={runManualPwaHandoff} className={primaryClass}>
            <ExternalLink size={18} />
            Open App
          </button>

        </div>
      </div>
    </div>
  );
}
