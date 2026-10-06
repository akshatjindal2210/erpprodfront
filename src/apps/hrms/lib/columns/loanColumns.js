import { hrmsApproveCell, hrmsAuditAtField, hrmsAuditBy, hrmsEmpCodeCell, hrmsEmpty, hrmsNameCell } from "./hrmsListCells";
import { formatRupee } from "@/apps/hrms/lib/loanUtils";

const rupeeCell = (v) => <span className="text-[10px] font-bold text-slate-700 tabular-nums">{formatRupee(v)}</span>;

/** Order: identity → business → Status → Created → Updated → Manager → Approved */
export const LOAN_HEADERS = [
  ["Emp Code", "emp_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "emp_name", hrmsNameCell, { width: "140px" }],
  ["Department", "deptname", hrmsEmpty, { width: "120px" }],
  ["Type", "type_display", hrmsEmpty, { width: "88px" }],
  ["Amount", "amount", rupeeCell, { width: "110px", exportType: "number", copyValue: (row) => row.amount ?? 0 }],
  ["First EMI", "emi_amount", rupeeCell, { width: "110px", exportType: "number", copyValue: (row) => row.emi_amount ?? 0 }],
  ["Months", "emi_months", hrmsEmpty, { width: "72px" }],
  ["Start", "start_month_display", hrmsEmpty, { width: "90px" }],
  ["Reason", "reason", hrmsEmpty, { width: "160px" }],
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
