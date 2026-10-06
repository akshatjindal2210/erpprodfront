import { hrmsAuditAtField, hrmsAuditBy, hrmsEmpCodeCell, hrmsEmpty, hrmsNameCell } from "./hrmsListCells";
import { formatRupee } from "@/apps/hrms/lib/loanUtils";

const rupeeCell = (v) => <span className="text-[10px] font-bold text-slate-700 tabular-nums">{formatRupee(v)}</span>;

function deductionStatusCell(v, row) {
  const s = String(row?.status || v || "").toLowerCase();
  const label = v || "—";
  const tone =
    s === "deducted"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : s === "approved"
        ? "bg-indigo-50 text-indigo-700 border-indigo-100"
        : s === "overdue"
          ? "bg-rose-50 text-rose-700 border-rose-100"
          : "bg-amber-50 text-amber-700 border-amber-100";
  return (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${tone}`}>
      {label}
    </span>
  );
}

export const LOAN_DEDUCTION_HEADERS = [
  ["Emp Code", "emp_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "emp_name", hrmsNameCell, { width: "140px" }],
  ["Department", "deptname", hrmsEmpty, { width: "120px" }],
  ["Type", "type_display", hrmsEmpty, { width: "90px" }],
  ["Month", "month", hrmsEmpty, { width: "90px" }],
  ["Amount", "amount", rupeeCell, { width: "110px", exportType: "number", copyValue: (row) => row.amount ?? 0 }],
  ["Remark", "remarks", hrmsEmpty, { width: "160px" }],
  ["Status", "status_display", deductionStatusCell, { width: "110px" }],
  ["Created By", "created_by", hrmsAuditBy, { width: "110px" }],
  ["Created At", "created_at", (_, row) => hrmsAuditAtField(row, "created_at"), { width: "150px" }],
  ["Approved By", "approved_by", hrmsAuditBy, { width: "110px" }],
  ["Approved At", "approved_at", (_, row) => hrmsAuditAtField(row, "approved_at"), { width: "150px" }],
  ["Approved Remark", "approved_remarks", hrmsAuditBy, { width: "140px" }],
];
