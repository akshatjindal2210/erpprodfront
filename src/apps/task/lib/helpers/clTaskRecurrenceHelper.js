/** Client-side recurrence checks — mirrors backend clTaskRecurrence.helper.js */

function toYmd(val) {
  if (val == null || val === "") return "";
  const s = String(val).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : "";
}

export function parseRecurrenceArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function weekdayFromYmd(ymd) {
  const s = toYmd(ymd);
  if (!s) return 0;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

function normalizeWeekdays(weekdays) {
  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  return parseRecurrenceArray(weekdays)
    .map((raw) => {
      if (typeof raw === "number" && Number.isFinite(raw)) return raw;
      const s = String(raw).trim().toLowerCase();
      if (/^\d+$/.test(s)) return Number(s);
      return dayMap[s] ?? -1;
    })
    .filter((d) => d >= 0 && d <= 6);
}

export function isSundayYmd(ymd) {
  return weekdayFromYmd(ymd) === 0;
}

/** True when ymd matches the task recurrence schedule (weekly day, monthly date, etc.). */
export function isClOccurrenceDay(recurrence_type, data = {}, ymd = null, options = {}) {
  const includeSunday = options.includeSunday === true;
  const day = toYmd(ymd);
  if (!day) return false;

  if (!includeSunday && isSundayYmd(day)) return false;

  const weekdays = parseRecurrenceArray(data.recurrence_weekdays);
  const monthDates = parseRecurrenceArray(data.recurrence_month_dates);
  const yearDates = parseRecurrenceArray(data.recurrence_year_dates);
  const recur = String(recurrence_type || "daily").toLowerCase();

  if (recur === "daily" || !recur) return true;

  if (recur === "weekly") {
    const days = normalizeWeekdays(weekdays);
    if (!days.length) return true;
    return days.includes(weekdayFromYmd(day));
  }

  if (recur === "monthly") {
    const sorted = monthDates.map(Number).filter((n) => !Number.isNaN(n) && n >= 1 && n <= 31);
    if (!sorted.length) return true;
    const d = Number(day.slice(8, 10));
    return sorted.includes(d);
  }

  if (recur === "yearly") {
    if (!yearDates.length) return true;
    const mmdd = day.slice(5, 10);
    return yearDates.map(String).includes(mmdd);
  }

  return true;
}

export function isFrequentTaskOccurrenceDay(task, ymd) {
  if (String(task?.task_type || "").toLowerCase() !== "frequently") return false;
  return isClOccurrenceDay(
    task.recurrence_type || "daily",
    {
      recurrence_weekdays: task.recurrence_weekdays,
      recurrence_month_dates: task.recurrence_month_dates,
      recurrence_year_dates: task.recurrence_year_dates,
    },
    ymd,
    { includeSunday: task.include_sunday === true },
  );
}

export function taskHasStoredDay(task, ymd) {
  if (!ymd || !task) return false;
  const states = task.day_states;
  const scores = task.day_scores;
  return Boolean(
    (states && typeof states === "object" && ymd in states) ||
      (scores && typeof scores === "object" && ymd in scores),
  );
}

/** Report grid: show cell on due/past occurrence days (or days with stored instance data). */
export function shouldShowTaskDayCell(task, ymd, today = null) {
  if (!ymd || !task) return false;
  if (taskHasStoredDay(task, ymd)) return true;
  const type = String(task.task_type || "").toLowerCase();
  if (type === "open") return false;
  if (type === "frequently") {
    const t =
      today ||
      (typeof window !== "undefined"
        ? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
        : "");
    if (t && ymd > t) return false;
    return isFrequentTaskOccurrenceDay(task, ymd);
  }
  return false;
}
