import { bestTierForStrings } from "@/features/apps/ims/helpers/liveSearchRank";
import { docDateToDayjs } from "@/core/utils/utilHelper";

/** Collect primitive values from a row for generic text search. */
export function defaultSearchParts(row) {
  const parts = [];
  for (const v of Object.values(row || {})) {
    if (v == null) continue;
    const t = typeof v;
    if (t === "string" || t === "number") parts.push(v);
    else if (t === "boolean") parts.push(v ? "true" : "false");
  }
  return parts;
}

/**
 * Filter rows where any part contains the query (case-insensitive), then sort by match strength:
 * exact → startsWith → word boundary → substring (same tiers as {@link bestTierForStrings}).
 */
export function applyClientSearch(rows, queryRaw, options = {}) {
  const { getParts = defaultSearchParts, tieBreaker } = options;
  const q = String(queryRaw ?? "").trim();
  if (!q) return [...rows];
  const ql = q.toLowerCase();
  const filtered = rows.filter((row) =>
    getParts(row).some((p) => String(p).toLowerCase().includes(ql))
  );
  return filtered.sort((a, b) => {
    const ra = bestTierForStrings(q, getParts(a).map(String));
    const rb = bestTierForStrings(q, getParts(b).map(String));
    if (ra !== rb) return ra - rb;
    if (tieBreaker) return tieBreaker(a, b);
    return 0;
  });
}

function sortDirectionMultiplier(sortDir) {
  return String(sortDir).toLowerCase() === "asc" ? 1 : -1;
}

function isDateSortKey(sortKey) {
  if (!sortKey) return false;
  if (sortKey === "doc_dt" || sortKey === "doc_date") return true;
  return /_(at|date|dt)$/.test(sortKey) || sortKey === "timestamp";
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

  return [...rows].sort((a, b) => compareSortValues(a, b, sortKey) * mul);
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
