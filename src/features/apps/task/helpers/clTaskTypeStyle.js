/** Shared Open / Daily / Weekly / Monthly / Yearly visual theme for My CL + Verification. */

export function getClTaskTypeKey(task) {
  if (!task) return "open";
  if (task.task_type === "open") return "open";
  const r = String(task.recurrence_type || "").toLowerCase();
  if (r === "daily" || r === "weekly" || r === "monthly" || r === "yearly") return r;
  return "frequently";
}

export function getClTaskTypeLabel(task) {
  const key = getClTaskTypeKey(task);
  if (key === "open") return "Open";
  if (key === "frequently") return "Frequently";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Themes: Open = sky, Daily = emerald, Weekly = amber,
 * Monthly = orange, Yearly = rose, generic Frequently = violet.
 */
export const CL_TASK_TYPE_THEME = {
  open: {
    bar: "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    cardBorder: "border-sky-200 hover:border-sky-300",
    cardSelected: "border-sky-500 ring-2 ring-sky-100 shadow-md shadow-sky-50",
    soft: "bg-sky-50/30",
    row: "[&_td]:!bg-sky-50/70 hover:[&_td]:!bg-sky-50",
  },
  daily: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cardBorder: "border-emerald-200 hover:border-emerald-300",
    cardSelected: "border-emerald-500 ring-2 ring-emerald-100 shadow-md shadow-emerald-50",
    soft: "bg-emerald-50/30",
    row: "[&_td]:!bg-emerald-50/70 hover:[&_td]:!bg-emerald-50",
  },
  weekly: {
    bar: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    cardBorder: "border-amber-200 hover:border-amber-300",
    cardSelected: "border-amber-500 ring-2 ring-amber-100 shadow-md shadow-amber-50",
    soft: "bg-amber-50/30",
    row: "[&_td]:!bg-amber-50/70 hover:[&_td]:!bg-amber-50",
  },
  monthly: {
    bar: "bg-orange-500",
    badge: "bg-orange-50 text-orange-800 border-orange-200",
    cardBorder: "border-orange-200 hover:border-orange-300",
    cardSelected: "border-orange-500 ring-2 ring-orange-100 shadow-md shadow-orange-50",
    soft: "bg-orange-50/30",
    row: "[&_td]:!bg-orange-50/70 hover:[&_td]:!bg-orange-50",
  },
  yearly: {
    bar: "bg-rose-500",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    cardBorder: "border-rose-200 hover:border-rose-300",
    cardSelected: "border-rose-500 ring-2 ring-rose-100 shadow-md shadow-rose-50",
    soft: "bg-rose-50/30",
    row: "[&_td]:!bg-rose-50/70 hover:[&_td]:!bg-rose-50",
  },
  frequently: {
    bar: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    cardBorder: "border-violet-200 hover:border-violet-300",
    cardSelected: "border-violet-500 ring-2 ring-violet-100 shadow-md shadow-violet-50",
    soft: "bg-violet-50/30",
    row: "[&_td]:!bg-violet-50/70 hover:[&_td]:!bg-violet-50",
  },
};

export function getClTaskTypeTheme(task) {
  return CL_TASK_TYPE_THEME[getClTaskTypeKey(task)] || CL_TASK_TYPE_THEME.frequently;
}

export function getClTaskRowClassName(task) {
  if (Number(task?.reject_count) > 0) {
    return "[&_td]:!bg-rose-50 hover:[&_td]:!bg-rose-100/80";
  }
  return getClTaskTypeTheme(task).row;
}
