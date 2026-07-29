import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const stockAdjustmentService = {
  getAll: (params) => api(ENDPOINTS.STOCK_ADJUSTMENT.LIST, { method: "POST", body: params }),
  getById: (adjustment_id) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.GET, { method: "POST", body: { adjustment_id } }),
  getActiveCoils: (params) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.ACTIVE_COILS, { method: "POST", body: params }),
  create: (data) => api(ENDPOINTS.STOCK_ADJUSTMENT.CREATE, { method: "POST", body: data }),
  update: (adjustment_id, data) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.UPDATE, { method: "POST", body: { adjustment_id, ...data } }),
  delete: (adjustment_id) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.DELETE, { method: "POST", body: { adjustment_id } }),
  renderSingleSticker: (body) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.STICKER_RENDER_SINGLE, { method: "POST", body }),
  renderBulkStickers: (body) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.STICKER_RENDER_BULK, { method: "POST", body }),
};
