import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";

export const auditService = {
  getAll: (params) => api(ENDPOINTS.AUDIT.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.AUDIT.GET, { method: "POST", body: { id } }),
  create: (data) => api(ENDPOINTS.AUDIT.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.AUDIT.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(ENDPOINTS.AUDIT.DELETE, { method: "POST", body: { id } }),
  submitScan: (data) => api(ENDPOINTS.AUDIT.SUBMIT_SCAN, { method: "POST", body: data }),
  removeScan: (data) => api(ENDPOINTS.AUDIT.REMOVE_SCAN, { method: "POST", body: data }),
  getComparisonReport: (id) => api(ENDPOINTS.AUDIT.COMPARISON_REPORT, { method: "POST", body: { id } }),
  verify: (id) => api(ENDPOINTS.AUDIT.VERIFY, { method: "POST", body: { id } }),
};
