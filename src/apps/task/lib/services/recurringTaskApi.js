import api from "@/apps/task/lib/helpers/apiHelper";
import { ENDPOINTS } from "@/apps/task/lib/config/endpoints";

const R = ENDPOINTS.RECURRING_TASKS;

export const recurringTaskService = {
  getAll: (params) => api.post(R.LIST, params || {}),
  getById: (id) => api.get(R.item(id)),
  create: (data) => api.post(`${R.BASE}/`, data),
  update: (id, data) => api.put(R.item(id), data),
  delete: (id) => api.delete(R.item(id)),
  getStats: () => api.get(R.STATS),
  removeAttachment: (recurringId, filePath) =>
    api.delete(R.attachments(recurringId), { data: { file_path: filePath } }),
};
