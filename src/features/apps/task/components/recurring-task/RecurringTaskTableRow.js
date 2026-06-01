import { Edit3, Trash2, Clock } from "lucide-react";
import { formatDate, formatDateTime, parseRecurrence } from "@/features/apps/task/helpers/utilHelper";

export default function RecurringTaskTableRow({ task, index, isSelected, onToggle, onEdit, onDelete, handleToggle }) {
  return (
    <tr className={`transition-colors group ${isSelected ? "bg-indigo-50/60" : "hover:bg-slate-50"}`}>
      
      {/* Checkbox */}
      <td className="px-4 py-3 sticky left-0 z-20 bg-white">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(task.recurring_id)}
          className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
        />
      </td>

      {/* # */}
      <td className="px-4 py-3 text-slate-400 text-xs sticky left-[48px] z-20 bg-white border-r border-slate-200">
        {index + 1}
      </td>

      {/* Task Title */}
      <td className="px-3 py-3 min-w-[212px] max-w-[300px]">
        <span className="text-sm font-semibold text-slate-800 line-clamp-4" title={task.title}>
          {task.title}
        </span>
      </td>

      {/* Recurrence */}
      <td className="px-4 py-3 text-slate-500 text-sm">
        {parseRecurrence(task)}
      </td>

      {/* Next Occurrence */}
      <td className="px-4 py-3 text-slate-500 text-sm flex items-center gap-1">
        <Clock size={14} className="text-slate-300" />
        {formatDateTime(task.next_occurrence)}
      </td>

      {/* End Date */}
      <td className="px-4 py-3 text-slate-500 text-sm">
        {task.end_date ? formatDateTime(task.end_date) : "-"}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <div className="flex items-center group">
          <button
            onClick={() => handleToggle(task.recurring_id)}
            className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors duration-300 ${
              task.is_active ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <span className="sr-only">Toggle Task Status</span>
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition duration-300 ${
                task.is_active ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`ml-3 text-xs font-bold uppercase ${
            task.is_active ? "text-emerald-600" : "text-slate-400"
          }`}>
            {task.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </td>

      {/* Created At */}
      <td className="px-4 py-3 text-slate-400 text-xs">
        {formatDate(task.created_at)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 sticky right-0 z-20 bg-white border-l border-slate-200 flex justify-center gap-1.5">
        <button onClick={() => onEdit(task)} title="Edit" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border-transparent hover:border-indigo-200 transition-all">
          <Edit3 size={14} />
        </button>
        <button onClick={() => onDelete(task)} title="Delete" className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border-transparent hover:border-rose-200 transition-all">
          <Trash2 size={14} />
        </button>
      </td>

    </tr>
  );
}
