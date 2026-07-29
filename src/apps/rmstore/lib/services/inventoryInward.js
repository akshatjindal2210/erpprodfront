import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const inventoryInwardService = {
  getAll: (params) => api(ENDPOINTS.INVENTORY_INWARDS.LIST, { method: "POST", body: params }),
  getPackingAreaList: (params) => api(ENDPOINTS.INVENTORY_INWARDS.PACKING_AREA_LIST, { method: "POST", body: params }),
  getCoilArea: (params) => api(ENDPOINTS.INVENTORY_INWARDS.COIL_AREA, { method: "POST", body: params }),
  getById: (in_uid) => api(ENDPOINTS.INVENTORY_INWARDS.GET, { method: "POST", body: { in_uid } }),
  create: (data) => api(ENDPOINTS.INVENTORY_INWARDS.CREATE, { method: "POST", body: data }),
  update: (in_uid, data) => api(ENDPOINTS.INVENTORY_INWARDS.UPDATE, { method: "POST", body: { in_uid, ...data } }),
  approve: (in_uid, data = {}) => api(ENDPOINTS.INVENTORY_INWARDS.APPROVE, { method: "POST", body: { in_uid, approved: true, ...data } }),
  delete: (in_uid) => api(ENDPOINTS.INVENTORY_INWARDS.DELETE, { method: "POST", body: { in_uid } }),
};
