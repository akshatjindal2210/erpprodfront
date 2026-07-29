import { useRouter } from "next/navigation";
import { Pencil, Trash2, Copy, Calendar, Bell, RepeatIcon, Eye, Activity, Tag, Clock } from "lucide-react";
import { PRIORITY_CONFIG, TASK_STATUS_CONFIG_FOR_TABLE } from "@/apps/task/lib/ui/common/Constants";
import { buildTaskDetailUrl } from "@/apps/task/lib/helpers/taskRouteHelper";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { ActivityLogModal } from "@/apps/task/modules/tasks/SubPageExtra";
import { useState } from "react";
import { formatDate } from "@/apps/task/lib/helpers/utilHelper";
import { getTaskRowColor, blendHexWithWhite, taskRowTint } from "@/apps/task/lib/ui/tasks_common_component/TaskHelper";

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onClone,
  rowMeta = {},
  report = false,
  selected = false,
  onSelect,
}) {
  const {
    badge: alertBadge = null,
    badgeCls: alertBadgeCls = "",
    dueDateCls: dueDateClass = "text-slate-500",
    reminderDateCls: reminderDateClass = "text-slate-500",
  } = rowMeta;

  const router = useRouter();
  const canAccess = useCanAccess();
  const canEdit = canAccess("tasks", "edit").allowed;
  const canDelete = canAccess("tasks", "delete").allowed;
  const [logModal, setLogModal] = useState(false);

  const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const statusCfg = TASK_STATUS_CONFIG_FOR_TABLE[task.status] ?? TASK_STATUS_CONFIG_FOR_TABLE.pending;

  // Same color source as TaskTableRow (original list colors)
  const finalColor = getTaskRowColor(task);
  const cardBgStyle = { backgroundColor: taskRowTint(finalColor) };
  const solidBg = blendHexWithWhite(finalColor, 0.09);
  const byName = task.created_by_name || task.assigned_by_name || "";

  const handleNavigation = () => {
    if (!task?.task_id) return;
    router.push(buildTaskDetailUrl(task.task_id, { report }), { scroll: false });
  };

  const descPlain = task.description ? task.description.replace(/<[^>]+>/g, "") : "";

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleNavigation();
            return;
          }
          onSelect?.(task);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          handleNavigation();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect?.(task);
          }
        }}
        className={`relative border rounded-none overflow-hidden hover:shadow-md transition-all duration-150 cursor-pointer group ${
          selected
            ? "border-indigo-400 ring-2 ring-indigo-200 shadow-sm"
            : "border-slate-200 hover:border-slate-300"
        }`}
        style={cardBgStyle}
      >
        {/* Top colour bar — same finalColor as table left bar */}
        <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: finalColor }} />

        <div className="px-2.5 pt-2 pb-1.5 border-b border-slate-100/80">
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex-1 min-w-0">
              {(alertBadge || task.is_recurring === 1 || task.is_recurring === true) && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {alertBadge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide ${alertBadgeCls}`}>
                      {alertBadge}
                    </span>
                  )}
                  {(task.is_recurring === 1 || task.is_recurring === true) && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-wide inline-flex items-center gap-0.5">
                      <RepeatIcon size={8} /> Recurring
                    </span>
                  )}
                </div>
              )}
              <h3
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigation();
                }}
                className="text-[12px] font-bold text-slate-800 leading-snug line-clamp-2 cursor-pointer hover:text-indigo-600"
                title={task.title}
              >
                {task.title}
              </h3>
            </div>
            <span className="text-[9px] text-slate-400 font-mono flex-shrink-0 tabular-nums">
              #{task.task_id}
            </span>
          </div>

          {descPlain ? (
            <p className="text-[10px] text-slate-500 mt-1 line-clamp-1 leading-snug" title={descPlain}>
              {descPlain}
            </p>
          ) : null}
        </div>

        <div className="px-2.5 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${statusCfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${priorityCfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
              {priorityCfg.label}
            </span>
            {task.category_name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                <Tag size={9} /> {task.category_name}
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            {byName ? (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate">
                <div className="w-4 h-4 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[8px] font-bold text-violet-600">{byName[0]}</span>
                </div>
                <span className="text-slate-400">By</span>
                <span className="font-medium text-slate-600 truncate">{byName}</span>
              </div>
            ) : null}
            {task.first_assigned_to_name && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate">
                <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[8px] font-bold text-amber-600">{task.first_assigned_to_name[0]}</span>
                </div>
                <span className="text-slate-400">To</span>
                <span className="font-medium text-slate-600 truncate">{task.first_assigned_to_name}</span>
              </div>
            )}
            {task.current_holder_name && task.current_holder_name !== task.first_assigned_to_name && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate">
                <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[8px] font-bold text-indigo-600">{task.current_holder_name[0]}</span>
                </div>
                <span className="text-slate-400">With</span>
                <span className="font-medium text-indigo-600 truncate">{task.current_holder_name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {task.due_date && (
              <div className={`flex items-center gap-0.5 text-[10px] font-medium ${dueDateClass}`}>
                <Calendar size={10} />
                {formatDate(task.due_date)}
              </div>
            )}
            {(task.reminder_date || task.self_reminder_date) && (
              <div className={`flex items-center gap-0.5 text-[10px] font-medium ${reminderDateClass}`}>
                <Bell size={10} />
                {formatDate(task.reminder_date ?? task.self_reminder_date)}
              </div>
            )}
            {task.log_count > 0 && (
              <div className="flex items-center gap-0.5 text-[9px] text-slate-400">
                <Activity size={9} />
                {task.log_count}
              </div>
            )}
          </div>
        </div>

        <div
          className="px-2 py-1.5 border-t border-slate-100 flex items-center justify-between"
          style={{ backgroundColor: solidBg }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
            <Clock size={9} />
            {task.created_at?.slice(0, 10)}
          </span>

          <div className="flex items-center gap-0">
            <button
              type="button"
              onClick={handleNavigation}
              className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="View"
            >
              <Eye size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLogModal(true); }}
              className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Activity Log"
            >
              <Activity size={12} />
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(task)}
                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Edit"
              >
                <Pencil size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onClone(task)}
              className="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
              title="Clone"
            >
              <Copy size={12} />
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(task)}
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Delete"
              >
                <Trash2 size={12} />
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
