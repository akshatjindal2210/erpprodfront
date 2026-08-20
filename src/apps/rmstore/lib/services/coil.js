import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const coilService = {
  getAll: (params) => api(ENDPOINTS.COIL.LIST, { method: "POST", body: params }),
  getByUid: (coil_no_uid) => api(ENDPOINTS.COIL.GET, { method: "POST", body: { coil_no_uid } }),
  /**
   * Coil lookup helper — requires permission_module + permission_action in body.
   * Pass coil_no_uid for single coil, or list params (filters, page, limit, search).
   */
  getViews: (params) => {
    const { permission_module, permission_action = "view", ...rest } = params || {};
    if (!permission_module) {
      return Promise.resolve({
        success: false,
        message: "permission_module required",
        data: null,
        total: 0,
      });
    }
    return api(ENDPOINTS.COIL.VIEWS, {
      method: "POST",
      body: { permission_module, permission_action, ...rest },
    });
  },
  /** QC / coil report HTML for same-page browser print. */
  finderReport: (body) => api(ENDPOINTS.COIL.FINDER_REPORT, { method: "POST", body }),
};
