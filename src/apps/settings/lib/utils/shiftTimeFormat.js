/**
 * Shift time helpers — DB: start_time, end_time, lunch.
 * Net hours match backend netShiftHours (shiftHours.util.js); LUNCH_MIN = 30.
 */

export const LUNCH_MIN = 30;

function toMins(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.getHours() * 60 + v.getMinutes();
  const s = String(v).trim();
  const iso = s.match(/T(\d{2}):(\d{2})/);
  if (iso) return Number(iso[1]) * 60 + Number(iso[2]);
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!ampm) return null;
  let h = Number(ampm[1]);
  const m = Number(ampm[2]);
  if (Number.isNaN(h) || Number.isNaN(m) || m > 59) return null;
  const ap = (ampm[3] || "").toUpperCase();
  if (ap === "AM" || ap === "PM") {
    if (h < 1 || h > 12) return null;
    if (ap === "AM" && h === 12) h = 0;
    if (ap === "PM" && h !== 12) h += 12;
  } else if (h > 23) return null;
  return h * 60 + m;
}

/** Net hours from start/end (+24h if overnight; −30m if lunch). */
export function shiftHours(start, end, lunch = false) {
  const a = toMins(start);
  const b = toMins(end);
  if (a == null || b == null) return 8;
  let m = b - a;
  if (m <= 0) m += 24 * 60;
  if (lunch) m = Math.max(0, m - LUNCH_MIN);
  return Math.round((m / 60) * 10) / 10;
}

export function isOvernight(start, end) {
  const a = toMins(start);
  const b = toMins(end);
  return a != null && b != null && b <= a;
}

export function formatShiftTime(v) {
  const m = toMins(v);
  if (m == null) return v == null || v === "" ? "—" : String(v).trim();
  let h = Math.floor(m / 60);
  const min = String(m % 60).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${min} ${ap}`;
}

export function shiftTimeToInputValue(v) {
  const m = toMins(v);
  if (m == null) return "";
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
