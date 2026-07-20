export function getISTHour() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0);
}

export function getISTTimeHM() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

export function getISTDateString() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function normalizeDueTime(raw, fallback = "11:00") {
  if (raw == null || raw === "") return fallback;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  const hh = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** 00:00 (12:00 AM) = end of day for fill window (otherwise Due is empty all day). */
export function effectiveFillDeadlineHm(dueTime) {
  const due = normalizeDueTime(dueTime);
  return due === "00:00" ? "23:59" : due;
}

export function isBeforeDueTime(dueTime) {
  return getISTTimeHM() < effectiveFillDeadlineHm(dueTime);
}

export function canSubmitPreviousTask(dueTime = "11:00") {
  return isBeforeDueTime(dueTime);
}

export function getISTTimeLabel() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDueTimeLabel(dueTime) {
  const hm = normalizeDueTime(dueTime);
  if (hm === "00:00") return "11:59 PM (end of day)";
  const [hStr, mStr] = hm.split(":");
  let h = Number(hStr);
  const m = mStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function addDaysYmd(ymd, days) {
  const base = String(ymd || "").match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || String(ymd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return "";
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + (Number(days) || 0));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Normalize scheduled_date / ISO → YYYY-MM-DD (IST-safe). */
function toYmdClientLocal(val) {
  if (val == null || val === "") return "";
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  }
  const s = String(val).trim();
  if (/T18:30:00/i.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    }
  }
  return s.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || "";
}

export function getClTaskFillDeadlineYmd(task) {
  const scheduled = toYmdClientLocal(task?.scheduled_date);
  if (!scheduled) return "";
  const offset = Math.max(0, Math.min(14, Math.floor(Number(task?.day_offset) || 0)));
  return addDaysYmd(scheduled, offset);
}

/** Client-side mirror of backend fill window. */
export function getClTaskFillBlockedReasonClient(task) {
  if (!task) return "Task not found";
  if (task.status && task.status !== "pending") {
    return task.status === "awaiting_verification"
      ? "Already submitted — open History to correct values"
      : "This cycle is already completed";
  }
  if (task.task_type === "open") return null;

  const today = getISTDateString();
  const scheduled = toYmdClientLocal(task.scheduled_date);
  if (scheduled && scheduled > today) return "Future tasks cannot be submitted yet";

  if (task.task_type !== "frequently") return null;

  const due = normalizeDueTime(task.due_time);
  const deadline = getClTaskFillDeadlineYmd(task) || scheduled;
  if (deadline && today > deadline) {
    return `Fill window closed on ${deadline} before ${formatDueTimeLabel(due)} IST`;
  }
  if (deadline && today === deadline && !isBeforeDueTime(due)) {
    return `Fill only before ${formatDueTimeLabel(due)} IST (deadline ${deadline})`;
  }
  return null;
}

/**
 * Frequently task still pending but fill window closed (user missed the deadline).
 * Open tasks are never “missed”.
 */
export function isClTaskMissed(task) {
  if (!task || task.status !== "pending" || task.task_type !== "frequently") return false;
  const today = getISTDateString();
  const scheduled = toYmdClientLocal(task.scheduled_date);
  if (scheduled && scheduled > today) return false;
  const due = normalizeDueTime(task.due_time);
  const deadline = getClTaskFillDeadlineYmd(task) || scheduled;
  if (deadline && today > deadline) return true;
  if (deadline && today === deadline && !isBeforeDueTime(due)) return true;
  return false;
}

/** Pending + still fillable (not missed, not future frequently). */
export function isClTaskDueFillable(task) {
  if (!task || task.status !== "pending") return false;
  if (isClTaskMissed(task)) return false;
  if (task.task_type === "open") return true;
  const today = getISTDateString();
  const scheduled = toYmdClientLocal(task.scheduled_date);
  if (scheduled && scheduled > today) return false;
  return !getClTaskFillBlockedReasonClient(task);
}

export function canStartClTaskNow(task) {
  return task?.status === "pending" && !getClTaskFillBlockedReasonClient(task);
}
