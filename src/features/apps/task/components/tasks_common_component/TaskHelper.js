import { ROW_META, EMPTY_META, TASK_COLORS, DONE_STATUSES, ACTIVE_STATUSES } from "@/features/apps/task/components/tasks_common_component/TaskConstant";
import { ClipboardList } from "lucide-react";

function localTodayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

const toDateOnly    = (val) => (val ? String(val).slice(0, 10) : null);
const isToday       = (val) => { const s = toDateOnly(val); return !!s && s === localTodayStr(); };
const isBeforeToday = (val) => { const s = toDateOnly(val); return !!s && s <  localTodayStr(); };


function resolveAlertMeta(task, currentUserId) {
  const parseDate = (d) => {
    if (!d) return null;
    const date = new Date(d);
    if (isNaN(date)) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const taskDue = parseDate(task.due_date);
  const reminder = parseDate(task.reminder_date) || parseDate(task.self_reminder_date);
  const createdAt = parseDate(task.created_at);
  const updatedAt = parseDate(task.updated_at);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isToday = (date) => date && date.getTime() === today.getTime();
  const isBeforeToday = (date) => date && date.getTime() < today.getTime();
  const isAfterToday = (date) => date && date.getTime() > today.getTime();

  const isTomorrow = (date) => {
    if (!date) return false;
    const d = new Date(date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return (
      d.getFullYear() === tomorrow.getFullYear() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getDate() === tomorrow.getDate()
    );
  };

  // 1. Pending Approval
  if (task.status === "creator_pending") return ROW_META.creator_pending;

  // 2. Reminder exists today
  if (isToday(reminder)) return ROW_META.reminder;

  // 3. Overdue
  if (taskDue && isBeforeToday(taskDue) && !DONE_STATUSES.includes(task.status)) return ROW_META.overdue;

  // 4. Due Today
  if (taskDue && isToday(taskDue) && !DONE_STATUSES.includes(task.status)) return ROW_META.due_today;

  // 5. Upcoming Due
  // if (taskDue && isAfterToday(taskDue) && !DONE_STATUSES.includes(task.status)) return ROW_META.upcoming_due;
  // 5. Upcoming Due (ONLY today + tomorrow)
  if (taskDue && !DONE_STATUSES.includes(task.status) && (isToday(taskDue) || isTomorrow(taskDue))) return ROW_META.upcoming_due;
  
  // 6. In Progress
  if (task.status === "in_progress") return ROW_META.in_progress;

  // 7. New / unseen updates
  if (createdAt && isToday(createdAt)) return ROW_META.new;
  if (task.has_unseen_updates) return ROW_META.updated;

  // 8. Pending
  if (task.status === "pending") return ROW_META.pending;

  // No alert — TaskTableRow will use default color
  return null;
}

function getActionReasons(task, currentUserId) {
  const reasons = [];
  if (task.status === "creator_pending")                                                                                  reasons.push("approval");
  if (isToday(task.reminder_date) || isToday(task.self_reminder_date))                                                    reasons.push("reminder");
  if (isBeforeToday(task.due_date) && !DONE_STATUSES.includes(task.status))                                               reasons.push("overdue");
  if (isToday(task.due_date) && !DONE_STATUSES.includes(task.status))                                                     reasons.push("due_today");
  if (task.has_unseen_updates)                                                                                           reasons.push("updated");
  if (isToday(task.created_at))                                                                                           reasons.push("new");
  return reasons;
}

export function getRowMeta(task, activeTab, currentUserId, quickFilter, statusFilter) {

  // Completed — only in all/completed filter
  if (task.status === "completed") {
    if (
      activeTab    === "all"       ||
      activeTab    === "completed" ||
      statusFilter === "completed" ||
      quickFilter  === "completed"
    ) return ROW_META.completed;
    return EMPTY_META;
  }

  // Closed — everywhere
  if (task.status === "closed") return ROW_META.closed;

  // Alert priority order — FIRST OF ALL, EVERYWHERE
  const alert = resolveAlertMeta(task, currentUserId);

  // Action Required tab — multiple badges support
  if (activeTab === "action_required") {

    if (task.status === "completed") return EMPTY_META;

    if (!alert) return EMPTY_META;

    const REASON_META_MAP = {
      approval: ROW_META.creator_pending,
      reminder: ROW_META.reminder,
      overdue:  ROW_META.overdue,
      due_today: ROW_META.due_today,
      updated:  ROW_META.updated,
      new:      ROW_META.new,
    };

    const reasons = getActionReasons(task, currentUserId);
    const badges  = reasons
      .map((r) => REASON_META_MAP[r])
      .filter((m) => m?.badge)
      .map((m) => ({ badge: m.badge, badgeCls: m.badgeCls }));

    return { ...alert, badges };
  }
  // Rest of all — quick filter, status filter, assigned_to_me, assigned_by_me, self, all
  // Alert exists → alert color
  // No alert → EMPTY_META (TaskTableRow default)
  return alert ?? EMPTY_META;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export function getActiveStatKey(quickFilter, statusFilter, activeTab) {
  if (quickFilter)                            return quickFilter;
  if (statusFilter && statusFilter !== "All") return statusFilter;
  if (activeTab === "action_required")        return "action_required";
  if (["all", "assigned_to_me", "assigned_by_me", "create_by_me", "self"].includes(activeTab)) return "total";
  return null;
}

export function SortIcon({ sortKey, columnKey, sortDir }) {
  const active = sortKey === columnKey;
  return (
    <span className={`ml-1 text-xs ${active ? "text-indigo-500" : "text-slate-300"}`}>
      {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );
}

export function EmptyState({ activeTab, hasFilter, onReset }) {
  if (activeTab === "action_required") {
    return (
      <>
        <div className="text-4xl mb-3">✅</div>
        <p className="text-base font-semibold text-slate-600">All clear for today!</p>
        <p className="text-xs text-slate-400 mt-1">
          No overdue tasks, reminders, approvals or new assignments for today.
        </p>
      </>
    );
  }
  return (
    <>
      <ClipboardList size={32} className="mx-auto mb-3 opacity-30 text-slate-400" />
      <p className="text-sm text-slate-400">No tasks found</p>
      {hasFilter && (
        <button onClick={onReset} className="text-xs text-indigo-500 hover:underline mt-1">
          Clear filters
        </button>
      )}
    </>
  );
}

/** Same row/card bar colors used by TaskTableRow + TaskCard (original list colors). */
const LIST_ROW_COLORS = {
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

export function getTaskRowColor(task) {
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

  const isSameDay = (date) => date && date.getTime() === today.getTime();
  const isPast = (date) => date && date.getTime() < today.getTime();

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = (date) => date && date.getTime() === tomorrow.getTime();

  if (task.status === "creator_pending") return LIST_ROW_COLORS.creator_pending;
  if (reminder && isSameDay(reminder)) return LIST_ROW_COLORS.reminder;
  if (taskDue && isPast(taskDue) && !["completed", "closed"].includes(task.status)) {
    return LIST_ROW_COLORS.overdue;
  }
  if (
    taskDue &&
    !["completed", "closed"].includes(task.status) &&
    (isSameDay(taskDue) || isTomorrow(taskDue))
  ) {
    return LIST_ROW_COLORS.upcoming_due;
  }
  if (task.status === "in_progress") return LIST_ROW_COLORS.in_progress;
  if (createdAt && isSameDay(createdAt)) return LIST_ROW_COLORS.new_today;
  if (task.status === "pending") return LIST_ROW_COLORS.pending;
  if (task.status === "completed") return LIST_ROW_COLORS.completed;
  return LIST_ROW_COLORS.total;
}

/** Opaque row tints (blended with white) so sticky columns do not show scrolled cells through. */
const TASK_DT_ROW_BY_COLOR = {
  "#696969": "[&_td]:!bg-[#f2f2f2] [&_td:first-child]:!shadow-[inset_3px_0_0_0_#696969]",
  "#00eeff": "[&_td]:!bg-[#e8fdff] [&_td:first-child]:!shadow-[inset_3px_0_0_0_#00eeff]",
  "#0e79aa": "[&_td]:!bg-[#e9f2f6] [&_td:first-child]:!shadow-[inset_3px_0_0_0_#0e79aa]",
  "#2bff00": "[&_td]:!bg-[#eaffe8] [&_td:first-child]:!shadow-[inset_3px_0_0_0_#2bff00]",
  "#ff0000": "[&_td]:!bg-[#ffe8e8] [&_td:first-child]:!shadow-[inset_3px_0_0_0_#ff0000]",
  "#0011ff": "[&_td]:!bg-[#e8e9ff] [&_td:first-child]:!shadow-[inset_3px_0_0_0_#0011ff]",
  "#ff8800": "[&_td]:!bg-[#fff4e8] [&_td:first-child]:!shadow-[inset_3px_0_0_0_#ff8800]",
  "#ffe600": "[&_td]:!bg-[#fffde8] [&_td:first-child]:!shadow-[inset_3px_0_0_0_#ffe600]",
  "#8800ff": "[&_td]:!bg-[#f4e8ff] [&_td:first-child]:!shadow-[inset_3px_0_0_0_#8800ff]",
};

/** IMS DataTable row tint + left color bar — same palette as TaskTableRow / TaskCard. */
export function getTaskDataTableRowClassName(task) {
  const color = getTaskRowColor(task);
  return TASK_DT_ROW_BY_COLOR[color] || TASK_DT_ROW_BY_COLOR["#696969"];
}

export function blendHexWithWhite(hex, alpha = 0.09) {
  const raw = String(hex || "#e2e8f0").replace("#", "");
  const h = raw.length >= 6 ? raw.slice(0, 6) : "e2e8f0";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const br = Math.round(r * alpha + 255 * (1 - alpha));
  const bg = Math.round(g * alpha + 255 * (1 - alpha));
  const bb = Math.round(b * alpha + 255 * (1 - alpha));
  return `rgb(${br},${bg},${bb})`;
}

export function taskRowTint(hex) {
  const raw = String(hex || "#e2e8f0").replace("#", "");
  const h = raw.length >= 6 ? raw.slice(0, 6) : "e2e8f0";
  return `#${h}18`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SubPage
// ─────────────────────────────────────────────────────────────────────────────
export function getTaskColor(task) {
  if (task.status === "creator_pending") return TASK_COLORS.approval;
  if (isBeforeToday(task.due_date) && !DONE_STATUSES.includes(task.status)) return TASK_COLORS.overdue;
  if (isToday(task.due_date) && !DONE_STATUSES.includes(task.status)) return TASK_COLORS.due_today;
  if (isToday(task.reminder_date)) return TASK_COLORS.reminder;
  if (task.due_date && !DONE_STATUSES.includes(task.status)) {
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Today and tomorrow — upcoming_due
    if (due.getTime() === today.getTime() || due.getTime() === tomorrow.getTime()) 
      return TASK_COLORS.upcoming_due;
  }
  if (isToday(task.created_at)) return TASK_COLORS.new_today;
  if (TASK_COLORS[task.status]) return TASK_COLORS[task.status];
  return TASK_COLORS.default;
}

function isActionRequired(task) {
  if (["completed", "closed"].includes(task.status)) return false;

  if (task.status === "creator_pending") return true;
  if (isBeforeToday(task.due_date) && !DONE_STATUSES.includes(task.status)) return true;
  if (isToday(task.due_date) && !DONE_STATUSES.includes(task.status)) return true;
  if (isToday(task.reminder_date) || isToday(task.self_reminder_date)) return true;
  if (isToday(task.updated_at)) return true;
  if (isToday(task.created_at)) return true;
  return false;
}

export function filterSidebarTasks(tasks, tab, search) {
  return tasks.filter((t) => {
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (tab === "action_required") return isActionRequired(t);
    if (tab === "active")          return !DONE_STATUSES.includes(t.status);
    if (tab === "completed")       return DONE_STATUSES.includes(t.status);
    return true;
  });
}

// SidebarCounts — from TASK_COLORS (same colors everywhere)
export function SidebarCounts({ tasks }) {
  const counts = tasks.reduce((acc, t) => {
    const tag = getTaskColor(t).tag;
    if (tag) acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {});

  const chips = [
    { tag: "Approval",     cls: "bg-purple-100 text-purple-600 border-purple-200" },
    { tag: "Overdue",      cls: "bg-red-100 text-red-600 border-red-200"          },
    { tag: "Due Today",    cls: "bg-amber-100 text-amber-600 border-amber-200"    },
    { tag: "Reminder",     cls: "bg-orange-100 text-orange-600 border-orange-200" },
    { tag: "Upcoming Due", cls: "bg-blue-100 text-blue-600 border-blue-200"       },
    { tag: "New",          cls: "bg-sky-100 text-sky-600 border-sky-200"          },
  ].filter(c => counts[c.tag] > 0);

  if (!chips.length) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap justify-end max-w-[72%]">
      {chips.slice(0, 2).map(({ tag, cls }) => (
        <span
          key={tag}
          className={`text-[8px] px-1 py-0.5 rounded-none font-bold border whitespace-nowrap ${cls}`}
        >
          {counts[tag]} {tag}
        </span>
      ))}
    </div>
  );
}
