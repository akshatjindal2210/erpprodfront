import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const specService = {
  getAll: (params) => api(ENDPOINTS.SPEC.LIST, { method: "POST", body: params }),
  getByItem: (item_dcode) => api(ENDPOINTS.SPEC.GET, { method: "POST", body: { item_dcode } }),
  create: (data) => api(ENDPOINTS.SPEC.CREATE, { method: "POST", body: data }),
  update: (item_dcode, data) => api(ENDPOINTS.SPEC.UPDATE, { method: "POST", body: { item_dcode, ...data } }),
  delete: (item_dcode) => api(ENDPOINTS.SPEC.DELETE, { method: "POST", body: { item_dcode } }),
};
