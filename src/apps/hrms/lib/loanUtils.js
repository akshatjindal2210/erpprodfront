import { empPickerRow, empResolved, GP_FIELD, GP_LABEL, GP_ROW2, ReadonlyField, TextInput } from "@/apps/hrms/lib/gatePassForm";

export { empPickerRow, empResolved, GP_FIELD, GP_LABEL, GP_ROW2, ReadonlyField, TextInput };

export const LOAN_TYPE_OPTIONS = [
  { value: "loan", label: "Loan" },
  { value: "advance", label: "Advance" },
];

export const LOAN_TYPE_FILTER_OPTIONS = [{ label: "All Types", value: "" }, ...LOAN_TYPE_OPTIONS];

/** Deduction register types — add here later (fine, damage, …). */
export const DEDUCTION_TYPES = [
  { value: "loan", label: "Loan" },
  { value: "advance", label: "Advance" },
  { value: "extra", label: "Extra" },
];
/** Manual create only — loan/advance come from Loan module. */
export const DEDUCTION_CREATE_TYPES = DEDUCTION_TYPES.filter((t) => t.value !== "loan" && t.value !== "advance");
export const DEDUCTION_TYPE_FILTER_OPTIONS = [{ label: "All Types", value: "" }, ...DEDUCTION_TYPES];
export const DEDUCTION_STATUS_OPTIONS = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Deducted", value: "deducted" },
  { label: "Overdue", value: "overdue" },
  { label: "All Status", value: "" },
];
export function deductionTypeLabel(type) {
  const t = String(type || "").trim().toLowerCase();
  return DEDUCTION_TYPES.find((x) => x.value === t)?.label || t || "—";
}

export const LOAN_STATUS_OPTIONS = [
  { label: "All Status", value: "" },
  { label: "Pending Manager", value: "pending_manager" },
  { label: "Pending Approve", value: "pending_approve" },
  { label: "Approved", value: "approved" },
];

export function loanStatus(row) {
  if (row?.sup_at && row?.approved_at) return "approved";
  if (row?.sup_at) return "pending_approve";
  return "pending_manager";
}

export const isPendingApprove = (row) => loanStatus(row) === "pending_approve";
export const isPendingManager = (row) => loanStatus(row) === "pending_manager";
export const isFullyApproved = (row) => loanStatus(row) === "approved";

function toPaise(n) {
  return Math.round(Number(n) * 100);
}

function fromPaise(p) {
  return Math.round(Number(p)) / 100;
}

/** Display: ₹1,00,000.00 (en-IN). Null/NaN → ₹0.00 */
export function formatRupee(n) {
  const x = Number(n);
  const v = Number.isFinite(x) ? x : 0;
  return `₹${Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Clean paste like "₹ 10,000.50" → number or "" */
export function parseRupeeInput(raw) {
  const s = String(raw ?? "")
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/[eE+]/g, "");
  if (s === "" || s === "-" || s === ".") return "";
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return "";
  return String(Math.round(n * 100) / 100);
}

export function currentMonthYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Equal EMI in whole rupees; last row takes remainder so SUM exact. */
export function buildLoanSchedule(amount, months, startYm, firstMonthAmount) {
  const totalP = toPaise(amount);
  const m = Number(months) || 0;
  const start = String(startYm || "").slice(0, 7);
  if (!(totalP > 0) || m < 1 || !/^\d{4}-\d{2}$/.test(start)) return [];
  const [y0, m0] = start.split("-").map(Number);
  const firstP = firstMonthAmount === "" || firstMonthAmount == null ? null : Math.round(toPaise(firstMonthAmount) / 100) * 100;
  const rows = [];
  let sumP = 0;
  for (let i = 0; i < m; i++) {
    const d = new Date(Date.UTC(y0, m0 - 1 + i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    let p;
    if (i === m - 1) p = totalP - sumP;
    else if (i === 0 && firstP != null) p = firstP;
    else if (firstP != null) p = Math.floor((totalP - firstP) / ((m - 1) * 100)) * 100;
    else p = Math.floor(totalP / (m * 100)) * 100;
    if (i < m - 1 && p < 100) p = 100;
    sumP += p;
    rows.push({ month, amount: fromPaise(p) });
  }
  return rows;
}

export function scheduleSum(rows) {
  return fromPaise((rows || []).reduce((s, r) => s + toPaise(r.amount || 0), 0));
}

/** Edit row `index` (not last); last EMI auto-fills so SUM == loan amount exactly. */
export function adjustScheduleRow(schedule, loanAmount, index, rawAmount) {
  const rows = (schedule || []).map((r) => ({ month: r.month, amount: fromPaise(toPaise(r.amount || 0)) }));
  if (!rows.length) return rows;
  const totalP = toPaise(loanAmount);
  if (!(totalP > 0)) return rows;
  const last = rows.length - 1;

  if (rows.length === 1) {
    rows[0] = { ...rows[0], amount: fromPaise(totalP) };
    return rows;
  }
  if (index < 0 || index >= last) return rows;

  let amtP = rawAmount === "" || rawAmount == null ? 0 : Math.round(toPaise(rawAmount) / 100) * 100;
  if (amtP < 0) amtP = 0;
  const othersP = rows.reduce((s, r, i) => (i === index || i === last ? s : s + toPaise(r.amount)), 0);
  const maxThis = totalP - othersP - 100; // leave ≥ ₹1 for last EMI
  if (amtP > maxThis) amtP = Math.max(0, maxThis);
  if (amtP < 100) amtP = 100;

  rows[index] = { ...rows[index], amount: fromPaise(amtP) };
  const sumHead = rows.reduce((s, r, i) => (i === last ? s : s + toPaise(r.amount)), 0);
  rows[last] = { ...rows[last], amount: fromPaise(totalP - sumHead) };
  return rows;
}

export function scheduleMatchesAmount(schedule, loanAmount) {
  if (!(Number(loanAmount) > 0) || !schedule?.length) return false;
  return toPaise(scheduleSum(schedule)) === toPaise(loanAmount);
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
    first_month_amount: "",
    schedule: [],
    reason: "",
  };
}

export function toLoanForm(record) {
  if (!record) return emptyLoanForm();
  const type = record.type === "advance" ? "advance" : "loan";
  const months = type === "advance" ? 1 : Number(record.emi_months ?? 6);
  const amount = record.amount != null ? Number(record.amount) : 0;
  const start = String(record.start_month || "").slice(0, 7) || currentMonthYm();
  const fromApi = Array.isArray(record.emi_schedule) && record.emi_schedule.length ? record.emi_schedule : null;
  const schedule = fromApi
    ? fromApi.map((r) => ({ month: String(r.month).slice(0, 7), amount: fromPaise(toPaise(r.amount)) }))
    : buildLoanSchedule(amount, months, start, record.emi_amount != null ? record.emi_amount : null);
  return {
    emp_dcode: record.emp_dcode != null ? Number(record.emp_dcode) : "",
    emp_code: record.emp_code || "",
    emp_name: record.emp_name || "",
    deptname: record.deptname || "",
    type,
    amount: record.amount != null ? String(record.amount) : "",
    emi_months: String(months),
    start_month: start,
    first_month_amount: schedule[0]?.amount != null ? String(schedule[0].amount) : "",
    schedule,
    reason: record.reason || "",
  };
}

export function validateLoanForm(form) {
  const next = {};
  if (!Number(form.emp_dcode)) next.emp_dcode = "Employee is required";
  if (!["loan", "advance"].includes(form.type)) next.type = "Type is required";
  if (!(Number(form.amount) > 0)) next.amount = "Valid amount is required";
  const months = form.type === "advance" ? 1 : Number(form.emi_months);
  if (form.type === "loan" && (!(months >= 1) || !Number.isInteger(months))) next.emi_months = "EMI months required";
  if (!/^\d{4}-\d{2}$/.test(String(form.start_month || ""))) next.start_month = "Start month is required";
  if (!String(form.reason || "").trim()) next.reason = "Reason is required";

  const schedule = Array.isArray(form.schedule) ? form.schedule : [];
  if (!(Number(form.amount) > 0) || !(months >= 1)) return next;
  if (schedule.length !== months) next.schedule = "Schedule months must match EMI months";
  else if (schedule.some((r) => !(toPaise(r.amount) > 0))) next.schedule = "Each EMI must be greater than 0";
  else if (!scheduleMatchesAmount(schedule, form.amount)) next.schedule = "Schedule sum must equal loan amount (not less, not more)";
  return next;
}

/** Payload: loan fields + schedule only (no emp name / computed totals). */
export function loanPayload(form) {
  const type = form.type === "advance" ? "advance" : "loan";
  const months = type === "advance" ? 1 : Number(form.emi_months);
  return {
    emp_dcode: Number(form.emp_dcode),
    type,
    amount: fromPaise(toPaise(form.amount)),
    emi_months: months,
    start_month: form.start_month,
    schedule: (form.schedule || []).map((r) => ({
      month: String(r.month).slice(0, 7),
      amount: fromPaise(toPaise(r.amount)),
    })),
    reason: form.reason,
  };
}

export function formEmiPreview(form) {
  const row = (form.schedule || [])[0];
  if (row?.amount != null) return formatRupee(row.amount);
  return "₹0.00";
}

export function rebuildFormSchedule(form) {
  const type = form.type === "advance" ? "advance" : "loan";
  const months = type === "advance" ? 1 : Number(form.emi_months) || 0;
  const amount = Number(form.amount);
  const start = form.start_month;
  if (!(amount > 0) || months < 1 || !/^\d{4}-\d{2}$/.test(String(start || ""))) {
    return { ...form, schedule: [], emi_months: type === "advance" ? "1" : form.emi_months };
  }
  const schedule = buildLoanSchedule(amount, months, start, form.first_month_amount);
  return {
    ...form,
    emi_months: String(months),
    schedule,
    first_month_amount: schedule[0] ? String(schedule[0].amount) : form.first_month_amount,
  };
}
