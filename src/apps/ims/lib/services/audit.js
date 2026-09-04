import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";

export const auditService = {
  getAll: (params) => api(ENDPOINTS.AUDIT.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.AUDIT.GET, { method: "POST", body: { id } }),
  create: (data) => api(ENDPOINTS.AUDIT.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.AUDIT.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(ENDPOINTS.AUDIT.DELETE, { method: "POST", body: { id } }),
  submitScan: (data) => api(ENDPOINTS.AUDIT.SUBMIT_SCAN, { method: "POST", body: data }),
  startLocation: (data) => api(ENDPOINTS.AUDIT.START_LOCATION, { method: "POST", body: data }),
  removeScan: (data) => api(ENDPOINTS.AUDIT.REMOVE_SCAN, { method: "POST", body: data }),
  getComparisonReport: (id, locationId = null) =>
    api(ENDPOINTS.AUDIT.COMPARISON_REPORT, {
      method: "POST",
      body: { id, ...(locationId != null ? { location_id: locationId } : {}) },
    }),
  applyComparisonAdjustment: ({ audit_id, location_id = null, result_rejected = false }) =>
    api(ENDPOINTS.AUDIT.COMPARISON_ADJUSTMENT, {
      method: "POST",
      body: {
        audit_id,
        ...(location_id != null ? { location_id } : {}),
        result_rejected: Boolean(result_rejected),
      },
    }),
  completeLocation: ({ audit_id, location_id, result_rejected = false }) =>
    api(ENDPOINTS.AUDIT.COMPLETE_LOCATION, {
      method: "POST",
      body: { audit_id, location_id, result_rejected: Boolean(result_rejected) },
    }),
  getScores: (audit_id) => api(ENDPOINTS.AUDIT.SCORES, { method: "POST", body: { audit_id } }),
  reopenLocation: (data) => api(ENDPOINTS.AUDIT.REOPEN_LOCATION, { method: "POST", body: data }),
  reassignLocation: (data) => api(ENDPOINTS.AUDIT.REASSIGN_LOCATION, { method: "POST", body: data }),
  verify: (id) => api(ENDPOINTS.AUDIT.VERIFY, { method: "POST", body: { id } }),
};
