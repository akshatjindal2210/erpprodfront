import { formatDocDate } from "@/platform/utils/core/utilHelper";

/**
 * RM Inventory Report — columns, totals, and labels (single config).
 *
 * Total Stock = In Store + Unassigned + Shop Floor (physical — includes QC pending / RM rejection)
 * Issuable    = In Store + Unassigned · QC passed · not RM rejection · not consumed · not shop floor
 * QC Pending  = informational subset (already counted in In Store or Unassigned)
 */

export const INVENTORY_REPORT_RULES = {
  totalStock: "In Store + Unassigned + Shop Floor",
  issuable: "In store or unassigned · QC passed · not RM rejection · not consumed · not shop floor",
  pageSubtitle: "Total Stock = In Store + Unassigned + Shop Floor · Issuable = in store + unassigned (ready to issue)",
};

export const INVENTORY_REPORT_TABLE_COLUMNS = [
  { label: "MRN UID", key: "mrn_uid", type: "text" },
  { label: "Doc Date", key: "doc_dt", type: "date" },
  { label: "Item Code", key: "item_code", type: "text" },
  { label: "Item Details", key: "item_desc", type: "text" },
  { label: "Supplier", key: "customer_name", type: "text" },
  { label: "Location Details (Coils Count)", key: "location_details", type: "text" },
  { label: "Total Stock", key: "total_stock_qty", type: "number" },
  { label: "Issuable", key: "issuable_qty", type: "number" },
  { label: "In Store", key: "in_store_qty", type: "number" },
  { label: "Unassigned", key: "unassigned_qty", type: "number" },
  { label: "Shop Floor", key: "shop_floor_qty", type: "number" },
  { label: "QC Pending", key: "pending_qc_qty", type: "number" },
  { label: "RM Rejection", key: "pending_reject_qty", type: "number" },
];

export const EMPTY_INVENTORY_TOTALS = {
  total_stock_qty: 0,
  issuable_qty: 0,
  in_store_qty: 0,
  unassigned_qty: 0,
  shop_floor_qty: 0,
  pending_qc_qty: 0,
  pending_reject_qty: 0,
};

/** Qty column → coil UID field from API + hover label. */
export const INVENTORY_QTY_META = {
  total_stock_qty: {
    uidField: "total_stock_coil_uids",
    tooltip: "Total stock coils (in store + unassigned + shop floor)",
  },
  issuable_qty: {
    uidField: "issuable_coil_uids",
    tooltip: "Issuable coils (in store or unassigned · QC passed · not rejected · not consumed)",
  },
  in_store_qty: { uidField: "in_store_coil_uids", tooltip: "In-store coils (on rack)" },
  unassigned_qty: { uidField: "unassigned_coil_uids", tooltip: "Unassigned coils (no location)" },
  shop_floor_qty: { uidField: "shop_floor_coil_uids", tooltip: "Shop floor coils (issued out)" },
  pending_qc_qty: { uidField: "pending_qc_coil_uids", tooltip: "QC pending coils" },
  pending_reject_qty: { uidField: "pending_reject_coil_uids", tooltip: "RM rejection coils" },
};

/** Footer card styling — keyed by INVENTORY_FOOTER_CARDS.tone */
export const INVENTORY_FOOTER_TONE = {
  emerald: {
    wrap: "border-emerald-300 bg-emerald-50",
    label: "text-emerald-800",
    value: "text-emerald-900",
    hint: "text-emerald-700/80",
  },
  slate: {
    wrap: "border-slate-200 bg-white",
    label: "text-slate-500",
    value: "text-slate-800",
    hint: "text-slate-400",
  },
  "emerald-muted": {
    wrap: "border-emerald-200 bg-white",
    label: "text-emerald-700",
    value: "text-emerald-800",
    hint: "text-slate-400",
  },
  amber: {
    wrap: "border-amber-200 bg-white",
    label: "text-amber-700",
    value: "text-amber-800",
    hint: "text-slate-400",
  },
  blue: {
    wrap: "border-blue-200 bg-white",
    label: "text-blue-700",
    value: "text-blue-800",
    hint: "text-slate-400",
  },
  "amber-strong": {
    wrap: "border-amber-300 bg-amber-50",
    label: "text-amber-800",
    value: "text-amber-900",
    hint: "text-amber-700/80",
  },
  red: {
    wrap: "border-red-300 bg-red-50",
    label: "text-red-800",
    value: "text-red-900",
    hint: "text-red-700/80",
  },
};

/** Footer summary cards (order matches table priority). */
export const INVENTORY_FOOTER_CARDS = [
  { key: "issuable_qty", label: "Issuable", hint: "In store + unassigned", tone: "emerald" },
  { key: "total_stock_qty", label: "Total Stock", hint: "In store + unassigned + shop floor", tone: "slate" },
  { key: "in_store_qty", label: "In Store", hint: "On rack", tone: "emerald-muted" },
  { key: "unassigned_qty", label: "Unassigned", hint: "No location", tone: "amber" },
  { key: "shop_floor_qty", label: "Shop Floor", hint: "Issued out", tone: "blue" },
  { key: "pending_qc_qty", label: "QC Pending", hint: "Awaiting QC", tone: "amber-strong" },
  { key: "pending_reject_qty", label: "RM Rejection", hint: "Awaiting store-out", tone: "red" },
];

export function formatInventoryTableCell(type, value) {
  if (type === "date") return formatDocDate(value) || "—";
  if (type === "number") {
    const n = Number(value);
    return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return value != null && value !== "" ? String(value) : "—";
}

export function computeInventoryTotals(rows = []) {
  const safeQty = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  return (rows || []).reduce(
    (acc, row) => {
      for (const key of Object.keys(EMPTY_INVENTORY_TOTALS)) {
        acc[key] += safeQty(row?.[key]);
      }
      return acc;
    },
    { ...EMPTY_INVENTORY_TOTALS }
  );
}

/** @deprecated use INVENTORY_QTY_META — kept for client filter module */
export const INVENTORY_COIL_UID_FIELD = Object.fromEntries(
  Object.entries(INVENTORY_QTY_META).map(([key, meta]) => [key, meta.uidField])
);
