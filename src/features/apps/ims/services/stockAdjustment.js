import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";
import { imsApiViews } from "@/features/apps/ims/helpers/sortDropdownResponse";

export const stockAdjustmentService = {
  getAll: (params) => api(ENDPOINTS.STOCK_ADJUSTMENT.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.STOCK_ADJUSTMENT.GET, { method: "POST", body: { id } }),
  getPackingMeta: (body) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.PACKING_META, { method: "POST", body }),
  create: (data) => api(ENDPOINTS.STOCK_ADJUSTMENT.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.STOCK_ADJUSTMENT.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(ENDPOINTS.STOCK_ADJUSTMENT.DELETE, { method: "POST", body: { id } }),
  getViews: (params) => imsApiViews(ENDPOINTS.STOCK_ADJUSTMENT.VIEWS, params),
  getViewById: (id, perms = {}) => api(ENDPOINTS.STOCK_ADJUSTMENT.VIEWS, { method: "POST", body: { id, ...perms } }),
};

