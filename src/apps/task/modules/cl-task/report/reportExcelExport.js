import { toYmdClient } from "@/apps/task/lib/services/reportApi";
import { formatScheduledDate } from "@/apps/task/lib/helpers/utilHelper";
import { scoreToPercent } from "@/apps/task/lib/helpers/clTaskScoreHelper";

/** Excel ARGB fills + font — matches report calendar legend. */
const SCORE_STYLES = {
  red_flag: {
    fill: { patternType: "solid", fgColor: { rgb: "FFB91C1C" } },
    font: { color: { rgb: "FFFFFFFF" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
  negative: {
    fill: { patternType: "solid", fgColor: { rgb: "FFFED7AA" } },
    font: { color: { rgb: "FF9A3412" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
  done: {
    fill: { patternType: "solid", fgColor: { rgb: "FFD1FAE5" } },
    font: { color: { rgb: "FF065F46" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
  verification: {
    fill: { patternType: "solid", fgColor: { rgb: "FFDDD6FE" } },
    font: { color: { rgb: "FF5B21B6" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
  pending: {
    fill: { patternType: "solid", fgColor: { rgb: "FFE0F2FE" } },
    font: { color: { rgb: "FF0C4A6E" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
  missed: {
    fill: { patternType: "solid", fgColor: { rgb: "FFFECDD3" } },
    font: { color: { rgb: "FF9F1239" }, bold: true },
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

function styleFromArgb(fillRgb, fontRgb, { bold = true, align = "center" } = {}) {
  const bg = fillRgb?.replace(/^FF/i, "#") || undefined;
  const color = fontRgb?.replace(/^FF/i, "#") || undefined;
  return {
    ...(bg ? { backgroundColor: bg } : {}),
    ...(color ? { color } : {}),
    ...(bold ? { fontWeight: "bold" } : {}),
    ...(align ? { align } : {}),
  };
}

function applyCellStyle(cellStyle = {}) {
  return styleFromArgb(
    cellStyle.fill?.fgColor?.rgb,
    cellStyle.font?.color?.rgb,
    {
      bold: cellStyle.font?.bold,
      align: cellStyle.alignment?.horizontal,
    },
  );
}

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
  if (task.status === "awaiting_verification") return "verification";
  if (task.not_done) return "missed";
  if (n > 0) return "positive";
  return "zero";
}

function statusLabel(task) {
  if (task.done_verified) return "Done";
  if (task.status === "awaiting_verification") return "Verification pending";
  if (task.not_done) return "Missed";
  if (task.is_red_flag) return "Red / MIS";
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
      const fillCount = Number(task.fill_count) || 0;
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
        attempts: fillCount > 1 ? fillCount : fillCount === 1 ? 1 : "",
        weightage: task.weightage ?? task.wastage ?? "",
        _task: task,
      });
    }
  }
  return rows;
}

/** Colored score cells for the common xlsx export path. */
export function buildClReportXlsxRowStyles({ rows = [], columns = [] }) {
  const headerStyle = applyCellStyle(HEADER_STYLE);
  const scoreColIdx = columns.findIndex((col) => col.label === "Score");
  const styles = [columns.map(() => headerStyle)];

  for (const row of rows) {
    const rowStyle = columns.map(() => null);
    if (scoreColIdx >= 0 && row._task) {
      rowStyle[scoreColIdx] = applyCellStyle(
        SCORE_STYLES[reportScoreStyleKey(row._task)] || SCORE_STYLES.zero,
      );
    }
    styles.push(rowStyle);
  }

  return styles;
}
