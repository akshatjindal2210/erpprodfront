import { hrmsApproveCell, hrmsDateCell, hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell } from "./hrmsListCells";

function auditAt(row, key) {
  return row?.[`${key}_display`] ?? row?.[key] ?? "—";
}

export const LEAVE_HEADERS = [
  ["Emp Code", "emp_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "emp_name", hrmsNameCell, { width: "140px" }],
  ["Department", "deptname", hrmsEmpty, { width: "120px" }],
  ["Type", "leave_type_display", hrmsEmpty, { width: "130px" }],
  ["From", "from_date_display", hrmsDateCell, { width: "100px" }],
  ["To", "to_date_display", hrmsDateCell, { width: "100px" }],
  ["Days", "days", hrmsEmpty, { width: "64px" }],
  ["Status", "status_display", hrmsApproveCell, { width: "120px" }],
  ["Reason", "reason", hrmsEmpty, { width: "160px" }],
  ["Sup By", "sup_by", hrmsEmpty, { width: "100px" }],
  ["HR By", "hr_by", hrmsEmpty, { width: "100px" }],
  ["Created By", "created_by", hrmsEmpty, { width: "100px" }],
  ["Created At", "created_at", (_, row) => hrmsMutedTimeCell(auditAt(row, "created_at")), { width: "140px" }],
];
