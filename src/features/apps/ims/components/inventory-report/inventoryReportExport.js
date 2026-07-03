import { createModuleExporter } from "@/core/utils/tableExport";
import { formatDocDate } from "@/core/utils/utilHelper";
export const INVENTORY_REPORT_TABLE_COLUMNS = [
  { label: "Packing Entry", key: "packing_number", type: "text" },
  { label: "Doc Date", key: "doc_dt", type: "date" },
  { label: "Job Card", key: "job_card_no", type: "text" },
  { label: "Item Code", key: "item_code", type: "text" },
  { label: "Item Details", key: "item_desc", type: "text" },
  { label: "Customer", key: "customer_name", type: "text" },
  { label: "Location Details", key: "location_details", type: "text" },
  { label: "Total Stock", key: "fg_stock_qty", type: "number" },
  { label: "In Store", key: "in_store_qty", type: "number" },
  { label: "Packing Area", key: "packing_area_qty", type: "number" },
  { label: "QC Hold Area", key: "qc_hold_qty", type: "number" },
];

export function formatInventoryTableCell(type, value) {
  if (type === "date") return formatDocDate(value) || "—";
  if (type === "number") {
    const n = Number(value);
    return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return value != null && value !== "" ? String(value) : "—";
}

export function buildInventoryExportColumns() {
  return INVENTORY_REPORT_TABLE_COLUMNS.map(({ label, key, type }) => ({
    label,
    key,
    format: (v) => formatInventoryTableCell(type, v),
  }));
}

/** Exports exactly the table: same columns, cell text, and filtered rows. */
export const exportInventoryReport = createModuleExporter({
  moduleName: "Inventory Report",
  columns: buildInventoryExportColumns(),
  includeMeta: false,
});