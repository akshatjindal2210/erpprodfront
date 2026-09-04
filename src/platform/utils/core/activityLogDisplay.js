import { ROUTES as RM_ROUTES } from "@/apps/rmstore/lib/utils/routes";
import { ROUTES as IMS_ROUTES } from "@/apps/ims/lib/utils/routes";

const SKIP_KEYS = new Set([
  "success",
  "action",
  "entity",
  "entity_ref",
  "ref",
  "summary",
  "more",
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "created_by",
  "updated_by",
  "deleted_by",
  "password",
  "token",
]);

function parsePayload(data) {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return { raw: data };
    }
  }
  return data;
}

function normalizeQtyForMinus(info) {
  if (!info || typeof info !== "object") return info;
  const type = String(info.Type || info.type || info["Entry type"] || info.entry_type || "").toLowerCase();
  const qtyKey = info.Qty != null ? "Qty" : info.qty != null ? "qty" : null;
  if (!qtyKey || type !== "minus") return info;

  const q = Number(info[qtyKey]);
  if (!Number.isFinite(q)) return info;
  return { ...info, [qtyKey]: String(Math.abs(q)) };
}

function normalizeLegacyStockAdjustment(data) {
  if (!data || typeof data !== "object") return data;
  const out = { ...data };

  if (out.info) out.info = normalizeQtyForMinus(out.info);
  if (out.more) out.more = normalizeQtyForMinus(out.more);

  for (const key of ["details", "delete_context", "update_context", "approval_context", "created_fields", "record"]) {
    if (out[key] && typeof out[key] === "object") {
      const block = { ...out[key] };
      if (String(block.entry_type || block.Type || "").toLowerCase() === "minus" && block.qty != null) {
        const q = Number(block.qty);
        if (Number.isFinite(q)) block.qty = Math.abs(q);
      }
      if (block.Qty != null && String(block.Type || block.entry_type || "").toLowerCase() === "minus") {
        const q = Number(block.Qty);
        if (Number.isFinite(q)) block.Qty = Math.abs(q);
      }
      out[key] = block;
    }
  }

  return out;
}

function renderBlock(block) {
  if (!block || typeof block !== "object") return null;
  const entries = Object.entries(block).filter(([key]) => !SKIP_KEYS.has(key));
  return entries.length ? entries : null;
}

/** Main details — short summary (Type, Qty, Packing, etc.). */
export function getActivityLogSections(data) {
  const payload = normalizeLegacyStockAdjustment(parsePayload(data));
  if (!payload || typeof payload !== "object") return [];

  if (payload.info && typeof payload.info === "object" && Object.keys(payload.info).length) {
    return [{ title: "Summary", data: payload.info, kind: "fields" }];
  }

  const legacyKeys = [
    "deleted_record",
    "created_record",
    "updated_record",
    "approved_record",
    "record",
    "details",
    "delete_context",
    "update_context",
    "approval_context",
    "created_fields",
    "body",
    "meta",
  ];

  const sections = [];
  for (const key of legacyKeys) {
    const value = payload[key];
    if (value == null || typeof value !== "object" || !Object.keys(value).length) continue;
    sections.push({ title: "Summary", data: normalizeQtyForMinus(value), kind: "fields" });
    break;
  }

  if (!sections.length) {
    const fallback = {};
    for (const [key, value] of Object.entries(payload)) {
      if (SKIP_KEYS.has(key)) continue;
      fallback[key] = value;
    }
    if (Object.keys(fallback).length) {
      sections.push({ title: "Summary", data: fallback, kind: "fields" });
    }
  }

  return sections;
}

/** Extra details — shown only when user expands (box ids, remarks, etc.). */
export function getActivityLogMoreSections(data) {
  const payload = normalizeLegacyStockAdjustment(parsePayload(data));
  if (!payload?.more || typeof payload.more !== "object" || !Object.keys(payload.more).length) {
    return [];
  }
  return [{ title: "More details", data: payload.more, kind: "fields" }];
}

export function hasActivityLogDetails(data) {
  const payload = parsePayload(data);
  if (!payload || typeof payload !== "object") return false;
  if (payload.info && Object.keys(payload.info).length) return true;
  if (payload.more && Object.keys(payload.more).length) return true;
  return getActivityLogSections(data).length > 0;
}

const ACTION_LABELS = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  APPROVE: "Approve",
  SUBMIT: "Submit",
  MODIFY: "Update",
  LOCK: "Lock",
  UNLOCK: "Unlock",
};

const ACTION_BADGE_CLASS = {
  CREATE: "bg-indigo-50 text-indigo-600 border-indigo-100",
  UPDATE: "bg-blue-50 text-blue-600 border-blue-100",
  MODIFY: "bg-blue-50 text-blue-600 border-blue-100",
  DELETE: "bg-rose-50 text-rose-600 border-rose-100",
  APPROVE: "bg-emerald-50 text-emerald-600 border-emerald-100",
  SUBMIT: "bg-amber-50 text-amber-700 border-amber-100",
};

const MODULE_LABELS = {
  qc_hold_material: "QC Hold Material",
  stock_adjustment: "Stock Adjustment",
  out_entry: "Out Entry",
  inventory_inwards: "Inventory Inward",
  forwarding_note_master: "Forwarding Note",
  packing_standard: "Packing Standard",
  location_master: "Location Master",
  boxes: "Boxes",
  box_table: "Boxes",
  change_override_customer: "Customer Override",
  ims_box_override_request: "Customer Override",
  activity_logs: "Activity Logs",
  audit: "Audit",
};

export function formatActivityLogActionLabel(action) {
  const key = String(action || "").trim().toUpperCase();
  if (!key) return "—";
  return ACTION_LABELS[key] || key.replace(/_/g, " ");
}

export function getActivityLogActionBadgeClass(action) {
  const key = String(action || "").trim().toUpperCase();
  return ACTION_BADGE_CLASS[key] || "bg-slate-50 text-slate-600 border-slate-100";
}

export function formatActivityLogModuleLabel(module) {
  const key = String(module || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!key) return "—";
  return MODULE_LABELS[key] || key.replace(/_/g, " ");
}

/** Event chip from log_data.info.Event (e.g. Partial submit awaiting approval). */
export function getActivityLogEventLabel(data) {
  const payload = parsePayload(data);
  const event = payload?.info?.Event ?? payload?.info?.event ?? null;
  if (event == null || String(event).trim() === "") return null;
  return String(event).trim();
}

function formatObjectRef(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ref =
    value.coil_no_uid ??
    value.box_uid ??
    value.box_no_uid ??
    value.uid ??
    value.id;
  if (ref != null && String(ref).trim() !== "") return String(ref).trim();
  return null;
}

export function formatActivityLogValue(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    const parts = value
      .map((item) => {
        if (item == null || item === "") return null;
        if (typeof item === "object") return formatObjectRef(item);
        const text = String(item).trim();
        return text && text !== "[object Object]" ? text : null;
      })
      .filter(Boolean);
    if (parts.length) return parts.join(", ");
    return `${value.length} item(s)`;
  }
  if (typeof value === "object") {
    if (value.from !== undefined || value.to !== undefined) {
      return `${formatActivityLogValue(value.from)} → ${formatActivityLogValue(value.to)}`;
    }
    return formatObjectRef(value) || "—";
  }
  const text = String(value);
  return text === "[object Object]" ? "—" : text;
}

/** Module/Entity REF: entity_id, else log_data.ref. */
export function resolveActivityLogRef(row) {
  const direct = row?.entity_id;
  if (direct != null && String(direct).trim() !== "") return String(direct).trim();
  const payload = parsePayload(row?.log_data);
  const ref = payload?.ref;
  if (ref != null && String(ref).trim() !== "") return String(ref).trim();
  return null;
}

export function renderActivityLogFields(data) {
  return renderBlock(data);
}

// ─── Activity log REF → module list page (navigation only, no URL params) ───

const TASK_BASE = "/task/dashboard";

function normalizeActivityModuleKey(module) {
  return String(module ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const RMSTORE_MODULE_ROUTES = {
  rm_production_master: RM_ROUTES.RM_PRODUCTION_MASTER,
  rm_spec_master: RM_ROUTES.RM_SPEC_MASTER,
  rm_store_location_master: RM_ROUTES.RM_STORE_LOCATION_MASTER,
  rm_mrn_portal: RM_ROUTES.RM_MRN_PORTAL,
  mrn_portal: RM_ROUTES.RM_MRN_PORTAL,
  rm_coils: RM_ROUTES.RM_COIL_TABLE,
  rm_inventory_inwards: RM_ROUTES.RM_STORE_IN,
  inventory_inward: RM_ROUTES.RM_STORE_IN,
  inventory_inwards: RM_ROUTES.RM_STORE_IN,
  rm_qc_check: RM_ROUTES.RM_QC_CHECK,
  qc_check: RM_ROUTES.RM_QC_CHECK,
  rm_rejection: RM_ROUTES.RM_REJECTION,
  rm_out_entry: RM_ROUTES.RM_STORE_OUT,
  out_entry: RM_ROUTES.RM_STORE_OUT,
  rm_issue_request: RM_ROUTES.RM_ISSUE_REQUEST,
  issue_request: RM_ROUTES.RM_ISSUE_REQUEST,
  rm_in_process_request: RM_ROUTES.RM_IN_PROCESS_REQUEST,
  in_process_request: RM_ROUTES.RM_IN_PROCESS_REQUEST,
  rm_stock_adjustment: RM_ROUTES.RM_STOCK_ADJUSTMENT,
  stock_adjustment: RM_ROUTES.RM_STOCK_ADJUSTMENT,
  rm_inventory_report: RM_ROUTES.RM_INVENTORY_REPORT,
};

const IMS_MODULE_ROUTES = {
  product_master: IMS_ROUTES.PRODUCT_MASTER,
  customer_master: IMS_ROUTES.CUSTOMER_MASTER,
  customer_item_code: IMS_ROUTES.CUSTOMER_ITEM_CODE,
  packing_standard: IMS_ROUTES.PACKING_STANDARD,
  packing_entry: IMS_ROUTES.PACKING_ENTRY,
  location_master: IMS_ROUTES.LOCATION_MASTER,
  boxes: IMS_ROUTES.BOX_TABLE,
  box: IMS_ROUTES.BOX_TABLE,
  inventory_inwards: IMS_ROUTES.INVENTORY_INWARD,
  inventory_inward: IMS_ROUTES.INVENTORY_INWARD,
  forwarding_note_master: IMS_ROUTES.FORWARDING_NOTE,
  out_entry: IMS_ROUTES.OUT_ENTRY,
  ims_out_entry: IMS_ROUTES.OUT_ENTRY,
  stock_adjustment: IMS_ROUTES.STOCK_ADJUSTMENT,
  ims_stock_adjustment: IMS_ROUTES.STOCK_ADJUSTMENT,
  change_override_customer: IMS_ROUTES.STICKER_OVERRIDE,
  qc_hold_material: IMS_ROUTES.QC_HOLD_MATERIAL,
  schedule_planning: IMS_ROUTES.SCHEDULE_PLANNING,
  inventory_report: IMS_ROUTES.ANALYTICS,
  erp_stock_report: IMS_ROUTES.ERP_STOCK_REPORT,
  audit: IMS_ROUTES.AUDIT,
};

const TASK_MODULE_ROUTES = {
  cl_task_master: `${TASK_BASE}/cl-task`,
  cl_task: `${TASK_BASE}/cl-tasks`,
  cl_tasks: `${TASK_BASE}/cl-tasks`,
  cl_task_verification: `${TASK_BASE}/cl-task/verification`,
  task_report: `${TASK_BASE}/cl-task/report`,
  red_ticket: `${TASK_BASE}/red-ticket`,
  category: `${TASK_BASE}/category`,
  holiday: `${TASK_BASE}/holidays`,
  holidays: `${TASK_BASE}/holidays`,
  tasks: `${TASK_BASE}/tasks`,
  recurring_task: `${TASK_BASE}/recurring-task`,
};

function moduleRouteMap(appType) {
  const app = String(appType ?? "").trim().toLowerCase();
  if (app === "rmstore") return RMSTORE_MODULE_ROUTES;
  if (app === "ims") return IMS_MODULE_ROUTES;
  if (app === "task") return TASK_MODULE_ROUTES;
  return null;
}

export function resolveActivityLogEntityHref(appType, module) {
  const key = normalizeActivityModuleKey(module);
  return moduleRouteMap(appType)?.[key] ?? null;
}
