import { useRouter } from "next/navigation";
import { Pencil, Trash2, Copy, Calendar, Bell, RepeatIcon, Eye, Activity, Tag, Clock } from "lucide-react";
import { PRIORITY_CONFIG, TASK_STATUS_CONFIG_FOR_TABLE } from "@/features/apps/task/components/common/Constants";
import { buildTaskDetailUrl } from "@/features/apps/task/helpers/taskRouteHelper";
import { useSelector } from "react-redux";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { ActivityLogModal } from "@/features/apps/task/components/tasks/SubPageExtra";
import { useState } from "react";
import { formatDate } from "@/features/apps/task/helpers/utilHelper";

// Blends hex color with white to create a solid opaque color
// Same function as TaskTableRow — transparent won't work for sticky/card bg
function blendWithWhite(hex, alpha = 0.09) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const br = Math.round(r * alpha + 255 * (1 - alpha));
  const bg = Math.round(g * alpha + 255 * (1 - alpha));
  const bb = Math.round(b * alpha + 255 * (1 - alpha));
  return `rgb(${br},${bg},${bb})`;
}

export function TaskCard({ task, onEdit, onDelete, onClone, rowMeta = {}, report = false }) {
  const { badge: alertBadge = null, badgeCls: alertBadgeCls = "", barColor = "", dueDateCls: dueDateClass = "text-slate-500", reminderDateCls: reminderDateClass = "text-slate-500",} = rowMeta;

  const router    = useRouter();
  const canAccess = useCanAccess();
  const canEdit   = canAccess("tasks", "edit").allowed;
  const canDelete = canAccess("tasks", "delete").allowed;
  const [logModal, setLogModal] = useState(false);

  const priorityCfg = PRIORITY_CONFIG[task.priority]             ?? PRIORITY_CONFIG.medium;
  const statusCfg   = TASK_STATUS_CONFIG_FOR_TABLE[task.status]  ?? TASK_STATUS_CONFIG_FOR_TABLE.pending;

  const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric",}) : null;

  // ── Card bg + top bar — both same hex from barColor ────────────────────────
  // Card bg  = barColor with low opacity (same as row)
  // Top bar  = barColor full opacity (same as row left bar)
  const hasColor   = !!barColor;
  const cardBgStyle = hasColor ? { backgroundColor: `${barColor}18` } : {};
  const solidBg     = hasColor ? blendWithWhite(barColor, 0.09) : "#ffffff";

  const handleNavigation = () => {
    if (!task?.task_id) return;
    router.push(buildTaskDetailUrl(task.task_id, { report }), { scroll: false });
  };

  return (
    <>
      <div
        className="relative border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
        style={cardBgStyle}>

        {/* Top colour bar — same barColor as row left bar */}
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: barColor || "#e2e8f0" }}
        />

        {/* Header */}
        <div className="px-4 pt-3.5 pb-2 border-b border-slate-100">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">

              {/* Alert badge + recurring */}
              <div className="flex flex-wrap gap-1 mb-2">
                {alertBadge && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide ${alertBadgeCls}`}>
                    {alertBadge}
                  </span>
                )}
                {(task.is_recurring === 1 || task.is_recurring === true) && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-wide flex items-center gap-0.5">
                    <RepeatIcon size={8} /> Recurring
                  </span>
                )}
              </div>

              <h3 
                onClick={handleNavigation}
                className="text-sm font-bold text-slate-800 leading-snug line-clamp-2 cursor-pointer hover:text-indigo-600 hover:underline decoration-indigo-300 underline-offset-2 transition-all"
              >
                {task.title}
              </h3>
            </div>

            {/* Task ID */}
            <span className="text-[10px] text-slate-300 font-mono flex-shrink-0 mt-0.5">
              #{task.task_id}
            </span>
          </div>

          {/* Description */}
          {task.description ? (
            <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
              {task.description.replace(/<[^>]+>/g, "")}
            </p>
          ) : (
            <p className="text-xs text-slate-300 mt-2 italic">No description</p>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-2.5">

          {/* Status + Priority + Category */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${statusCfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${priorityCfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
              {priorityCfg.label}
            </span>
            {task.category_name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                <Tag size={9} /> {task.category_name}
              </span>
            )}
          </div>

          {/* People */}
          <div className="space-y-1">
            {task.created_by_name && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <div className="w-4 h-4 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[8px] font-bold text-violet-600">{task.created_by_name[0]}</span>
                </div>
                <span className="text-slate-400">By</span>
                <span className="font-medium text-slate-600 truncate">{task.assigned_by_name}</span>
              </div>
            )}
            {task.first_assigned_to_name && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[8px] font-bold text-amber-600">{task.first_assigned_to_name[0]}</span>
                </div>
                <span className="text-slate-400">To</span>
                <span className="font-medium text-slate-600 truncate">{task.first_assigned_to_name}</span>
              </div>
            )}
            {task.current_holder_name && task.current_holder_name !== task.first_assigned_to_name && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[8px] font-bold text-indigo-600">{task.current_holder_name[0]}</span>
                </div>
                <span className="text-slate-400">With</span>
                <span className="font-medium text-indigo-600 truncate">{task.current_holder_name}</span>
              </div>
            )}
          </div>

          {/* Dates — class comes from ROW_META, same as TaskTableRow */}
          <div className="flex items-center gap-3 flex-wrap pt-0.5">
            {task.due_date && (
              <div className={`flex items-center gap-1 text-[11px] font-medium ${dueDateClass}`}>
                <Calendar size={11} />
                {formatDate(task.due_date)}
              </div>
            )}
            {(task.reminder_date || task.self_reminder_date) && (
              <div className={`flex items-center gap-1 text-[11px] font-medium ${reminderDateClass}`}>
                <Bell size={11} />
                {formatDate(task.reminder_date ?? task.self_reminder_date)}
              </div>
            )}
            {!task.due_date && !task.reminder_date && !task.self_reminder_date && (
              <span className="text-[11px] text-slate-300 italic">No dates set</span>
            )}
          </div>

          {/* Log count */}
          {task.log_count > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Activity size={10} />
              {task.log_count} activit{task.log_count === 1 ? "y" : "ies"}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className="px-3 py-2 border-t border-slate-100 flex items-center justify-between"
          style={{ backgroundColor: solidBg }}
          onClick={(e) => e.stopPropagation()}>

          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Clock size={10} />
            {task.created_at?.slice(0, 10)}
          </span>

          <div className="flex items-center gap-0.5">
            <button
              onClick={handleNavigation}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
              title="View">
              <Eye size={13} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setLogModal(true); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
              title="Activity Log">
              <Activity size={13} />
            </button>
            {canEdit && (
              <button
                onClick={() => onEdit(task)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                title="Edit">
                <Pencil size={13} />
              </button>
            )}
            <button
              onClick={() => onClone(task)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
              title="Clone">
              <Copy size={13} />
            </button>
            {canDelete && (
              <button
                onClick={() => onDelete(task)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                title="Delete">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      <ActivityLogModal
        open={logModal}
        onClose={() => setLogModal(false)}
        taskId={task.task_id}
        taskTitle={task.title}
        taskStatus={task.status}
        logs={null}
      />
    </>
  );
}
