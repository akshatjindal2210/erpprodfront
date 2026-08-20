"use client";

import { Loader2 } from "lucide-react";

/** Full-area loader — hide form fields until bootstrap fetch finishes. */
export default function FormPanelLoader({
  label = "Loading...",
  hint = "Please wait.",
  className = "",
  minHeight = "min-h-[220px]",
  fullScreen = false,
}) {
  if (fullScreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily: "system-ui,sans-serif",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 32,
            height: 32,
            border: "3px solid #e2e8f0",
            borderTopColor: "#4f46e5",
            borderRadius: "50%",
            animation: "imp-spin .75s linear infinite",
          }}
        />
        <p style={{ margin: "12px 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#475569" }}>
          {label}
        </p>
        {hint ? <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>{hint}</p> : null}
        <style>{`@keyframes imp-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

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
