import { hrmsApproveCell, hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell } from "./hrmsListCells";

function auditAt(row, key) {
  return row?.[`${key}_display`] ?? row?.[key] ?? "—";
}

export const LOAN_HEADERS = [
  ["Emp Code", "emp_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "emp_name", hrmsNameCell, { width: "140px" }],
  ["Department", "deptname", hrmsEmpty, { width: "120px" }],
  ["Type", "type_display", hrmsEmpty, { width: "88px" }],
  ["Amount", "amount", hrmsEmpty, { width: "90px" }],
  ["EMI", "emi_amount", hrmsEmpty, { width: "80px" }],
  ["Months", "emi_months", hrmsEmpty, { width: "72px" }],
  ["Start", "start_month_display", hrmsEmpty, { width: "90px" }],
  ["Status", "status_display", hrmsApproveCell, { width: "120px" }],
  ["Reason", "reason", hrmsEmpty, { width: "160px" }],
  ["Sup By", "sup_by", hrmsEmpty, { width: "100px" }],
  ["Sup At", "sup_at", (_, row) => hrmsMutedTimeCell(auditAt(row, "sup_at")), { width: "140px" }],
  ["HR By", "hr_by", hrmsEmpty, { width: "100px" }],
  ["HR At", "hr_at", (_, row) => hrmsMutedTimeCell(auditAt(row, "hr_at")), { width: "140px" }],
  ["Created By", "created_by", hrmsEmpty, { width: "100px" }],
  ["Created At", "created_at", (_, row) => hrmsMutedTimeCell(auditAt(row, "created_at")), { width: "140px" }],
];
