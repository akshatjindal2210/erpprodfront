import { api } from "@/platform/api/apiClient";
import { CORE_ENDPOINTS as ENDPOINTS } from "@/platform/api/endpoints";

export const attributeService = {
  getAll: (params) => api(ENDPOINTS.ATTRIBUTES.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.ATTRIBUTES.GET, { method: "POST", body: { id } }),
  create: (data) => api(ENDPOINTS.ATTRIBUTES.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.ATTRIBUTES.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(ENDPOINTS.ATTRIBUTES.DELETE, { method: "POST", body: { id } }),
  getViews: (body = {}) => api(ENDPOINTS.ATTRIBUTES.HELPER, { method: "POST", body }),
};
