/**
 * Shared QR / scan parsing for stickers, boxes, and locations.
 * Keep behavior aligned across Inward, Override, and similar flows.
 */

export function extractLocationNo(rawValue) {
  const normalizedValue = String(rawValue ?? "").trim();
  if (!normalizedValue) return null;

  if (/\bbox(?:_no)?\s*uid\b/i.test(normalizedValue)) return null;

  if (normalizedValue.startsWith("{") && normalizedValue.endsWith("}")) {
    try {
      const parsed = JSON.parse(normalizedValue);
      if (parsed?.box_uid != null || parsed?.box_no_uid != null) return null;
      if (parsed?.location_no != null) return String(parsed.location_no).trim().toUpperCase();
      if (parsed?.location_id != null) return String(parsed.location_id).trim().toUpperCase();
      if (parsed?.id != null) return String(parsed.id).trim().toUpperCase();
    } catch {
      // continue
    }
  }

  const locationNoMatch = normalizedValue.match(/\blocation[_\s]*(?:no|id)\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i);
  if (locationNoMatch?.[1]) return locationNoMatch[1].trim().toUpperCase();

  const idMatch = normalizedValue.match(/\bid\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i);
  if (idMatch?.[1]) return idMatch[1].trim().toUpperCase();

  return normalizedValue.toUpperCase();
}

export function detectQrType(rawValue) {
  const trimmed = String(rawValue ?? "").trim();
  const normalized = trimmed.toLowerCase();
  if (!normalized) return "unknown";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (u.searchParams.get("box_no_uid") || u.searchParams.get("id") || u.searchParams.get("box_uid")) {
        return "box";
      }
    } catch {
      /* continue */
    }
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const p = JSON.parse(trimmed);
      if (p?.box_uid != null || p?.box_no_uid) return "box";
      if ((p?.location_id != null || p?.location_no != null) && p?.box_uid == null && p?.box_no_uid == null) return "location";
    } catch {
      // continue
    }
  }

  if (/\bbox(?:_no)?\s*uid\b/.test(normalized)) return "box";
  if (/\blocation[_\s]*(?:id|no)\b/.test(normalized)) return "location";
  return "unknown";
}

// Backward-compatible alias
export const extractLocationId = extractLocationNo;

/**
 * Sticker / box scan → panel DB keys.
 * `box_no_uid` is required on printed stickers; numeric panel id comes from external `id=` (not `box_uid=`).
 */
export function parseStickerScan(rawValue) {
  const trimmed = String(rawValue ?? "").trim();
  let box_no_uid = "";
  let box_uid = "";

  if (!trimmed) {
    return { box_no_uid: "", box_uid: "" };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const noParam = u.searchParams.get("box_no_uid");
      const idParam = u.searchParams.get("id");
      if (noParam != null && String(noParam).trim() !== "") {
        box_no_uid = String(noParam).trim();
      }
      if (idParam != null && String(idParam).trim() !== "") {
        const id = String(idParam).trim();
        if (/^\d+$/.test(id)) box_uid = id;
        else if (!box_no_uid) box_no_uid = id;
      }
      // Legacy external links that used box_uid= instead of id=
      if (!box_uid) {
        const uidParam = u.searchParams.get("box_uid");
        if (uidParam != null && /^\d+$/.test(String(uidParam).trim())) {
          box_uid = String(uidParam).trim();
        }
      }
    } catch {
      /* fall through */
    }
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.location_id != null && parsed?.box_uid == null && parsed?.box_no_uid == null) {
        return { box_no_uid: "", box_uid: "" };
      }
      if (parsed?.box_no_uid != null && String(parsed.box_no_uid).trim() !== "") {
        box_no_uid = String(parsed.box_no_uid).trim();
      }
      if (parsed?.box_uid != null && String(parsed.box_uid).trim() !== "") {
        box_uid = String(parsed.box_uid).trim();
      }
    } catch {
      // continue
    }
  }

  if (!box_no_uid) {
    const noMatch = trimmed.match(/\bbox_no_uid\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i);
    if (noMatch?.[1]) box_no_uid = noMatch[1].trim();
  }
  if (!box_uid) {
    const uidMatch = trimmed.match(/\bbox_uid\s*[:=-]?\s*(\d+)\b/i);
    if (uidMatch?.[1]) box_uid = uidMatch[1].trim();
  }

  if (!box_no_uid && !box_uid) {
    const legacy = extractBoxCodeLegacy(trimmed);
    if (legacy) {
      if (/^\d+$/.test(legacy)) box_uid = legacy;
      else box_no_uid = legacy;
    }
  }

  return {
    box_no_uid: box_no_uid.trim(),
    box_uid: /^\d+$/.test(String(box_uid).trim()) ? String(box_uid).trim() : "",
  };
}

/** Plain-text / legacy QR fallback (no parseStickerScan — avoids recursion). */
function extractBoxCodeLegacy(normalizedValue) {
  const trimmed = String(normalizedValue ?? "").trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const idParam = u.searchParams.get("id");
      if (idParam != null && String(idParam).trim() !== "") {
        return String(idParam).trim();
      }
    } catch {
      /* fall through */
    }
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.location_id != null && parsed?.box_uid == null && parsed?.box_no_uid == null) {
        return "";
      }
      if (parsed?.box_uid) return String(parsed.box_uid).trim();
      if (parsed?.box_no_uid) return String(parsed.box_no_uid).trim();
    } catch {
      // continue
    }
  }

  const uidMatch = trimmed.match(
    /\b(?:box_uid|box_no_uid|uid|box(?:\s*id)?)\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i
  );
  if (uidMatch?.[1]) return uidMatch[1].trim();

  const idMatch = trimmed.match(/\bid\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i);
  if (idMatch?.[1]) return idMatch[1].trim();

  return trimmed.split(/\r?\n/)[0].trim();
}

export function extractBoxCode(rawValue) {
  const { box_no_uid, box_uid } = parseStickerScan(rawValue);
  if (box_no_uid) return box_no_uid;
  if (box_uid) return box_uid;
  return extractBoxCodeLegacy(rawValue);
}

/** Same as legacy `parseScannedValue` — primary lookup key (`box_no_uid` preferred). */
export function parseBoxScanRaw(raw) {
  return extractBoxCode(raw);
}
