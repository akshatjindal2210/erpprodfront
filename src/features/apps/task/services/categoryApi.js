import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const C = ENDPOINTS.CATEGORIES;

export const categoryService = {
  getAll: (params) => api.get(C.LIST, { params }),
  getById: (id) => api.get(C.item(id)),
  create: (data) => api.post(C.LIST, data),
  update: (id, data) => api.put(C.item(id), data),
  delete: (id) => api.delete(C.item(id)),
  getStats: () => api.get(C.STATS),
};

