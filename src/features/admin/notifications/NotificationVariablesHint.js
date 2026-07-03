"use client";

import { toast } from "react-toastify";
import { TASK_NOTIFY_VARIABLE_GROUPS } from "@/features/apps/task/config/notificationVariables";

export default function NotificationVariablesHint() {
  const copyVar = (key) => {
    const token = `{{${key}}}`;
    navigator.clipboard?.writeText(token).then(
      () => toast.info(`Copied ${token}`, { autoClose: 1500 }),
      () => toast.error("Copy failed")
    );
  };

  return (
    <div className="rounded border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-[10px] text-slate-600 mb-2.5">
        <span className="font-semibold">Variables</span>
        <span className="text-slate-400"> — click to copy, paste in subject or message</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TASK_NOTIFY_VARIABLE_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.keys.map((key) => {
                const hint = group.labels?.[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => copyVar(key)}
                    className="px-2 py-1 text-[10px] font-mono text-slate-700 bg-white border border-slate-200 rounded hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/50 transition-colors text-left"
                    title={hint ? `${hint} — copy {{${key}}}` : `Copy {{${key}}}`}
                  >
                    {hint ? hint : `{{${key}}}`}
                    {hint ? (
                      <span className="block text-[8px] text-slate-400 font-normal not-italic">{`{{${key}}}`}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
