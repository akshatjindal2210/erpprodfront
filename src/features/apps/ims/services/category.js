import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";
import { imsApiViews } from "@/features/apps/ims/helpers/sortDropdownResponse";

export const categoryService = {
  getViews: (params) => imsApiViews(ENDPOINTS.CATEGORY.VIEWS, params, "name"),
  getViewById: (id, perms = {}) => api(ENDPOINTS.CATEGORY.VIEWS, { method: "POST", body: { id, ...perms } }),
};
