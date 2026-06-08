"use client";

import { ListTodo } from "lucide-react";

export default function TaskAppConfigForm() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[320px] p-8 text-center bg-slate-50/40">
      <div className="w-14 h-14 rounded-none bg-violet-50 border border-violet-200 flex items-center justify-center mb-4">
        <ListTodo size={28} className="text-violet-500" />
      </div>
      <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Task application settings</h2>
      <p className="text-[11px] text-slate-500 mt-2 max-w-sm leading-relaxed">
        No Task-specific settings yet. App-level options for reminders, defaults, and workflows will appear here when added.
      </p>
    </div>
  );
}
