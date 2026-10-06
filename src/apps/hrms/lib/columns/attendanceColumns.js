import { hrmsApproveCell, hrmsAuditAt, hrmsAuditBy, hrmsDateCell, hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell, hrmsTimeCell } from "./hrmsListCells";
import { attendanceHours, dayTypeDisplay, formatDuration, normalizeDayType } from "@/apps/hrms/lib/attendanceUtils";

const mins = (n) => (n == null || !Number.isFinite(Number(n)) ? null : formatDuration(Math.max(0, Math.round(Number(n)))));
const hours = (row) => attendanceHours(row);

function hoursCell(key) {
  return (_, row) => hrmsTimeCell(mins(hours(row)[key]));
}

function otCell(_, row) {
  const value = hours(row).ot ?? 0;
  return (
    <span className={`text-[10px] font-bold tabular-nums ${value <= 0 ? "text-slate-500" : Number(row.ot_approved) === 1 ? "text-emerald-600" : "text-red-600"}`}>
      {mins(value)}
    </span>
  );
}

function lunchCell(_, row) {
  const lunchMins = hours(row).lunch;
  if (lunchMins == null) return hrmsEmpty(null);
  const yes = lunchMins > 0;
  return (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${yes ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
      {yes ? "Yes" : "No"}
    </span>
  );
}

/** Order: identity → business → Status → Created → Updated → Approved → Remark */
export const ATTENDANCE_HEADERS = [
  ["Emp Code", "emp_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "name", hrmsNameCell, { width: "140px" }],
  ["Date", "attendance_date_display", hrmsDateCell, { width: "100px" }],
  ["Shift", "shift_display", hrmsEmpty, { width: "70px" }],
  ["In Time", "in_display", hrmsTimeCell, { width: "155px" }],
  ["Out Time", "out_display", hrmsMutedTimeCell, { width: "155px" }],
  ["Day", "day_type_display", (v, row) => hrmsEmpty(v || dayTypeDisplay(row?.day_type)), { width: "70px" }],
  ["Day Value", "day_value", (v, row) => hrmsEmpty(v != null ? v : normalizeDayType(row?.day_type) === "HD" ? 0.5 : 1), { width: "80px", align: "center" }],
  ["Total Hours", "total_minutes", hoursCell("total"), { width: "175px", exportType: "number", copyValue: (row) => hours(row).total ?? "" }],
  ["Lunch", "lunch_display", lunchCell, { width: "80px", align: "center", copyValue: (row) => (hours(row).lunch > 0 ? "true" : "false") }],
  ["OT", "ot_minutes", otCell, { width: "175px", exportType: "number", copyValue: (row) => hours(row).ot ?? 0 }],
  ["Worked Hours", "worked_minutes", hoursCell("worked"), { width: "175px", exportType: "number", copyValue: (row) => hours(row).worked ?? "" }],
  ["Type", "entry_type_display", hrmsEmpty, { width: "90px" }],
  ["Default Hours", "default_hours", (_, row) => hrmsTimeCell(mins(hours(row).fullDefault)), { width: "175px", exportType: "number", copyValue: (row) => hours(row).fullDefault ?? "" }],
  ["Default In", "default_in_display", (v, row) => hrmsEmpty(v || row?.default_in || "—"), { width: "155px" }],
  ["Default Out", "default_out_display", (v, row) => hrmsEmpty(v || row?.default_out || "—"), { width: "155px" }],
  ["Status", "approval_status_display", hrmsApproveCell, { width: "110px", align: "center" }],
  ["Created By", "created_by_name", hrmsAuditBy, { width: "110px" }],
  ["Created At", "created_at", hrmsAuditAt, { width: "150px" }],
  ["Updated By", "updated_by_name", hrmsAuditBy, { width: "110px" }],
  ["Updated At", "updated_at", hrmsAuditAt, { width: "150px" }],
  ["Approved By", "approved_by_name", hrmsAuditBy, { width: "110px" }],
  ["Approved At", "approved_at", hrmsAuditAt, { width: "150px" }],
  ["Remark", "approval_remarks", hrmsAuditBy, { width: "140px" }],
];
