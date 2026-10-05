import { hrmsApproveCell, hrmsCountCell, hrmsDateCell, hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell, hrmsTimeCell } from "./hrmsListCells";
import { formatDuration, rowTotals } from "@/apps/hrms/lib/attendanceUtils";
import { formatDateTime } from "@/platform/utils/core/utilHelper";

function hoursCol(key) {
  return (_, row) => {
    const totals = rowTotals({ ...row, day_type: row.day_type || "full" });
    const mins = totals[key];
    const label = mins == null ? null : `${formatDuration(mins)} (${Math.round(mins)} min)`;
    const tip = totals.calcHints?.length ? `Calc (min only)\n${totals.calcHints.map((h) => h.text).join("\n")}` : undefined;
    return (
      <span className="cursor-help" title={tip}>
        {hrmsTimeCell(label)}
      </span>
    );
  };
}

export const ATTENDANCE_HEADERS = [
  ["Emp Code", "emp_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "name", hrmsNameCell, { width: "140px" }],
  ["Date", "attendance_date_display", hrmsDateCell, { width: "100px" }],
  ["Shift", "shift_display", hrmsEmpty, { width: "80px" }],
  ["In Time", "in_display", hrmsTimeCell, { width: "155px" }],
  ["Out Time", "out_display", hrmsMutedTimeCell, { width: "155px" }],
  ["Approval", "approval_status_display", hrmsApproveCell, { width: "120px", align: "center" }],
  ["Total", "wh_total", hoursCol("total"), { width: "145px" }],
  ["Lunch", "wh_lunch", hoursCol("lunch"), { width: "145px" }],
  ["Normal", "wh_normal", hoursCol("normal"), { width: "145px" }],
  ["OT", "wh_ot", hoursCol("ot"), { width: "145px" }],
  // ["Status", "punch_status_display", hrmsEmpty, { width: "100px" }],
  // ["Punches", "punch_count", hrmsCountCell, { width: "80px", align: "center" }],
  ["Type", "entry_type_display", hrmsEmpty, { width: "90px" }],
  ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
];
