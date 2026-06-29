import { sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";
import { sortSelectRowsAsc } from "@/core/utils/sortSelectOptions";
import { normalizeMultiFilterIds } from "@/features/apps/ims/components/inventory-report/inventoryReportClient";

export const EMPTY_FILTERS = {
  item_dcodes: [],
  packing_numbers: [],
  /** "" | "any" | "red" | "yellow" */
  mismatch: "",
};

export const EMPTY_TOTALS = {
  erp_stock: 0,
  db_stock: 0,
  stock_diff: 0,
};

const FILTER_OMIT = {
  items: "item_dcodes",
  packings: "packing_numbers",
  mismatch: "mismatch",
};

function tokenSet(values = []) {
  const set = new Set();
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (!s || s === "—") continue;
    set.add(s);
    set.add(s.toUpperCase());
  }
  return set;
}

/** Precompute item tokens once per filter change (avoids O(rows × options) per row). */
function buildItemMatchTokens(selectedIds, itemOptions = []) {
  const ids = normalizeMultiFilterIds(selectedIds);
  if (!ids.length) return null;

  const matchTokens = tokenSet(ids);
  const optById = new Map();
  for (const opt of itemOptions) {
    const id = String(opt?.id ?? "").trim();
    if (id) optById.set(id, opt);
  }

  for (const id of ids) {
    const opt = optById.get(String(id));
    if (opt?.item_code) tokenSet([opt.item_code]).forEach((t) => matchTokens.add(t));
  }

  const selectedCodes = new Set();
  for (const opt of itemOptions) {
    const id = String(opt.id ?? "").trim();
    const code = String(opt.item_code ?? "").trim().toUpperCase();
    if (!id) continue;
    if (matchTokens.has(id) || matchTokens.has(id.toUpperCase()) || (code && matchTokens.has(code))) {
      if (code) selectedCodes.add(code);
    }
  }
  for (const opt of itemOptions) {
    const code = String(opt.item_code ?? "").trim().toUpperCase();
    if (code && selectedCodes.has(code)) {
      tokenSet([opt.id, opt.item_code]).forEach((t) => matchTokens.add(t));
    }
  }

  return matchTokens;
}

function rowMatchesItemTokens(row, matchTokens) {
  if (!matchTokens) return true;
  const dcode = String(row?.item_dcode ?? "").trim();
  const code = String(row?.item_code ?? "").trim();
  return (
    matchTokens.has(dcode) ||
    matchTokens.has(code) ||
    matchTokens.has(dcode.toUpperCase()) ||
    matchTokens.has(code.toUpperCase())
  );
}

function rowMatchesMismatch(row, mismatch) {
  const m = String(mismatch ?? "").trim();
  if (!m) return true;
  if (m === "any") return row?.mismatch === "red" || row?.mismatch === "yellow";
  return row?.mismatch === m;
}

export function createErpStockRowMatcher(filters = {}, itemOptions = []) {
  const itemTokens = buildItemMatchTokens(filters.item_dcodes, itemOptions);
  const packingSet = new Set(normalizeMultiFilterIds(filters.packing_numbers).map(String));
  const mismatch = filters.mismatch ?? "";

  if (!itemTokens && !packingSet.size && !mismatch) return null;

  return (row) => {
    if (itemTokens && !rowMatchesItemTokens(row, itemTokens)) return false;
    if (packingSet.size) {
      const pn = String(row?.packing_number ?? "").trim();
      if (!packingSet.has(pn)) return false;
    }
    if (mismatch && !rowMatchesMismatch(row, mismatch)) return false;
    return true;
  };
}

export function filterErpStockRows(rows = [], filters = {}, itemOptions = []) {
  const list = Array.isArray(rows) ? rows : [];
  const matcher = createErpStockRowMatcher(filters, itemOptions);
  if (!matcher) return list;
  const out = [];
  for (let i = 0; i < list.length; i++) {
    if (matcher(list[i])) out.push(list[i]);
  }
  return out;
}

function addItemOption(map, row) {
  const id = String(row?.item_dcode ?? row?.item_code ?? "").trim();
  const itemCode = String(row?.item_code ?? row?.item_dcode ?? id).trim();
  if (!id || !itemCode) return;
  const key = itemCode.toUpperCase();
  if (!map.has(key)) {
    map.set(key, { id, item_code: itemCode, item_desc: row?.item_desc ?? null });
  }
}

function addPackingOption(map, row) {
  const id = String(row?.packing_number ?? "").trim();
  if (!id || map.has(id)) return;
  map.set(id, { id, packing_number: id });
}

/** One pass over loaded rows — base dropdown options + mismatch counts. */
export function buildErpStockBaseMeta(rows = []) {
  const items = new Map();
  const packings = new Map();
  let red = 0;
  let yellow = 0;
  let match = 0;

  for (const row of rows) {
    addItemOption(items, row);
    addPackingOption(packings, row);
    if (row?.mismatch === "red") red += 1;
    else if (row?.mismatch === "yellow") yellow += 1;
    else match += 1;
  }

  return {
    itemOptions: sortSelectRowsAsc([...items.values()], "item_code", ["item_desc"]),
    packingOptions: sortSelectRowsAsc([...packings.values()], "packing_number"),
    mismatchStats: { red, yellow, match, mismatch: red + yellow },
  };
}

function filtersWithoutField(filters = {}, field) {
  const omitKey = FILTER_OMIT[field];
  if (!omitKey) return filters;
  return { ...filters, [omitKey]: omitKey === "mismatch" ? "" : [] };
}

export function buildErpStockFilterOptions(allRows = [], filters = {}, baseMeta = null) {
  const base = baseMeta || buildErpStockBaseMeta(allRows);
  if (!hasActiveErpStockFilters(filters)) {
    return { items: base.itemOptions, packings: base.packingOptions };
  }

  const itemMatcher = createErpStockRowMatcher(
    filtersWithoutField(filters, "items"),
    base.itemOptions
  );
  const packingMatcher = createErpStockRowMatcher(
    filtersWithoutField(filters, "packings"),
    base.itemOptions
  );

  const items = new Map();
  const packings = new Map();
  for (const row of allRows) {
    if (!itemMatcher || itemMatcher(row)) addItemOption(items, row);
    if (!packingMatcher || packingMatcher(row)) addPackingOption(packings, row);
  }

  return {
    items: sortSelectRowsAsc([...items.values()], "item_code", ["item_desc"]),
    packings: sortSelectRowsAsc([...packings.values()], "packing_number"),
  };
}

export function computeErpStockTotals(rows = []) {
  let erp_stock = 0;
  let db_stock = 0;
  for (const row of rows || []) {
    const erp = Number(row?.erp_stock);
    const db = Number(row?.db_stock);
    if (Number.isFinite(erp)) erp_stock += erp;
    if (Number.isFinite(db)) db_stock += db;
  }
  return { erp_stock, db_stock, stock_diff: db_stock - erp_stock };
}

/** Filter + totals + sort in one pass where possible. */
export function deriveErpStockView(allRows = [], filters = {}, itemOptions = [], sortKey, sortDir) {
  const matcher = createErpStockRowMatcher(filters, itemOptions);
  let filtered;
  let totals;

  if (!matcher) {
    filtered = allRows;
    totals = computeErpStockTotals(allRows);
  } else {
    filtered = [];
    let erp_stock = 0;
    let db_stock = 0;
    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      if (!matcher(row)) continue;
      filtered.push(row);
      const erp = Number(row?.erp_stock);
      const db = Number(row?.db_stock);
      if (Number.isFinite(erp)) erp_stock += erp;
      if (Number.isFinite(db)) db_stock += db;
    }
    totals = { erp_stock, db_stock, stock_diff: db_stock - erp_stock };
  }

  const sortedRows = sortRowsByKey(filtered, sortKey, sortDir);
  return { sortedRows, totals, filteredCount: filtered.length };
}

export function computeMismatchStats(rows = []) {
  let red = 0;
  let yellow = 0;
  let match = 0;
  for (const row of rows || []) {
    if (row?.mismatch === "red") red += 1;
    else if (row?.mismatch === "yellow") yellow += 1;
    else match += 1;
  }
  return { red, yellow, match, mismatch: red + yellow };
}

export function hasActiveErpStockFilters(filters = {}) {
  return (
    (filters.item_dcodes?.length ?? 0) > 0 ||
    (filters.packing_numbers?.length ?? 0) > 0 ||
    Boolean(String(filters.mismatch ?? "").trim())
  );
}

const SESSION_CACHE_KEY = "ims:erp-stock-report:v1";
const SESSION_CACHE_TTL_MS = 3 * 60 * 1000;

/** Show last report instantly on revisit (same browser tab session). */
export function readErpStockReportSessionCache() {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !Array.isArray(parsed.rows)) return null;
    if (Date.now() - parsed.at > SESSION_CACHE_TTL_MS) return null;
    return {
      rows: parsed.rows,
      total: Number(parsed.total) || parsed.rows.length,
    };
  } catch {
    return null;
  }
}

export function writeErpStockReportSessionCache(rows, total) {
  try {
    if (typeof sessionStorage === "undefined" || !Array.isArray(rows) || !rows.length) return;
    sessionStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({
        at: Date.now(),
        rows,
        total: Number(total) || rows.length,
      })
    );
  } catch {
    /* storage full — ignore */
  }
}

export function clearErpStockReportSessionCache() {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
