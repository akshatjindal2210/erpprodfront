import dayjs from "dayjs";

/**
 * HRMS attendance UI — display only.
 * ALL formulas → backend/.../attendanceCommon.js (computeAttendanceDerived).
 * Live Add/Edit hours → POST /hrms/attendance/calc
 */

/** Lunch deduct */
export const LUNCH_DEFAULT_MINUTES = 30;

/** Total ≥ this → apply lunch */
export const LUNCH_AUTO_HOURS = 4;
export const LUNCH_AUTO_MINUTES = LUNCH_AUTO_HOURS * 60;

/** ≥ this → Shift B */
export const NIGHT_SHIFT_FROM = "17:00";
/** Night Out cutoff */
export const NIGHT_SHIFT_END = "08:00";

/** Day codes */
export const DAY_TYPE_MASTER = {
  FD: { name: "Full", value: 1 },
  HD: { name: "Half", value: 0.5 },
};

export const DAY_TYPES = Object.entries(DAY_TYPE_MASTER).map(([value]) => ({
  value,
  label: value,
}));

export const DEFAULT_DAY_TYPE = "FD";

export function normalizeDayType(value) {
  const s = String(value ?? "").trim().toUpperCase();
  if (s === "HD" || s === "HALF") return "HD";
  if (s === "FD" || s === "FULL" || !s) return "FD";
  return DAY_TYPE_MASTER[s] ? s : "FD";
}

export function dayTypeDisplay(value) {
  return normalizeDayType(value);
}

export function dayTypeValue(value) {
  return DAY_TYPE_MASTER[normalizeDayType(value)]?.value ?? 1;
}

export function todayYmd() {
  return dayjs().format("YYYY-MM-DD");
}

function ymd(date) {
  return String(date || "").slice(0, 10);
}

function minutesOfHHmm(t) {
  const [h, m] = String(t || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function nextYmd(date) {
  const d = ymd(date);
  return d ? dayjs(d).add(1, "day").format("YYYY-MM-DD") : "";
}

export function outMaxDateTime(date) {
  const n = nextYmd(ymd(date));
  return n ? `${n}T${NIGHT_SHIFT_END}` : "";
}

/* ── Time parse / format ─────────────────────────────────── */
/** Any time / datetime / "05:00 PM" → HH:mm (24h). AM/PM before plain HH:mm. */
export function toTimeInput(value) {
  if (value == null || String(value).trim() === "") return "";
  const s = String(value).trim();

  const ampm = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)\b/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const mer = ampm[3].toUpperCase();
    if (mer === "AM") {
      if (h === 12) h = 0;
    } else if (h !== 12) {
      h += 12;
    }
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  const iso = s.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (iso) return `${String(parseInt(iso[1], 10)).padStart(2, "0")}:${iso[2]}`;

  const plain = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (plain) return `${String(parseInt(plain[1], 10)).padStart(2, "0")}:${plain[2]}`;

  return "";
}

/** Under-input label like employee master: 08:30 AM */
export function formatDefaultTimeLabel(value) {
  const hm = toTimeInput(value);
  if (!hm) return "—";
  const [h24, min] = hm.split(":").map(Number);
  if (!Number.isFinite(h24) || !Number.isFinite(min)) return "—";
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(min).padStart(2, "0")} ${ampm}`;
}

/** → YYYY-MM-DDTHH:mm for datetime-local */
export function toDateTimeInput(value, baseDate = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}T${iso[2]}:${iso[3]}`;
  const hm = toTimeInput(raw);
  return hm && baseDate ? `${ymd(baseDate)}T${hm}` : "";
}

/* ── In / Out normalize + picker ranges ──────────────────── */
export function normalizeInDateTime(value, date) {
  const d = ymd(date);
  const t = toTimeInput(value);
  return d && t ? `${d}T${t}` : "";
}

/**
 * Out ≥ In.
 * Same-day morning Out before In → bump to next day if ≤ cutoff hour.
 * Never later than next day cutoff hour.
 */
export function normalizeOutDateTime(value, date, inValue = "") {
  const d = ymd(date);
  const n = nextYmd(d);
  const t = toTimeInput(value);
  if (!d || !t) return "";

  const maxOut = outMaxDateTime(d);
  const inDt = toDateTimeInput(inValue, d) || normalizeInDateTime(inValue, d) || "";
  const cutoffMins = minutesOfHHmm(NIGHT_SHIFT_END);
  const tMins = minutesOfHHmm(t);
  const morningOk = tMins != null && cutoffMins != null && tMins <= cutoffMins;

  let part = String(value || "").slice(0, 10);
  if (part !== d && part !== n) {
    part = morningOk && n ? n : d;
  }

  let out = `${part}T${t}`;

  if (inDt && out < inDt && part === d && n && morningOk) {
    const nextOut = `${n}T${t}`;
    if (nextOut >= inDt && (!maxOut || nextOut <= maxOut)) out = nextOut;
  }

  if (maxOut && out > maxOut) out = maxOut;
  if (inDt && out < inDt) return "";
  return out;
}

/** Value for datetime-local (Out always passes In rules). */
export function dateTimeFieldValue(value, date, kind = "in", inValue = "") {
  if (kind === "out") {
    const raw = toDateTimeInput(value, date);
    if (!raw) return "";
    return normalizeOutDateTime(raw, date, inValue) || "";
  }
  return toDateTimeInput(value, date) || normalizeInDateTime(value, date);
}

export function dateRangeForIn(date) {
  const d = ymd(date);
  return d ? { min: `${d}T00:00`, max: `${d}T23:59` } : { min: "", max: "" };
}

/** Out picker: min = In (or day start), max = next day cutoff. */
export function dateRangeForOut(date, inValue = "") {
  const d = ymd(date);
  if (!d) return { min: "", max: "" };
  const inDt = toDateTimeInput(inValue, d) || normalizeInDateTime(inValue, d);
  return { min: inDt || `${d}T00:00`, max: outMaxDateTime(d) };
}

/** null | "before_in" | "after_cutoff" */
export function inOutOrderError(inValue, outValue, date) {
  const d = ymd(date);
  const inDt = toDateTimeInput(inValue, d) || normalizeInDateTime(inValue, d);
  const outDt = toDateTimeInput(outValue, d);
  if (!inDt || !outDt) return null;
  if (outDt < inDt) return "before_in";
  const max = outMaxDateTime(d);
  if (max && outDt > max) return "after_cutoff";
  return null;
}

/* ── Row accessors / shift / fingerprint ─────────────────── */
export function rowIn(row) {
  return row?.in ?? null;
}

export function rowOut(row) {
  return row?.out ?? null;
}

export function defaultShift(row) {
  return row?.shift === "B" ? "B" : "A";
}

/** In ≥ NIGHT_SHIFT_FROM → Night (B), else Day (A). */
export function suggestShiftFromIn(inValue) {
  const hm = toTimeInput(inValue);
  if (!hm) return "A";
  return minutesOfHHmm(hm) >= minutesOfHHmm(NIGHT_SHIFT_FROM) ? "B" : "A";
}

export function defaultTimesFromEmployee(item) {
  return {
    in: toTimeInput(item?.emp_intime_display) || toTimeInput(item?.emp_intime) || "",
    out: toTimeInput(item?.emp_outtime_display) || toTimeInput(item?.emp_outtime) || "",
  };
}

function dateTimeKey(value) {
  if (value == null || String(value).trim() === "") return "";
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2}).*?(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}T${iso[2]}:${iso[3]}`;
  const hm = toTimeInput(raw);
  return hm ? `T${hm}` : "";
}

export function rowFingerprint(row) {
  return [dateTimeKey(rowIn(row)), dateTimeKey(rowOut(row)), defaultShift(row), normalizeDayType(row?.day_type)].join("|");
}

/* ── Duration / lunch / derived ──────────────────────────── */
/** Full datetimes if both have dates; else HH:mm (+24h if end < start). */
function minutesBetween(a, b, { allowNegative = false } = {}) {
  const sa = String(a ?? "").trim();
  const sb = String(b ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(sa) && /^\d{4}-\d{2}-\d{2}/.test(sb)) {
    const start = dayjs(sa);
    const end = dayjs(sb);
    if (start.isValid() && end.isValid()) {
      const mins = end.diff(start, "minute");
      if (allowNegative) return mins;
      return mins >= 0 ? mins : null;
    }
  }
  const ta = toTimeInput(a);
  const tb = toTimeInput(b);
  if (!ta || !tb) return null;
  const [ah, am] = ta.split(":").map(Number);
  const [bh, bm] = tb.split(":").map(Number);
  let start = ah * 60 + am;
  let end = bh * 60 + bm;
  if (end < start) end += 24 * 60;
  return end - start;
}

/** "8 hr 2 min" — Add Daily Attendance table */
export function formatDurationShort(mins) {
  if (mins == null || !Number.isFinite(mins)) return "—";
  const rounded = Math.round(mins);
  const sign = rounded < 0 ? "-" : "";
  const m = Math.abs(rounded);
  return `${sign}${Math.floor(m / 60)} hr ${m % 60} min`;
}

/** "8 hr 2 min (482 min)" — View / Edit / Approve drawer */
export function formatDuration(mins) {
  if (mins == null || !Number.isFinite(mins)) return "—";
  const rounded = Math.round(mins);
  const sign = rounded < 0 ? "-" : "";
  const m = Math.abs(rounded);
  return `${sign}${Math.floor(m / 60)} hr ${m % 60} min (${sign}${m} min)`;
}

export function rawWorkMinutes(row) {
  return minutesBetween(rowIn(row), rowOut(row));
}

/** Punch ≥ LUNCH_AUTO → lunch yes. */
export function suggestLunch(row) {
  const raw = rawWorkMinutes(row);
  return raw != null && raw >= LUNCH_AUTO_MINUTES ? "yes" : "no";
}

/** Sync lunch/day/shift; syncShift=true → In≥17:00 → B */
export function withDerivedFields(row, { syncShift = false } = {}) {
  const inVal = rowIn(row);
  let shift = "A";
  if (syncShift && inVal) {
    shift = suggestShiftFromIn(inVal);
  } else if (row?.shift === "B" || row?.shift === "A") {
    shift = row.shift;
  } else if (inVal) {
    shift = suggestShiftFromIn(inVal);
  }

  return {
    ...row,
    lunch: suggestLunch(row),
    day_type: normalizeDayType(row?.day_type),
    shift,
  };
}

function otTone(otMins) {
  if (otMins == null) return "muted";
  if (otMins > 0) return "ot";
  if (otMins < 0) return "neg";
  return "muted";
}

export const HOURS_API_KEYS = [
  "total_minutes",
  "lunch",
  "lunch_minutes",
  "worked_minutes",
  "default_minutes",
  "full_default_minutes",
  "normal_minutes",
  "ot_minutes",
  "adjust_minutes",
];

export const EMPTY_HOURS_FIELDS = {
  total_minutes: null,
  lunch: null,
  lunch_minutes: null,
  worked_minutes: null,
  default_minutes: null,
  full_default_minutes: null,
  normal_minutes: null,
  ot_minutes: null,
  adjust_minutes: null,
};

export function pickHoursFields(src = {}) {
  const out = {};
  HOURS_API_KEYS.forEach((key) => {
    if (src[key] !== undefined) out[key] = src[key];
  });
  return out;
}

function numMin(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function hoursPack({ defaultMins, total, lunch, worked, normal, ot, adjust, calcHints = [] }) {
  const otMins = ot == null ? null : Math.max(0, ot);
  const adj = adjust != null && adjust > 0 ? Math.round(adjust) : null;
  const lines = [
    { key: "default", label: "Default", mins: defaultMins, tone: "default" },
    { key: "total", label: "Total", mins: total, tone: "slate" },
    { key: "lunch", label: "Lunch", mins: lunch, tone: "lunch" },
    { key: "normal", label: "Normal", mins: normal, tone: "green" },
    { key: "ot", label: "OT", mins: otMins, tone: otTone(otMins) },
    { key: "adjust", label: "Adjust", mins: adj, tone: "adjust" },
  ].map((line) => ({ ...line, value: formatDuration(line.mins) }));
  return {
    defaultMins,
    fullDefault: defaultMins,
    defaultLabel: formatDuration(defaultMins),
    total,
    lunch,
    normal,
    ot: otMins,
    adjust: adj,
    worked,
    lines,
    calcHints,
  };
}

/** Display backend hours only — no formulas. */
export function hoursFromApi(row = {}) {
  const total = numMin(row.total_minutes);
  const lunch = numMin(row.lunch_minutes) ?? (total == null ? null : (row.lunch === true || row.lunch === 1 || row.lunch === "1" || row.lunch === "t" ? LUNCH_DEFAULT_MINUTES : 0));
  const otRaw = numMin(row.ot_minutes);
  const ot = total == null ? null : otRaw == null ? 0 : otRaw;
  const worked = numMin(row.worked_minutes);
  const normal = numMin(row.normal_minutes);
  const defaultMins = numMin(row.default_minutes) ?? numMin(row.full_default_minutes);
  const adjust = (() => {
    const a = numMin(row.adjust_minutes);
    return a != null && a > 0 ? a : null;
  })();
  const calcHints = [];
  if (defaultMins != null) calcHints.push({ key: "default", text: `${defaultMins} min default` });
  if (total != null) calcHints.push({ key: "total", text: `${total} min (In → Out)` });
  if (total != null && lunch != null) calcHints.push({ key: "lunch", text: lunch > 0 ? `${total} − ${lunch} = ${worked} min after lunch` : `0 min lunch` });
  if (normal != null) calcHints.push({ key: "normal", text: `${normal} min normal` });
  if (ot != null && ot > 0) calcHints.push({ key: "ot", text: `${ot} min OT` });
  if (adjust > 0) calcHints.push({ key: "adjust", text: `${adjust} min adjust` });
  return hoursPack({ defaultMins, total, lunch, worked, normal, ot, adjust, calcHints });
}

export function attendanceHours(row) {
  return hoursFromApi(row || {});
}

export function isUnapproved(row) {
  const s = String(row?.approval_status || "").trim().toLowerCase();
  return !s || s === "unapproved" || s === "pending";
}
