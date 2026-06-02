import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";
import { imsApiViews } from "@/features/apps/ims/helpers/sortDropdownResponse";

export const packingStandardService = {
  getAll:  (params) => api(ENDPOINTS.PACKING_STANDARD.LIST,   { method: "POST", body: params }),
  getById: (standard_id) => api(ENDPOINTS.PACKING_STANDARD.GET, { method: "POST", body: { standard_id } }),
  create:  (data) => api(ENDPOINTS.PACKING_STANDARD.CREATE, { method: "POST", body: data }),
  update:  (standard_id, data) => api(ENDPOINTS.PACKING_STANDARD.UPDATE, { method: "POST", body: { standard_id, ...data } }),
  delete:  (standard_id) => api(ENDPOINTS.PACKING_STANDARD.DELETE, { method: "POST", body: { standard_id } }),
  getViews: (params) => imsApiViews(ENDPOINTS.PACKING_STANDARD.VIEWS, params, "name"),
  getViewById: (id, perms = {}) => api(ENDPOINTS.PACKING_STANDARD.VIEWS, { method: "POST", body: { id, ...perms } }),
};
