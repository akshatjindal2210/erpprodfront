import { ROLE_LABELS } from "@/ui/common/Constants";

/**
 * Module notification template UI labels.
 * Backend routing: moduleNotify.service.js
 */
export const TRIGGER_EVENT_OPTIONS = [
  { value: "add", label: "Add" },
  { value: "edit", label: "Edit" },
  { value: "delete", label: "Delete" },
  { value: "approve", label: "Approve" },
];

export const TRIGGER_EVENT_LABELS = Object.fromEntries(TRIGGER_EVENT_OPTIONS.map((o) => [o.value, o.label]));

export const RECIPIENT_TYPE_OPTIONS = [
  { value: "attribute", label: "Attribute" },
  { value: "role", label: "Role" },
  { value: "department", label: "Department" },
  { value: "designation", label: "Designation" },
  { value: "user", label: "Direct Person" },
];

export const RECIPIENT_TYPE_LABELS = Object.fromEntries(RECIPIENT_TYPE_OPTIONS.map((o) => [o.value, o.label]));

export const AUDIENCE_DIM_OPTIONS = [
  { key: "departments", label: "Department", allLabel: "All Departments" },
  { key: "designations", label: "Designation", allLabel: "All Designations" },
  { key: "attributes", label: "Attribute", allLabel: "All Attributes" },
  { key: "roles", label: "Role / Type", allLabel: "All Roles" },
  { key: "users", label: "User", allLabel: "All Users" },
];

export const EMPTY_AUDIENCE = {
  departments: { all: false, ids: [] },
  designations: { all: false, ids: [] },
  attributes: { all: false, ids: [] },
  roles: { all: false, ids: [] },
  users: { all: false, ids: [] },
};

/** Fresh audience object for forms (avoids mutating EMPTY_AUDIENCE). */
export function createEmptyAudience() {
  return normalizeAudience(null);
}

export const roleLabel = (key) => ROLE_LABELS[key] ?? String(key || "").replace(/_/g, " ");

export function normalizeAudienceDim(raw) {
  if (!raw || typeof raw !== "object") return { all: false, ids: [] };
  const all = !!raw.all;
  const list = Array.isArray(raw.ids) ? raw.ids : [];
  const ids = [...new Set(list.map((v) => String(v).trim()).filter(Boolean))];
  return { all, ids: all ? [] : ids };
}

export function normalizeAudience(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    departments: normalizeAudienceDim(src.departments),
    designations: normalizeAudienceDim(src.designations),
    attributes: normalizeAudienceDim(src.attributes),
    roles: normalizeAudienceDim(src.roles),
    users: normalizeAudienceDim(src.users),
  };
}

export function isAudienceDimActive(dim) {
  return !!(dim && (dim.all || (Array.isArray(dim.ids) && dim.ids.length > 0)));
}

export function audienceHasAny(audience) {
  const a = normalizeAudience(audience);
  return AUDIENCE_DIM_OPTIONS.some((d) => isAudienceDimActive(a[d.key]));
}

function nameMap(list) {
  const m = new Map();
  (list ?? []).forEach((x) => m.set(String(x.id), x.name));
  return m;
}

/** List/card summary. */
export function recipientText(row, options) {
  const audience = normalizeAudience(row?.audience);
  const hasMulti = audienceHasAny(audience);

  if (!hasMulti) {
    const label =
      row.recipient_type === "role" ? (row.recipient_refs ?? []).map(roleLabel).join(", ") : row.recipient_label;
    return { type: RECIPIENT_TYPE_LABELS[row.recipient_type] ?? row.recipient_type ?? "Audience", label: label || "-" };
  }

  const deptNames = nameMap(options?.departments);
  const desigNames = nameMap(options?.designations);
  const attrNames = nameMap(options?.attributes);
  const userNames = nameMap(options?.users);

  const parts = [];
  const pushDim = (label, dim, resolve) => {
    if (!isAudienceDimActive(dim)) return;
    if (dim.all) parts.push(`${label}: All`);
    else parts.push(`${label}: ${dim.ids.map(resolve).join(", ")}`);
  };

  pushDim("Dept", audience.departments, (id) => deptNames.get(id) || id);
  pushDim("Desig", audience.designations, (id) => desigNames.get(id) || id);
  pushDim("Attr", audience.attributes, (id) => attrNames.get(id) || id);
  pushDim("Role", audience.roles, (id) => roleLabel(id));
  pushDim("User", audience.users, (id) => userNames.get(id) || id);

  return { type: "Audience", label: parts.join(" · ") || "-" };
}

export function channelText(row) {
  return [
    row.pwa_enabled ? "PWA" : null,
    row.send_via && row.send_via !== "none" ? CHANNEL_LABELS[row.send_via] : null,
    row.email_enabled ? "Email" : null,
  ]
    .filter(Boolean)
    .join(" + ");
}

export const WHATSAPP_OPTIONS = [
  { value: "none", label: "Off" },
  { value: "free", label: "Free (WhatsApp)" },
  { value: "paid", label: "Paid (WhatsApp)" },
];

export const CHANNEL_LABELS = {
  pwa_push: "PWA",
  free: "WhatsApp Free",
  paid: "WhatsApp Paid",
  email: "Email",
};

/** Built-in placeholders for notification subject and message. */
export const SYSTEM_VARIABLES = [
  { key: "user_name", label: "Recipient name" },
  { key: "module_label", label: "Module" },
  { key: "action_label", label: "Action (Add, Edit, Delete, Approve)" },
  { key: "record_id", label: "Record ID" },
  { key: "ref", label: "Activity ref (packing/doc no.)" },
  { key: "summary", label: "Activity summary line" },
  { key: "actor_name", label: "Done by" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "datetime", label: "Date & time" },
  { key: "template_name", label: "Template name" },
];

/** Default copy when opening a new module notification template (all modules). */
export const DEFAULT_MODULE_NOTIFY_SUBJECT = "{{module_label}} — {{action_label}}";

export const DEFAULT_MODULE_NOTIFY_MESSAGE = `Hi {{user_name}},

{{module_label}} was {{action_label}} (ref: {{record_id}}).

By: {{actor_name}}
{{datetime}}`;

export const EVENT_BADGE_TONE = {
  add: "bg-emerald-50 text-emerald-700 border-emerald-200",
  edit: "bg-sky-50 text-sky-700 border-sky-200",
  delete: "bg-rose-50 text-rose-700 border-rose-200",
  approve: "bg-violet-50 text-violet-700 border-violet-200",
};
