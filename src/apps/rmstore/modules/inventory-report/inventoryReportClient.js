import { sortSelectRowsAsc } from "@/platform/utils/form/sortSelectOptions";
import { EMPTY_INVENTORY_TOTALS } from "@/apps/rmstore/modules/inventory-report/inventoryReport.config";

export { EMPTY_INVENTORY_TOTALS };

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

function rowMatchesMrnFilter(row, selectedIds) {
  const ids = normalizeMultiFilterIds(selectedIds);
  if (!ids.length) return true;
  const pn = String(row?.mrn_no ?? "").trim();
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
      rowMatchesMrnFilter(row, packingIds)
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

function parseLocationDetailSegment(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "—") return null;
  return s.replace(/\s*\([\d,]+\)\s*$/, "").trim() || null;
}

function buildLocationOptions(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const ids = Array.isArray(row?.in_store_location_ids) ? row.in_store_location_ids : [];
    const segments = String(row?.location_details ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const rackSegments = segments
      .map(parseLocationDetailSegment)
      .filter((label) => label && label !== "—");
    ids.forEach((id, index) => {
      const key = String(id);
      if (!key || map.has(key)) return;
      map.set(key, {
        id: key,
        location_no: rackSegments[index] || rackSegments[0] || key,
      });
    });
  }
  return sortSelectRowsAsc([...map.values()], "location_no");
}

function buildMrnOptions(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const id = String(row?.mrn_no ?? "").trim();
    if (!id || id === "—") continue;
    if (!map.has(id)) {
      map.set(id, { id, packing_number: id });
    }
  }
  return sortSelectRowsAsc([...map.values()], "packing_number");
}

export function buildInventoryFilterOptionsFromRows(allRows = [], filters = {}) {
  const allItemOpts = buildItemOptions(allRows);
  if (!hasActiveInventoryFilters(filters)) {
    return {
      items: allItemOpts,
      customers: buildCustomerOptions(allRows),
      locations: buildLocationOptions(allRows),
      packings: buildMrnOptions(allRows),
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
    packings: buildMrnOptions(
      filterInventoryRows(allRows, filtersWithoutField(filters, "packings"), allItemOpts)
    ),
  };
}

export function hasActiveInventoryFilters(filters = {}) {
  return (
    (filters.item_dcodes?.length ?? 0) > 0 ||
    (filters.customer_codes?.length ?? 0) > 0 ||
    (filters.location_ids?.length ?? 0) > 0 ||
    (filters.packing_numbers?.length ?? 0) > 0
  );
}

/** Native title tooltip — lists coil_no_uid values behind a qty/count cell. */
export function formatCoilUidTooltip(label, uidsRaw, { maxShow = 50 } = {}) {
  const uids = String(uidsRaw || "")
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!uids.length) return undefined;
  const shown = uids.slice(0, maxShow);
  const rest = uids.length - shown.length;
  return (
    `${label} (${uids.length} coil${uids.length === 1 ? "" : "s"}):\n` +
    shown.join("\n") +
    (rest > 0 ? `\n… and ${rest} more` : "")
  );
}

/** @deprecated use INVENTORY_QTY_META from inventoryReport.config.js */
export { INVENTORY_COIL_UID_FIELD } from "@/apps/rmstore/modules/inventory-report/inventoryReport.config";
