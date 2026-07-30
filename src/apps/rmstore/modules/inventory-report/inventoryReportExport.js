import { createModuleExporter } from "@/platform/utils/list/tableExport";
import { formatDocDate } from "@/platform/utils/core/utilHelper";

/** RM Inventory qty columns — match backend coil zones. */
export const INVENTORY_REPORT_TABLE_COLUMNS = [
  { label: "MRN", key: "mrn_no", type: "text" },
  { label: "Doc Date", key: "doc_dt", type: "date" },
  { label: "Heat No.", key: "heat_no", type: "text" },
  { label: "Item Code", key: "item_code", type: "text" },
  { label: "Item Details", key: "item_desc", type: "text" },
  { label: "Supplier", key: "customer_name", type: "text" },
  { label: "Location Details (Coils Count)", key: "location_details", type: "text" },
  { label: "Total Stock", key: "total_stock_qty", type: "number" },
  { label: "In Store", key: "in_store_qty", type: "number" },
  { label: "Unassigned Area", key: "unassigned_qty", type: "number" },
  { label: "Pending QC", key: "pending_qc_qty", type: "number" },
  { label: "Pending Rejection", key: "pending_reject_qty", type: "number" },
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
    type,
    format: (v) => formatInventoryTableCell(type, v),
  }));
}

export const exportInventoryReport = createModuleExporter({
  moduleName: "RM Inventory Report",
  columns: buildInventoryExportColumns(),
  includeMeta: false,
});
