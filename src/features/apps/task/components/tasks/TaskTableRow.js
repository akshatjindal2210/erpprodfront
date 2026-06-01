import { Pencil, Trash2, Calendar, RepeatIcon, Eye, Copy, Activity, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRIORITY_CONFIG, TASK_STATUS_CONFIG_FOR_TABLE } from "@/features/apps/task/components/common/Constants";
import { formatDate, formatDateTime } from "@/features/apps/task/helpers/utilHelper";
import { buildTaskDetailUrl } from "@/features/apps/task/helpers/taskRouteHelper";
import { useSelector } from "react-redux";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { ActivityLogModal } from "./SubPageExtra";

const COLORS = {
  total: "#696969",
  pending: "#00eeff",
  in_progress: "#0e79aa",
  completed: "#2bff00",
  action_required: "#ff0000",
  overdue: "#ff0000",
  new_today: "#0011ff",
  reminder: "#ff8800",
  upcoming_due: "#ffe600",
  creator_pending: "#8800ff",
};

function getTaskRowColor(task) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d)) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const taskDue = parseDate(task.due_date);
  const reminder = parseDate(task.reminder_date) || parseDate(task.self_reminder_date);
  const createdAt = parseDate(task.created_at);

  const isToday = (date) => date && date.getTime() === today.getTime();
  const isBeforeToday = (date) => date && date.getTime() < today.getTime();
  const isAfterToday = (date) => date && date.getTime() > today.getTime();

  // 1. Pending Approval
  if (task.status === "creator_pending") return COLORS.creator_pending;

  // 2. Reminder exists
  if (reminder && isToday(reminder)) return COLORS.reminder;

  // 3. Upcoming Due / Due Today
  // if (taskDue && !["completed", "closed"].includes(task.status)) {
  //   if (isAfterToday(taskDue) || isToday(taskDue)) return COLORS.upcoming_due;
  // }

  // Tomorrow calculate
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const isTomorrow = (date) => date && date.getTime() === tomorrow.getTime();

  // 3. Overdue (check FIRST)
  if (taskDue && isBeforeToday(taskDue) && !["completed", "closed"].includes(task.status)) {
    return COLORS.overdue;
  }

  // 4. Upcoming (Aaj + Kal)
  if (
    taskDue &&
    !["completed", "closed"].includes(task.status) &&
    (isToday(taskDue) || isTomorrow(taskDue))
  ) {
    return COLORS.upcoming_due;
  }

  // 4. Overdue
  if (taskDue && isBeforeToday(taskDue) && !["completed", "closed"].includes(task.status)) return COLORS.overdue;

  // 5. In Progress
  if (task.status === "in_progress") return COLORS.in_progress;

  // 6. New Today (created today)
  if (createdAt && isToday(createdAt)) return COLORS.new_today;

  // 7. Pending
  if (task.status === "pending") return COLORS.pending;

  // 8. Completed
  if (task.status === "completed") return COLORS.completed;


  // Default
  return COLORS.total;
}

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

function Badge({ cfg, colorOverride }) {
  if (!cfg) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${cfg.badge}`}
      style={{ borderColor: colorOverride ?? "", color: colorOverride ?? "" }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`}
        style={{ backgroundColor: colorOverride ?? "" }}
      />
      {cfg.label}
    </span>
  );
}

function AssignmentInfo({ task }) {
  const first = task.first_assigned_to_name;
  const current = task.current_holder_name;

  if (!first && !current) return <span className="text-slate-300 text-xs">—</span>;
  if (first === current || !current) {
    return (
      <div>
        <p className="text-xs font-medium text-slate-700 truncate max-w-[120px]">{first ?? current}</p>
        <p className="text-[10px] text-slate-400">Assigned</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium text-slate-700 truncate max-w-[120px]">{current}</p>
      <p className="text-[10px] text-slate-400">Forwarded</p>
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
  const rowBgStyle = isSelected ? { backgroundColor: "#c7d2fe" } : { backgroundColor: `${finalColor}18` };
  const stickyBgColor = isSelected ? "#c7d2fe" : blendWithWhite(finalColor, 0.09);
 
  const handleNavigation = () => {
    if (!task?.task_id) return;
    router.push(buildTaskDetailUrl(task.task_id, { report }), { scroll: false });
  };

  return (
    <>
      <tr className="transition-colors cursor-pointer hover:brightness-95" style={rowBgStyle} >
      {/* <tr className="transition-colors cursor-pointer hover:brightness-95" style={rowBgStyle} onClick={handleNavigation}> */}
      {/* <tr className="transition-colors cursor-pointer hover:brightness-95" style={rowBgStyle} onClick={() => router.push(`/task/dashboard/tasks/${task.task_id}`)}> */}
        {/* Color bar */}
        <td className="w-1 p-0 sticky left-0 z-[2]" style={{ backgroundColor: stickyBgColor }}>
          <div className="w-[5px] min-h-[52px]" style={{ backgroundColor: finalColor }} />
        </td>

        {/* Checkbox */}
        <td className="px-3 py-3 w-8 sticky left-[5px] z-[2]" style={{ backgroundColor: stickyBgColor }} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(task.task_id)}
            className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
          />
        </td>

        {/* Index */}
        <td 
          className="px-2 py-3 w-8 text-xs font-mono sticky left-[44px] z-[2] border-r border-slate-200 transition-colors cursor-pointer text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 hover:underline decoration-indigo-400 underline-offset-4" 
          style={{ backgroundColor: stickyBgColor }}
          onClick={handleNavigation}
          title="Click to view details"
        >
          {index}
        </td>
        {/* <td className="px-2 py-3 w-8 text-xs text-slate-400 font-mono sticky left-[44px] z-[2] border-r border-slate-200" style={{ backgroundColor: stickyBgColor }} onClick={handleNavigation}>
          {index}
        </td> */}

        {/* Title */}
        <td className="px-3 py-3 min-w-[312px] max-w-[400px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-slate-800 leading-snug break-words line-clamp-2" title={task.title}>
              {task.title}
            </span>
            {(task.is_recurring === 1 || task.is_recurring === true) && <RepeatIcon size={11} className="text-indigo-400 flex-shrink-0" title="Recurring" />}
            {alertBadge && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none flex-shrink-0 ${alertBadgeCls}`}>{alertBadge}</span>}
          </div>
          {task.description && <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2 overflow-hidden" title={task.description.replace(/<[^>]+>/g, "")}>{task.description.replace(/<[^>]+>/g, "")}</p>}
        </td>

        {/* Last Remark */}
        <td className="px-4 py-3 min-w-[212px] max-w-[300px]">
          {task.last_message && task.status !== "pending" ? (
            <div className="flex flex-col">
              <p className="text-xs font-semibold text-slate-800 leading-relaxed break-words line-clamp-3" title={task.last_message}>{task.last_message}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{formatDateTime(task.last_message_at)}</p>
            </div>
          ) : (
            <span className="text-slate-300 text-xs">—</span>
          )}
        </td>

        {/* Status */}
        <td className="px-3 py-3 w-32">
          <Badge cfg={statusCfg} colorOverride={finalColor} />
        </td>

        {/* Dates */}
        <td className="px-3 py-3 w-24">
          <span className={`flex items-center gap-1 text-xs whitespace-nowrap ${dueDateCls}`}>
            <Calendar size={10} /> {formatDate(task.due_date) ?? "—"}
          </span>
        </td>
        <td className="px-3 py-3 w-24">
          <span className={`flex items-center gap-1 text-xs whitespace-nowrap ${reminderDateCls}`}>
            <Calendar size={10} /> {formatDate(task.reminder_date ?? task.self_reminder_date) ?? "—"}
          </span>
        </td>

        {/* Category */}
        <td className="px-3 py-3 w-28">
          {task.category_name ? <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">{task.category_name}</span> : <span className="text-slate-300 text-xs">—</span>}
        </td>

        {/* Priority */}
        <td className="px-3 py-3 w-24"><Badge cfg={priorityCfg} colorOverride={finalColor} /></td>

        {/* Assigned By / To */}
        <td className="px-4 py-3 w-28">
          {task.assigned_by_name ? <div><p className="text-xs font-medium text-slate-700 truncate max-w-[100px]">{task.assigned_by_name}</p><p className="text-[10px] text-slate-400">Assigner</p></div> : <span className="text-slate-300 text-xs">—</span>}
        </td>
        <td className="px-3 py-3 w-28"><AssignmentInfo task={task} /></td>

        {/* Created At */}
        <td className="px-3 py-3 w-32 text-slate-400 text-[11px] whitespace-nowrap">{formatDateTime(task.created_at)}</td>

        {/* Type */}
        <td className="px-3 py-3 w-20">
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md border ${task.task_type === "self" ? "bg-violet-50 text-violet-600 border-violet-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
            {task.task_type === "self" ? "Self" : "Assigned"}
          </span>
        </td>

        {/* Created By */}
        <td className="px-3 py-3 w-28">
          {task.created_by_name ? <div className="min-w-0"><p className="text-xs font-medium text-slate-700 truncate max-w-[100px]">{task.created_by_name}</p><p className="text-[10px] text-slate-400 truncate">{task.creator_label ?? task.creator_type ?? "User"}</p></div> : <span className="text-slate-300 text-xs">—</span>}
        </td>

        {/* Actions */}
        <td className="px-3 py-3 w-32 sticky right-0 z-[2] border-l border-slate-200" style={{ backgroundColor: stickyBgColor }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-0.5">
            {reportPage && onReassign && (
              <button onClick={(e) => {e.stopPropagation(); onReassign(task);}} className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-all" title="Reassign"><RefreshCw size={13} /></button>
            )}
            <button onClick={handleNavigation} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all" title="View"><Eye size={13} /></button>
            <button onClick={(e) => { e.stopPropagation(); handleNavigation(); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Activity"><Activity size={13} /></button>
            {/* <button onClick={(e) => { e.stopPropagation(); setLogModal(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Activity"><Activity size={13} /></button> */}
            {canEdit && isOwner && <button onClick={() => onEdit(task)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="Edit"><Pencil size={13} /></button>}
            <button onClick={() => onClone(task)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all" title="Clone"><Copy size={13} /></button>
            {canDelete && isOwner && <button onClick={() => onDelete(task)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all" title="Delete"><Trash2 size={13} /></button>}
          </div>
        </td>
      </tr>

      <ActivityLogModal open={logModal} onClose={() => setLogModal(false)} taskId={task.task_id} taskTitle={task.title} taskStatus={task.status} logs={null} />
    </>
  );
}
