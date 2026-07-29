import { api } from "@/platform/api/apiClient";
import { CORE_ENDPOINTS as ENDPOINTS } from "@/platform/api/endpoints";

export const permissionService = {
  getAll: (params) => api(ENDPOINTS.PERMISSIONS.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.PERMISSIONS.GET, { method: "POST", body: { id } }),
  set: (data) => api(ENDPOINTS.PERMISSIONS.SET, { method: "POST", body: data }),
  setBulk: (user_id, permissions) => api(ENDPOINTS.PERMISSIONS.SET_BULK, { method: "POST", body: { user_id, permissions } }),
  update: (data) => api(ENDPOINTS.PERMISSIONS.UPDATE, { method: "POST", body: data }),
  remove: (params) => api(ENDPOINTS.PERMISSIONS.REMOVE, { method: "POST", body: params }),
};

