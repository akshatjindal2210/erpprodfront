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