/**
 * In-process Request service.
 * Canonical DB `type`: consume | return | reassign | reject_coil | reject_lot
 * Legacy `request_type` still returned for older modal flows.
 */

import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

/** Canonical row type (DB `type`) — prefer this for list Type column. */
export const IPR_TYPE = {
  CONSUME: "consume",
  RETURN: "return",
  REASSIGN: "reassign",
  COIL: "reject_coil",
  LOT: "reject_lot",
};

const LEGACY_TYPE_MAP = {
  coil: IPR_TYPE.COIL,
  lot: IPR_TYPE.LOT,
};

/** Legacy FE request_type aliases (modal / older payloads). */
export const IPR_REQUEST_TYPE = {
  REJECTION: "rejection",
  STORE_IN: "store_in",
  CONSUME: "consume",
  TRANSFER: "transfer",
};

export const IPR_DOWNSTREAM = {
  NONE: null,
  PENDING_STORE_OUT: "pending_store_out",
  PENDING_STORE_IN: "pending_store_in",
  CONSUMED: "consumed",
  TRANSFER_PENDING: "transfer_pending",
  STORE_IN_DONE: "store_in_done",
  STORE_OUT_DONE: "store_out_done",
};

/** Canonical type labels — Register/Pending Type column. */
export const IPR_TYPE_LABEL = {
  [IPR_TYPE.CONSUME]: "Consume",
  [IPR_TYPE.RETURN]: "Store In",
  [IPR_TYPE.REASSIGN]: "Reassign",
  [IPR_TYPE.COIL]: "Reject Coil",
  [IPR_TYPE.LOT]: "Reject Lot",
};

export const IPR_TYPE_BADGE_CLASS = {
  [IPR_TYPE.CONSUME]: "bg-amber-50 text-amber-800 border-amber-200",
  [IPR_TYPE.RETURN]: "bg-teal-50 text-teal-800 border-teal-200",
  [IPR_TYPE.REASSIGN]: "bg-indigo-50 text-indigo-800 border-indigo-200",
  [IPR_TYPE.COIL]: "bg-rose-50 text-rose-800 border-rose-200",
  [IPR_TYPE.LOT]: "bg-amber-50 text-amber-900 border-amber-300",
};

/** @deprecated use IPR_TYPE_LABEL — kept for modal titles */
export const IPR_REQUEST_TYPE_LABEL = {
  [IPR_REQUEST_TYPE.REJECTION]: "In-process Rejection",
  [IPR_REQUEST_TYPE.STORE_IN]: "Store In Request",
  [IPR_REQUEST_TYPE.CONSUME]: "Update Coil Status",
  [IPR_REQUEST_TYPE.TRANSFER]: "Transfer Coil",
};

/** @deprecated scope badges — Type column shows Reject Coil / Reject Lot directly */
export const IPR_REJECTION_SCOPE_LABEL = {
  coil: "Coil",
  lot: "Lot",
  [IPR_TYPE.COIL]: "Coil",
  [IPR_TYPE.LOT]: "Lot",
};

function normalizeIprType(value) {
  const t = String(value || "").trim().toLowerCase();
  if (Object.values(IPR_TYPE).includes(t)) return t;
  return LEGACY_TYPE_MAP[t] || null;
}

export function isIprRejectionType(type) {
  const t = normalizeIprType(type);
  return t === IPR_TYPE.COIL || t === IPR_TYPE.LOT;
}

/** Resolve canonical type from API row (prefers `type`). */
export function resolveIprCanonicalType(row = {}) {
  // Reassign header/flag wins even if type was saved as consume.
  if (String(row?.reassign_jc || "").trim()) return IPR_TYPE.REASSIGN;
  const coils = Array.isArray(row?.coils) ? row.coils : [];
  if (coils.some((c) => c?.reassign === true)) return IPR_TYPE.REASSIGN;

  const fromType = normalizeIprType(row?.type);
  if (fromType) return fromType;
  const rt = String(row?.request_type || "").trim().toLowerCase();
  if (rt === IPR_REQUEST_TYPE.STORE_IN) return IPR_TYPE.RETURN;
  if (rt === IPR_REQUEST_TYPE.REJECTION) {
    return row?.rejection_type === "lot" ? IPR_TYPE.LOT : IPR_TYPE.COIL;
  }
  if (rt === IPR_REQUEST_TYPE.CONSUME || rt === IPR_REQUEST_TYPE.TRANSFER) {
    return IPR_TYPE.CONSUME;
  }
  return IPR_TYPE.COIL;
}

/**
 * Type column display.
 * Update Coil Status "Return" is still request_type=consume in DB (balance → Store In),
 * so map consume + store-in balance stage to Return for the badge.
 */
export function getIprTypeDisplay(row = {}) {
  const canonical = resolveIprCanonicalType(row);
  let type = canonical;
  let label = IPR_TYPE_LABEL[type] || IPR_TYPE_LABEL[IPR_TYPE.COIL];

  if (canonical === IPR_TYPE.CONSUME) {
    const stage = String(row?.stage || row?.downstream || "").trim();
    const balStatus = String(row?.balance_status || "").trim().toLowerCase();
    if (
      stage === IPR_DOWNSTREAM.PENDING_STORE_IN ||
      stage === IPR_DOWNSTREAM.STORE_IN_DONE ||
      balStatus === "balance"
    ) {
      type = IPR_TYPE.RETURN;
      label = "Return";
    }
  }

  return {
    type,
    label,
    className: IPR_TYPE_BADGE_CLASS[type] || IPR_TYPE_BADGE_CLASS[IPR_TYPE.COIL],
  };
}

export function matchesIprTypeFilter(row, filterValue) {
  if (!filterValue || filterValue === "all") return true;
  if (filterValue === IPR_REQUEST_TYPE.REJECTION) {
    return isIprRejectionType(resolveIprCanonicalType(row));
  }
  // Filter "return" matches pure store-in + consume-with-store-in-balance rows.
  if (filterValue === IPR_TYPE.RETURN || filterValue === IPR_REQUEST_TYPE.STORE_IN) {
    return getIprTypeDisplay(row).type === IPR_TYPE.RETURN;
  }
  return getIprTypeDisplay(row).type === filterValue || resolveIprCanonicalType(row) === filterValue;
}

/** Register Request Type filter — maps to DB `type` / legacy request_type. */
export const IPR_REQUEST_TYPE_FILTER_OPTIONS = [
  { label: "All Types", value: "all" },
  { label: "Reject Coil", value: IPR_TYPE.COIL },
  { label: "Reject Lot", value: IPR_TYPE.LOT },
  { label: "Consume", value: IPR_TYPE.CONSUME },
  { label: "Return", value: IPR_TYPE.RETURN },
  { label: "Reassign", value: IPR_TYPE.REASSIGN },
];

const E = ENDPOINTS.IN_PROCESS_REQUEST;

export const inProcessRequestService = {
  coilHelper: (coil_no_uid) => api(ENDPOINTS.IN_PROCESS_REQUEST.COIL_HELPER, { method: "POST", body: { coil_no_uid } }),
  reassignJobCards: (params = {}) => api(ENDPOINTS.IN_PROCESS_REQUEST.REASSIGN_JOB_CARDS, { method: "POST", body: params }),
  getAll: (params) => api(E.LIST, { method: "POST", body: params }),
  getPendingShopFloor: (params) => api(E.PENDING_SHOP_FLOOR, { method: "POST", body: params }),
  getById: (ipr_uid) => api(E.GET, { method: "POST", body: { ipr_uid } }),
  getByHelper: (ipr_uid, permissions = {}) => api(E.HELPER, { method: "POST", body: { ipr_uid, ...permissions } }),

  /** Distinct reasons used before — powers the reason suggest field. */
  getReasons: (params = {}) => api(E.REASONS, { method: "POST", body: params }),

  /** Approved store-in requests waiting to be processed on Store In. */
  getPendingStoreIn: () => api(E.PENDING_STORE_IN, { method: "POST", body: {} }),
  getPendingStoreInById: (ipr_uid) => api(E.PENDING_STORE_IN_GET, { method: "POST", body: { ipr_uid } }),

  /** Approved rejection requests waiting on Store Out. */
  getPendingStoreOut: () => api(E.PENDING_STORE_OUT, { method: "POST", body: {} }),

  create: (data) => api(E.CREATE, { method: "POST", body: data }),
  update: (ipr_uid, data) => {
    if (data instanceof FormData) {
      data.set("ipr_uid", ipr_uid);
      return api(E.UPDATE, { method: "POST", body: data });
    }
    return api(E.UPDATE, { method: "POST", body: { ipr_uid, ...data } });
  },
  approve: (ipr_uid, data = {}) => {
    if (data instanceof FormData) {
      data.set("ipr_uid", ipr_uid);
      return api(E.APPROVE, { method: "POST", body: data });
    }
    return api(E.APPROVE, { method: "POST", body: { ipr_uid, ...data } });
  },

  /** Receive queued store-in — same coil, return qty, Unassigned Area. */
  completeStoreIn: (ipr_uid, data = {}) => api(E.COMPLETE_STORE_IN, { method: "POST", body: { ipr_uid, ...data } }),

  delete: (ipr_uid) => api(E.DELETE, { method: "POST", body: { ipr_uid } }),
};
