"use client";

import { Loader2 } from "lucide-react";

/** Full-area loader — hide form fields until bootstrap fetch finishes. */
export default function FormPanelLoader({
  label = "Loading...",
  hint = "Please wait.",
  className = "",
  minHeight = "min-h-[220px]",
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center gap-2 py-12 px-4 ${minHeight} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="animate-spin text-indigo-600" size={28} aria-hidden />
      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{label}</p>
      {hint ? <p className="text-[10px] text-slate-400 text-center max-w-xs">{hint}</p> : null}
    </div>
  );
}
