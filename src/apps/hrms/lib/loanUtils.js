import { empPickerRow, empResolved, GP_FIELD, GP_LABEL, GP_ROW2, ReadonlyField, TextInput } from "@/apps/hrms/lib/gatePassForm";

export { empPickerRow, empResolved, GP_FIELD, GP_LABEL, GP_ROW2, ReadonlyField, TextInput };

export const LOAN_TYPE_OPTIONS = [
  { value: "loan", label: "Loan" },
  { value: "advance", label: "Advance" },
];

export const LOAN_TYPE_FILTER_OPTIONS = [{ label: "All Types", value: "" }, ...LOAN_TYPE_OPTIONS];

export const LOAN_STATUS_OPTIONS = [
  { label: "All Status", value: "" },
  { label: "Pending Supervisor", value: "pending_manager" },
  { label: "Pending HR", value: "pending_hr" },
  { label: "Approved", value: "approved" },
];

export function loanStatus(row) {
  if (row?.sup_at && row?.hr_at) return "approved";
  if (row?.sup_at) return "pending_hr";
  return "pending_manager";
}

export const isPendingHr = (row) => loanStatus(row) === "pending_hr";
export const isPendingManager = (row) => loanStatus(row) === "pending_manager";
export const isFullyApproved = (row) => loanStatus(row) === "approved";

export function emiAmount(amount, months) {
  const m = Number(months) || 0;
  const a = Number(amount) || 0;
  return m ? Math.round((a / m) * 100) / 100 : 0;
}

export function currentMonthYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function emptyLoanForm() {
  return {
    emp_dcode: "",
    emp_code: "",
    emp_name: "",
    deptname: "",
    type: "loan",
    amount: "",
    emi_months: "6",
    start_month: currentMonthYm(),
    reason: "",
  };
}

export function toLoanForm(record) {
  if (!record) return emptyLoanForm();
  const type = record.type === "advance" ? "advance" : "loan";
  return {
    emp_dcode: record.emp_dcode != null ? Number(record.emp_dcode) : "",
    emp_code: record.emp_code || "",
    emp_name: record.emp_name || "",
    deptname: record.deptname || "",
    type,
    amount: record.amount != null ? String(record.amount) : "",
    emi_months: type === "advance" ? "1" : String(record.emi_months ?? "6"),
    start_month: String(record.start_month || "").slice(0, 7) || currentMonthYm(),
    reason: record.reason || "",
  };
}

export function validateLoanForm(form) {
  const next = {};
  if (!Number(form.emp_dcode)) next.emp_dcode = "Employee is required";
  if (!["loan", "advance"].includes(form.type)) next.type = "Type is required";
  if (!(Number(form.amount) > 0)) next.amount = "Valid amount is required";
  if (form.type === "loan" && (!(Number(form.emi_months) >= 1) || !Number.isInteger(Number(form.emi_months)))) {
    next.emi_months = "EMI months required";
  }
  if (!/^\d{4}-\d{2}$/.test(String(form.start_month || ""))) next.start_month = "Start month is required";
  if (!String(form.reason || "").trim()) next.reason = "Reason is required";
  return next;
}

export function loanPayload(form) {
  const type = form.type === "advance" ? "advance" : "loan";
  return {
    emp_dcode: Number(form.emp_dcode),
    type,
    amount: Number(form.amount),
    emi_months: type === "advance" ? 1 : Number(form.emi_months),
    start_month: form.start_month,
    reason: form.reason,
  };
}

export function formEmiPreview(form) {
  const type = form.type === "advance" ? "advance" : "loan";
  const months = type === "advance" ? 1 : Number(form.emi_months);
  const amount = Number(form.amount);
  if (!(amount > 0) || !(months >= 1)) return "—";
  return String(emiAmount(amount, months));
}
