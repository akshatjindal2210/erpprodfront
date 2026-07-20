import { buildExportFilename } from "@/core/utils/tableExport";
import { toYmdClient } from "@/features/apps/task/services/reportApi";
import { formatScheduledDate } from "@/features/apps/task/helpers/utilHelper";
import { scoreToPercent } from "@/features/apps/task/helpers/clTaskScoreHelper";

/** Excel ARGB fills + font — matches report calendar legend. */
const SCORE_STYLES = {
  red_flag: {
    fill: { patternType: "solid", fgColor: { rgb: "FFF43F5E" } },
    font: { color: { rgb: "FFFFFFFF" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
  negative: {
    fill: { patternType: "solid", fgColor: { rgb: "FFFECDD3" } },
    font: { color: { rgb: "FF9F1239" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
  done: {
    fill: { patternType: "solid", fgColor: { rgb: "FF475569" } },
    font: { color: { rgb: "FFFFFFFF" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
  approval: {
    fill: { patternType: "solid", fgColor: { rgb: "FF6366F1" } },
    font: { color: { rgb: "FFFFFFFF" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
  pending: {
    fill: { patternType: "solid", fgColor: { rgb: "FFFDE68A" } },
    font: { color: { rgb: "FF1E293B" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
  positive: {
    fill: { patternType: "solid", fgColor: { rgb: "FFD1FAE5" } },
    font: { color: { rgb: "FF065F46" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
  zero: {
    fill: { patternType: "solid", fgColor: { rgb: "FFF1F5F9" } },
    font: { color: { rgb: "FF475569" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
};

const HEADER_STYLE = {
  fill: { patternType: "solid", fgColor: { rgb: "FF1E293B" } },
  font: { color: { rgb: "FFFFFFFF" }, bold: true },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
};

function resolveExportScorePct(task) {
  if (task.score_pct != null && task.score_pct !== "") return Number(task.score_pct);
  if (task.effective_score_raw != null && task.effective_score_raw !== "") {
    return scoreToPercent(task.effective_score_raw);
  }
  if (task.effective_score != null && task.effective_score !== "") {
    return Number(task.effective_score);
  }
  return scoreToPercent(task.score);
}

function formatSignedScore(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return `${num}%`;
}

export function reportScoreStyleKey(task = {}) {
  const n = resolveExportScorePct(task);

  if (task.is_red_flag) return "red_flag";
  if (n < 0) return "negative";
  if (task.done_verified) return "done";
  if (task.status === "awaiting_verification") return "approval";
  if (task.not_done) return "pending";
  if (n > 0) return "positive";
  return "zero";
}

function statusLabel(task) {
  if (task.done_verified) return "Done";
  if (task.not_done) return "Not done";
  if (task.status === "awaiting_verification") return "Approval";
  if (task.is_red_flag) return "Red flag";
  return String(task.status || "—").replace(/_/g, " ");
}

function taskSectionLabel(task) {
  const type = String(task.task_type || "").toLowerCase();
  const recur = String(task.recurrence_type || "").toLowerCase();
  if (type === "open") return "Open";
  if (type === "frequently") {
    if (recur === "weekly") return "Weekly";
    if (recur === "monthly") return "Monthly";
    if (recur === "yearly") return "Yearly";
    return "Daily";
  }
  return type || "—";
}

/** Flat rows from nested users (keeps task ref for colors). */
export function buildClReportExportRows(users = []) {
  const rows = [];
  for (const user of users) {
    for (const task of user.tasks || []) {
      rows.push({
        sno: user.sno,
        scheduled_date: formatScheduledDate(toYmdClient(task.startDate || task.scheduled_date)),
        person_name: user.person_name || "",
        department_name: user.department_name || "",
        designation_name: user.designation_name || "",
        section: taskSectionLabel(task),
        title: task.title || "",
        status: statusLabel(task),
        score_display: formatSignedScore(resolveExportScorePct(task)),
        weightage: task.weightage ?? task.wastage ?? "",
        _task: task,
      });
    }
  }
  return rows;
}

const EXPORT_COLUMNS = [
  ["S.No.", "sno"],
  ["Date", "scheduled_date"],
  ["Person", "person_name"],
  ["Department", "department_name"],
  ["Designation", "designation_name"],
  ["Section", "section"],
  ["Task", "title"],
  ["Status", "status"],
  ["Score", "score_display"],
  ["Weightage", "weightage"],
];

/**
 * Colored Excel export for CL Task Report (score column matches UI legend).
 */
export async function exportClTaskReportExcel({
  users = [],
  moduleName = "CL Task Report",
  rangeFrom,
  rangeTo,
}) {
  const XLSX = await import("xlsx-js-style");
  const rows = buildClReportExportRows(users);
  if (!rows.length) throw new Error("No rows to export.");

  const headers = EXPORT_COLUMNS.map(([label]) => label);
  const keys = EXPORT_COLUMNS.map(([, key]) => key);
  const scoreColIdx = keys.indexOf("score_display");

  const aoa = [];
  if (rangeFrom && rangeTo) {
    aoa.push([`${moduleName} · ${formatScheduledDate(rangeFrom)} → ${formatScheduledDate(rangeTo)}`]);
    aoa.push([`Exported: ${new Date().toLocaleString()}`]);
    aoa.push([]);
  }
  aoa.push(headers);

  const dataStartRow = aoa.length;
  for (const row of rows) {
    aoa.push(keys.map((key) => row[key] ?? ""));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

  const headerRow = dataStartRow;
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c });
    if (ws[addr]) ws[addr].s = HEADER_STYLE;
  }

  for (let r = headerRow + 1; r <= range.e.r; r += 1) {
    const dataIdx = r - headerRow - 1;
    const task = rows[dataIdx]?._task;
    if (!task || scoreColIdx < 0) continue;
    const addr = XLSX.utils.encode_cell({ r, c: scoreColIdx });
    if (!ws[addr]) continue;
    const styleKey = reportScoreStyleKey(task);
    ws[addr].s = SCORE_STYLES[styleKey] || SCORE_STYLES.zero;
  }

  ws["!cols"] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 28 },
    { wch: 14 },
    { wch: 8 },
    { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "CL Task Report".slice(0, 31));

  const filename = buildExportFilename(moduleName, "xlsx");
  XLSX.writeFile(wb, filename);
  return { filename };
}
