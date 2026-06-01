import { api } from "@/core/api/apiClient";
import { CORE_ENDPOINTS as ENDPOINTS } from "@/core/api/endpoints";

export const designationService = {
  getAll: (params) => api(ENDPOINTS.DESIGNATIONS.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.DESIGNATIONS.GET, { method: "POST", body: { id } }),
  create: (data) => api(ENDPOINTS.DESIGNATIONS.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.DESIGNATIONS.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(ENDPOINTS.DESIGNATIONS.DELETE, { method: "POST", body: { id } }),
  getViews: (body = {}) => api(ENDPOINTS.DESIGNATIONS.HELPER, { method: "POST", body }),
};

