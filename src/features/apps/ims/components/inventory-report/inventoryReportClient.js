import { sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";

function safeQty(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeLocationIds(ids) {
  if (Array.isArray(ids)) return ids.map((id) => String(id));
  if (typeof ids === "string" && ids.startsWith("{")) {
    return ids
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Sum quantity columns from visible rows (safe if values are missing). */
export function computeInventoryTotals(rows = []) {
  return (rows || []).reduce(
    (acc, row) => {
      acc.fg_stock_qty += safeQty(row?.fg_stock_qty);
      acc.in_store_qty += safeQty(row?.in_store_qty);
      acc.packing_area_qty += safeQty(row?.packing_area_qty);
      acc.out_qty += safeQty(row?.out_qty);
      return acc;
    },
    { fg_stock_qty: 0, in_store_qty: 0, packing_area_qty: 0, out_qty: 0 }
  );
}

function normalizeFilterList(value) {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => String(v).trim()).filter(Boolean);
}

function matchesAnyFilterValue(value, selected) {
  if (!selected.length) return true;
  return selected.some((entry) => String(value) === String(entry));
}

function rowLocationLabels(row) {
  return String(row?.location_details || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== "—");
}

function rowMatchesLocationFilter(row, selectedLocations) {
  if (!selectedLocations.length) return true;
  const labels = rowLocationLabels(row);
  const ids = normalizeLocationIds(row.in_store_location_ids);
  return selectedLocations.some(
    (loc) =>
      labels.some((label) => String(label) === String(loc)) ||
      ids.some((id) => String(id) === String(loc))
  );
}

export function filterInventoryRows(rows = [], filters = {}) {
  const items = normalizeFilterList(filters.item_dcodes);
  const customers = normalizeFilterList(filters.customer_codes);
  const packings = normalizeFilterList(filters.packing_numbers);
  const locations = normalizeFilterList(filters.location_ids);

  return (rows || []).filter((row) => {
    if (!matchesAnyFilterValue(row.item_dcode, items)) return false;
    if (!matchesAnyFilterValue(row.customer_code, customers)) return false;
    if (!matchesAnyFilterValue(row.packing_number, packings)) return false;
    if (locations.length && !rowMatchesLocationFilter(row, locations)) return false;
    return true;
  });
}

export function buildFilterOptionsFromRows(rows = []) {
  const items = new Map();
  const customers = new Map();
  const packings = new Map();
  const locations = new Map();

  for (const row of rows || []) {
    const itemId = row.item_dcode != null ? String(row.item_dcode) : "";
    if (itemId) {
      items.set(itemId, {
        id: itemId,
        item_code: row.item_code ?? itemId,
        item_desc: row.item_desc ?? null,
      });
    }

    const custId = row.customer_code != null ? String(row.customer_code) : "";
    if (custId) {
      customers.set(custId, {
        id: custId,
        acc_name: row.customer_name ?? custId,
      });
    }

    const pn = row.packing_number != null ? String(row.packing_number) : "";
    if (pn) packings.set(pn, { id: pn, packing_number: pn });

    const locIds = normalizeLocationIds(row.in_store_location_ids);
    const locLabels = rowLocationLabels(row);

    locIds.forEach((lid, idx) => {
      const label = (locLabels[idx] || String(lid)).trim();
      if (!label || label === "—") return;
      const key = label;
      const id = String(lid);
      const existing = locations.get(key);
      if (existing) {
        if (!existing.location_ids.includes(id)) existing.location_ids.push(id);
        return;
      }
      locations.set(key, { id: key, location_no: label, location_ids: [id] });
    });
  }

  const byLabel = (a, b, key) =>
    String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { sensitivity: "base" });

  return {
    items: [...items.values()].sort((a, b) => byLabel(a, b, "item_code")),
    customers: [...customers.values()].sort((a, b) => byLabel(a, b, "acc_name")),
    packings: [...packings.values()].sort((a, b) => byLabel(a, b, "packing_number")),
    locations: [...locations.values()].sort((a, b) => byLabel(a, b, "location_no")),
  };
}

export function applyInventoryView(rows, { filters, sortKey, sortDir }) {
  const filtered = filterInventoryRows(rows, filters);
  const sorted = sortRowsByKey(filtered, sortKey, sortDir);
  return {
    rows: sorted,
    totals: computeInventoryTotals(sorted),
    total: sorted.length,
  };
}

/** Cascading filter dropdowns: apply all filters except the field being edited. */
export function buildCascadingFilterOptions(allRows = [], filters = {}) {
  const scoped = (excludeKey) => {
    const next = { ...filters };
    if (excludeKey) next[excludeKey] = [];
    return filterInventoryRows(allRows, next);
  };

  return {
    items: buildFilterOptionsFromRows(scoped("item_dcodes")).items,
    customers: buildFilterOptionsFromRows(scoped("customer_codes")).customers,
    locations: buildFilterOptionsFromRows(scoped("location_ids")).locations,
    packings: buildFilterOptionsFromRows(scoped("packing_numbers")).packings,
  };
}

