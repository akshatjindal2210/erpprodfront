import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";
import { imsApiViews } from "@/apps/ims/lib/helpers/sortDropdownResponse";

export const categoryService = {
  getViews: (params) => imsApiViews(ENDPOINTS.CATEGORY.VIEWS, params, "name"),
  getViewById: (id, perms = {}) => api(ENDPOINTS.CATEGORY.VIEWS, { method: "POST", body: { id, ...perms } }),
};
