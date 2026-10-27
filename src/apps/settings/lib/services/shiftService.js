import { api } from "@/platform/api/apiClient";
import { CORE_ENDPOINTS as ENDPOINTS } from "@/platform/api/endpoints";

export const shiftService = {
  getAll: (params) => api(ENDPOINTS.SHIFTS.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.SHIFTS.GET, { method: "POST", body: { id } }),
  create: (data) => api(ENDPOINTS.SHIFTS.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.SHIFTS.UPDATE, { method: "POST", body: { id, ...data } }),
  toggleStatus: (id) => api(ENDPOINTS.SHIFTS.TOGGLE_STATUS, { method: "POST", body: { id } }),
  delete: (id) => api(ENDPOINTS.SHIFTS.DELETE, { method: "POST", body: { id } }),
};
