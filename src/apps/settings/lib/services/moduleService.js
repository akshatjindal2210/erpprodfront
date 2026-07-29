import { api } from "@/platform/api/apiClient";
import { CORE_ENDPOINTS as ENDPOINTS } from "@/platform/api/endpoints";

export const moduleService = {
  getAll: (params) => api(ENDPOINTS.MODULES.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.MODULES.GET, { method: "POST", body: { id } }),
  create: (data) => api(ENDPOINTS.MODULES.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.MODULES.UPDATE, { method: "POST", body: { id, ...data } }),
  toggleStatus: (id) => api(ENDPOINTS.MODULES.TOGGLE_STATUS, { method: "POST", body: { id } }),
  getViews: (params) => api(ENDPOINTS.MODULES.VIEWS, { method: "POST", body: params }),
  getViewById: (id, perms = {}) =>
    api(ENDPOINTS.MODULES.VIEWS, { method: "POST", body: { id, ...perms } }),
};

/** Alias for permission/training pickers. */
export const settingsModuleService = moduleService;

