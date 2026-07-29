/**
 * Shared QR / scan parsing for RM coils and store locations.
 */

import { getLocationQrValue } from "@/apps/rmstore/lib/helpers/locationQrLabel";

/** Strip scanner control chars / BOM; first line only (HID often appends CR/LF). */
export function normalizeScanInput(rawValue) {
  return String(rawValue ?? "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\uFEFF/g, "")
    .split(/\r?\n/)[0]
    .trim();
}

/**
 * Extract coil UID from scan / typed input.
 * Accepts RM_… stickers, underscore UIDs, or plain typed UID text.
 */
export function extractCoilUid(rawValue) {
  const trimmed = normalizeScanInput(rawValue);
  if (!trimmed) return null;

  // QC stickers use QC|{uid} — not valid as coil sticker scans
  if (/^QC\s*[|:]/i.test(trimmed)) return null;

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      const fromJson =
        parsed?.coil_no_uid ?? parsed?.coil_uid ?? parsed?.uid ?? parsed?.id ?? null;
      if (fromJson != null && String(fromJson).trim() !== "") {
        return String(fromJson).trim();
      }
    } catch {
      // continue
    }
  }

  const qp =
    trimmed.match(/[?&]coil_no_uid=([^&#\s]+)/i) ||
    trimmed.match(/[?&]uid=([^&#\s]+)/i);
  if (qp?.[1]) {
    try {
      return decodeURIComponent(qp[1].replace(/\+/g, " ")).trim();
    } catch {
      return qp[1].trim();
    }
  }

  const labeled = trimmed.match(
    /\b(?:coil_no_uid|coil_uid|uid)\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i
  );
  if (labeled?.[1]) return labeled[1].trim();

  // URL-like without usable coil param — reject
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("://")) return null;

  // Coil stickers: underscore UID (year_mrn_…) or plain typed text
  if (trimmed.includes("_") || /^[A-Za-z0-9-]+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Prefer location_no from QR; fall back to RM-rack/row display patterns.
 * Strips whitespace and uppercases (RM- style).
 */
export function extractLocationNo(rawValue) {
  const normalizedValue = normalizeScanInput(rawValue);
  if (!normalizedValue) return null;

  // Coil scans should not resolve as locations (UID has underscores / year_mrn pattern)
  if (/\bcoil(?:_no)?\s*uid\b/i.test(normalizedValue)) {
    return null;
  }
  // Likely coil UID: digits_digits_… (year_mrn_serial_total_coil)
  if (/^\d+_\d+_\d+_\d+_\d+$/.test(normalizedValue.replace(/\s+/g, ""))) {
    return null;
  }
  // QC stickers
  if (/^QC\s*[|:]/i.test(normalizedValue)) {
    return null;
  }

  if (normalizedValue.startsWith("{") && normalizedValue.endsWith("}")) {
    try {
      const parsed = JSON.parse(normalizedValue);
      if (parsed?.coil_no_uid != null || parsed?.coil_uid != null) return null;
      const fromHelper = getLocationQrValue(parsed);
      if (fromHelper) return fromHelper;
      if (parsed?.location_no != null) return String(parsed.location_no).trim().toUpperCase();
      if (parsed?.location_id != null) return String(parsed.location_id).trim().toUpperCase();
      if (parsed?.id != null) return String(parsed.id).trim().toUpperCase();
    } catch {
      // continue
    }
  }

  const locationNoMatch = normalizedValue.match(
    /\blocation[_\s]*(?:no|id)\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i
  );
  if (locationNoMatch?.[1]) return locationNoMatch[1].trim().toUpperCase();

  // Plain RM-… sticker / typed location no
  const cleaned = normalizedValue.replace(/\s+/g, "").toUpperCase();
  if (!cleaned) return null;
  return cleaned;
}

/** Laser / scan UI label — show coil UID only. */
export function coilUidDisplayLabel(rawValue) {
  const trimmed = String(rawValue ?? "").trim();
  if (!trimmed) return "";
  const uid = extractCoilUid(rawValue);
  return uid || trimmed;
}

/** Laser / scan UI — location no only. */
export function locationNoDisplayLabel(rawValue) {
  const trimmed = String(rawValue ?? "").trim();
  if (!trimmed) return "";
  const no = extractLocationNo(rawValue);
  return no || trimmed.toUpperCase();
}

/**
 * QC sticker QR: `QC|{coil_no_uid}` or `QC|{mrn_uid}_batch_qc`.
 * Returns payload uid only when scan is a QC sticker — not plain coil / MRN / user.
 */
export function extractQcStickerUid(rawValue) {
  const trimmed = normalizeScanInput(rawValue);
  if (!trimmed) return null;

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      const kind = String(parsed?.kind || parsed?.sticker_kind || "").toLowerCase();
      if (kind === "qc") {
        const fromJson = parsed?.coil_no_uid ?? parsed?.uid ?? null;
        if (fromJson != null && String(fromJson).trim() !== "") {
          return String(fromJson).trim();
        }
      }
    } catch {
      // continue
    }
  }

  const m = trimmed.match(/^QC\s*[|:]\s*(.+)$/i);
  if (m?.[1]) {
    const uid = m[1].trim();
    return uid || null;
  }
  return null;
}

export function qcStickerDisplayLabel(rawValue) {
  const uid = extractQcStickerUid(rawValue);
  return uid ? `QC|${uid}` : "";
}

/**
 * Batch sticker → MRN uid.
 * Accepts `QC|{mrn_uid}_batch_qc` or plain `{mrn_uid}_batch_qc`.
 */
export function extractBatchMrnUid(rawValue) {
  const qcUid = extractQcStickerUid(rawValue);
  const candidate = qcUid || normalizeScanInput(rawValue);
  if (!candidate) return null;
  const m = String(candidate).trim().match(/^(.+)_batch_qc$/i);
  const mrnUid = m?.[1]?.trim();
  return mrnUid || null;
}
