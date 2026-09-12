import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/template/lib/config/endpoints";

export const recordService = {
  getAll: (params) => api(ENDPOINTS.RECORDS.LIST, { method: "POST", body: params }),
  getById: (record_id) => api(ENDPOINTS.RECORDS.GET, { method: "POST", body: { record_id } }),
  create: (data) => api(ENDPOINTS.RECORDS.CREATE, { method: "POST", body: data }),
  update: (record_id, data) => api(ENDPOINTS.RECORDS.UPDATE, { method: "POST", body: { record_id, ...data } }),
  delete: (record_id) => api(ENDPOINTS.RECORDS.DELETE, { method: "POST", body: { record_id } }),
  getViews: (params) => api(ENDPOINTS.RECORDS.HELPER, { method: "POST", body: params }),
};
