import dayjs from "dayjs";
import { getBoxNoUidPrefix, parseStandardBoxNoUid } from "@/platform/utils/global";

function parseSafeDate(d) {
  if (d == null || String(d).trim() === "") return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export const formatDate = (d) => {
  const dt = parseSafeDate(d);
  if (!dt) return "—";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export function formatDateTime(date, options = {}) {
  const dt = parseSafeDate(date);
  if (!dt) return "—";

  const defaultOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  return dt.toLocaleString("en-IN", { ...defaultOptions, ...options });
}

/** dayjs format with fallback — never returns "Invalid Date". */
export function formatDayjs(v, pattern = "DD/MM/YYYY") {
  if (v == null || String(v).trim() === "") return "—";
  const d = dayjs(v);
  return d.isValid() ? d.format(pattern) : "—";
}

const DOC_DATE_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Packing entry date → DD/MM/YYYY (no timestamp / timezone shift). */
export function formatDocDate(v) {
  if (v == null || String(v).trim() === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${String(v.getDate()).padStart(2, "0")}/${String(v.getMonth() + 1).padStart(2, "0")}/${v.getFullYear()}`;
  }
  const s = String(v).trim();
  if (/invalid/i.test(s)) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (dmy) return `${dmy[1]}/${dmy[2]}/${dmy[3]}`;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})T/.exec(s);
  if (iso) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
  }
  const monTok = /^(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})$/i.exec(s);
  if (monTok) {
    const day = parseInt(monTok[1], 10);
    const year = parseInt(monTok[3], 10);
    const monIdx = DOC_DATE_MON.findIndex((x) => x.toLowerCase() === monTok[2].toLowerCase());
    if (monIdx >= 0 && day >= 1 && day <= 31 && year > 0) {
      return `${String(day).padStart(2, "0")}/${String(monIdx + 1).padStart(2, "0")}/${year}`;
    }
  }
  return s;
}

/** Parse doc_dt (any supported shape) to dayjs for comparisons — null if unparseable. */
export function docDateToDayjs(v) {
  const f = formatDocDate(v);
  if (!f || !/^\d{2}\/\d{2}\/\d{4}$/.test(f)) return null;
  const [dd, mm, yyyy] = f.split("/");
  const d = dayjs(`${yyyy}-${mm}-${dd}`);
  return d.isValid() ? d : null;
}

/** List filter: YYYY-MM-DD → DD/MM/YYYY display text. */
export function filterDateToDisplay(ymd) {
  if (ymd == null || String(ymd).trim() === "") return "";
  const f = formatDocDate(ymd);
  return f && /^\d{2}\/\d{2}\/\d{4}$/.test(f) ? f : "";
}

/** Sane year window for list/report filters (blocks typos like 0265 that explode ranges). */
export const FILTER_DATE_YEAR_MIN = 1990;
export const FILTER_DATE_YEAR_MAX = 2100;
/**
 * Change this single value to raise/lower the allowed From–To span (e.g. 20, 30, 40).
 * Multi-year history is allowed; only absurd ranges are blocked.
 */
export const FILTER_DATE_RANGE_MAX_YEARS = 30;
/** Inclusive max day span derived from FILTER_DATE_RANGE_MAX_YEARS. */
export const FILTER_DATE_RANGE_MAX_DAYS = 366 * FILTER_DATE_RANGE_MAX_YEARS;

const FILTER_DATE_SEG_MAX = [2, 2, 4];

/** Auto-insert slashes while typing digits (max 8): 20062026 → 20/06/2026 */
export function formatDateTypingInput(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Split filter display into [dd, mm, yyyy] digit strings (may be partial). */
export function splitFilterDateSegments(text) {
  const s = String(text ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return [iso[3], iso[2], iso[1]];

  if (/[/\-.]/.test(s)) {
    const parts = s.split(/[/\-.]/);
    /** DD/MM/YYYY — if first part looks like a year, treat as YYYY-MM-DD fragments. */
    if ((parts[0] || "").replace(/\D/g, "").length === 4 && parts.length >= 3) {
      return [
        (parts[2] || "").replace(/\D/g, "").slice(0, 2),
        (parts[1] || "").replace(/\D/g, "").slice(0, 2),
        (parts[0] || "").replace(/\D/g, "").slice(0, 4),
      ];
    }
    return [
      (parts[0] || "").replace(/\D/g, "").slice(0, 2),
      (parts[1] || "").replace(/\D/g, "").slice(0, 2),
      (parts[2] || "").replace(/\D/g, "").slice(0, 4),
    ];
  }
  const d = s.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)];
}

/**
 * Join segments. Once month/year exist, keep `DD/MM/YYYY` structure so
 * editing the day never shifts month/year digits left.
 */
export function joinFilterDateSegments(segs) {
  const [dd = "", mm = "", yyyy = ""] = segs || [];
  if (!dd && !mm && !yyyy) return "";
  if (mm || yyyy) return `${dd}/${mm}/${yyyy}`;
  return dd;
}

function filterDateHasStructure(text, segs) {
  const s = String(text ?? "");
  if ((s.match(/[/\-.]/g) || []).length >= 1) return true;
  return Boolean(segs[1] || segs[2]);
}

function filterDateCaretIndex(segs, segIdx, offset) {
  let caret = 0;
  const structured = Boolean(segs[1] || segs[2]);
  for (let i = 0; i < 3; i += 1) {
    const part = segs[i] || "";
    if (i === segIdx) return caret + Math.min(Math.max(0, offset), part.length);
    caret += part.length;
    if (i < 2 && structured) caret += 1;
  }
  return caret;
}

function locateFilterDateCaret(segs, caret) {
  let pos = 0;
  const structured = Boolean(segs[1] || segs[2]);
  const c = Math.max(0, Number(caret) || 0);
  for (let i = 0; i < 3; i += 1) {
    const part = segs[i] || "";
    const end = pos + part.length;
    if (c <= end) {
      return { seg: i, offset: Math.max(0, c - pos), onSep: false };
    }
    pos = end;
    if (i < 2 && structured) {
      if (c === pos) {
        /** Caret on `/` — backspace edits end of this segment; digits jump to next. */
        return { seg: i, offset: part.length, onSep: true };
      }
      pos += 1;
    }
  }
  return { seg: 2, offset: (segs[2] || "").length, onSep: false };
}

function isRealFilterYmd(yyyy, mm, dd) {
  const y = Number(yyyy);
  const m = Number(mm);
  const d = Number(dd);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  if (y < FILTER_DATE_YEAR_MIN || y > FILTER_DATE_YEAR_MAX) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Segment-aware edit for DD/MM/YYYY filter fields.
 * Returns `{ text, caret }` or null when the key should use default browser behavior.
 */
export function editFilterDateInput(prevText, { key, selectionStart = 0, selectionEnd = 0 } = {}) {
  const prev = String(prevText ?? "");
  let segs = splitFilterDateSegments(prev);
  const structured = filterDateHasStructure(prev, segs);
  let selStart = Math.min(selectionStart, selectionEnd);
  let selEnd = Math.max(selectionStart, selectionEnd);

  const commit = (nextSegs, segIdx, offset) => {
    const keep = structured || Boolean(nextSegs[1] || nextSegs[2]);
    const text = keep
      ? joinFilterDateSegments(nextSegs)
      : formatDateTypingInput(nextSegs.join(""));
    const outSegs = splitFilterDateSegments(text);
    return {
      text,
      caret: filterDateCaretIndex(outSegs, segIdx, offset),
    };
  };

  /** Clear selected span (digit-wise), then optionally insert. */
  if (selStart !== selEnd) {
    const before = prev.slice(0, selStart).replace(/\D/g, "");
    const after = prev.slice(selEnd).replace(/\D/g, "");
    if (key === "Backspace" || key === "Delete") {
      const digits = (before + after).slice(0, 8);
      if (structured) {
        /** Rebuild segments from remaining digits left-filled — only when wiping a range. */
        const next = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
        /** Prefer preserving trailing year/month when selection was only in day. */
        const locStart = locateFilterDateCaret(segs, selStart);
        const locEnd = locateFilterDateCaret(segs, selEnd);
        if (locStart.seg === locEnd.seg) {
          const si = locStart.seg;
          const part = segs[si] || "";
          segs[si] = part.slice(0, locStart.offset) + part.slice(locEnd.offset);
          return commit(segs, si, locStart.offset);
        }
        segs = next;
        return commit(segs, 0, before.length);
      }
      const text = formatDateTypingInput(digits);
      return { text, caret: formatDateTypingInput(before).length };
    }
    if (/^\d$/.test(key)) {
      const locStart = locateFilterDateCaret(segs, selStart);
      const locEnd = locateFilterDateCaret(segs, selEnd);
      if (structured && locStart.seg === locEnd.seg) {
        const si = locStart.seg;
        const max = FILTER_DATE_SEG_MAX[si];
        const part = segs[si] || "";
        segs[si] = (part.slice(0, locStart.offset) + key + part.slice(locEnd.offset)).slice(0, max);
        return commit(segs, si, Math.min(locStart.offset + 1, segs[si].length));
      }
      const digits = (before + key + after).slice(0, 8);
      const text = formatDateTypingInput(digits);
      return { text, caret: formatDateTypingInput(before + key).length };
    }
    return null;
  }

  if (key === "Backspace") {
    const loc = locateFilterDateCaret(segs, selStart);
    if (loc.onSep || (loc.offset === 0 && loc.seg > 0)) {
      const si = loc.onSep ? loc.seg : loc.seg - 1;
      if (!(segs[si] || "").length) {
        return commit(segs, si, 0);
      }
      segs[si] = segs[si].slice(0, -1);
      return commit(segs, si, segs[si].length);
    }
    if (loc.offset > 0) {
      const part = segs[loc.seg] || "";
      segs[loc.seg] = part.slice(0, loc.offset - 1) + part.slice(loc.offset);
      return commit(segs, loc.seg, loc.offset - 1);
    }
    return { text: prev, caret: selStart };
  }

  if (key === "Delete") {
    const loc = locateFilterDateCaret(segs, selStart);
    if (loc.onSep) {
      const si = Math.min(loc.seg + 1, 2);
      if ((segs[si] || "").length) {
        segs[si] = segs[si].slice(1);
      }
      return commit(segs, si, 0);
    }
    const part = segs[loc.seg] || "";
    if (loc.offset < part.length) {
      segs[loc.seg] = part.slice(0, loc.offset) + part.slice(loc.offset + 1);
      return commit(segs, loc.seg, loc.offset);
    }
    if (loc.seg < 2 && (segs[loc.seg + 1] || segs[2])) {
      const si = loc.seg + 1;
      segs[si] = (segs[si] || "").slice(1);
      return commit(segs, si, 0);
    }
    return { text: prev, caret: selStart };
  }

  if (/^\d$/.test(key)) {
    if (!structured) {
      const digits = (prev.replace(/\D/g, "") + key).slice(0, 8);
      const text = formatDateTypingInput(digits);
      return { text, caret: text.length };
    }
    let { seg, offset, onSep } = locateFilterDateCaret(segs, selStart);
    if (onSep) {
      seg = Math.min(seg + 1, 2);
      offset = 0;
    }
    let max = FILTER_DATE_SEG_MAX[seg];
    if (offset >= max && seg < 2) {
      seg += 1;
      offset = (segs[seg] || "").length;
      max = FILTER_DATE_SEG_MAX[seg];
    }
    const part = segs[seg] || "";
    if (offset < part.length) {
      segs[seg] = part.slice(0, offset) + key + part.slice(offset + 1);
    } else if (part.length >= max) {
      if (seg < 2) {
        seg += 1;
        offset = (segs[seg] || "").length;
        max = FILTER_DATE_SEG_MAX[seg];
        const p2 = segs[seg] || "";
        if (offset < p2.length) {
          segs[seg] = p2.slice(0, offset) + key + p2.slice(offset + 1);
        } else {
          segs[seg] = (p2 + key).slice(0, max);
          offset = segs[seg].length - 1;
        }
      } else {
        return { text: prev, caret: selStart };
      }
    } else {
      segs[seg] = (part.slice(0, offset) + key + part.slice(offset)).slice(0, max);
    }
    let nextOffset = Math.min(offset + 1, (segs[seg] || "").length);
    let caretSeg = seg;
    if (nextOffset >= FILTER_DATE_SEG_MAX[seg] && seg < 2) {
      caretSeg = seg + 1;
      nextOffset = 0;
    }
    return commit(segs, caretSeg, nextOffset);
  }

  return null;
}

/**
 * Parse typed / pasted filter date → YYYY-MM-DD, or "" if empty / invalid.
 * Accepts DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD (via formatDocDate).
 * Rejects years outside FILTER_DATE_YEAR_MIN…MAX and non-calendar days.
 */
export function parseFilterDateInput(text) {
  if (text == null) return "";
  const s = String(text).trim();
  if (!s) return "";

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    if (!isRealFilterYmd(iso[1], iso[2], iso[3])) return "";
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const segs = splitFilterDateSegments(s);
  if (segs[0].length === 2 && segs[1].length === 2 && segs[2].length === 4) {
    if (!isRealFilterYmd(segs[2], segs[1], segs[0])) return "";
    return `${segs[2]}-${segs[1]}-${segs[0]}`;
  }

  const d = docDateToDayjs(s);
  if (!d) return "";
  const y = d.year();
  if (y < FILTER_DATE_YEAR_MIN || y > FILTER_DATE_YEAR_MAX) return "";
  if (!isRealFilterYmd(d.format("YYYY"), d.format("MM"), d.format("DD"))) return "";
  return d.format("YYYY-MM-DD");
}

/** Inclusive day count between two YYYY-MM-DD values; 0 if invalid / inverted. */
export function filterDateRangeDayCount(fromYmd, toYmd) {
  const from = parseFilterDateInput(fromYmd) || String(fromYmd || "").slice(0, 10);
  const to = parseFilterDateInput(toYmd) || String(toYmd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return 0;
  }
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

/** Clamp YYYY-MM-DD to optional min/max (inclusive). Rejects out-of-window years. */
export function clampFilterDateYmd(ymd, { min, max } = {}) {
  if (!ymd) return "";
  const normalized = parseFilterDateInput(ymd) || (/^\d{4}-\d{2}-\d{2}$/.test(String(ymd)) ? String(ymd) : "");
  if (!normalized) return "";
  const y = Number(normalized.slice(0, 4));
  if (!Number.isFinite(y) || y < FILTER_DATE_YEAR_MIN || y > FILTER_DATE_YEAR_MAX) return "";
  const d = docDateToDayjs(normalized);
  if (!d) return "";
  let out = d;
  if (min) {
    const lo = docDateToDayjs(min);
    if (lo && out.isBefore(lo, "day")) out = lo;
  }
  if (max) {
    const hi = docDateToDayjs(max);
    if (hi && out.isAfter(hi, "day")) out = hi;
  }
  return out.format("YYYY-MM-DD");
}

export function getInitials(name = "") {
  if (!name) return "??";

  const words = name.trim().split(" ");

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words[0][0] + words[1][0]
  ).toUpperCase();
}

export const extractList = (res) => {
  const d = res.data;
  const raw = d?.data?.items ?? d?.data?.data ?? d?.data ?? d ?? [];
  return Array.isArray(raw) ? raw : [];
};

export const maskTaskId = (id) => {
  if (!id) return "";
  const pattern = `TSK${id}Z${id * 7}`; 
  return btoa(pattern).replace(/=/g, "");
};

/** Keep in sync with `backend/src/apps/ims/utils/box/boxLooseKind.js`. */
function isBoxLooseFlagged(box) {
  const v = box?.is_loose;
  return v === true || v === 1 || v === "true" || v === "t";
}

function isLooseStickerIndex(box) {
  const raw = box?.full_boxes_count;
  if (raw == null || raw === "") return false;
  const fullCount = Number(raw);
  if (!Number.isFinite(fullCount) || fullCount < 0) return false;
  const parsed = parseStandardBoxNoUid(box?.box_no_uid, getBoxNoUidPrefix());
  if (!parsed?.boxIndex) return false;
  return parsed.boxIndex > fullCount;
}

export function inferForwardingPackingStandardQty(boxes = []) {
  for (const box of boxes || []) {
    const dpStd = Math.round(Number(box?.qty_per_box) || 0);
    if (dpStd > 0) return dpStd;
  }

  const counts = new Map();
  for (const box of boxes || []) {
    if (isBoxLooseFlagged(box) || isLooseStickerIndex(box)) continue;
    const qty = Math.round(Number(box?.qty) || 0);
    if (qty > 0) counts.set(qty, (counts.get(qty) || 0) + 1);
  }
  if (counts.size === 0) {
    for (const box of boxes || []) {
      const qty = Math.round(Number(box?.qty) || 0);
      if (qty > 0) counts.set(qty, (counts.get(qty) || 0) + 1);
    }
  }
  let bestQty = 0;
  let bestCount = 0;
  for (const [qty, count] of counts) {
    if (count > bestCount || (count === bestCount && qty > bestQty)) {
      bestQty = qty;
      bestCount = count;
    }
  }
  return bestQty > 0 ? bestQty : 0;
}

/** Full/open vs loose — `is_loose` flag, sticker index, else qty vs packing standard. */
export function isForwardingLooseBox(box, packingStandardQty = null) {
  if (isBoxLooseFlagged(box)) return true;
  if (isLooseStickerIndex(box)) return true;

  const qty = Math.round(Number(box?.qty) || 0);
  const std = Math.round(
    Number(
      packingStandardQty != null
        ? packingStandardQty
        : box?._packing_std_qty ?? box?.qty_per_box ?? box?.standard_qty_per_box ?? 0
    ) || 0
  );
  if (std > 0 && qty > 0 && qty !== std) return true;
  return false;
}

export function enrichForwardingBoxesWithPackingStd(boxes = []) {
  const byPacking = new Map();
  for (const box of boxes || []) {
    const pn = String(box?.packing_number ?? "").trim() || "N/A";
    if (!byPacking.has(pn)) byPacking.set(pn, []);
    byPacking.get(pn).push(box);
  }
  const stdByPacking = new Map();
  for (const [pn, list] of byPacking) {
    stdByPacking.set(pn, inferForwardingPackingStandardQty(list));
  }
  return (boxes || []).map((box) => {
    const pn = String(box?.packing_number ?? "").trim() || "N/A";
    return { ...box, _packing_std_qty: stdByPacking.get(pn) || null };
  });
}

/**
 * Allocates boxes in FIFO order; never returns more than `requestedQty`.
 *
 * @param {Array}  boxes         - Boxes from the API in FIFO order `[{ box_uid, qty, ... }, ...]`
 * @param {number} requestedQty - Quantity requested
 * @returns {{ selectedBoxes: Array, allocatedQty: number, remainingQty: number }}
 */
export function calculateFifoBoxes(boxes, requestedQty) {
  if (!boxes?.length || !requestedQty || requestedQty <= 0) {
    return { selectedBoxes: [], allocatedQty: 0, remainingQty: requestedQty };
  }

  const selectedBoxes = [];
  let allocated = 0;
  const needed = Number(requestedQty);

  for (const box of boxes) {
    if (allocated >= needed) break;

    const boxQty    = Number(box.qty);
    // const remaining = needed - allocated;

    // Always take the full box to avoid breaking FIFO / breaking boxes
    selectedBoxes.push({ ...box });
    allocated += boxQty;

    if (allocated >= needed) break;
  }

  return {
    selectedBoxes,
    allocatedQty:  allocated,
    remainingQty:  needed - allocated, // 0 if fully satisfied
  };
}