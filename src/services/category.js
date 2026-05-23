import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const categoryService = {
  getViews: (params)    => api(ENDPOINTS.CATEGORY.VIEWS, { method: "POST", body: params }),
  getViewById: (id, perms = {}) => api(ENDPOINTS.CATEGORY.VIEWS, { method: "POST", body: { id, ...perms } }),
};