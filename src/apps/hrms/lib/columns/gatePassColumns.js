import { hrmsApproveCell, hrmsDateCell, hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell, hrmsTimeCell } from "./hrmsListCells";

function auditAt(row, key) {
  return row?.[`${key}_display`] ?? row?.[key] ?? "—";
}

export const GATE_PASS_HEADERS = [
  ["Emp Code", "emp_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "emp_name", hrmsNameCell, { width: "140px" }],
  ["Department", "deptname", hrmsEmpty, { width: "120px" }],
  ["Date", "pass_date_display", hrmsDateCell, { width: "100px" }],
  ["Out", "out_time_display", hrmsTimeCell, { width: "140px" }],
  ["In", "in_time_display", hrmsTimeCell, { width: "140px" }],
  ["Duration", "duration", hrmsEmpty, { width: "72px" }],
  ["Type", "pass_type_display", hrmsEmpty, { width: "88px" }],
  ["Status", "status_display", hrmsApproveCell, { width: "120px" }],
  ["Sup By", "sup_by", hrmsEmpty, { width: "100px" }],
  ["Sup At", "sup_at", (_, row) => hrmsMutedTimeCell(auditAt(row, "sup_at")), { width: "140px" }],
  ["HR By", "hr_by", hrmsEmpty, { width: "100px" }],
  ["HR At", "hr_at", (_, row) => hrmsMutedTimeCell(auditAt(row, "hr_at")), { width: "140px" }],
  ["Created By", "created_by", hrmsEmpty, { width: "100px" }],
  ["Created At", "created_at", (_, row) => hrmsMutedTimeCell(auditAt(row, "created_at")), { width: "140px" }],
  ["Updated By", "updated_by", hrmsEmpty, { width: "100px" }],
  ["Updated At", "updated_at", (_, row) => hrmsMutedTimeCell(auditAt(row, "updated_at")), { width: "140px" }],
];
