import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const productionService = {
  getAll: (params) => api(ENDPOINTS.PRODUCTION.LIST, { method: "POST", body: params }),
  getById: (production_id) => api(ENDPOINTS.PRODUCTION.GET, { method: "POST", body: { production_id } }),
  create: (data) => api(ENDPOINTS.PRODUCTION.CREATE, { method: "POST", body: data }),
  update: (production_id, data) => api(ENDPOINTS.PRODUCTION.UPDATE, { method: "POST", body: { production_id, ...data } }),
  delete: (production_id) => api(ENDPOINTS.PRODUCTION.DELETE, { method: "POST", body: { production_id } }),
};

export const productionErpHelpers = {
  getProductionItemsViews: async (params = {}) => {
    const { permission_module, permission_action = "view", ...rest } = params;
    if (!permission_module) {
      return { success: false, message: "permission_module required", data: [], total: 0 };
    }
    return api(ENDPOINTS.PRODUCTION.PRODUCTION_ITEMS_VIEWS, {
      method: "POST",
      body: { permission_module, permission_action, ...rest },
    });
  },
  getProductionItemViewById: (id, perms = {}) =>  
    api(ENDPOINTS.PRODUCTION.PRODUCTION_ITEMS_VIEWS, {
      method: "POST",
      body: { id, ...perms },
    }),
  getRmItemsViews: async (params = {}) => {
    const { permission_module, permission_action = "view", ...rest } = params;
    if (!permission_module) {
      return { success: false, message: "permission_module required", data: [], total: 0 };
    }
    return api(ENDPOINTS.PRODUCTION.RM_ITEMS_VIEWS, {
      method: "POST",
      body: { permission_module, permission_action, ...rest },
    });
  },
  getRmItemViewById: (id, perms = {}) =>
    api(ENDPOINTS.PRODUCTION.RM_ITEMS_VIEWS, {
      method: "POST",
      body: { id, ...perms },
    }),
  getPrdRunJcViews: async (params = {}) => {
    const { permission_module, permission_action = "view", ...rest } = params;
    if (!permission_module) {
      return { success: false, message: "permission_module required", data: [], total: 0 };
    }
    return api(ENDPOINTS.PRODUCTION.PRD_RUN_JC_VIEWS, {
      method: "POST",
      body: { permission_module, permission_action, ...rest },
    });
  },
  getPrdRunJcViewById: (id, perms = {}) =>
    api(ENDPOINTS.PRODUCTION.PRD_RUN_JC_VIEWS, {
      method: "POST",
      body: { id, ...perms },
    }),
};
