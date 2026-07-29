"use client";

import { Pencil, Trash2, Calendar, Clock } from "lucide-react";
import { formatDate, formatDateTime, parseRecurrence } from "@/apps/task/lib/helpers/utilHelper";
import { taskRowTint } from "@/apps/task/lib/ui/tasks_common_component/TaskHelper";

/** Same colors as Recurring page frontend filters: Total / Active / Inactive / Created Today */
export const RECURRING_FILTER_COLORS = {
  total: "#696969",
  active: "#2bff00",
  inactive: "#ff8800",
  today: "#0011ff",
};

function isCreatedToday(row) {
  if (!row?.created_at) return false;
  const d = new Date(row.created_at);
  if (isNaN(d)) return false;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

/** Frontend-only filter colors (no backend logic). */
export function getRecurringCardColor(task) {
  if (isCreatedToday(task)) return RECURRING_FILTER_COLORS.today;
  const isActive = task.is_active === 1 || task.is_active === true;
  return isActive ? RECURRING_FILTER_COLORS.active : RECURRING_FILTER_COLORS.inactive;
}

export default function RecurringTaskCard({ task, isSelected, onToggle, onEdit, onDelete, handleToggle }) {
  const isActive = task.is_active === 1 || task.is_active === true;
  const createdToday = isCreatedToday(task);
  const finalColor = getRecurringCardColor(task);
  const cardBgStyle = isSelected
    ? { backgroundColor: "#eef2ff" }
    : { backgroundColor: taskRowTint(finalColor) };

  return (
    <div
      className={`relative rounded-none border overflow-hidden transition-all duration-150 group cursor-pointer ${
        isSelected
          ? "border-indigo-400 ring-1 ring-indigo-200"
          : "border-slate-200 hover:border-slate-300 hover:shadow-md"
      }`}
      style={cardBgStyle}
      onClick={() => onToggle?.(task.recurring_id)}
    >
      <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: finalColor }} />

      <div className="absolute top-3.5 left-2 z-10" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={!!isSelected}
          onChange={() => onToggle(task.recurring_id)}
          className={`w-3.5 h-3.5 rounded-sm border-slate-300 accent-indigo-600 cursor-pointer transition-opacity ${
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        />
      </div>

      <div className="p-2.5 pl-7 space-y-2">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1 mb-1">
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide ${
                  isActive
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-amber-100 text-amber-700 border-amber-200"
                }`}
              >
                {isActive ? "Active" : "Inactive"}
              </span>
              {createdToday && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wide">
                  Created Today
                </span>
              )}
              {task.recurrence_type && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-wide">
                  {task.recurrence_type}
                </span>
              )}
            </div>
            <p className="text-[12px] font-bold text-slate-800 leading-snug line-clamp-2" title={task.title}>
              {task.title || "—"}
            </p>
            <p className="text-[9px] text-slate-400 font-mono tabular-nums mt-0.5">
              #{task.recurring_id}
            </p>
          </div>
          <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onEdit(task)}
              title="Edit"
              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(task)}
              title="Delete"
              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 py-1.5 border-y border-slate-100/80 text-[10px]">
          <div className="flex items-center gap-1 min-w-0 col-span-2">
            <Calendar size={10} className="text-slate-400 flex-shrink-0" />
            <span className="text-slate-600 truncate font-medium">{parseRecurrence(task) || "—"}</span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <Clock size={10} className="text-slate-400 flex-shrink-0" />
            <span className="text-slate-700 truncate font-semibold tabular-nums">
              {formatDateTime(task.next_occurrence)}
            </span>
          </div>
          <div className="flex items-center justify-end gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleToggle?.(task.recurring_id)}
              className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                isActive ? "bg-emerald-500" : "bg-slate-300"
              }`}
              title={isActive ? "Set inactive" : "Set active"}
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                  isActive ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </button>
            <span
              className={`text-[9px] font-bold uppercase ${
                isActive ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="col-span-2 flex items-center justify-between gap-2">
            <span className="text-[9px] text-slate-500">
              End: {task.end_date ? formatDateTime(task.end_date) : "—"}
            </span>
            <span className="text-[8px] text-slate-400 font-semibold tabular-nums">
              {formatDate(task.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
