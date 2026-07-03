import { api } from "@/core/api/apiClient";
import { CORE_ENDPOINTS as ENDPOINTS } from "@/core/api/endpoints";

export const departmentService = {
  getAll: (params) => api(ENDPOINTS.DEPARTMENTS.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.DEPARTMENTS.GET, { method: "POST", body: { id } }),
  create: (data) => api(ENDPOINTS.DEPARTMENTS.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.DEPARTMENTS.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(ENDPOINTS.DEPARTMENTS.DELETE, { method: "POST", body: { id } }),
  getViews: (body = {}) =>
    api(ENDPOINTS.DEPARTMENTS.HELPER, {
      method: "POST",
      body: {
        permission_module: "departments",
        permission_action: "view",
        ...body,
      },
    }),
};

