import { sortSelectRowsAsc } from "@/platform/utils/form/sortSelectOptions";

export const EMPTY_INVENTORY_TOTALS = {
  fg_stock_qty: 0,
  in_store_qty: 0,
  packing_area_qty: 0,
  qc_hold_qty: 0,
  out_qty: 0,
};

export const EMPTY_FILTERS = {
  item_dcodes: [],
  customer_codes: [],
  location_ids: [],
  packing_numbers: [],
};

export const EMPTY_FILTER_OPTIONS = {
  items: [],
  customers: [],
  locations: [],
  packings: [],
};

const FILTER_OMIT_KEY = {
  items: "item_dcodes",
  customers: "customer_codes",
  locations: "location_ids",
  packings: "packing_numbers",
};

export function normalizeMultiFilterIds(value) {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map((v) => String(v).trim()).filter(Boolean))];
}

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

/** Match item by dcode / item_code and aliases that share the same item_code label. */
export function rowMatchesItemFilter(row, selectedIds, itemOptions = []) {
  const ids = normalizeMultiFilterIds(selectedIds);
  if (!ids.length) return true;

  const matchTokens = tokenSet(ids);
  for (const id of ids) {
    const opt = itemOptions.find((o) => String(o.id) === String(id));
    if (opt?.item_code) tokenSet([opt.item_code]).forEach((t) => matchTokens.add(t));
  }

  const selectedCodes = new Set();
  itemOptions.forEach((opt) => {
    const id = String(opt.id ?? "").trim();
    const code = String(opt.item_code ?? "").trim().toUpperCase();
    if (!id) return;
    if (matchTokens.has(id) || matchTokens.has(id.toUpperCase()) || (code && matchTokens.has(code))) {
      if (code) selectedCodes.add(code);
    }
  });
  itemOptions.forEach((opt) => {
    const code = String(opt.item_code ?? "").trim().toUpperCase();
    if (code && selectedCodes.has(code)) {
      tokenSet([opt.id, opt.item_code]).forEach((t) => matchTokens.add(t));
    }
  });

  const dcode = String(row?.item_dcode ?? "").trim();
  const code = String(row?.item_code ?? "").trim();
  return (
    matchTokens.has(dcode) ||
    matchTokens.has(code) ||
    matchTokens.has(dcode.toUpperCase()) ||
    matchTokens.has(code.toUpperCase())
  );
}

function rowMatchesCustomerFilter(row, selectedIds) {
  const ids = normalizeMultiFilterIds(selectedIds);
  if (!ids.length) return true;
  const code = String(row?.customer_code ?? "").trim();
  return ids.some((id) => String(id) === code);
}

function rowMatchesPackingFilter(row, selectedIds) {
  const ids = normalizeMultiFilterIds(selectedIds);
  if (!ids.length) return true;
  const pn = String(row?.packing_number ?? "").trim();
  return ids.some((id) => String(id) === pn);
}

function rowMatchesLocationFilter(row, selectedIds) {
  const ids = normalizeMultiFilterIds(selectedIds);
  if (!ids.length) return true;
  const locIds = Array.isArray(row?.in_store_location_ids) ? row.in_store_location_ids : [];
  if (!locIds.length) return false;
  const set = new Set(ids.map(String));
  return locIds.some((id) => set.has(String(id)));
}

/** Filter rows — all active dropdown filters (AND). */
export function filterInventoryRows(rows = [], filters = {}, itemOptions = []) {
  const list = Array.isArray(rows) ? rows : [];
  const itemIds = normalizeMultiFilterIds(filters.item_dcodes);
  const customerIds = normalizeMultiFilterIds(filters.customer_codes);
  const locationIds = normalizeMultiFilterIds(filters.location_ids);
  const packingIds = normalizeMultiFilterIds(filters.packing_numbers);

  if (!itemIds.length && !customerIds.length && !locationIds.length && !packingIds.length) {
    return list;
  }

  return list.filter(
    (row) =>
      rowMatchesItemFilter(row, itemIds, itemOptions) &&
      rowMatchesCustomerFilter(row, customerIds) &&
      rowMatchesLocationFilter(row, locationIds) &&
      rowMatchesPackingFilter(row, packingIds)
  );
}

function filtersWithoutField(filters = {}, field) {
  const omitKey = FILTER_OMIT_KEY[field];
  if (!omitKey) return filters;
  return { ...filters, [omitKey]: [] };
}

function buildItemOptions(rows = []) {
  const byCode = new Map();
  for (const row of rows) {
    const id = String(row?.item_dcode ?? row?.item_code ?? "").trim();
    const itemCode = String(row?.item_code ?? row?.item_dcode ?? id).trim();
    if (!id || id === "—" || !itemCode || itemCode === "—") continue;
    const key = itemCode.toUpperCase();
    if (!byCode.has(key)) {
      byCode.set(key, {
        id,
        item_code: itemCode,
        item_desc: row?.item_desc ?? null,
      });
    }
  }
  return sortSelectRowsAsc([...byCode.values()], "item_code", ["item_desc"]);
}

function buildCustomerOptions(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const id = String(row?.customer_code ?? "").trim();
    if (!id || id === "—") continue;
    if (!map.has(id)) {
      map.set(id, {
        id,
        acc_name: row?.customer_name ?? id,
      });
    }
  }
  return sortSelectRowsAsc([...map.values()], "acc_name");
}

function parseLocationDetailSegment(segment) {
  const s = String(segment ?? "").trim();
  if (!s || s === "—") return null;
  return s.replace(/\s*\([\d,]+\)\s*$/, "").trim() || null;
}

function buildLocationOptions(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const ids = Array.isArray(row?.in_store_location_ids) ? row.in_store_location_ids : [];
    const labels = String(row?.location_details ?? "")
      .split(",")
      .map((s) => s.trim())
      .map(parseLocationDetailSegment)
      .filter(Boolean);
    ids.forEach((id, index) => {
      const key = String(id);
      if (!key || map.has(key)) return;
      map.set(key, {
        id: key,
        location_no: labels[index] || labels[0] || key,
      });
    });
  }
  return sortSelectRowsAsc([...map.values()], "location_no");
}

function buildPackingOptions(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const id = String(row?.packing_number ?? "").trim();
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, { id, packing_number: id });
    }
  }
  return sortSelectRowsAsc([...map.values()], "packing_number");
}

/** Facet dropdown options from loaded rows (omit each field's own filter). */
export function buildInventoryFilterOptionsFromRows(allRows = [], filters = {}) {
  const allItemOpts = buildItemOptions(allRows);
  if (!hasActiveInventoryFilters(filters)) {
    return {
      items: allItemOpts,
      customers: buildCustomerOptions(allRows),
      locations: buildLocationOptions(allRows),
      packings: buildPackingOptions(allRows),
    };
  }

  return {
    items: buildItemOptions(
      filterInventoryRows(allRows, filtersWithoutField(filters, "items"), allItemOpts)
    ),
    customers: buildCustomerOptions(
      filterInventoryRows(allRows, filtersWithoutField(filters, "customers"), allItemOpts)
    ),
    locations: buildLocationOptions(
      filterInventoryRows(allRows, filtersWithoutField(filters, "locations"), allItemOpts)
    ),
    packings: buildPackingOptions(
      filterInventoryRows(allRows, filtersWithoutField(filters, "packings"), allItemOpts)
    ),
  };
}

/** Sum quantity columns (footer / export). */
export function computeInventoryTotals(rows = []) {
  const safeQty = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  return (rows || []).reduce(
    (acc, row) => {
      acc.fg_stock_qty += safeQty(row?.fg_stock_qty);
      acc.in_store_qty += safeQty(row?.in_store_qty);
      acc.packing_area_qty += safeQty(row?.packing_area_qty);
      acc.qc_hold_qty += safeQty(row?.qc_hold_qty);
      acc.out_qty += safeQty(row?.out_qty);
      return acc;
    },
    { ...EMPTY_INVENTORY_TOTALS }
  );
}

export function hasActiveInventoryFilters(filters = {}) {
  return (
    (filters.item_dcodes?.length ?? 0) > 0 ||
    (filters.customer_codes?.length ?? 0) > 0 ||
    (filters.location_ids?.length ?? 0) > 0 ||
    (filters.packing_numbers?.length ?? 0) > 0
  );
}
