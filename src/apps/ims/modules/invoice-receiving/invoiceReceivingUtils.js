import { FILE_BASE_URL } from "@/platform/utils/core/lib";

/**
 * ERP/IMS often sends JSON null as the literal string `"null"`.
 * Use for logic (empty file, no value); use {@link formatImsErpScalar} for list/display text.
 */
export function isImsErpNullString(value) {
  if (value == null) return true;
  const s = String(value).trim();
  return s === "" || s.toLowerCase() === "null";
}

/** True only when backend sent the string `"null"` (not JS null / blank). */
export function isImsErpNullLiteral(value) {
  if (value == null) return false;
  return String(value).trim().toLowerCase() === "null";
}

/** Table/export text: blank → —, literal `"null"` → null, else trimmed value. */
export function formatImsErpScalar(value, emptyLabel = "—", nullLiteralLabel = "null") {
  if (value == null || String(value).trim() === "") return emptyLabel;
  if (isImsErpNullLiteral(value)) return nullLiteralLabel;
  return String(value).trim();
}

export function imsErpScalarHasValue(value) {
  return !isImsErpNullString(value);
}

/** Browser URL for stored path e.g. `uploads/ims/invoice-receiving/…` from ERP / internal API. */
export function publicUploadHref(storedPath) {
  if (isImsErpNullString(storedPath)) return "";
  const p = String(storedPath ?? "")
    .trim()
    .replace(/\\/g, "/");
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  const base = String(FILE_BASE_URL || "").replace(/\/$/, "");
  const rel = p.replace(/^\/+/, "");
  if (rel.startsWith("uploads/")) return `${base}/${rel}`;
  return `${base}/uploads/${rel}`;
}

export function receivingFileLabel(storedPath) {
  if (isImsErpNullString(storedPath)) return "";
  const p = String(storedPath || "").trim();
  if (!p) return "";
  return p.split(/[/\\]/).pop() || p;
}

/** ERP / API truthy for invreceiving.approved */
export function isIrApproved(row) {
  if (!row) return false;
  const ref = parseReceiverefnoFromIms(row.receiverefno);
  const v = row.approved ?? ref?.approved;
  if (v === true || v === 1) return true;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "y";
}

/** Normalized attachment path from ERP (ignores empty / literal `"null"` string). */
export function irReceivingFilePath(row) {
  const raw = row?.receivingfile ?? row?.file_path;
  if (isImsErpNullString(raw)) return "";
  return String(raw).trim();
}

export function hasIrReceivingFile(row) {
  return Boolean(irReceivingFilePath(row));
}

/** Register row has receiving metadata in `receiverefno` JSON (even if file path missing). */
export function hasIrReceiverefnoData(row) {
  const ref = parseReceiverefnoFromIms(row?.receiverefno);
  if (!ref || typeof ref !== "object") return false;
  if (imsErpScalarHasValue(ref.remarks)) return true;
  if (imsErpScalarHasValue(ref.uploaded_by)) return true;
  if (imsErpScalarHasValue(ref.uploaded_at)) return true;
  if (ref.approved === true || ref.approved === 1) return true;
  const s = String(ref.approved ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "y";
}

/** Register tab — any listed bill (incl. empty / ERP literal `"null"` fields). */
export function canIrEditRegisterRow(row) {
  return Boolean(String(row?.prnbillno ?? "").trim());
}

/** Register tab — clear or normalize receiving on ERP (`receivingfile` + `receiverefno` → null). */
export function canIrClearReceivingRow(row) {
  return canIrEditRegisterRow(row);
}

export function canIrApproveRow(row) {
  return hasIrReceivingFile(row) && !isIrApproved(row);
}

/** ERP stores audit JSON inside `receiverefno` string. */
export function parseReceiverefnoFromIms(raw) {
  if (isImsErpNullString(raw)) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    const s = String(raw).trim();
    return s ? { remarks: s } : null;
  }
}

/** Flatten receiverefno JSON onto row for list + modal. */
export function normalizeInvoiceReceivingRow(row) {
  if (!row || typeof row !== "object") return row;
  const ref = parseReceiverefnoFromIms(row.receiverefno);
  if (!ref) return { ...row };

  const out = { ...row };
  const pick = (topKey, refKey = topKey) => {
    const fromRef = ref[refKey];
    if (fromRef == null || fromRef === "") return;
    if (out[topKey] == null || out[topKey] === "") out[topKey] = fromRef;
  };

  pick("remarks");
  pick("approved");
  pick("uploaded_by");
  pick("uploaded_at");
  pick("approved_by");
  pick("approved_at");

  return out;
}

export function pickIrRemarks(row) {
  if (!row) return "";
  const direct = String(row.remarks ?? row.remark ?? row.narration ?? "").trim();
  if (direct && !isImsErpNullLiteral(direct)) return direct;
  const fromRef = String(parseReceiverefnoFromIms(row.receiverefno)?.remarks ?? "").trim();
  if (fromRef && !isImsErpNullLiteral(fromRef)) return fromRef;
  return "";
}

export function irRemarksDisplay(v, row) {
  return String(v ?? pickIrRemarks(row) ?? "").trim();
}

/** Parse ERP / IMS datetime (`23-09-2026 11:53`, ISO, etc.). */
export function parseImsIrDateTime(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const s = String(v).trim();
  const dmyHm = s.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dmyHm) {
    const d = new Date(
      parseInt(dmyHm[3], 10),
      parseInt(dmyHm[2], 10) - 1,
      parseInt(dmyHm[1], 10),
      parseInt(dmyHm[4] ?? "0", 10),
      parseInt(dmyHm[5] ?? "0", 10)
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** List + drawer — keeps IMS `DD-MM-YYYY HH:mm` when already formatted. */
export function formatIrBillDate(v) {
  if (isImsErpNullLiteral(v)) return "null";
  if (isImsErpNullString(v)) return "—";
  const s = String(v).trim();
  if (/^\d{2}-\d{2}-\d{4}(\s+\d{1,2}:\d{2})?$/.test(s)) return s.split(/\s+/)[0];
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = parseImsIrDateTime(v);
  if (!d) return s || "—";
  return d
    .toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "-");
}

/** `YYYY-MM-DD` for list date filter (bill date). */
export function irBillDateYmd(v) {
  const d = parseImsIrDateTime(v);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function irRowInBillDateRange(row, fromYmd, toYmd) {
  const ymd = irBillDateYmd(row?.billdt);
  if (!ymd) return true;
  if (fromYmd && ymd < fromYmd) return false;
  if (toYmd && ymd > toYmd) return false;
  return true;
}

export function formatIrDateTime(v) {
  if (isImsErpNullLiteral(v)) return "null";
  if (isImsErpNullString(v)) return "—";
  const s = String(v).trim();
  if (/^\d{2}-\d{2}-\d{4}\s+\d{1,2}:\d{2}/.test(s)) return s;
  const d = parseImsIrDateTime(v);
  if (!d) return s || "—";
  return d
    .toLocaleString("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(/\//g, "-")
    .replace(", ", " ");
}
