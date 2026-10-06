import { todayYmd } from "@/apps/hrms/lib/gatePassUtils";
import { empPickerRow, empResolved, GP_FIELD, GP_LABEL, GP_ROW2, ReadonlyField, TextInput } from "@/apps/hrms/lib/gatePassForm";

export { empPickerRow, empResolved, GP_FIELD, GP_LABEL, GP_ROW2, ReadonlyField, TextInput };

export const LEAVE_TYPE_OPTIONS = [
  { value: "CL", label: "CL — Casual Leave" },
  { value: "SL", label: "SL — Sick Leave" },
  { value: "PL", label: "PL — Privilege Leave" },
];

export const LEAVE_TYPE_FILTER_OPTIONS = [{ label: "All Types", value: "" }, ...LEAVE_TYPE_OPTIONS];

export const LEAVE_STATUS_OPTIONS = [
  { label: "All Status", value: "" },
  { label: "Pending Manager", value: "pending_manager" },
  { label: "Pending Approve", value: "pending_approve" },
  { label: "Approved", value: "approved" },
];

export function leaveStatus(row) {
  if (row?.sup_at && row?.approved_at) return "approved";
  if (row?.sup_at) return "pending_approve";
  return "pending_manager";
}

export const isPendingApprove = (row) => leaveStatus(row) === "pending_approve";
export const isPendingManager = (row) => leaveStatus(row) === "pending_manager";
export const isFullyApproved = (row) => leaveStatus(row) === "approved";

export function leaveTypeLabel(code) {
  return LEAVE_TYPE_OPTIONS.find((o) => o.value === code)?.label || code || "—";
}

export function calcLeaveDays(from, to, dayPart = "full") {
  if (!from || !to || to < from) return null;
  if (dayPart === "half") {
    if (from !== to) return null;
    return 0.5;
  }
  return Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000) + 1;
}

export function emptyLeaveForm() {
  const d = todayYmd();
  return { emp_dcode: "", emp_code: "", emp_name: "", deptname: "", leave_type: "CL", day_part: "full", from_date: d, to_date: d, reason: "" };
}

export function toLeaveForm(record) {
  if (!record) return emptyLeaveForm();
  const from = record.from_date || todayYmd();
  const to = record.to_date || record.from_date || todayYmd();
  const days = Number(record.days);
  const half = from === to && Number.isFinite(days) && days === 0.5;
  return {
    emp_dcode: record.emp_dcode != null ? Number(record.emp_dcode) : "",
    emp_code: record.emp_code || "",
    emp_name: record.emp_name || "",
    deptname: record.deptname || "",
    leave_type: record.leave_type || "CL",
    day_part: half ? "half" : "full",
    from_date: from,
    to_date: to,
    reason: record.reason || "",
  };
}

export function validateLeaveForm(form, opts = {}) {
  const next = {};
  const today = todayYmd();
  const keepFrom = String(opts.existing?.from_date ?? "").slice(0, 10);
  const keepTo = String(opts.existing?.to_date ?? "").slice(0, 10);
  const unchangedPast = Boolean(keepFrom) && form.from_date === keepFrom && form.to_date === keepTo && (form.from_date < today || form.to_date < today);
  if (!Number(form.emp_dcode)) next.emp_dcode = "Employee is required";
  if (!form.leave_type) next.leave_type = "Type is required";
  if (!form.from_date) next.from_date = "From date is required";
  else if (form.from_date < today && !unchangedPast) next.from_date = "Past date not allowed";
  if (!form.to_date) next.to_date = "To date is required";
  else if (form.to_date < today && !unchangedPast) next.to_date = "Past date not allowed";
  else if (form.to_date < form.from_date) next.to_date = "Invalid date range";
  if (form.day_part === "half" && form.from_date !== form.to_date) next.to_date = "Half day must be same date";
  if (!String(form.reason || "").trim()) next.reason = "Reason is required";
  return next;
}

export function leavePayload(form) {
  const multi = form.from_date && form.to_date && form.from_date !== form.to_date;
  const dayPart = !multi && form.day_part === "half" ? "half" : "full";
  return {
    emp_dcode: Number(form.emp_dcode),
    leave_type: form.leave_type,
    from_date: form.from_date,
    to_date: dayPart === "half" ? form.from_date : form.to_date,
    day_part: dayPart,
    reason: form.reason,
  };
}
