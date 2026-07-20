import { Pencil, Trash2, Clock } from "lucide-react";
import { formatDate, formatDateTime, parseRecurrence } from "@/features/apps/task/helpers/utilHelper";

export default function RecurringTaskTableRow({
  task,
  index,
  isSelected,
  onToggle,
  onEdit,
  onDelete,
  handleToggle,
}) {
  const stickyBg = isSelected ? "#eef2ff" : "#ffffff";
  const isActive = task.is_active === 1 || task.is_active === true;

  return (
    <tr
      className={`transition-colors ${
        isSelected ? "bg-indigo-50/70" : "hover:bg-slate-50/80"
      }`}
    >
      <td
        className="px-2 py-1.5 w-8 sticky left-0 z-[2] border-b border-slate-100"
        style={{ backgroundColor: stickyBg }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(task.recurring_id)}
          className="w-3.5 h-3.5 rounded border-slate-300 accent-indigo-600 cursor-pointer"
        />
      </td>

      <td
        className="px-1.5 py-1.5 w-7 text-[10px] font-mono text-slate-400 sticky left-[36px] z-[2] border-r border-b border-slate-100"
        style={{ backgroundColor: stickyBg }}
      >
        {index}
      </td>

      <td className="px-2 py-1.5 min-w-[200px] max-w-[320px] border-b border-slate-100">
        <span
          className="text-[12px] font-semibold text-slate-800 leading-tight line-clamp-1 break-words"
          title={task.title}
        >
          {task.title || "—"}
        </span>
      </td>

      <td className="px-2 py-1.5 text-[11px] text-slate-600 leading-tight border-b border-slate-100 whitespace-nowrap">
        {parseRecurrence(task) || "—"}
      </td>

      <td className="px-2 py-1.5 text-[11px] text-slate-600 border-b border-slate-100">
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
          <Clock size={10} className="text-slate-400 shrink-0" />
          {formatDateTime(task.next_occurrence)}
        </span>
      </td>

      <td className="px-2 py-1.5 text-[11px] text-slate-600 whitespace-nowrap border-b border-slate-100">
        {task.end_date ? formatDateTime(task.end_date) : "—"}
      </td>

      <td className="px-2 py-1.5 border-b border-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleToggle(task.recurring_id)}
            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              isActive ? "bg-emerald-500" : "bg-slate-300"
            }`}
            title={isActive ? "Set inactive" : "Set active"}
          >
            <span className="sr-only">Toggle status</span>
            <span
              className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                isActive ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              isActive ? "text-emerald-600" : "text-slate-400"
            }`}
          >
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </td>

      <td className="px-2 py-1.5 text-[10px] text-slate-400 whitespace-nowrap border-b border-slate-100">
        {formatDate(task.created_at)}
      </td>

      <td
        className="px-1.5 py-1.5 w-20 sticky right-0 z-[2] border-l border-b border-slate-100"
        style={{ backgroundColor: stickyBg }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center gap-0">
          <button
            type="button"
            onClick={() => onEdit(task)}
            title="Edit"
            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task)}
            title="Delete"
            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}
