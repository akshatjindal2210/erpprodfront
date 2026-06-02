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

export function filterInventoryRows(rows = [], filters = {}) {
  const item = filters.item_dcodes?.[0];
  const customer = filters.customer_codes?.[0];
  const packing = filters.packing_numbers?.[0];
  const location = filters.location_ids?.[0];

  return (rows || []).filter((row) => {
    if (item != null && item !== "" && String(row.item_dcode) !== String(item)) return false;
    if (customer != null && customer !== "" && String(row.customer_code) !== String(customer)) {
      return false;
    }
    if (packing != null && packing !== "" && String(row.packing_number) !== String(packing)) {
      return false;
    }
    if (location != null && location !== "") {
      const ids = normalizeLocationIds(row.in_store_location_ids);
      return ids.length > 0 && ids.some((id) => String(id) === String(location));
    }
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
    const locLabels = String(row.location_details || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    locIds.forEach((lid, idx) => {
      const id = String(lid);
      if (!id || locations.has(id)) return;
      locations.set(id, { id, location_no: locLabels[idx] || id });
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

