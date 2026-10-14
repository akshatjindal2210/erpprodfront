import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

/** Same API shape for any mount of the production table (RM Store Item RM Master, Engineering Prime Item Master). */
export function createProductionService(EP) {
  return {
    getAll: (params) => api(EP.LIST, { method: "POST", body: params }),
    getById: (production_id) => api(EP.GET, { method: "POST", body: { production_id } }),
    create: (data) => api(EP.CREATE, { method: "POST", body: data }),
    update: (production_id, data) => api(EP.UPDATE, { method: "POST", body: { production_id, ...data } }),
    delete: (production_id) => api(EP.DELETE, { method: "POST", body: { production_id } }),
  };
}

function viewsCall(url) {
  return async (params = {}) => {
    const { permission_module, permission_action = "view", ...rest } = params;
    if (!permission_module) {
      return { success: false, message: "permission_module required", data: [], total: 0 };
    }
    return api(url, { method: "POST", body: { permission_module, permission_action, ...rest } });
  };
}

const byIdCall = (url) => (id, perms = {}) => api(url, { method: "POST", body: { id, ...perms } });

export function createProductionErpHelpers(EP) {
  return {
    getProductionItemsViews: viewsCall(EP.PRODUCTION_ITEMS_VIEWS),
    getProductionItemViewById: byIdCall(EP.PRODUCTION_ITEMS_VIEWS),
    getRmItemsViews: viewsCall(EP.RM_ITEMS_VIEWS),
    getRmItemViewById: byIdCall(EP.RM_ITEMS_VIEWS),
    getPrdRunJcViews: viewsCall(EP.PRD_RUN_JC_VIEWS),
    getPrdRunJcViewById: byIdCall(EP.PRD_RUN_JC_VIEWS),
  };
}

export const productionService = createProductionService(ENDPOINTS.PRODUCTION);
export const productionErpHelpers = createProductionErpHelpers(ENDPOINTS.PRODUCTION);
