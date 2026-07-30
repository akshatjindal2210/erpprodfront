import { getCellPlainText, getCellXlsxValue } from "@/platform/utils/list/dataTableCellSelection";
import { exportTableData } from "@/platform/utils/list/tableExport";

const SKIP_HEADER_KEYS = new Set(["_row"]);

/** DataTable headers → export columns (uses copyValue / plain text like Ctrl+C). */
export function buildExportColumnsFromHeaders(headers = []) {
  return (headers || [])
    .filter((header) => {
      const key = header?.[1];
      const label = String(header?.[0] ?? "").trim();
      if (!key || SKIP_HEADER_KEYS.has(key)) return false;
      if (label === "#") return false;
      if (header?.[3]?.export === false) return false;
      return true;
    })
    .map((header) => ({
      label: String(header[0] ?? ""),
      getValue: (row, rowIndex) => getCellPlainText(row, header, rowIndex),
      getXlsxValue: (row, rowIndex) => getCellXlsxValue(row, header, rowIndex),
    }));
}

/** Export current filtered table rows (WYSIWYG — same as visible table data). */
export async function exportListPageTable({
  moduleName,
  headers,
  rows = [],
  format,
  xlsxPreambleRows,
  getXlsxRowStyles,
}) {
  const columns = buildExportColumnsFromHeaders(headers);
  if (!columns.length) {
    throw new Error("No exportable columns.");
  }
  return exportTableData({
    format,
    rows,
    columns,
    moduleName,
    includeMeta: false,
    xlsxPreambleRows,
    getXlsxRowStyles,
  });
}

export function notifyListPageExportResult(format, filename) {
  if (format === "pdf") {
    return { type: "pdf", message: `Print dialog opened — save as "${filename}".` };
  }
  return { type: "download", message: `Downloaded ${filename}` };
}
