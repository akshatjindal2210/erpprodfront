export const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", }) : "—";

/** CL task scheduled_date — date-only, no raw ISO in UI */
export function formatScheduledDate(val) {
  if (!val) return "—";
  const d = String(val).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  }
  return formatDateTime(val);
}

function istDateTimeParts(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
}

function partsToDateTimeLocal(parts) {
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Normalize API/DB timestamps for `<input type="datetime-local" />` (IST wall clock). */
export function toDateTimeLocalInput(value) {
  if (value == null || value === "") return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return partsToDateTimeLocal(istDateTimeParts(value));
  }

  const text = String(value).trim();
  const hasTz = /[Zz]$|[+-]\d{2}:\d{2}$/.test(text);
  const naive = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  if (naive && !hasTz) return `${naive[1]}T${naive[2]}:${naive[3]}`;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return partsToDateTimeLocal(istDateTimeParts(parsed));
}

/** Pretty label for datetime-local value (IST wall clock, no UTC shift). */
export function formatDateTimeLocalLabel(value) {
  if (!value) return "";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return formatDateTime(value);
  return formatDateTime(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+05:30`);
}

export function formatDateTime(date, options = {}) {
  if (!date) return "—";

  const defaultOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  return new Date(date).toLocaleString(
    "en-IN",
    { ...defaultOptions, ...options, timeZone: "Asia/Kolkata" }
  );
}

export function getInitials(name = "") {
  if (!name) return "??";

  const words = name.trim().split(" ");

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words[0][0] + words[1][0]
  ).toUpperCase();
}

/** Task dropdown label — "Name (Department)" */
export function formatTaskUserOptionLabel(user) {
  const name = user?.name ?? "";
  const dept =
    user?.department?.name ??
    (typeof user?.department === "string" ? user.department : "");
  return dept ? `${name} (${dept})` : name;
}

export function mapTaskUserToOption(user) {
  return {
    ...user,
    id: user.id,
    name: formatTaskUserOptionLabel(user),
  };
}

export const extractList = (res) => {
  const d = res.data;
  const raw = d?.data?.items ?? d?.data?.data ?? d?.data ?? d ?? [];
  return Array.isArray(raw) ? raw : [];
};

export const maskTaskId = (id) => {
  if (!id) return "";
  const pattern = `TSK${id}Z${id * 7}`; 
  return btoa(pattern).replace(/=/g, "");
};

// recurringHelper.js
// helpers/recurringHelper.js
const WEEKDAYS_MAP = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS_MAP = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// monthly ordinal helper
function getOrdinal(n) {
  const i = parseInt(n, 10);
  const j = i % 10, k = i % 100;
  if (j === 1 && k !== 11) return i + "st";
  if (j === 2 && k !== 12) return i + "nd";
  if (j === 3 && k !== 13) return i + "rd";
  return i + "th";
}

export function parseRecurrence(task) {
  if (!task.recurrence_type) return "-";

  switch (task.recurrence_type.toLowerCase()) {
    case "daily":
      return "Daily";

    case "weekly":
      if (!task.recurrence_weekdays) return "-";
      try {
        const days = JSON.parse(task.recurrence_weekdays); // ["2","3"]
        return days
          .map(d => WEEKDAYS_MAP[parseInt(d, 10)])
          .join(", ");
      } catch {
        return "-";
      }

    case "monthly":
      if (!task.recurrence_month_dates) return "-";
      try {
        const dates = JSON.parse(task.recurrence_month_dates);
        return dates.map(d => getOrdinal(d)).join(", ");
      } catch {
        return "-";
      }

    case "yearly":
      if (!task.recurrence_year_dates) return "-";
      try {
        const dates = JSON.parse(task.recurrence_year_dates); // ["03-09"]
        return dates
          .map(d => {
            const [month, day] = d.split("-").map(Number);
            return `${MONTHS_MAP[month - 1]} ${day}`;
          })
          .join(", ");
      } catch {
        return "-";
      }

    default:
      return "-";
  }
}
