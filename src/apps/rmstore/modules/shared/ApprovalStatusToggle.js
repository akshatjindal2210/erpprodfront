"use client";

import { Shield, AlertCircle } from "lucide-react";

/**
 * IMS-style Approval Status row for RM Store drawers.
 * Footer stays Cancel + Save; approval is only controlled here.
 */
export default function ApprovalStatusToggle({
  show = false,
  checked = false,
  onChange,
  disabled = false,
  pendingHint = "This entry will be marked as Pending until authorized.",
  lockedLabel = "Final & Locked",
  draftLabel = "Draft Mode",
}) {
  if (!show) {
    return (
      <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
        <AlertCircle size={16} className="text-slate-400 shrink-0" />
        <p className="text-[10px] text-slate-500 italic">{pendingHint}</p>
      </div>
    );
  }

  return (
    <div
      className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
        checked
          ? "bg-emerald-600 border-emerald-700 shadow-sm"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`p-2 rounded-lg shrink-0 ${
            checked ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
          }`}
        >
          <Shield size={16} />
        </div>
        <div className="min-w-0">
          <p className={`text-xs font-bold ${checked ? "text-white" : "text-slate-700"}`}>
            Approval Status
          </p>
          <p
            className={`text-[9px] uppercase font-bold tracking-tight ${
              checked ? "text-emerald-100" : "text-slate-400"
            }`}
          >
            {checked ? lockedLabel : draftLabel}
          </p>
        </div>
      </div>
      <label
        className={`relative inline-flex items-center ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <input
          type="checkbox"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
      </label>
    </div>
  );
}
