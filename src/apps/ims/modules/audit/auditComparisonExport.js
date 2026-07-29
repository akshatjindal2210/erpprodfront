import { buildExportFilename, TABLE_EXPORT_FORMATS } from "@/platform/utils/list/tableExport";
import { computeLocationScoreFromCounts, formatLocationScorePct, getLocationStatusLabel, resolveBoxAccName } from "./auditScanHelpers";
import { getAuditExecutionStatusLabel } from "./auditStatusHelpers";

function typeLabel(type) {
  if (type === "extra_scan") return "Extra";
  if (type === "matched_scan") return "Matched";
  return "Missing";
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function buildBoxColumns(showLocation) {
  const cols = [];
  if (showLocation) {
    cols.push({
      label: "Audit location",
      getValue: (r) => r.audit_location_no || r.location_no || "",
    });
  }
  cols.push(
    { label: "Type", getValue: (r) => typeLabel(r.difference_type) },
    {
      label: "Expected",
      getValue: (r) => yesNo(r.expected ?? r.difference_type !== "extra_scan"),
    },
    {
      label: "Scanned",
      getValue: (r) => yesNo(r.scanned ?? r.difference_type !== "not_scanned"),
    },
    { label: "Packing no.", getValue: (r) => r.packing_number ?? "" },
    { label: "Box UID", getValue: (r) => r.box_no_uid ?? "" },
    { label: "Acc name", getValue: (r) => r.acc_name || resolveBoxAccName(r) || "" },
    { label: "Item code", getValue: (r) => r.item_code ?? "" },
    { label: "Qty", getValue: (r) => r.qty ?? "" },
    { label: "Box location", getValue: (r) => r.location_no ?? "" },
  );
  return cols;
}

const LOCATION_COLUMNS = [
  { label: "Location", getValue: (l) => l.location_no ?? "" },
  { label: "Expected", getValue: (l) => l.system_count ?? 0 },
  { label: "Scanned", getValue: (l) => l.scanned_count ?? 0 },
  { label: "Matched", getValue: (l) => l.matched_scanned_count ?? 0 },
  {
    label: "Missing",
    getValue: (l) => l.not_scanned_count ?? l.missing_boxes?.length ?? 0,
  },
  {
    label: "Extra",
    getValue: (l) => l.extra_scan_count ?? l.extra_boxes?.length ?? 0,
  },
  {
    label: "Score",
    getValue: (l) =>
      formatLocationScorePct(
        computeLocationScoreFromCounts(
          l.system_count,
          l.matched_scanned_count ?? 0,
          l.extra_scan_count ?? l.extra_boxes?.length ?? 0,
        ),
      ),
  },
  {
    label: "Result",
    getValue: (l) => (l.matched ? "Complete" : "Difference"),
  },
  {
    label: "Status",
    getValue: (l) => getLocationStatusLabel(l.location_status),
  },
];

function cellText(row, column) {
  const raw = column.getValue ? column.getValue(row) : row?.[column.key];
  if (raw == null || raw === "") return "";
  return String(raw);
}

function matrixFrom(rows, columns) {
  return {
    header: columns.map((c) => c.label),
    body: (rows || []).map((row) => columns.map((col) => cellText(row, col))),
  };
}

function escapeCsvCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildSummaryLines(ctx) {
  const {
    report,
    auditLabel,
    singleLocation,
    locationRow,
    stats,
    displayScore,
    allMatched,
  } = ctx;
  const lines = [
    auditLabel || (report?.audit_id ? `Audit #${report.audit_id}` : "Audit comparison"),
    `Exported: ${new Date().toLocaleString()}`,
    `Status: ${getAuditExecutionStatusLabel(report?.status)}`,
    `Expected: ${stats.expected} · Scanned: ${stats.scanned} · Matched: ${stats.matched} · Missing: ${stats.notScanned} · Extra: ${stats.extra}`,
    `Score: ${formatLocationScorePct(displayScore)} · ${allMatched ? "All boxes match" : "Differences found"}`,
  ];
  if (singleLocation && locationRow?.location_no) {
    lines.push(`Location: ${locationRow.location_no} · ${getLocationStatusLabel(locationRow.location_status)}`);
  }
  return lines;
}

function buildModuleName(ctx) {
  const id = ctx.report?.audit_id ?? ctx.locationRow?.audit_id;
  if (ctx.singleLocation && ctx.locationRow?.location_no) {
    return `Audit ${id || ""} ${ctx.locationRow.location_no} Comparison`.trim();
  }
  return `Audit ${id || ""} Comparison Report`.trim();
}

function sectionToCsv(sectionTitle, rows, columns) {
  if (!rows?.length) return [];
  const { header, body } = matrixFrom(rows, columns);
  return [
    sectionTitle,
    header.map(escapeCsvCell).join(","),
    ...body.map((line) => line.map(escapeCsvCell).join(",")),
    "",
  ];
}

function exportComparisonCsv(ctx, filename) {
  const { locations, notScannedRows, extraRows, matchedRows, showLocationCol } = ctx;
  const boxCols = buildBoxColumns(showLocationCol);
  const lines = [
    ...buildSummaryLines(ctx).map((l) => escapeCsvCell(l)),
    "",
  ];

  if (!ctx.singleLocation && locations.length > 1) {
    lines.push(...sectionToCsv("LOCATION SUMMARY", locations, LOCATION_COLUMNS));
  }

  lines.push(...sectionToCsv("MISSING BOXES", notScannedRows, boxCols));
  lines.push(...sectionToCsv("EXTRA BOXES", extraRows, boxCols));
  lines.push(...sectionToCsv("MATCHED BOXES", matchedRows, boxCols));

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: TABLE_EXPORT_FORMATS.csv.mime });
  downloadBlob(blob, filename);
}

async function exportComparisonXlsx(ctx, filename) {
  const XLSX = await import("xlsx");
  const { locations, notScannedRows, extraRows, matchedRows, showLocationCol } = ctx;
  const boxCols = buildBoxColumns(showLocationCol);
  const wb = XLSX.utils.book_new();

  const summaryAoa = buildSummaryLines(ctx).map((line) => [line]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryAoa), "Summary");

  if (!ctx.singleLocation && locations.length > 1) {
    const loc = matrixFrom(locations, LOCATION_COLUMNS);
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([loc.header, ...loc.body]),
      "Locations",
    );
  }

  const addBoxSheet = (name, rows) => {
    const m = matrixFrom(rows, boxCols);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([m.header, ...m.body]), name.slice(0, 31));
  };

  addBoxSheet("Missing", notScannedRows);
  addBoxSheet("Extra", extraRows);
  addBoxSheet("Matched", matchedRows);

  XLSX.writeFile(wb, filename);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tableHtml(title, rows, columns) {
  if (!rows?.length) {
    return `<h2>${escapeHtml(title)} (0)</h2><p class="empty">None</p>`;
  }
  const { header, body } = matrixFrom(rows, columns);
  const thead = `<tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  const tbody = body
    .map((line) => `<tr>${line.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<h2>${escapeHtml(title)} (${rows.length})</h2><table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function exportComparisonPdf(ctx, filename, title) {
  const { locations, notScannedRows, extraRows, matchedRows, showLocationCol } = ctx;
  const boxCols = buildBoxColumns(showLocationCol);
  const metaHtml = buildSummaryLines(ctx).map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("");
  const locHtml =
    !ctx.singleLocation && locations.length > 1
      ? tableHtml("Location summary", locations, LOCATION_COLUMNS)
      : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  @page { size: landscape; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #0f172a; margin: 0; padding: 12px; }
  h1 { font-size: 15px; margin: 0 0 6px; }
  h2 { font-size: 12px; margin: 14px 0 6px; }
  .meta { margin: 0 0 3px; color: #475569; }
  .empty { color: #94a3b8; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #eef2ff; font-size: 9px; text-transform: uppercase; }
</style></head><body>
  <h1>${escapeHtml(title)}</h1>
  ${metaHtml}
  ${locHtml}
  ${tableHtml("Missing boxes", notScannedRows, boxCols)}
  ${tableHtml("Extra boxes", extraRows, boxCols)}
  ${tableHtml("Matched boxes", matchedRows, boxCols)}
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
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
  doc.open();
  doc.write(html);
  doc.close();
  doc.title = title;

  window.setTimeout(() => {
    try {
      document.title = title;
      frameWin.focus();
      frameWin.print();
    } finally {
      window.setTimeout(() => iframe.remove(), 500);
      window.setTimeout(() => {
        document.title = previousTitle;
      }, 2500);
    }
  }, 300);

  void filename;
}

/** Export comparison drawer — summary, locations, missing, extra, matched (same as on screen). */
export async function exportAuditComparisonReport(format, ctx) {
  const fmt = TABLE_EXPORT_FORMATS[format];
  if (!fmt) throw new Error(`Unsupported export format: ${format}`);

  const moduleName = buildModuleName(ctx);
  const filename = buildExportFilename(moduleName, fmt.extension);
  const title = moduleName;

  if (format === "csv") {
    exportComparisonCsv(ctx, filename);
    return { filename, format };
  }

  if (format === "xlsx") {
    await exportComparisonXlsx(ctx, filename);
    return { filename, format };
  }

  if (format === "pdf") {
    exportComparisonPdf(ctx, filename, title);
    return { filename, format };
  }

  throw new Error(`Export handler missing for: ${format}`);
}
