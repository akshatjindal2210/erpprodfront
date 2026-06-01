// components/task/dashboard/QuickActions.jsx
"use client";
import { Users, Plus, Activity, Settings } from "lucide-react";

const ACTIONS = [
  { label: "New Task",  icon: Plus,     color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100", href: "/task/dashboard/tasks"    },
  { label: "View User Logs", icon: Activity, color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-100",   href: "/task/dashboard/logs"     },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {ACTIONS.map(({ label, icon: Icon, color, bg, border, href }) => (
        <a key={label} href={href}
          className={`flex items-center gap-3 p-3.5 bg-white border ${border} rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}>
          <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={15} className={color} />
          </div>
          <span className="text-xs font-semibold text-slate-600">{label}</span>
        </a>
      ))}
    </div>
  );
}