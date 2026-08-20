/**
 * In-process Request service.
 * One module, three request types:
 *   rejection → approved rows queue for Store Out
 *   store_in  → authorize queues pending; receive updates same coil to Unassigned Area
 *   consume   → approval marks the coils consumed and out of stock (no queue)
 */

import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

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

/** Same 3 labels — filter dropdown and table Type column (line 1). */
export const IPR_REQUEST_TYPE_LABEL = {
  [IPR_REQUEST_TYPE.REJECTION]: "In-process Rejection",
  [IPR_REQUEST_TYPE.STORE_IN]: "Store In Request",
  [IPR_REQUEST_TYPE.CONSUME]: "Update Coil Status",
  [IPR_REQUEST_TYPE.TRANSFER]: "Transfer Coil",
};

/** Soft badge — request type (table Type column, line 1). */
export const IPR_TYPE_BADGE_CLASS = {
  [IPR_REQUEST_TYPE.REJECTION]: "bg-rose-50 text-rose-800 border-rose-200",
  [IPR_REQUEST_TYPE.STORE_IN]: "bg-teal-50 text-teal-800 border-teal-200",
  [IPR_REQUEST_TYPE.CONSUME]: "bg-amber-50 text-amber-800 border-amber-200",
  [IPR_REQUEST_TYPE.TRANSFER]: "bg-indigo-50 text-indigo-800 border-indigo-200",
};

/** Coil / lot — table Type column line 2 (rejection only). */
export const IPR_REJECTION_SCOPE_LABEL = {
  coil: "Coil",
  lot: "Lot",
};

export function getIprTypeDisplay(row = {}) {
  const type = row.request_type || IPR_REQUEST_TYPE.REJECTION;
  return {
    label: IPR_REQUEST_TYPE_LABEL[type] || IPR_REQUEST_TYPE_LABEL[IPR_REQUEST_TYPE.REJECTION],
    className: IPR_TYPE_BADGE_CLASS[type] || IPR_TYPE_BADGE_CLASS[IPR_REQUEST_TYPE.REJECTION],
  };
}

export function matchesIprTypeFilter(row, filterValue) {
  if (!filterValue || filterValue === "all") return true;
  return (row?.request_type || IPR_REQUEST_TYPE.REJECTION) === filterValue;
}

export const IPR_REQUEST_TYPE_FILTER_OPTIONS = [
  { label: "All Types", value: "all" },
  { label: IPR_REQUEST_TYPE_LABEL[IPR_REQUEST_TYPE.REJECTION], value: IPR_REQUEST_TYPE.REJECTION },
  // { label: IPR_REQUEST_TYPE_LABEL[IPR_REQUEST_TYPE.STORE_IN], value: IPR_REQUEST_TYPE.STORE_IN },
  { label: IPR_REQUEST_TYPE_LABEL[IPR_REQUEST_TYPE.CONSUME], value: IPR_REQUEST_TYPE.CONSUME },
];

const E = ENDPOINTS.IN_PROCESS_REQUEST;

export const inProcessRequestService = {
  coilHelper: (coil_no_uid) => api(ENDPOINTS.IN_PROCESS_REQUEST.COIL_HELPER, { method: "POST", body: { coil_no_uid } }),
  getAll: (params) => api(E.LIST, { method: "POST", body: params }),
  getById: (ipr_uid) => api(E.GET, { method: "POST", body: { ipr_uid } }),
  getByHelper: (ipr_uid, permissions = {}) => api(E.HELPER, { method: "POST", body: { ipr_uid, ...permissions } }),

  /** Distinct reasons used before — powers the reason suggest field. */
  getReasons: (params = {}) => api(E.REASONS, { method: "POST", body: params }),

  /** Approved store-in requests waiting to be processed on Store In. */
  getPendingStoreIn: () => api(E.PENDING_STORE_IN, { method: "POST", body: {} }),

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
