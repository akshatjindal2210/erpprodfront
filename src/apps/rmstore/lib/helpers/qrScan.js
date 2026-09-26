/**
 * Shared QR / scan parsing for RM coils and store locations.
 * UID format / prefix rules live in stickerUidFormat.js — not here.
 */

import { formatLocationDisplay } from "@/apps/rmstore/lib/helpers/formatLocationDisplay";
import { getLocationQrValue } from "@/apps/rmstore/lib/helpers/locationQrLabel";
import { findMatchingCoilNoUid, looksLikeStickerUid, stickerUidCoreKey, stickerUidsMatch } from "@/platform/utils/global/stickerUidFormat";

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
 * Accepts plain UID, `QC|…` rejected, or public URL `?coil_no_uid=…` (not kind=qc).
 */
export function extractCoilUid(rawValue) {
  const trimmed = normalizeScanInput(rawValue);
  if (!trimmed) return null;

  // QC stickers — not valid as coil sticker scans
  if (/^QC\s*[|:]/i.test(trimmed)) return null;
  if (/[?&]qc=/i.test(trimmed) || /[?&]kind=qc\b/i.test(trimmed)) return null;

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      const kind = String(parsed?.kind || parsed?.sticker_kind || "").toLowerCase();
      if (kind === "qc") return null;
      const fromJson = parsed?.coil_no_uid ?? parsed?.coil_uid ?? parsed?.uid ?? parsed?.id ?? null;
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

  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("://")) return null;

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

  if (/\bcoil(?:_no)?\s*uid\b/i.test(normalizedValue)) return null;
  if (looksLikeStickerUid(normalizedValue)) return null;
  if (/^QC\s*[|:]/i.test(normalizedValue)) return null;
  if (/[?&](coil_no_uid|box_no_uid|fuid|kind=qc|qc=)=/i.test(normalizedValue)) return null;

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

  const qp = normalizedValue.match(/[?&]location_no=([^&#\s]+)/i);
  if (qp?.[1]) {
    try {
      return decodeURIComponent(qp[1].replace(/\+/g, " ")).trim().toUpperCase();
    } catch {
      return qp[1].trim().toUpperCase();
    }
  }

  if (/^https?:\/\//i.test(normalizedValue) || normalizedValue.includes("://")) return null;

  const locationNoMatch = normalizedValue.match(
    /\blocation[_\s]*(?:no|id)\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i
  );
  if (locationNoMatch?.[1]) return locationNoMatch[1].trim().toUpperCase();

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
  return formatLocationDisplay(no || trimmed.toUpperCase());
}

/**
 * QC sticker QR: `QC|{uid}`, or public URL `?qc=…` (also accepts legacy `?kind=qc&coil_no_uid=…`).
 */
export function extractQcStickerUid(rawValue) {
  const trimmed = normalizeScanInput(rawValue);
  if (!trimmed) return null;

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      const kind = String(parsed?.kind || parsed?.sticker_kind || "").toLowerCase();
      if (kind === "qc") {
        const fromJson = parsed?.coil_no_uid ?? parsed?.uid ?? parsed?.qc ?? null;
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

  const qcParam = trimmed.match(/[?&]qc=([^&#\s]+)/i);
  if (qcParam?.[1]) {
    try {
      return decodeURIComponent(qcParam[1].replace(/\+/g, " ")).trim();
    } catch {
      return qcParam[1].trim();
    }
  }

  if (/[?&]kind=qc\b/i.test(trimmed)) {
    const qp = trimmed.match(/[?&]coil_no_uid=([^&#\s]+)/i);
    if (qp?.[1]) {
      try {
        return decodeURIComponent(qp[1].replace(/\+/g, " ")).trim();
      } catch {
        return qp[1].trim();
      }
    }
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

export { stickerUidCoreKey as coilUidMatchKey };

/** Match scanned coil UID to a generated list (exact, core, or IMS-style suffix). */
export const findMatchingCoilUid = findMatchingCoilNoUid;

/** Match a scanned UID to a coil row list. */
export function findMatchingCoil(scanned, coils = []) {
  if (!Array.isArray(coils) || !coils.length) return null;
  const matchUid = findMatchingCoilNoUid(
    scanned,
    coils.map((c) => String(c?.coil_no_uid ?? "").trim())
  );
  if (!matchUid) return null;
  return coils.find((c) => String(c?.coil_no_uid ?? "").trim() === matchUid) || null;
}

/** Compare MRN uids (4111_1) even if scan includes sticker prefix segments. */
export const mrnUidsMatch = stickerUidsMatch;

export { looksLikeStickerUid, stickerUidsMatch };
