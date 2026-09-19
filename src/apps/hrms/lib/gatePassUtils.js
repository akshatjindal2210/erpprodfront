import dayjs from "dayjs";

/** Add new gate pass types here only — DB stores plain text, no enum in table.js */
export const PASS_TYPE_OPTIONS = [
  { value: "personal", label: "Personal" },
  { value: "official", label: "Official" },
  { value: "medical", label: "Medical" },
];

export const PASS_TYPE_FILTER_OPTIONS = [{ label: "All Types", value: "" }, ...PASS_TYPE_OPTIONS];

/** Supervisor/HOD → HR → approved (both stamps). */
export function gatePassStatus(row) {
  if (row?.sup_at && row?.hr_at) return "approved";
  if (row?.sup_at) return "pending_hr";
  return "pending_manager";
}

export function isPendingHr(row) {
  return gatePassStatus(row) === "pending_hr";
}

export function isPendingManager(row) {
  return gatePassStatus(row) === "pending_manager";
}

export function isFullyApproved(row) {
  return gatePassStatus(row) === "approved";
}

/**
 * Calendar: pass date from today (0) up to today + N days.
 * N = 0 → only today | N = 1 → today + tomorrow (current setting).
 */
export const PASS_DATE_MAX_FUTURE_DAYS = 1;

export function minAllowedPassDateYmd(now = dayjs()) {
  return now.format("YYYY-MM-DD");
}

export function maxAllowedPassDateYmd(now = dayjs()) {
  return now.add(PASS_DATE_MAX_FUTURE_DAYS, "day").format("YYYY-MM-DD");
}

export function combinePassDateTime(dateYmd, timeHm) {
  const d = String(dateYmd ?? "").trim();
  const t = String(timeHm ?? "").trim();
  if (!d || !t) return null;
  const hm = t.length === 5 ? `${t}:00` : t;
  const combined = dayjs(`${d}T${hm}+05:30`);
  return combined.isValid() ? combined.toISOString() : null;
}

export function validatePassDateYmd(dateYmd, now = dayjs()) {
  const d = dayjs(String(dateYmd ?? "").trim());
  if (!d.isValid()) return { ok: false, message: "Invalid date" };
  const minDay = now.startOf("day");
  const maxDay = minDay.add(PASS_DATE_MAX_FUTURE_DAYS, "day");
  if (d.startOf("day").isBefore(minDay)) return { ok: false, message: "Date cannot be before today" };
  if (d.startOf("day").isAfter(maxDay)) {
    return { ok: false, message: PASS_DATE_MAX_FUTURE_DAYS ? "Date cannot be after tomorrow" : "Only today is allowed" };
  }
  return { ok: true };
}

export function resolveGatePassOutIn(passDate, outHm, inHm) {
  const date = String(passDate ?? "").trim();
  if (!date) return { ok: false, message: "Date is required" };

  const dateCheck = validatePassDateYmd(date);
  if (!dateCheck.ok) return dateCheck;

  let out = dayjs(combinePassDateTime(date, outHm));
  let inn = dayjs(combinePassDateTime(date, inHm));
  if (!out.isValid()) return { ok: false, message: "Out time is required" };
  if (!inn.isValid()) return { ok: false, message: "In time is required" };

  if (!inn.isAfter(out)) inn = inn.add(1, "day");
  const maxIn = dayjs(`${date}T00:00:00+05:30`).add(1, "day").endOf("day");
  if (inn.isAfter(maxIn)) return { ok: false, message: "In time must be same day or next day only" };
  if (!inn.isAfter(out)) return { ok: false, message: "In time must be after out time" };

  return { ok: true, outIso: out.toISOString(), inIso: inn.toISOString() };
}

export function toTimeInput(value) {
  const d = dayjs(value);
  return d.isValid() ? d.format("HH:mm") : "";
}

/** View drawer: clock on pass date; next-day in shows small date hint. */
export function gatePassTimeView(row, kind) {
  const key = kind === "in" ? "in_time" : "out_time";
  const iso = row?.[key];
  const fallback = row?.[`${key}_display`];
  const d = dayjs(iso);
  if (!d.isValid()) return fallback || "—";
  const passYmd = String(row?.pass_date ?? "").slice(0, 10);
  const time = d.format("h:mm A");
  if (!passYmd || d.format("YYYY-MM-DD") === passYmd) return time;
  return `${time} (${d.format("DD/MM/YYYY")})`;
}

export function formatDuration(outTime, inTime) {
  const out = dayjs(outTime);
  const inn = dayjs(inTime);
  if (!out.isValid() || !inn.isValid() || !inn.isAfter(out)) return "—";
  const mins = inn.diff(out, "minute");
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function formatDurationFromParts(passDate, outHm, inHm) {
  const outIso = combinePassDateTime(passDate, outHm);
  const inIso = combinePassDateTime(passDate, inHm);
  return formatDuration(outIso, inIso);
}

/** e.g. 1:00 PM – 3:00 PM (2h) */
export function formatPassDurationLabel(passDate, outHm, inHm) {
  if (!String(passDate ?? "").trim() || !String(outHm ?? "").trim() || !String(inHm ?? "").trim()) {
    return "—";
  }
  const resolved = resolveGatePassOutIn(passDate, outHm, inHm);
  if (!resolved.ok) return "—";
  const out = dayjs(resolved.outIso);
  const inn = dayjs(resolved.inIso);
  const span = `${out.format("h:mm A")} – ${inn.format("h:mm A")}`;
  const len = formatDuration(resolved.outIso, resolved.inIso);
  const dayHint = out.format("YYYY-MM-DD") !== inn.format("YYYY-MM-DD") ? " · next day" : "";
  return len && len !== "—" ? `${span}${dayHint} (${len})` : span;
}

export function toDateTimeInput(value) {
  const d = dayjs(value);
  return d.isValid() ? d.format("YYYY-MM-DDTHH:mm") : "";
}

export function todayYmd() {
  return dayjs().format("YYYY-MM-DD");
}
