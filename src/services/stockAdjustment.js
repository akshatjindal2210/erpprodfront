import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const stockAdjustmentService = {
  getAll: (params) => api(ENDPOINTS.STOCK_ADJUSTMENT.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.STOCK_ADJUSTMENT.GET, { method: "POST", body: { id } }),
  create: (data) => api(ENDPOINTS.STOCK_ADJUSTMENT.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.STOCK_ADJUSTMENT.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(ENDPOINTS.STOCK_ADJUSTMENT.DELETE, { method: "POST", body: { id } }),
  getViews: (params) => api(ENDPOINTS.STOCK_ADJUSTMENT.VIEWS, { method: "POST", body: params }),
  getViewById: (id, perms = {}) => api(ENDPOINTS.STOCK_ADJUSTMENT.VIEWS, { method: "POST", body: { id, ...perms } }),
};
