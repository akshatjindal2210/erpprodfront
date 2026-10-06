import { hrmsApproveCell, hrmsAuditAtField, hrmsAuditBy, hrmsDateCell, hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell, hrmsTimeCell } from "./hrmsListCells";

/** Order: identity → business → Status → Created → Updated → Manager → Approved */
export const GATE_PASS_HEADERS = [
  ["Emp Code", "emp_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "emp_name", hrmsNameCell, { width: "140px" }],
  ["Department", "deptname", hrmsEmpty, { width: "120px" }],
  ["Date", "pass_date_display", hrmsDateCell, { width: "100px" }],
  ["Out", "out_time_display", hrmsTimeCell, { width: "140px" }],
  ["In", "in_time_display", hrmsTimeCell, { width: "140px" }],
  ["Duration", "duration", hrmsEmpty, { width: "72px" }],
  ["Type", "pass_type_display", hrmsEmpty, { width: "88px" }],
  ["Gate", "movement_display", hrmsEmpty, { width: "88px" }],
  ["Gone At", "gone_at_display", hrmsMutedTimeCell, { width: "140px" }],
  ["Returned At", "returned_at_display", hrmsMutedTimeCell, { width: "140px" }],
  ["Status", "status_display", hrmsApproveCell, { width: "120px" }],
  ["Created By", "created_by", hrmsAuditBy, { width: "110px" }],
  ["Created At", "created_at", (_, row) => hrmsAuditAtField(row, "created_at"), { width: "150px" }],
  ["Updated By", "updated_by", hrmsAuditBy, { width: "110px" }],
  ["Updated At", "updated_at", (_, row) => hrmsAuditAtField(row, "updated_at"), { width: "150px" }],
  ["Manager By", "sup_by", hrmsAuditBy, { width: "110px" }],
  ["Manager At", "sup_at", (_, row) => hrmsAuditAtField(row, "sup_at"), { width: "150px" }],
  ["Manager Remark", "sup_remarks", hrmsAuditBy, { width: "140px" }],
  ["Approved By", "approved_by", hrmsAuditBy, { width: "110px" }],
  ["Approved At", "approved_at", (_, row) => hrmsAuditAtField(row, "approved_at"), { width: "150px" }],
  ["Approved Remark", "approved_remarks", hrmsAuditBy, { width: "140px" }],
];
