/**
 * Stickers encode a public URL so phone cameras outside the app open a page.
 * Inside the app (laser / in-app QR), strip the https host — keep only the value
 * (or a short `?param=` form IMS parsers / detectQrType still understand).
 *
 * Print / generate: keep using `withPublicBase` / resolve*QrPayload (full URL).
 */

import { looksLikeBillBase64, looksLikeEInvoiceJwt, normalizeBillScanInput } from "@/apps/ims/lib/helpers/qrScan";

function decodeParam(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    return decodeURIComponent(s.replace(/\+/g, " ")).trim();
  } catch {
    return s;
  }
}

function firstQueryMatch(text, pattern) {
  const m = String(text ?? "").match(pattern);
  return m?.[1] ? decodeParam(m[1]) : "";
}

function looksLikeBillPayload(rawValue) {
  const s = String(rawValue ?? "");
  if (!s.trim()) return false;
  if (looksLikeEInvoiceJwt(s) || looksLikeBillBase64(s)) return true;
  const compact = s.replace(/\s+/g, "");
  if (/^eyJ/i.test(compact)) return true;
  // Multi-line camera base64 (Gate Entry) — must not first-line truncate
  if (/\r?\n/.test(s) && compact.length >= 48 && /^[A-Za-z0-9+/_=-]+$/.test(compact)) {
    return true;
  }
  return false;
}

/**
 * Camera / laser entry: bill payloads stay whole; sticker public URLs → in-app value.
 * @param {unknown} rawValue
 * @returns {string}
 */
export function resolveInAppScanValue(rawValue) {
  if (looksLikeBillPayload(rawValue)) {
    return normalizeBillScanInput(rawValue);
  }

  const trimmed = String(rawValue ?? "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\uFEFF/g, "")
    .split(/\r?\n/)[0]
    .trim();
  if (!trimmed) return "";

  // Already in-app QC form
  if (/^QC\s*[|:]/i.test(trimmed)) {
    const uid = trimmed.replace(/^QC\s*[|:]\s*/i, "").trim();
    return uid ? `QC|${uid}` : trimmed;
  }

  const isUrl =
    /^https?:\/\//i.test(trimmed) ||
    trimmed.includes("://") ||
    /^[?&][a-z_]+=/i.test(trimmed) ||
    /[?&](box_no_uid|coil_no_uid|qc|location_no|fuid|uid|kind)=/i.test(trimmed);
  if (!isUrl) return trimmed;

  // QC public URL: `?qc=…` or legacy `?kind=qc&coil_no_uid=…`
  const qc = firstQueryMatch(trimmed, /[?&]qc=([^&#\s]+)/i);
  if (qc) return `QC|${qc}`;

  if (/[?&]kind=qc\b/i.test(trimmed)) {
    const legacyQc = firstQueryMatch(trimmed, /[?&]coil_no_uid=([^&#\s]+)/i);
    if (legacyQc) return `QC|${legacyQc}`;
  }

  // RM coil — plain UID (extractCoilUid / handlers expect value)
  const coil = firstQueryMatch(trimmed, /[?&]coil_no_uid=([^&#\s]+)/i);
  if (coil) return coil;

  // IMS box — keep short query so detectQrType / parseStickerScan still see box + id
  const box = firstQueryMatch(trimmed, /[?&]box_no_uid=([^&#\s]+)/i);
  const boxId =
    firstQueryMatch(trimmed, /[?&]id=([^&#\s]+)/i) ||
    firstQueryMatch(trimmed, /[?&]box_uid=([^&#\s]+)/i);
  if (box || boxId) {
    const parts = [];
    if (box) parts.push(`box_no_uid=${encodeURIComponent(box)}`);
    if (boxId) parts.push(`id=${encodeURIComponent(boxId)}`);
    return `?${parts.join("&")}`;
  }

  const locationNo = firstQueryMatch(trimmed, /[?&]location_no=([^&#\s]+)/i);
  if (locationNo) return locationNo.toUpperCase();

  // FN — short query (classifiers match fuid=)
  const fuid = firstQueryMatch(trimmed, /[?&]fuid=([^&#\s]+)/i);
  if (fuid) return `?fuid=${encodeURIComponent(fuid)}`;

  const uid = firstQueryMatch(trimmed, /[?&]uid=([^&#\s]+)/i);
  if (uid) return uid;

  // Unknown URL — leave as-is for specialized parsers
  return trimmed;
}
