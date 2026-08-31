/**
 * Shared QR / scan parsing for stickers, boxes, and locations.
 * Keep behavior aligned across Inward, Override, and similar flows.
 */

/** Strip scanner control chars / BOM; first line only (HID often appends CR/LF). */
export function normalizeScanInput(rawValue) {
  return String(rawValue ?? "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\uFEFF/g, "")
    .split(/\r?\n/)[0]
    .trim();
}

/**
 * Bill / e-invoice QR: keep full payload (JWT or base64).
 * Phone cameras often return multi-line base64 — do not take first line only.
 */
export function normalizeBillScanInput(rawValue) {
  let s = String(rawValue ?? "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\uFEFF/g, "")
    .trim();
  if (!s) return "";

  const compact = s.replace(/\s+/g, "");
  // JWT or long base64 blob from e-invoice / tax QR
  if (/^eyJ/i.test(compact) || (compact.length >= 32 && /^[A-Za-z0-9+/_-]+={0,2}$/.test(compact))) {
    return compact;
  }
  if (s.startsWith("{")) return s;
  return s.split(/\r?\n/)[0].trim();
}

/** True GST SignedQR JWT (header.payload…) — not plain base64 that merely starts with eyJ. */
export function looksLikeEInvoiceJwt(rawValue) {
  const s = String(rawValue ?? "").replace(/\s+/g, "");
  if (!s) return false;
  return /^eyJ[A-Za-z0-9_-]+\./i.test(s);
}

/** Phone QR often returns a single base64 JSON blob (no JWT dots). */
export function looksLikeBillBase64(rawValue) {
  const s = String(rawValue ?? "").replace(/\s+/g, "");
  if (!s || s.length < 24) return false;
  if (s.includes(".")) return false;
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(s);
}

function readBoxParamsFromUrl(url) {
  const noParam = url.searchParams.get("box_no_uid");
  const idParam = url.searchParams.get("id");
  let box_no_uid = "";
  let box_uid = "";

  if (noParam != null && String(noParam).trim() !== "") {
    box_no_uid = String(noParam).trim();
  }
  if (idParam != null && String(idParam).trim() !== "") {
    const id = String(idParam).trim();
    if (/^\d+$/.test(id)) box_uid = id;
    else if (!box_no_uid) box_no_uid = id;
  }
  if (!box_uid) {
    const uidParam = url.searchParams.get("box_uid");
    if (uidParam != null && /^\d+$/.test(String(uidParam).trim())) {
      box_uid = String(uidParam).trim();
    }
  }

  return { box_no_uid, box_uid };
}

function parseUrlStickerScan(trimmed) {
  const attempts = [trimmed];
  if (!/^https?:\/\//i.test(trimmed)) {
    if (/[?&](box_no_uid|id|box_uid)=/i.test(trimmed) || trimmed.includes("://")) {
      attempts.push(`https://${trimmed.replace(/^\/+/, "")}`);
    }
  }

  for (const candidate of attempts) {
    if (!/^https?:\/\//i.test(candidate)) continue;
    try {
      const u = new URL(candidate);
      const { box_no_uid, box_uid } = readBoxParamsFromUrl(u);
      if (box_no_uid || box_uid) {
        return {
          box_no_uid: box_no_uid.trim(),
          box_uid: /^\d+$/.test(String(box_uid).trim()) ? String(box_uid).trim() : "",
        };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/** True when idle-commit should wait (slow phone/BT scanners still sending URL/JWT chars). */
export function scanBufferLooksIncomplete(rawValue) {
  const s = normalizeScanInput(rawValue);
  if (!s) return false;

  const compact = s.replace(/\s+/g, "");

  // Long e-invoice JWT — wait until all 3 segments arrive (scanners often pause mid-stream).
  if (looksLikeEInvoiceJwt(s)) {
    const parts = compact.split(".");
    if (parts.length < 3) return true;
    // Signature still arriving (HID/BT often pauses between segments).
    if (parts.length === 3 && parts[2].length < 16) return true;
    return false;
  }

  // Tax-invoice QR often returns ONE long base64 blob (may start with eyJ, no dots).
  // Laser HID pauses mid-stream — do not commit early.
  if (looksLikeBillBase64(s) || (/^eyJ/i.test(compact) && !compact.includes("."))) {
    if (compact.length < 96) return true;
    // Still growing / no padding yet for typical invoice payload sizes
    if (!/=$/.test(compact) && compact.length < 500) return true;
    return false;
  }

  if (/^https?:\/\//i.test(s) || s.includes("://")) {
    if (/[?&]box_no_uid=[^&]+/i.test(s) || /[?&]id=\d+/i.test(s)) return false;
    if (!/[?&](box_no_uid|id|box_uid)=/i.test(s)) return true;
  }

  if (/[?&]box_no_uid=/i.test(s)) {
    const m = s.match(/[?&]box_no_uid=([^&#\s]*)/i);
    if (!m?.[1] || m[1].length < 3) return true;
  }

  return false;
}

export function extractLocationNo(rawValue) {
  const normalizedValue = normalizeScanInput(rawValue);
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
  const trimmed = normalizeScanInput(rawValue);
  const normalized = trimmed.toLowerCase();
  if (!normalized) return "unknown";

  if (/[?&](box_no_uid|box_uid)=/i.test(trimmed) || /[?&]id=\d+/i.test(trimmed)) {
    return "box";
  }

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
  const trimmed = normalizeScanInput(rawValue);
  let box_no_uid = "";
  let box_uid = "";

  if (!trimmed) {
    return { box_no_uid: "", box_uid: "" };
  }

  const fromUrl = parseUrlStickerScan(trimmed);
  if (fromUrl) {
    box_no_uid = fromUrl.box_no_uid;
    box_uid = fromUrl.box_uid;
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
    const noMatch =
      trimmed.match(/[?&]box_no_uid=([^&#\s]+)/i) ||
      trimmed.match(/\bbox_no_uid\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i);
    if (noMatch?.[1]) {
      try {
        box_no_uid = decodeURIComponent(noMatch[1].replace(/\+/g, " ")).trim();
      } catch {
        box_no_uid = noMatch[1].trim();
      }
    }
  }
  if (!box_uid) {
    const uidMatch = trimmed.match(/[?&]id=(\d+)/i) || trimmed.match(/\bbox_uid\s*[:=-]?\s*(\d+)\b/i);
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
  const trimmed = normalizeScanInput(normalizedValue);
  if (!trimmed) return "";

  const fromUrl = parseUrlStickerScan(trimmed);
  if (fromUrl?.box_no_uid) return fromUrl.box_no_uid;
  if (fromUrl?.box_uid) return fromUrl.box_uid;

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

  if (!/^https?:\/\//i.test(trimmed) && !trimmed.includes("?")) {
    return trimmed;
  }
  return "";
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

/** Laser / scan UI label — show sticker code only, never full URL. */
export function boxNoUidDisplayLabel(rawValue) {
  const trimmed = String(rawValue ?? "").trim();
  if (!trimmed) return "";

  const urlLike =
    /^https?:/i.test(trimmed) ||
    trimmed.includes("://") ||
    /[?&]box_no_uid=/i.test(trimmed) ||
    /\bbox_no_uid\s*[:=]/i.test(trimmed);

  if (urlLike) {
    const qp = trimmed.match(/[?&]box_no_uid=([^&#\s]+)/i);
    if (qp?.[1]) {
      try {
        return decodeURIComponent(qp[1].replace(/\+/g, " "));
      } catch {
        return qp[1];
      }
    }
    const { box_no_uid } = parseStickerScan(rawValue);
    return box_no_uid || "";
  }

  const { box_no_uid } = parseStickerScan(rawValue);
  if (box_no_uid) return box_no_uid;

  if (trimmed.startsWith("{")) return "";
  if (!/^\d+$/.test(trimmed)) return trimmed;
  return "";
}

/** Laser / scan UI — location no only, never full URL. */
export function locationNoDisplayLabel(rawValue) {
  const trimmed = String(rawValue ?? "").trim();
  if (!trimmed) return "";

  if (/^https?:/i.test(trimmed) || trimmed.includes("://")) {
    if (detectQrType(rawValue) === "box") return "";
    const no = extractLocationNo(rawValue);
    return no || "";
  }

  return extractLocationNo(rawValue) || "";
}

function decodeBase64UrlJsonBrowser(part) {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
  const json = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json);
}

function pickBillField(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

/**
 * Parse bill / e-invoice QR (GST SignedQR JWT, JSON, or plain bill no).
 * Example DocNo from invoice QR: HPF/26-27/1686
 */
export function parseBillQrPayload(rawValue) {
  const raw = normalizeScanInput(rawValue);
  if (!raw) return null;

  if (looksLikeEInvoiceJwt(raw)) {
    const parts = raw.split(".");
    if (parts.length !== 3) {
      return { ok: false, error: "Incomplete e-invoice QR. Hold steady and scan again." };
    }
    try {
      const dataObject = decodeBase64UrlJsonBrowser(parts[1]);
      let inside = dataObject?.data ?? dataObject;
      if (typeof inside === "string") {
        try {
          inside = JSON.parse(inside);
        } catch {
          /* keep */
        }
      }
      const payload = inside && typeof inside === "object" ? inside : dataObject;
      const docNumber =
        pickBillField(payload, ["DocNo", "docNo", "doc_no", "billno", "bill_no", "BillNo", "InvoiceNo"]) ||
        pickBillField(dataObject, ["DocNo", "docNo", "billno", "bill_no"]);
      if (!docNumber) {
        return { ok: false, error: "Document number not found in e-invoice QR." };
      }
      const bill_dt =
        pickBillField(payload, ["DocDt", "docDt", "doc_dt", "billdt", "bill_dt", "BillDt"]) ||
        pickBillField(dataObject, ["DocDt", "docDt", "billdt"]) ||
        null;
      return { ok: true, docNumber, bill_dt, source: "einvoice_jwt", payload };
    } catch {
      return { ok: false, error: "Invalid e-invoice QR. Scan the full QR from the tax invoice." };
    }
  }

  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const obj = JSON.parse(raw);
      const docNumber = pickBillField(obj, ["DocNo", "docNo", "billno", "bill_no", "BillNo", "InvoiceNo"]);
      if (docNumber) {
        return {
          ok: true,
          docNumber,
          bill_dt: pickBillField(obj, ["DocDt", "docDt", "billdt", "bill_dt"]) || null,
          source: "json",
          payload: obj,
        };
      }
    } catch {
      /* fall through */
    }
  }

  return { ok: true, docNumber: raw, bill_dt: null, source: "plain", payload: null };
}

