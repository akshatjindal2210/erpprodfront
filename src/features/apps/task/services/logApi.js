import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const L = ENDPOINTS.LOGS;

export const logService = {
  getAll: (params) => api.get(L.LIST, { params }),
  getById: (id) => api.get(L.item(id)),
  delete: (id) => api.delete(L.item(id)),
  bulkDelete: (ids) => api.delete(L.BULK, { data: { ids } }),
};

