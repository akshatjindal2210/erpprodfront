import dayjs from "dayjs";

/* ── (change here only) ─────────────────────────── */
/** Deduct this many minutes when lunch applies. */
export const LUNCH_DEFAULT_MINUTES = 30;
export const LUNCH_DEFAULT_LABEL = "30 min";

/** Punch Total ≥ this many hours → apply lunch. (4.5 = 4h 30m) */
export const LUNCH_AUTO_HOURS = 4;
export const LUNCH_AUTO_MINUTES = LUNCH_AUTO_HOURS * 60;

/** Next-day Out allowed until this HH:mm (inclusive). */
export const OUT_NEXT_DAY_CUTOFF = "08:30";

/** In time ≥ this hour (24h) → Night shift (B). */
export const NIGHT_SHIFT_FROM_HOUR = 17;

export const DAY_TYPES = [
  { value: "full", label: "Full Day" },
  { value: "half", label: "Half Day" },
];
export const DEFAULT_DAY_TYPE = "full";

/* ── Date helpers ────────────────────────────────────────── */
export function todayYmd() {
  return dayjs().format("YYYY-MM-DD");
}

function ymd(date) {
  return String(date || "").slice(0, 10);
}

function nextYmd(date) {
  const d = ymd(date);
  return d ? dayjs(d).add(1, "day").format("YYYY-MM-DD") : "";
}

function minutesOfHHmm(t) {
  const [h, m] = String(t || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function outMaxDateTime(date) {
  const n = nextYmd(ymd(date));
  return n ? `${n}T${OUT_NEXT_DAY_CUTOFF}` : "";
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
 * Same-day morning Out before In → bump to next day if ≤ OUT_NEXT_DAY_CUTOFF.
 * Never later than next day OUT_NEXT_DAY_CUTOFF.
 */
export function normalizeOutDateTime(value, date, inValue = "") {
  const d = ymd(date);
  const n = nextYmd(d);
  const t = toTimeInput(value);
  if (!d || !t) return "";

  const maxOut = outMaxDateTime(d);
  const inDt = toDateTimeInput(inValue, d) || normalizeInDateTime(inValue, d) || "";
  const cutoffMins = minutesOfHHmm(OUT_NEXT_DAY_CUTOFF);
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

/** In ≥ NIGHT_SHIFT_FROM_HOUR → Night (B), else Day (A). */
export function suggestShiftFromIn(inValue) {
  const hm = toTimeInput(inValue);
  if (!hm) return "A";
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m >= NIGHT_SHIFT_FROM_HOUR * 60 ? "B" : "A";
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
  return [dateTimeKey(rowIn(row)), dateTimeKey(rowOut(row)), defaultShift(row)].join("|");
}

/* ── Duration / lunch / derived ──────────────────────────── */
/** Full datetimes if both have dates; else HH:mm (+24h if end < start). */
function minutesBetween(a, b) {
  const sa = String(a ?? "").trim();
  const sb = String(b ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(sa) && /^\d{4}-\d{2}-\d{2}/.test(sb)) {
    const start = dayjs(sa);
    const end = dayjs(sb);
    if (start.isValid() && end.isValid()) {
      const mins = end.diff(start, "minute");
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

/** "8 hr 2 min" or "-2 hr 30 min" */
export function formatDuration(mins) {
  if (mins == null || !Number.isFinite(mins)) return "—";
  const rounded = Math.round(mins);
  const sign = rounded < 0 ? "-" : "";
  const m = Math.abs(rounded);
  return `${sign}${Math.floor(m / 60)} hr ${m % 60} min`;
}

export function rawWorkMinutes(row) {
  return minutesBetween(rowIn(row), rowOut(row));
}

/** Punch ≥ LUNCH_AUTO → lunch yes. */
export function suggestLunch(row) {
  const raw = rawWorkMinutes(row);
  return raw != null && raw >= LUNCH_AUTO_MINUTES ? "yes" : "no";
}

/**
 * lunch / day_type / optional shift sync.
 * syncShift: true → In ≥ 17:00 forces Night (use on In change / new row).
 */
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
    day_type: row?.day_type === "half" || row?.day_type === "full" ? row.day_type : DEFAULT_DAY_TYPE,
    shift,
  };
}

/** Half expected = (full − lunch) / 2 + lunch  e.g. 8h30 → 4h30 */
function halfDayExpectedMinutes(fullDefaultMins) {
  if (fullDefaultMins == null) return null;
  const net = Math.max(0, fullDefaultMins - LUNCH_DEFAULT_MINUTES);
  return net / 2 + LUNCH_DEFAULT_MINUTES;
}

/** Actual lunch from punch: ≥ LUNCH_AUTO hours → 30 min, else 0. */
function lunchFromPunch(punchedMins) {
  if (punchedMins == null) return null;
  return punchedMins >= LUNCH_AUTO_MINUTES ? LUNCH_DEFAULT_MINUTES : 0;
}

/** Expected day length (Full = default In→Out, Half = half formula). */
function expectedDayMinutes(fullDefaultMins, isHalf) {
  if (fullDefaultMins == null) return null;
  return isHalf ? halfDayExpectedMinutes(fullDefaultMins) : fullDefaultMins;
}

function otTone(otMins) {
  if (otMins == null) return "muted";
  if (otMins > 0) return "ot";
  if (otMins < 0) return "neg";
  return "muted";
}

/**
 * Working Hours — one place for UI math. Change carefully.
 *
 * Inputs:  default_in/out, day_type, in, out
 * Outputs: defaultLabel + Total / Lunch / Normal / OT
 *
 *   Total   = In → Out
 *   Lunch   = 30 if Total ≥ LUNCH_AUTO else 0
 *   Expected= Full default | Half = (full − 30)/2 + 30
 *   Normal  = min(Total − Lunch, Expected − lunchInExpected)
 *   OT      = Total − Expected   (+ late / − early)
 */
export function rowTotals(row) {
  const fullDefault = minutesBetween(row?.default_in, row?.default_out);
  const isHalf = String(row?.day_type || "").toLowerCase() === "half";
  const total = minutesBetween(rowIn(row), rowOut(row)); // null until both In + Out

  const lunch = lunchFromPunch(total);
  const expected = expectedDayMinutes(fullDefault, isHalf);

  // Half always plans 30 lunch inside expected; Full uses actual lunch for the cap
  const lunchInExpected = isHalf ? LUNCH_DEFAULT_MINUTES : lunch ?? 0;
  const normalCap = expected == null ? null : Math.max(0, expected - lunchInExpected);
  const worked = total == null || lunch == null ? null : Math.max(0, total - lunch);
  const normal = worked == null || normalCap == null ? null : Math.min(worked, normalCap);
  const ot = total == null || expected == null ? null : total - expected;

  const lines = [
    { key: "total", label: "Total", mins: total, tone: "slate" },
    { key: "lunch", label: "Lunch", mins: lunch, tone: "lunch" },
    { key: "normal", label: "Normal", mins: normal, tone: "green" },
    { key: "ot", label: "OT", mins: ot, tone: otTone(ot) },
  ].map((line) => ({ ...line, value: formatDuration(line.mins) }));

  return {
    defaultMins: expected,
    fullDefault,
    defaultLabel: formatDuration(expected),
    total,
    lunch,
    normal,
    ot,
    lines,
  };
}

export function isUnapproved(row) {
  const s = String(row?.approval_status || "").trim().toLowerCase();
  return !s || s === "unapproved" || s === "pending";
}
