import { hrmsApproveCell, hrmsCountCell, hrmsDateCell, hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell, hrmsPresentCell, hrmsTimeCell } from "./hrmsListCells";

/** hrms_attendance — daily summary columns. */
export const ATTENDANCE_HEADERS = [
  ["Emp Code", "employee_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "name", hrmsNameCell, { width: "140px" }],
  ["Date", "attendance_date_display", hrmsDateCell, { width: "100px" }],
  ["Shift", "shift_display", hrmsEmpty, { width: "80px" }],
  ["First Punch", "check_in_display", hrmsTimeCell, { width: "100px" }],
  ["Last Punch", "check_out_display", hrmsMutedTimeCell, { width: "100px" }],
  ["Punches", "punch_count", hrmsCountCell, { width: "80px", align: "center" }],
  ["Status", "status", hrmsPresentCell, { width: "100px" }],
  ["Type", "entry_type_display", hrmsEmpty, { width: "90px" }],
  ["Approval", "approval_status_display", hrmsApproveCell, { width: "100px" }],
];

export const ATTENDANCE_DETAIL_FIELDS = [
  ["Emp Code", "employee_code"],
  ["Name", "name"],
  ["Date", "attendance_date_display"],
  ["Shift", "shift_display"],
  ["First Punch", "check_in_display"],
  ["Last Punch", "check_out_display"],
  ["Punches", "punch_count"],
  ["Status", "status"],
  ["Type", "entry_type_display"],
  ["Approval", "approval_status_display"],
  ["Created By", "created_by"],
  ["Updated By", "updated_by"],
  ["Approved By", "approved_by"],
];
