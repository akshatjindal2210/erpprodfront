/**
 * In-process Request service.
 * One module, three request types:
 *   rejection → approved rows queue for Store Out
 *   store_in  → approved rows queue for Store In (with before/after coil snapshot)
 *   consume   → approval marks the coils consumed and out of stock (no queue)
 */

import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const IPR_REQUEST_TYPE = {
  REJECTION: "rejection",
  STORE_IN: "store_in",
  CONSUME: "consume",
};

export const IPR_DOWNSTREAM = {
  NONE: null,
  PENDING_STORE_OUT: "pending_store_out",
  PENDING_STORE_IN: "pending_store_in",
  CONSUMED: "consumed",
};

const E = ENDPOINTS.IN_PROCESS_REQUEST;

export const inProcessRequestService = {
  getAll: (params) => api(E.LIST, { method: "POST", body: params }),
  getById: (ipr_uid) => api(E.GET, { method: "POST", body: { ipr_uid } }),

  /** Distinct reasons used before — powers the reason suggest field. */
  getReasons: (params = {}) => api(E.REASONS, { method: "POST", body: params }),

  /** Approved store-in requests waiting to be processed on Store In. */
  getPendingStoreIn: () => api(E.PENDING_STORE_IN, { method: "POST", body: {} }),

  /** Approved rejection requests waiting on Store Out. */
  getPendingStoreOut: () => api(E.PENDING_STORE_OUT, { method: "POST", body: {} }),

  create: (data) => api(E.CREATE, { method: "POST", body: data }),
  update: (ipr_uid, data) => api(E.UPDATE, { method: "POST", body: { ipr_uid, ...data } }),
  approve: (ipr_uid, data = {}) => api(E.APPROVE, { method: "POST", body: { ipr_uid, ...data } }),
  delete: (ipr_uid) => api(E.DELETE, { method: "POST", body: { ipr_uid } }),
};
