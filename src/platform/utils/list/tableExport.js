import writeXlsxFile from "write-excel-file/browser";
import { formatDocDate } from "@/platform/utils/core/utilHelper";

/** @typedef {{ key?: string, label: string, getValue?: (row: object) => unknown, format?: (value: unknown, row?: object) => string }} ExportColumn */

/** @typedef {'csv' | 'xlsx' | 'pdf'} TableExportFormat */

export const TABLE_EXPORT_FORMATS = {
  csv: { id: "csv", label: "CSV", extension: "csv", mime: "text/csv;charset=utf-8" },
  xlsx: { id: "xlsx", label: "Excel", extension: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pdf: { id: "pdf", label: "PDF", extension: "pdf", mime: "application/pdf" },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeCsvCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const XLSX_DATE_FORMAT = "dd/mm/yyyy";
const XLSX_NUMBER_FORMAT = "#,##0";

function asXlsxNumber(value) {
  const n = Number(value);
  return { value: Number.isFinite(n) ? n : 0, format: XLSX_NUMBER_FORMAT };
}

function finishXlsxCell(value) {
  if (value instanceof Date) {
    return formatDocDate(value) || "";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return asXlsxNumber(value);
  }
  return value;
}

function cellText(row, column, rowIndex) {
  const raw = column.getValue ? column.getValue(row, rowIndex) : row?.[column.key];
  if (column.format) return column.format(raw, row);
  if (raw == null || raw === "") return "";
  return String(raw);
}

function cellXlsxValue(row, column, rowIndex) {
  if (typeof column.getXlsxValue === "function") {
    return finishXlsxCell(column.getXlsxValue(row, rowIndex));
  }

  const raw = column.key != null ? row?.[column.key] : undefined;

  if (column.type === "number") {
    const n = Number(raw);
    return asXlsxNumber(Number.isFinite(n) ? n : 0);
  }
  if (column.type === "date") {
    if (!raw) return "";
    if (column.format) return column.format(raw, row);
    return formatDocDate(raw) || "";
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return asXlsxNumber(raw);
  if (typeof raw === "boolean") return raw;
  if (raw == null || raw === "") return "";

  if (column.format) return column.format(raw, row);
  if (column.getValue) return finishXlsxCell(column.getValue(row, rowIndex));
  return finishXlsxCell(raw);
}

function buildMatrix(rows = [], columns = [], { forXlsx = false } = {}) {
  const header = columns.map((c) => c.label);
  const readCell = forXlsx ? cellXlsxValue : cellText;
  const body = (rows || []).map((row, rowIndex) => columns.map((col) => readCell(row, col, rowIndex)));
  return { header, body };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 100);
}

function normalizeXlsxCellValue(value) {
  if (value != null && typeof value === "object" && "value" in value) return value;
  if (typeof value === "number" && Number.isFinite(value)) return asXlsxNumber(value);
  return value ?? "";
}

function toWriteCell(value, style) {
  const base = normalizeXlsxCellValue(value);
  if (!style) return base;
  if (typeof base === "object" && base !== null && "value" in base) {
    return { ...base, ...style };
  }
  return { value: base ?? "", ...style };
}

function applyRowStyles(rows, rowStyles) {
  if (!rowStyles?.length) return rows;
  return rows.map((row, rowIndex) => {
    const styles = rowStyles[rowIndex];
    if (!styles) return row;
    return row.map((cell, colIndex) => (styles[colIndex] ? toWriteCell(cell, styles[colIndex]) : cell));
  });
}

/** Download a single- or multi-sheet .xlsx file in the browser. */
export async function downloadXlsxFile({ sheets, filename }) {
  const payload = (sheets || []).map((sheet) => ({
    sheet: String(sheet.name || "Sheet").slice(0, 31),
    dateFormat: XLSX_DATE_FORMAT,
    data: applyRowStyles(sheet.rows || [], sheet.rowStyles),
  }));

  if (!payload.length) throw new Error("No sheet data to export.");

  const blob = payload.length === 1
    ? await writeXlsxFile(payload[0].data, {
      sheet: payload[0].sheet,
      dateFormat: XLSX_DATE_FORMAT,
    }).toBlob()
    : await writeXlsxFile(payload, { dateFormat: XLSX_DATE_FORMAT }).toBlob();

  downloadBlob(blob, filename);
}

function normalizeExportFormat(format) {
  if (format === "excel") return "xlsx";
  return format;
}

/** Filename-safe timestamp: 2026-06-11_14-30-45 */
export function formatExportTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d}_${h}-${min}-${s}`;
}

/** Filename: "Inventory Report 2026-06-11_14-30-45.xlsx" */
export function buildExportFilename(moduleName, extension, date = new Date()) {
  const name = String(moduleName || "Export").trim() || "Export";
  return `${name} ${formatExportTimestamp(date)}.${extension}`;
}

/** Standard PDF / sheet header lines (title is shown separately). */
export function buildReportMetaLines({ hasFilters = false, filtersText = "All records (no filters)", rowCount = 0 } = {}) {
  return [
    `Exported: ${new Date().toLocaleString()}`,
    `Scope: ${hasFilters ? "Filtered" : "All"}`,
    `Filters: ${filtersText}`,
    `Rows: ${Number(rowCount || 0).toLocaleString()}`,
  ];
}

function buildMetaAoa(title, metaLines = []) {
  const aoa = [];
  if (title) aoa.push([title]);
  for (const line of metaLines || []) aoa.push([line]);
  if (aoa.length) aoa.push([]);
  return aoa;
}

function exportCsv({ rows, columns, filename, title, metaLines, includeMeta }) {
  const { header, body } = buildMatrix(rows, columns);
  const prefix = includeMeta ? buildMetaAoa(title, metaLines).map((line) => line.map(escapeCsvCell).join(",")) : [];
  const dataLines = [header, ...body].map((line) => line.map(escapeCsvCell).join(","));
  const blob = new Blob(["\uFEFF" + [...prefix, ...dataLines].join("\n")], { type: TABLE_EXPORT_FORMATS.csv.mime });
  downloadBlob(blob, filename);
}

async function exportXlsx({
  rows,
  columns,
  filename,
  sheetName = "Report",
  footerRows = [],
  title,
  metaLines = [],
  includeMeta,
  xlsxPreambleRows,
  getXlsxRowStyles,
}) {
  const { header, body } = buildMatrix(rows, columns, { forXlsx: true });
  let aoa = includeMeta ? [...buildMetaAoa(title, metaLines), header, ...body] : [header, ...body];

  if (xlsxPreambleRows?.length) {
    aoa = [...xlsxPreambleRows, [], ...aoa];
  }

  if (footerRows?.length) {
    aoa.push([], ...footerRows);
  }

  let rowStyles = typeof getXlsxRowStyles === "function"
    ? getXlsxRowStyles({ rows, columns, header, body })
    : null;

  if (rowStyles?.length && xlsxPreambleRows?.length) {
    const prefix = xlsxPreambleRows.map(() => null);
    rowStyles = [...prefix, null, ...rowStyles];
  }

  await downloadXlsxFile({
    sheets: [{ name: sheetName, rows: aoa, rowStyles }],
    filename,
  });
}

function exportPdfViaPrint({ rows, columns, title, metaLines = [], footerRows = [], documentTitle, includeMeta }) {
  const { header, body } = buildMatrix(rows, columns);
  const metaHtml = includeMeta ? metaLines.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("") : "";
  const titleHtml = includeMeta ? `<h1>${escapeHtml(title || "Report")}</h1>` : "";
  const thead = `<tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  const tbody = body
    .map((line) => `<tr>${line.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  const tfoot = (footerRows || [])
    .map((line) => `<tr class="total">${line.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  const pageTitle = documentTitle || title || "Report";
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(pageTitle)}</title>
<style>
  @page { size: landscape; margin: 12mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 16px; }
  h1 { font-size: 16px; margin: 0 0 8px; }
  .meta { margin: 0 0 4px; color: #475569; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #eef2ff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  tr.total td { font-weight: 700; background: #f8fafc; }
</style></head><body>
  ${titleHtml}
  ${metaHtml}
  <table><thead>${thead}</thead><tbody>${tbody}</tbody>${tfoot ? `<tfoot>${tfoot}</tfoot>` : ""}</table>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.title = pageTitle;
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  const frameWin = iframe.contentWindow;
  const doc = iframe.contentDocument || frameWin?.document;
  if (!doc || !frameWin) {
    iframe.remove();
    throw new Error("Could not open print preview.");
  }

  const previousTitle = document.title;

  const restoreTitle = () => {
    document.title = previousTitle;
  };

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 500);
  };

  doc.open();
  doc.write(html);
  doc.close();
  doc.title = pageTitle;

  frameWin.addEventListener("afterprint", restoreTitle, { once: true });

  window.setTimeout(() => {
    try {
      document.title = pageTitle;
      frameWin.focus();
      frameWin.print();
    } finally {
      cleanup();
      window.setTimeout(restoreTitle, 2500);
    }
  }, 300);
}

/**
 * Low-level export. Prefer `createModuleExporter` for page-level exports.
 */
export async function exportTableData({
  format,
  rows = [],
  columns = [],
  moduleName = "Export",
  title,
  metaLines = [],
  footerRows = [],
  sheetName,
  includeMeta = false,
  xlsxPreambleRows,
  getXlsxRowStyles,
}) {
  const normalizedFormat = normalizeExportFormat(format);
  const fmt = TABLE_EXPORT_FORMATS[normalizedFormat];
  if (!fmt) throw new Error(`Unsupported export format: ${format}`);

  const reportTitle = title ?? moduleName;
  const exportedAt = new Date();
  const filename = buildExportFilename(moduleName, fmt.extension, exportedAt);
  const documentTitle = filename.replace(/\.[^.]+$/, "");

  if (normalizedFormat === "csv") {
    exportCsv({ rows, columns, filename, title: reportTitle, metaLines, includeMeta });
    return { filename, format: normalizedFormat };
  }

  if (normalizedFormat === "xlsx") {
    await exportXlsx({
      rows,
      columns,
      filename,
      sheetName: sheetName ?? moduleName,
      footerRows,
      title: reportTitle,
      metaLines,
      includeMeta,
      xlsxPreambleRows,
      getXlsxRowStyles,
    });
    return { filename, format: normalizedFormat };
  }

  if (normalizedFormat === "pdf") {
    exportPdfViaPrint({
      rows,
      columns,
      title: reportTitle,
      metaLines,
      footerRows,
      documentTitle,
      includeMeta,
    });
    return { filename, format: normalizedFormat };
  }

  throw new Error(`Export handler missing for: ${format}`);
}

/**
 * Factory for any list/report page.
 *
 * @example
 * const exportInventoryReport = createModuleExporter({
 *   moduleName: "Inventory Report",
 *   columns: MY_COLUMNS,
 *   getHasFilters: ({ filters }) => Boolean(filters?.item),
 *   getFiltersText: ({ filters }) => `Item: ${filters.item}`,
 *   getFooterRows: ({ totals }) => [["TOTAL", "", totals.qty]],
 * });
 * await exportInventoryReport({ format: "xlsx", rows, totals, filters });
 */
export function createModuleExporter({
  moduleName,
  columns,
  sheetName,
  getFooterRows,
  getFiltersText,
  getHasFilters,
  includeMeta = false,
}) {
  return async function runModuleExport({ format, rows = [], ...ctx }) {
    const hasFilters = getHasFilters ? Boolean(getHasFilters(ctx)) : false;
    const filtersText = getFiltersText ? String(getFiltersText(ctx) || "All records (no filters)") : "All records (no filters)";
    const metaLines = includeMeta
      ? buildReportMetaLines({
          hasFilters,
          filtersText,
          rowCount: rows.length,
        })
      : [];
    const footerRows = getFooterRows ? getFooterRows({ rows, ...ctx }) : [];

    return exportTableData({
      format,
      rows,
      columns,
      moduleName,
      title: moduleName,
      metaLines,
      footerRows,
      sheetName: sheetName ?? moduleName,
      includeMeta,
    });
  };
}

export function listTableExportFormats() {
  return Object.values(TABLE_EXPORT_FORMATS);
}
