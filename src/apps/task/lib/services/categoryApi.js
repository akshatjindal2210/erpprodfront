import api from "@/apps/task/lib/helpers/apiHelper";
import { ENDPOINTS } from "@/apps/task/lib/config/endpoints";

const C = ENDPOINTS.CATEGORIES;

export const categoryService = {
  getAll: (params) => api.post(C.LIST, params || {}),
  getViews: (params = {}) => api.post(C.HELPER, { permission_module: "tasks", permission_action: "view", ...params}),
  getById: (id) => api.post(C.GET, { id }),
  create: (data) => api.post(C.CREATE, data),
  update: (id, data) => api.post(C.UPDATE, { id, ...(data || {}) }),
  delete: (id) => api.post(C.DELETE, { id }),
};
