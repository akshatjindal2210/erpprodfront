import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const inventoryAuditService = {
  getAll: (params) => api(ENDPOINTS.INVENTORY_AUDIT.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.INVENTORY_AUDIT.GET, { method: "POST", body: { id } }),
  create: (data) => api(ENDPOINTS.INVENTORY_AUDIT.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.INVENTORY_AUDIT.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(ENDPOINTS.INVENTORY_AUDIT.DELETE, { method: "POST", body: { id } }),
  submitScan: (data) => api(ENDPOINTS.INVENTORY_AUDIT.SUBMIT_SCAN, { method: "POST", body: data }),
  startLocation: (data) => api(ENDPOINTS.INVENTORY_AUDIT.START_LOCATION, { method: "POST", body: data }),
  removeScan: (data) => api(ENDPOINTS.INVENTORY_AUDIT.REMOVE_SCAN, { method: "POST", body: data }),
  getComparisonReport: (id, locationId = null) =>
    api(ENDPOINTS.INVENTORY_AUDIT.COMPARISON_REPORT, {
      method: "POST",
      body: { id, ...(locationId != null ? { location_id: locationId } : {}) },
    }),
  applyComparisonAdjustment: ({ audit_id, location_id = null, result_rejected = false }) =>
    api(ENDPOINTS.INVENTORY_AUDIT.COMPARISON_ADJUSTMENT, {
      method: "POST",
      body: {
        audit_id,
        ...(location_id != null ? { location_id } : {}),
        result_rejected: Boolean(result_rejected),
      },
    }),
  completeLocation: ({ audit_id, location_id, result_rejected = false }) =>
    api(ENDPOINTS.INVENTORY_AUDIT.COMPLETE_LOCATION, {
      method: "POST",
      body: { audit_id, location_id, result_rejected: Boolean(result_rejected) },
    }),
  getScores: (audit_id) => api(ENDPOINTS.INVENTORY_AUDIT.SCORES, { method: "POST", body: { audit_id } }),
  reopenLocation: (data) => api(ENDPOINTS.INVENTORY_AUDIT.REOPEN_LOCATION, { method: "POST", body: data }),
  reassignLocation: (data) => api(ENDPOINTS.INVENTORY_AUDIT.REASSIGN_LOCATION, { method: "POST", body: data }),
  verify: (id) => api(ENDPOINTS.INVENTORY_AUDIT.VERIFY, { method: "POST", body: { id } }),
};
