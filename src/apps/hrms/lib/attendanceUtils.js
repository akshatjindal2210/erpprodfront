import dayjs from "dayjs";

export function todayYmd() {
  return dayjs().format("YYYY-MM-DD");
}

export function toTimeInput(value) {
  if (value == null || String(value).trim() === "") return "";
  const s = String(value).trim();
  const iso = s.match(/T(\d{2}):(\d{2})/i);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const plain = s.match(/^(\d{1,2}):(\d{2})/);
  if (plain) return `${String(plain[1]).padStart(2, "0")}:${plain[2]}`;
  return "";
}

export function rowIn(row) {
  return row?.in ?? null;
}

export function rowOut(row) {
  return row?.out ?? null;
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
  return [dateTimeKey(rowIn(row)), dateTimeKey(rowOut(row)), row?.shift === "B" ? "B" : "A"].join("|");
}

export function defaultShift(row) {
  return row?.shift === "B" ? "B" : "A";
}

export function defaultTimesFromEmployee(item) {
  return {
    in: toTimeInput(item?.emp_intime_display) || toTimeInput(item?.emp_intime) || "",
    out: toTimeInput(item?.emp_outtime_display) || toTimeInput(item?.emp_outtime) || "",
  };
}

export function isUnapproved(row) {
  const s = String(row?.approval_status || "").trim().toLowerCase();
  return !s || s === "unapproved" || s === "pending";
}
