import { docDateToDayjs } from "@/platform/utils/core/utilHelper";
import { getCellPlainText } from "@/platform/utils/list/dataTableCellSelection";

/** Collect primitive values from a row for generic text search. */
export function defaultSearchParts(row) {
  const parts = [];
  const obj = row || {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const t = typeof v;
    if (t === "string" || t === "number") {
      parts.push(v);
      if ((k === "approved" || k === "apvitem") && Number(v) === 1) {
        parts.push("approved", "authorized", "active", "yes", "true");
      } else if ((k === "approved" || k === "apvitem") && Number(v) === 0) {
        parts.push("pending", "inactive", "no", "false");
      }
    } else if (t === "boolean") {
      parts.push(v ? "true" : "false");
      if (k === "approved") {
        parts.push(v ? "approved" : "pending");
        parts.push(v ? "authorized" : "unauthorized");
        parts.push(v ? "active" : "inactive");
      }
    } else if (Array.isArray(v)) {
      for (const item of v) {
        if (item == null) continue;
        const it = typeof item;
        if (it === "string" || it === "number") parts.push(item);
      }
    }
  }

  // Location fallback display uses rack+shelf combo in UI ("48A"), include it for quick search.
  if ((obj.location_no == null || obj.location_no === "") && obj.rack_no != null && obj.shelf_no != null) {
    parts.push(`${obj.rack_no}${String(obj.shelf_no).toUpperCase()}`);
  }
  return parts;
}

/**
 * Filter rows where any part contains the query (case-insensitive).
 */
function rowMatchesQuery(row, ql, getParts) {
  const parts = getParts(row);
  for (let i = 0; i < parts.length; i++) {
    if (String(parts[i]).toLowerCase().includes(ql)) return true;
  }
  return false;
}

function cheapMatchTier(row, q, getParts) {
  const parts = getParts(row);
  let best = 4;
  for (let i = 0; i < parts.length; i++) {
    const s = String(parts[i]).toLowerCase();
    if (!s.includes(q)) continue;
    if (s === q) return 0;
    if (s.startsWith(q)) best = Math.min(best, 1);
    else best = Math.min(best, 3);
  }
  return best;
}

export function applyClientSearch(rows, queryRaw, options = {}) {
  const { getParts = defaultSearchParts, tieBreaker, skipSort = false } = options;
  const q = String(queryRaw ?? "").trim().toLowerCase();
  if (!q) return rows;
  const filtered = [];
  for (let i = 0; i < rows.length; i++) {
    if (rowMatchesQuery(rows[i], q, getParts)) filtered.push(rows[i]);
  }
  if (skipSort || filtered.length > 250) return filtered;
  return filtered.sort((a, b) => {
    const ra = cheapMatchTier(a, q, getParts);
    const rb = cheapMatchTier(b, q, getParts);
    if (ra !== rb) return ra - rb;
    if (tieBreaker) return tieBreaker(a, b);
    return 0;
  });
}

/** IMS-style quick search parts from visible table columns (copy/export text). */
export function buildTableSearchParts(row, headers = []) {
  const parts = [];
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (header?.[3]?.searchable === false) continue;
    const label = String(header?.[0] ?? "").trim();
    if (label === "#") continue;
    const text = getCellPlainText(row, header, i);
    if (text != null && String(text).trim() !== "") parts.push(text);
  }
  return parts;
}

function sortDirectionMultiplier(sortDir) {
  return String(sortDir).toLowerCase() === "asc" ? 1 : -1;
}

function isDateSortKey(sortKey) {
  if (!sortKey) return false;
  if (sortKey === "doc_dt" || sortKey === "doc_date") return true;
  return /_(at|date|dt|timestamp)$/.test(sortKey) || sortKey === "timestamp";
}

function parseSortTimestamp(value, sortKey) {
  if (value == null || value === "") return NaN;
  if (sortKey === "doc_dt" || sortKey === "doc_date") {
    const d = docDateToDayjs(value);
    return d ? d.valueOf() : NaN;
  }
  const n = Date.parse(String(value));
  return Number.isFinite(n) ? n : NaN;
}

function parseSortNumber(value) {
  if (value == null || value === "") return NaN;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const s = String(value).trim();
  if (!s) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function compareSortValues(a, b, sortKey) {
  const va = a?.[sortKey];
  const vb = b?.[sortKey];

  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;

  if (isDateSortKey(sortKey)) {
    const ta = parseSortTimestamp(va, sortKey);
    const tb = parseSortTimestamp(vb, sortKey);
    if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
    if (!Number.isFinite(ta)) return 1;
    if (!Number.isFinite(tb)) return -1;
    if (ta === tb) return 0;
    return ta < tb ? -1 : 1;
  }

  const na = parseSortNumber(va);
  const nb = parseSortNumber(vb);
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    if (na === nb) return 0;
    return na < nb ? -1 : 1;
  }

  if (typeof va === "boolean" || typeof vb === "boolean") {
    const ba = va === true ? 1 : va === false ? 0 : -1;
    const bb = vb === true ? 1 : vb === false ? 0 : -1;
    if (ba === bb) return 0;
    return ba < bb ? -1 : 1;
  }

  const cmp = String(va).localeCompare(String(vb), undefined, {
    sensitivity: "base",
    numeric: true,
  });
  return cmp;
}

/** Toggle sort key/direction for IMS list tables. */
export function nextSortParams(prev, key) {
  return {
    sortKey: key,
    sortDir: prev.sortKey === key && String(prev.sortDir).toLowerCase() === "asc" ? "desc" : "asc",
  };
}

/** Client-side column sort for IMS tables. */
export function sortRowsByKey(rows, sortKey, sortDir) {
  if (!sortKey) return [...rows];
  const mul = sortDirectionMultiplier(sortDir);

  if (sortKey === "sort_order") {
    const ord = (row) => {
      const s = String(row?.sort_order ?? "").trim();
      return /^[0-9]+$/.test(s) ? parseInt(s, 10) : Number.MAX_SAFE_INTEGER;
    };
    return [...rows].sort((a, b) => {
      const na = ord(a);
      const nb = ord(b);
      if (na !== nb) return na < nb ? -1 * mul : 1 * mul;
      const la = String(a?.label ?? "").toLowerCase();
      const lb = String(b?.label ?? "").toLowerCase();
      if (la < lb) return -1 * mul;
      if (la > lb) return 1 * mul;
      return 0;
    });
  }

  const dateKey = isDateSortKey(sortKey);
  const keyed = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]?.[sortKey];
    let key = null;
    if (raw != null && raw !== "") {
      if (dateKey) key = parseSortTimestamp(raw, sortKey);
      else {
        const n = parseSortNumber(raw);
        key = Number.isFinite(n) ? n : String(raw).toLowerCase();
      }
      if (typeof key === "number" && !Number.isFinite(key)) key = null;
    }
    keyed[i] = [key, rows[i]];
  }
  keyed.sort((a, b) => {
    const va = a[0];
    const vb = b[0];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va < vb) return -mul;
    if (va > vb) return mul;
    return 0;
  });
  const out = new Array(keyed.length);
  for (let i = 0; i < keyed.length; i++) out[i] = keyed[i][1];
  return out;
}

/**
 * Repeated GET list until all rows for current filters are loaded (backend caps page size, e.g. 1000).
 * @param {(page: number, limit: number) => Promise<{ data?: unknown[]; total?: number }>} loadOnePage
 */
/** One list API call (default cap 500 rows) — avoids multi-page loops when data is small. */
export async function fetchListFirstPage(loadOnePage, perPage = 500) {
  const first = await loadOnePage(1, perPage);
  const rows = [...(first.data ?? [])];
  const total = Number(first.total ?? rows.length);
  return { data: rows, total: Number.isFinite(total) ? total : rows.length };
}

export async function fetchAllListPages(loadOnePage, perPage = 1000, cap = 50000) {
  const first = await loadOnePage(1, perPage);
  let rows = [...(first.data ?? [])];
  let total = Number(first.total ?? 0);
  if (!Number.isFinite(total) || total < rows.length) total = rows.length;
  let page = 2;
  while (rows.length < total && rows.length < cap) {
    const next = await loadOnePage(page, perPage);
    const chunk = next.data ?? [];
    if (!chunk.length) break;
    rows.push(...chunk);
    const t = Number(next.total ?? total);
    if (Number.isFinite(t)) total = t;
    page += 1;
    if (chunk.length < perPage) break;
  }
  return { data: rows, total: Math.min(rows.length, total) };
}
