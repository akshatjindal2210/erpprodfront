import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";

export const categoryService = {
  getViews: (params)    => api(ENDPOINTS.CATEGORY.VIEWS, { method: "POST", body: params }),
  getViewById: (id, perms = {}) => api(ENDPOINTS.CATEGORY.VIEWS, { method: "POST", body: { id, ...perms } }),
};
