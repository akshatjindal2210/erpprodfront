import dayjs from "dayjs";
import { ROUTES } from "@/apps/hrms/lib/utils/routes";

/** Add new gate pass types here only — DB stores plain text, no enum in table.js */
export const PASS_TYPE_OPTIONS = [
  { value: "personal", label: "Personal" },
  { value: "official", label: "Official" },
  { value: "medical", label: "Medical" },
];

export const PASS_TYPE_FILTER_OPTIONS = [{ label: "All Types", value: "" }, ...PASS_TYPE_OPTIONS];

/** Manager / team head → Approve (both stamps). */
export function gatePassStatus(row) {
  if (row?.sup_at && row?.approved_at) return "approved";
  if (row?.sup_at) return "pending_approve";
  return "pending_manager";
}

export function isPendingApprove(row) {
  return gatePassStatus(row) === "pending_approve";
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

export function validatePassDateYmd(dateYmd, opts = {}) {
  const now = opts.now || dayjs();
  const d = dayjs(String(dateYmd ?? "").trim());
  if (!d.isValid()) return { ok: false, message: "Invalid date" };
  const minDay = now.startOf("day");
  const maxDay = minDay.add(PASS_DATE_MAX_FUTURE_DAYS, "day");
  const dStr = d.format("YYYY-MM-DD");
  const existing = String(opts.existingPassDate ?? "").slice(0, 10);
  const unchangedPast = Boolean(existing) && dStr === existing && d.startOf("day").isBefore(minDay);
  if (d.startOf("day").isBefore(minDay) && !unchangedPast) return { ok: false, message: "Date cannot be before today" };
  if (d.startOf("day").isAfter(maxDay) && !unchangedPast) {
    return { ok: false, message: PASS_DATE_MAX_FUTURE_DAYS ? "Date cannot be after tomorrow" : "Only today is allowed" };
  }
  return { ok: true };
}

export function resolveGatePassOutIn(passDate, outHm, inHm, opts = {}) {
  const date = String(passDate ?? "").trim();
  if (!date) return { ok: false, message: "Date is required" };

  const dateCheck = validatePassDateYmd(date, opts);
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

/** special_permissions.hrms.gate_pass_supervisor — Manager / Team Head (not module Approve). */
export function canApproveAsManager(user) {
  const role = String(user?.type || user?.role || "").toLowerCase().trim();
  if (role === "super_admin") return true;
  const raw = user?.special_permissions;
  const perms = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
  return Boolean(perms?.hrms?.gate_pass_supervisor);
}

/** App origin for printed gate pass URLs (`NEXT_PUBLIC_HRMS_APP_ORIGIN` or `NEXT_PUBLIC_PWA_APP_ORIGIN`). */
export function getHrmsAppOrigin() {
  const fromEnv = String(process.env.NEXT_PUBLIC_HRMS_APP_ORIGIN || process.env.NEXT_PUBLIC_PWA_APP_ORIGIN || "").trim();
  if (typeof window !== "undefined") {
    return (fromEnv || window.location.origin).replace(/\/+$/, "");
  }
  return fromEnv.replace(/\/+$/, "");
}

/** hrms_gate_pass.id only — never emp_code / uid / display code. */
export function resolveGatePassPkId(row) {
  for (const key of ["gate_pass_id", "id"]) {
    const s = String(row?.[key] ?? "").trim();
    if (!/^\d+$/.test(s)) continue;
    const n = Number(s);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** QR = full view URL with gate pass primary key only. */
export function getGatePassQrValue(row) {
  const id = resolveGatePassPkId(row);
  if (!id) return "";
  const origin = getHrmsAppOrigin();
  if (!origin) return "";
  return `${origin}${ROUTES.HRMS_GATE_PASS}/${id}`;
}

/** IMS scanner: URL or plain numeric id → gate pass id string (digits only). */
export function extractGatePassIdFromScan(rawValue) {
  const text = String(rawValue ?? "").trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return text;
  if (/^[A-Za-z]/.test(text)) return null;
  try {
    if (/^https?:\/\//i.test(text)) {
      const u = new URL(text);
      const idParam = u.searchParams.get("id");
      if (idParam && /^\d+$/.test(String(idParam).trim())) return String(idParam).trim();
      const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && /^\d+$/.test(last)) return last;
    }
  } catch {
    /* ignore */
  }
  const m = text.match(/\/gate-pass\/(\d+)(?:[/?#]|$)/i);
  return m?.[1] && /^\d+$/.test(m[1]) ? m[1] : null;
}

function formatGatePassQrDate(row) {
  const raw = row?.pass_date_display ?? row?.pass_date;
  if (raw == null || String(raw).trim() === "") return "";
  const d = dayjs(String(raw).trim().slice(0, 10));
  return d.isValid() ? d.format("DD-MM-YYYY") : String(raw).trim();
}

/** Plain QR PNG — white square, no captions (IMS-style sticker). */
export const GATE_PASS_QR_PX = 256;

function svgToGatePassPngDataUrl(svgMarkup, qrPx = GATE_PASS_QR_PX) {
  const canvas = document.createElement("canvas");
  canvas.width = qrPx;
  canvas.height = qrPx;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" }));

  return new Promise((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, qrPx, qrPx);
      ctx.drawImage(img, 0, 0, qrPx, qrPx);
      resolve(canvas.toDataURL("image/png", 1.0));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load QR image"));
    };
    img.src = url;
  });
}

/** PNG from rendered QR <svg> (drawer preview). */
export function buildGatePassQrDataUrlFromSvg(svgElement, row) {
  if (!svgElement) return Promise.reject(new Error("QR preview is not ready."));
  return svgToGatePassPngDataUrl(new XMLSerializer().serializeToString(svgElement));
}

/** PNG without drawer — list toolbar download. */
export async function buildGatePassQrDataUrlFromRow(row) {
  const value = getGatePassQrValue(row);
  if (!value) throw new Error("Gate pass id missing.");
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const QRCode = (await import("react-qr-code")).default;
  const svgMarkup = renderToStaticMarkup(React.createElement(QRCode, { value, size: 256, level: "H" }));
  return svgToGatePassPngDataUrl(svgMarkup);
}

export function downloadGatePassQrDataUrl(row, dataUrl) {
  const id = resolveGatePassPkId(row) || "qr";
  const dateSlug = formatGatePassQrDate(row).replace(/\//g, "-") || "";
  const link = document.createElement("a");
  link.download = dateSlug ? `GATEPASS_${id}_${dateSlug}.png` : `GATEPASS_${id}.png`;
  link.href = dataUrl;
  link.click();
}

export async function downloadGatePassQr(row) {
  downloadGatePassQrDataUrl(row, await buildGatePassQrDataUrlFromRow(row));
}
