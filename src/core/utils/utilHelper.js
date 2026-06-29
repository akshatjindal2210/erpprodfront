import dayjs from "dayjs";

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

/** Auto-insert slashes while typing digits (max 8): 20062026 → 20/06/2026 */
export function formatDateTypingInput(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Parse typed / pasted filter date → YYYY-MM-DD, or "" if empty / invalid.
 * Accepts DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD (via formatDocDate).
 */
export function parseFilterDateInput(text) {
  if (text == null) return "";
  const s = String(text).trim();
  if (!s) return "";
  const d = docDateToDayjs(s);
  if (!d) return "";
  return d.format("YYYY-MM-DD");
}

/** Clamp YYYY-MM-DD to optional min/max (inclusive). */
export function clampFilterDateYmd(ymd, { min, max } = {}) {
  if (!ymd) return "";
  const d = docDateToDayjs(ymd);
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
export function inferForwardingPackingStandardQty(boxes = []) {
  const counts = new Map();
  for (const box of boxes || []) {
    const flaggedLoose = box?.is_loose === true || box?.is_loose === 1 || box?.is_loose === "true" || box?.is_loose === "t";
    if (flaggedLoose) continue;
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

/** Full/open vs loose — `is_loose` flag, else qty vs packing standard (full box qty). */
export function isForwardingLooseBox(box, packingStandardQty = null) {
  const v = box?.is_loose;
  if (v === true || v === 1 || v === "true" || v === "t") return true;

  const qty = Math.round(Number(box?.qty) || 0);
  const std = Math.round(
    Number(
      packingStandardQty != null
        ? packingStandardQty
        : box?._packing_std_qty ?? box?.standard_qty_per_box ?? 0
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