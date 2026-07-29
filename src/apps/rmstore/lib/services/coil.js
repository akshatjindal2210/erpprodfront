import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const coilService = {
  getAll: (params) => api(ENDPOINTS.COIL.LIST, { method: "POST", body: params }),
  getByUid: (coil_no_uid) => api(ENDPOINTS.COIL.GET, { method: "POST", body: { coil_no_uid } }),
};
