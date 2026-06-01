import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";

export const inventoryInwardService = {
  getAll:  (params) => api(ENDPOINTS.INVENTORY_INWARDS.LIST,   { method: "POST", body: params }),
  getPackingAreaList: (params) => api(ENDPOINTS.INVENTORY_INWARDS.PACKING_AREA_LIST, { method: "POST", body: params }),
  getPackingAreaBoxes: (params) => api(ENDPOINTS.INVENTORY_INWARDS.PACKING_AREA_BOXES, { method: "POST", body: params }),
  getById: (in_uid) => api(ENDPOINTS.INVENTORY_INWARDS.GET, { method: "POST", body: { in_uid } }),
  create:  (data) => api(ENDPOINTS.INVENTORY_INWARDS.CREATE, { method: "POST", body: data }),
  update:  (in_uid, data) => api(ENDPOINTS.INVENTORY_INWARDS.UPDATE, { method: "POST", body: { in_uid, ...data } }),
  delete:  (in_uid) => api(ENDPOINTS.INVENTORY_INWARDS.DELETE, { method: "POST", body: { in_uid } }),
  getViews: (params) => api(ENDPOINTS.INVENTORY_INWARDS.VIEWS, { method: "POST", body: params }),
  getViewById: (id, perms = {}) => api(ENDPOINTS.INVENTORY_INWARDS.VIEWS, { method: "POST", body: { id, ...perms } }),
  validateBoxAtLocation: (location_id, box_no_uid) =>
    api(ENDPOINTS.INVENTORY_INWARDS.VALIDATE_BOX_LOCATION, {
      method: "POST",
      body: { location_id, box_no_uid },
    }),
  batchScanBoxes: (location_id, items) =>
    api(ENDPOINTS.INVENTORY_INWARDS.BATCH_SCAN_BOXES, {
      method: "POST",
      body: { location_id, items },
    }),
};
