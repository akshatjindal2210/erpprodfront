import { hrmsApproveCell, hrmsAuditAt, hrmsAuditBy, hrmsDateCell, hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell, hrmsTimeCell } from "./hrmsListCells";
import { dayTypeDisplay, formatDuration, normalizeDayType, rowTotals } from "@/apps/hrms/lib/attendanceUtils";

const mins = (n) => (n == null || !Number.isFinite(Number(n)) ? null : formatDuration(Math.round(Number(n))));
const totals = (row) => rowTotals({ ...row, day_type: normalizeDayType(row.day_type) });

function hoursCell(key) {
  return (_, row) => {
    const t = totals(row);
    const value = key === "total" && row.total_minutes != null ? Number(row.total_minutes) : t[key];
    return hrmsTimeCell(mins(value));
  };
}

function otCell(_, row) {
  if (Number(row.ot_approved) === 2) return hrmsEmpty(null);
  const value = row.ot_minutes != null ? Number(row.ot_minutes) : totals(row).ot;
  if (value == null || value === 0) return hrmsEmpty(null);
  return (
    <span className={`text-[10px] font-bold tabular-nums ${Number(row.ot_approved) === 1 ? "text-emerald-600" : "text-red-600"}`}>
      {mins(value)}
    </span>
  );
}

function lunchCell(_, row) {
  const yes = row.lunch === true || row.lunch === 1 || row.lunch === "1" || row.lunch === "t" || String(row.lunch_display || "").toLowerCase() === "yes";
  const no = row.lunch === false || row.lunch === 0 || row.lunch === "0" || row.lunch === "f" || String(row.lunch_display || "").toLowerCase() === "no";
  if (!yes && !no) return hrmsEmpty(null);
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
  ["Total Hours", "total_minutes", hoursCell("total"), { width: "145px", exportType: "number", copyValue: (row) => row.total_minutes ?? "" }],
  ["Lunch", "lunch_display", lunchCell, { width: "80px", align: "center", copyValue: (row) => (row.lunch ? "true" : "false") }],
  ["OT", "ot_minutes", otCell, { width: "130px", exportType: "number", copyValue: (row) => (Number(row.ot_approved) === 2 ? "" : row.ot_minutes ?? "") }],
  ["Worked Hours", "worked_minutes", (_, row) => hrmsTimeCell(mins(row.worked_minutes)), { width: "145px", exportType: "number", copyValue: (row) => row.worked_minutes ?? "" }],
  ["Type", "entry_type_display", hrmsEmpty, { width: "90px" }],
  ["Default Hours", "default_hours", (_, row) => hrmsTimeCell(mins(totals(row).fullDefault)), { width: "140px", exportType: "number", copyValue: (row) => totals(row).fullDefault ?? "" }],
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
