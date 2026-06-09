/** Legacy rows used status=approved for manager sign-off; execution is still not started. */
export function normalizeAuditExecutionStatus(status) {
  if (status === "approved") return "pending";
  return status;
}

export const AUDIT_EXECUTION_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  submitted: "Submitted",
  verified: "Approved",
  cancelled: "Cancelled",
};

export const AUDIT_EXECUTION_COLORS = {
  pending: "bg-slate-50 text-slate-600 border-slate-200",
  in_progress: "bg-blue-50 text-blue-600 border-blue-100",
  submitted: "bg-indigo-50 text-indigo-600 border-indigo-100",
  verified: "bg-purple-600 text-white border-purple-700 shadow-sm",
  cancelled: "bg-rose-50 text-rose-600 border-rose-100",
};

export const AUTHORIZATION_LABELS = {
  authorized: "Authorized",
  pending: "Pending Authorization",
};

export const AUTHORIZATION_COLORS = {
  authorized: "bg-emerald-50 text-emerald-600 border-emerald-100",
  pending: "bg-amber-50 text-amber-600 border-amber-100",
};

export const ACTIVE_LABELS = {
  active: "Active",
  inactive: "Inactive",
};

export const ACTIVE_COLORS = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-100",
  inactive: "bg-slate-50 text-slate-500 border-slate-200",
};

export function getAuditExecutionStatusLabel(status) {
  const key = normalizeAuditExecutionStatus(status);
  return AUDIT_EXECUTION_LABELS[key] || key?.replace(/_/g, " ") || "—";
}

export function getAuthorizationLabel(approved) {
  return approved ? AUTHORIZATION_LABELS.authorized : AUTHORIZATION_LABELS.pending;
}

export function getActiveLabel(approved) {
  return approved ? ACTIVE_LABELS.active : ACTIVE_LABELS.inactive;
}

export function renderAuditExecutionStatusBadge(status) {
  const key = normalizeAuditExecutionStatus(status);
  const label = getAuditExecutionStatusLabel(status);
  const color = AUDIT_EXECUTION_COLORS[key] || "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-sm ${color}`}>
      {label}
    </span>
  );
}

export function renderAuthorizationBadge(approved) {
  const key = approved ? "authorized" : "pending";
  return (
    <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-sm ${AUTHORIZATION_COLORS[key]}`}>
      {AUTHORIZATION_LABELS[key]}
    </span>
  );
}

export function renderActiveBadge(approved) {
  const key = approved ? "active" : "inactive";
  return (
    <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-sm ${ACTIVE_COLORS[key]}`}>
      {ACTIVE_LABELS[key]}
    </span>
  );
}

export function getAuditStatusLabel(status) {
  return getAuditExecutionStatusLabel(status);
}

export function renderAuditStatusBadge(status) {
  return renderAuditExecutionStatusBadge(status);
}

export function canStartAuditExecution(record) {
  if (!record?.approved) return false;
  const key = normalizeAuditExecutionStatus(record.status);
  return key === "pending" || key === "in_progress";
}
