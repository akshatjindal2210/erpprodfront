import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const permissionService = {
  getAll: (params) => api(ENDPOINTS.PERMISSIONS.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.PERMISSIONS.GET, { method: "POST", body: { id } }),
  create: (data) => api(ENDPOINTS.PERMISSIONS.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.PERMISSIONS.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(ENDPOINTS.PERMISSIONS.DELETE, { method: "POST", body: { id } }),
  bulkCreate: (data) => api(ENDPOINTS.PERMISSIONS.BULK_CREATE, { method: "POST", body: data })
};
