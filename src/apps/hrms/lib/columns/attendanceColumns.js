import { hrmsApproveCell, hrmsCountCell, hrmsDateCell, hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell, hrmsTimeCell } from "./hrmsListCells";

export const ATTENDANCE_HEADERS = [
  ["Emp Code", "employee_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "name", hrmsNameCell, { width: "140px" }],
  ["Date", "attendance_date_display", hrmsDateCell, { width: "100px" }],
  ["Shift", "shift_display", hrmsEmpty, { width: "80px" }],
  ["In Time", "in_display", hrmsTimeCell, { width: "155px" }],
  ["Out Time", "out_display", hrmsMutedTimeCell, { width: "155px" }],
  ["Punches", "punch_count", hrmsCountCell, { width: "80px", align: "center" }],
  ["Type", "entry_type_display", hrmsEmpty, { width: "90px" }],
  ["Approval", "approval_status_display", hrmsApproveCell, { width: "100px" }],
];