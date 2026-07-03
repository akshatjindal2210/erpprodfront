import { createModuleExporter } from "@/core/utils/tableExport";
import { formatDocDate } from "@/core/utils/utilHelper";

export const ERP_STOCK_REPORT_TABLE_COLUMNS = [
  { label: "Packing Entry", key: "packing_number", type: "text" },
  { label: "Doc Date", key: "doc_dt", type: "date" },
  { label: "Job Card", key: "job_card_no", type: "text" },
  { label: "Item Code", key: "item_code", type: "text" },
  { label: "Item Details", key: "item_desc", type: "text" },
  { label: "DB Stock", key: "db_stock", type: "number", tone: "db" },
  { label: "ERP Stock", key: "erp_stock", type: "number", tone: "erp" },
  { label: "Balance Stock (DB - ERP)", key: "stock_diff", type: "diff" },
];

export function formatErpStockTableCell(type, value) {
  if (type === "date") return formatDocDate(value) || "—";
  if (type === "diff") return formatStockDiff(value);
  if (type === "number") {
    const n = Number(value);
    return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  const s = value != null && value !== "" ? String(value).trim() : "";
  return s || "—";
}

export function formatStockDiff(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n > 0 ? `+${abs}` : `−${abs}`;
}

export function stockDiffCellClass(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "text-slate-500";
  if (n > 0) return "text-red-700 font-black";
  return "text-amber-700 font-black";
}

export const exportErpStockReport = createModuleExporter({
  moduleName: "ERP Stock Report",
  columns: ERP_STOCK_REPORT_TABLE_COLUMNS.map(({ label, key, type }) => ({
    label,
    key,
    format: (v) => formatErpStockTableCell(type, v),
  })),
  includeMeta: false,
});

export function erpStockRowClassName(row) {
  if (row?.mismatch === "red") return "bg-red-50/90";
  if (row?.mismatch === "yellow") return "bg-amber-50/80";
  return "";
}
