import { Pencil, Trash2, Calendar, RepeatIcon, Eye, Copy, Activity, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRIORITY_CONFIG, TASK_STATUS_CONFIG_FOR_TABLE } from "@/apps/task/lib/ui/common/Constants";
import { formatDate, formatDateTime } from "@/apps/task/lib/helpers/utilHelper";
import { buildTaskDetailUrl } from "@/apps/task/lib/helpers/taskRouteHelper";
import { useSelector } from "react-redux";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { ActivityLogModal } from "./SubPageExtra";
import { getTaskRowColor, blendHexWithWhite, taskRowTint } from "@/apps/task/lib/ui/tasks_common_component/TaskHelper";

function Badge({ cfg, colorOverride }) {
  if (!cfg) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] font-medium border leading-tight ${cfg.badge}`}
      style={{ borderColor: colorOverride ?? "", color: colorOverride ?? "" }}
    >
      <span
        className={`w-1 h-1 rounded-full flex-shrink-0 ${cfg.dot}`}
        style={{ backgroundColor: colorOverride ?? "" }}
      />
      {cfg.label}
    </span>
  );
}

function AssignmentInfo({ task }) {
  const first = task.first_assigned_to_name;
  const current = task.current_holder_name;

  if (!first && !current) return <span className="text-slate-300 text-[10px]">—</span>;
  if (first === current || !current) {
    return (
      <div>
        <p className="text-[11px] font-medium text-slate-700 truncate max-w-[110px] leading-tight">{first ?? current}</p>
        <p className="text-[9px] text-slate-400 leading-tight">Assigned</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] font-medium text-slate-700 truncate max-w-[110px] leading-tight">{current}</p>
      <p className="text-[9px] text-slate-400 leading-tight">Forwarded</p>
    </div>
  );
}

export default function TaskTableRow({ task, index, isSelected, onToggle, onEdit, onDelete, onClone, onReassign = null, rowMeta = {}, reportPage = false, report = false}) {
  const { badge: alertBadge = null, badgeCls: alertBadgeCls = "", barColor = "", dueDateCls = "text-slate-500", reminderDateCls = "text-slate-500" } = rowMeta;

  const currentUserId = useSelector((s) => s.auth?.user?.id ?? s.auth?.id ?? null);
  const canAccess = useCanAccess();
  const canEdit = canAccess("tasks", "edit").allowed;
  const canDelete = canAccess("tasks", "delete").allowed;
  const router = useRouter();

  const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const statusCfg = TASK_STATUS_CONFIG_FOR_TABLE[task.status] ?? TASK_STATUS_CONFIG_FOR_TABLE.pending;
  const isOwner = task.task_type === "self"
    ? task.created_by_id === currentUserId
    : task.assigned_by_id === currentUserId;

  const [logModal, setLogModal] = useState(false);

  const finalColor = getTaskRowColor(task);
  const rowBgStyle = isSelected ? { backgroundColor: "#c7d2fe" } : { backgroundColor: taskRowTint(finalColor) };
  const stickyBgColor = isSelected ? "#c7d2fe" : blendHexWithWhite(finalColor, 0.09);
 
  const handleNavigation = () => {
    if (!task?.task_id) return;
    router.push(buildTaskDetailUrl(task.task_id, { report }), { scroll: false });
  };

  return (
    <>
      <tr className="transition-colors cursor-pointer hover:brightness-95" style={rowBgStyle}>
        {/* Color bar */}
        <td className="w-1 p-0 sticky left-0 z-[2]" style={{ backgroundColor: stickyBgColor }}>
          <div className="w-[3px] min-h-[34px]" style={{ backgroundColor: finalColor }} />
        </td>

        {/* Checkbox */}
        <td className="px-2 py-1.5 w-8 sticky left-[3px] z-[2]" style={{ backgroundColor: stickyBgColor }} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(task.task_id)}
            className="w-3.5 h-3.5 rounded border-slate-300 accent-indigo-600 cursor-pointer"
          />
        </td>

        {/* Index */}
        <td
          className="px-1.5 py-1.5 w-7 text-[10px] font-mono sticky left-[36px] z-[2] border-r border-slate-200 transition-colors cursor-pointer text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 hover:underline decoration-indigo-400 underline-offset-2"
          style={{ backgroundColor: stickyBgColor }}
          onClick={handleNavigation}
          title="Click to view details"
        >
          {index}
        </td>

        {/* Title */}
        <td className="px-2 py-1.5 min-w-[240px] max-w-[360px]">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[12px] font-semibold text-slate-800 leading-tight break-words line-clamp-1" title={task.title}>
              {task.title}
            </span>
            {(task.is_recurring === 1 || task.is_recurring === true) && <RepeatIcon size={10} className="text-indigo-400 flex-shrink-0" title="Recurring" />}
            {alertBadge && <span className={`text-[8px] font-bold px-1 py-px rounded border leading-none flex-shrink-0 ${alertBadgeCls}`}>{alertBadge}</span>}
          </div>
          {/* {task.description && (
            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight line-clamp-1 overflow-hidden" title={task.description.replace(/<[^>]+>/g, "")}>
              {task.description.replace(/<[^>]+>/g, "")}
            </p>
          )} */}
        </td>

        {/* Last Remark */}
        <td className="px-2 py-1.5 min-w-[160px] max-w-[240px]">
          {task.last_message && task.status !== "pending" ? (
            <div className="flex flex-col">
              <p className="text-[11px] font-medium text-slate-800 leading-tight break-words line-clamp-2" title={task.last_message}>{task.last_message}</p>
              <p className="text-[9px] text-slate-400 mt-px leading-tight">{formatDateTime(task.last_message_at)}</p>
            </div>
          ) : (
            <span className="text-slate-300 text-[10px]">—</span>
          )}
        </td>

        {/* Status */}
        <td className="px-2 py-1.5 w-28">
          <Badge cfg={statusCfg} colorOverride={finalColor} />
        </td>

        {/* Dates */}
        <td className="px-2 py-1.5 w-20">
          <span className={`flex items-center gap-0.5 text-[11px] whitespace-nowrap ${dueDateCls}`}>
            <Calendar size={9} /> {formatDate(task.due_date) ?? "—"}
          </span>
        </td>
        <td className="px-2 py-1.5 w-20">
          <span className={`flex items-center gap-0.5 text-[11px] whitespace-nowrap ${reminderDateCls}`}>
            <Calendar size={9} /> {formatDate(task.reminder_date ?? task.self_reminder_date) ?? "—"}
          </span>
        </td>

        {/* Category */}
        <td className="px-2 py-1.5 w-24">
          {task.category_name
            ? <span className="px-1.5 py-px rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">{task.category_name}</span>
            : <span className="text-slate-300 text-[10px]">—</span>}
        </td>

        {/* Priority */}
        <td className="px-2 py-1.5 w-20"><Badge cfg={priorityCfg} colorOverride={finalColor} /></td>

        {/* Assigned By / To */}
        <td className="px-2 py-1.5 w-24">
          {task.assigned_by_name
            ? <div><p className="text-[11px] font-medium text-slate-700 truncate max-w-[90px] leading-tight">{task.assigned_by_name}</p></div>
            // ? <div><p className="text-[11px] font-medium text-slate-700 truncate max-w-[90px] leading-tight">{task.assigned_by_name}</p><p className="text-[9px] text-slate-400 leading-tight">Assigner</p></div>
            : <span className="text-slate-300 text-[10px]">—</span>}
        </td>
        <td className="px-2 py-1.5 w-24"><AssignmentInfo task={task} /></td>

        {/* Created At */}
        <td className="px-2 py-1.5 w-28 text-slate-400 text-[10px] whitespace-nowrap leading-tight">{formatDateTime(task.created_at)}</td>

        {/* Type */}
        <td className="px-2 py-1.5 w-16">
          <span className={`text-[10px] font-semibold px-1 py-px rounded border ${task.task_type === "self" ? "bg-violet-50 text-violet-600 border-violet-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
            {task.task_type === "self" ? "Self" : "Assigned"}
          </span>
        </td>

        {/* Created By */}
        <td className="px-2 py-1.5 w-24">
          {task.created_by_name
            ? <div className="min-w-0"><p className="text-[11px] font-medium text-slate-700 truncate max-w-[90px] leading-tight">{task.created_by_name}</p></div>
            // ? <div className="min-w-0"><p className="text-[11px] font-medium text-slate-700 truncate max-w-[90px] leading-tight">{task.created_by_name}</p><p className="text-[9px] text-slate-400 truncate leading-tight">{task.creator_label ?? task.creator_type ?? "User"}</p></div>
            : <span className="text-slate-300 text-[10px]">—</span>}
        </td>

        {/* Actions */}
        <td className="px-1.5 py-1.5 w-28 sticky right-0 z-[2] border-l border-slate-200" style={{ backgroundColor: stickyBgColor }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-0">
            {reportPage && onReassign && (
              <button onClick={(e) => {e.stopPropagation(); onReassign(task);}} className="p-1 rounded text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-all" title="Reassign"><RefreshCw size={12} /></button>
            )}
            <button onClick={handleNavigation} className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all" title="View"><Eye size={12} /></button>
            <button onClick={(e) => { e.stopPropagation(); handleNavigation(); }} className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Activity"><Activity size={12} /></button>
            {canEdit && isOwner && <button onClick={() => onEdit(task)} className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="Edit"><Pencil size={12} /></button>}
            <button onClick={() => onClone(task)} className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all" title="Clone"><Copy size={12} /></button>
            {canDelete && isOwner && <button onClick={() => onDelete(task)} className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all" title="Delete"><Trash2 size={12} /></button>}
          </div>
        </td>
      </tr>

      <ActivityLogModal open={logModal} onClose={() => setLogModal(false)} taskId={task.task_id} taskTitle={task.title} taskStatus={task.status} logs={null} />
    </>
  );
}
