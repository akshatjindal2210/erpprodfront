"use client";

import { Edit3, Trash2, Calendar, Clock } from "lucide-react";
import { formatDate } from "@/features/apps/task/helpers/utilHelper";

export default function RecurringTaskCard({ task, isSelected, onToggle, onEdit, onDelete, parseWeekdays }) {
  return (
    <div
      className={`relative bg-white rounded-2xl border transition-all duration-200 group
      ${isSelected ? "border-indigo-300 shadow-md shadow-indigo-100/50 ring-1 ring-indigo-200 bg-indigo-50/10" : "border-slate-200 hover:border-indigo-200 hover:shadow-md"}`}
    >
      {/* Checkbox */}
      <div className="absolute top-3 left-3 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(task.recurring_id)}
          className={`w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        />
      </div>

      <div className="p-4 pl-8 space-y-3">
        {/* ── Header: Task ID + Edit/Delete ── */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800 truncate">
            Recurring #{task.recurring_id} (Task #{task.task_id})
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(task)}
              title="Edit"
              className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all"
            >
              <Edit3 size={13} />
            </button>
            <button
              onClick={() => onDelete(task)}
              title="Delete"
              className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* ── Details ── */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-2 border-y border-slate-100">
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-slate-300 flex-shrink-0" />
            <span className="text-xs text-slate-500 truncate">
              Type: {task.recurrence_type}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-slate-300 flex-shrink-0" />
            <span className="text-xs text-slate-500 truncate">
              Next: {formatDate(task.next_occurrence)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 col-span-2">
            <span className="text-xs text-slate-500 font-medium">
              Weekdays:
            </span>
            <span className="text-xs text-slate-600 truncate">
              {parseWeekdays(task.recurrence_weekdays)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 col-span-2">
            <span className="text-xs text-slate-500 font-medium">
              Status:
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${task.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
              {task.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="col-span-2 text-[9px] text-slate-300 mt-1">
            Created: {formatDate(task.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}
