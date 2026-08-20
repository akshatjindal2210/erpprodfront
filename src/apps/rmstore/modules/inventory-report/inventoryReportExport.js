import { createModuleExporter } from "@/platform/utils/list/tableExport";
import {
  INVENTORY_REPORT_TABLE_COLUMNS,
  formatInventoryTableCell,
} from "@/apps/rmstore/modules/inventory-report/inventoryReport.config";

export { INVENTORY_REPORT_TABLE_COLUMNS, formatInventoryTableCell };

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
