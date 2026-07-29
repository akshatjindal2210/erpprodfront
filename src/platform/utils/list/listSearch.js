import { bestTierForStrings } from "@/apps/settings/configuration/helpers/liveSearchRank";

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
  const { getParts = defaultSearchParts, tieBreaker, skipSort = false } = options;
  const q = String(queryRaw ?? "").trim();
  if (!q) return [...rows];
  const ql = q.toLowerCase();
  const filtered = rows.filter((row) =>
    getParts(row).some((p) => String(p).toLowerCase().includes(ql))
  );
  if (skipSort) return filtered;
  return filtered.sort((a, b) => {
    const ra = bestTierForStrings(q, getParts(a).map(String));
    const rb = bestTierForStrings(q, getParts(b).map(String));
    if (ra !== rb) return ra - rb;
    if (tieBreaker) return tieBreaker(a, b);
    return 0;
  });
}

/** Client-side column sort (when there is no active text search). */
export function sortRowsByKey(rows, sortKey, sortDir) {
  if (!sortKey) return [...rows];
  const mul = sortDir === "asc" ? 1 : -1;

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

  if (sortKey === "created_at" || sortKey === "updated_at") {
    const ts = (row) => {
      const v = row?.[sortKey];
      if (v == null || v === "") return NaN;
      const n = Date.parse(String(v));
      return Number.isFinite(n) ? n : NaN;
    };
    const rowId = (row) => Number(row?.id) || 0;
    return [...rows].sort((a, b) => {
      const na = ts(a);
      const nb = ts(b);
      if (!Number.isFinite(na) && !Number.isFinite(nb)) return 0;
      if (!Number.isFinite(na)) return 1;
      if (!Number.isFinite(nb)) return -1;
      if (na !== nb) return na < nb ? -1 * mul : 1 * mul;
      const ida = rowId(a);
      const idb = rowId(b);
      if (ida === idb) return 0;
      return ida < idb ? -1 * mul : 1 * mul;
    });
  }

  if (sortKey === "id" || sortKey === "box_count" || sortKey === "total_qty") {
    const num = (row) => {
      const n = Number(row?.[sortKey]);
      return Number.isFinite(n) ? n : NaN;
    };
    return [...rows].sort((a, b) => {
      const na = num(a);
      const nb = num(b);
      if (!Number.isFinite(na) && !Number.isFinite(nb)) return 0;
      if (!Number.isFinite(na)) return 1;
      if (!Number.isFinite(nb)) return -1;
      if (na === nb) return 0;
      return na < nb ? -1 * mul : 1 * mul;
    });
  }

  return [...rows].sort((a, b) => {
    let va = a[sortKey];
    let vb = b[sortKey];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string") {
      va = va.toLowerCase();
      vb = String(vb).toLowerCase();
    }
    if (va < vb) return -1 * mul;
    if (va > vb) return 1 * mul;
    return 0;
  });
}

/**
 * Repeated GET list until all rows for current filters are loaded (backend caps page size, e.g. 1000).
 * @param {(page: number, limit: number) => Promise<{ data?: unknown[]; total?: number }>} loadOnePage
 */
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

