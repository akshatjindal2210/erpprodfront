import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

const post = (url, body) => api(url, { method: "POST", body });

/** Helper needs the calling page's `permission_module` + `permission_action`. */
const helper = (body) =>
  body.permission_module && body.permission_action
    ? post(ENDPOINTS.RM_PRODUCT.VIEWS, body)
    : Promise.resolve({ success: false, message: "permission_module and permission_action required", data: [] });

export const rmProductService = {
  getItems: (params = {}) => post(ENDPOINTS.RM_PRODUCT.LIST, params),
  getItemById: (id) => post(ENDPOINTS.RM_PRODUCT.GET, { id }),
  getItemsViews: (params = {}) => helper(params),
  getItemViewById: (id, perms = {}) => helper({ id, ...perms }),
};
