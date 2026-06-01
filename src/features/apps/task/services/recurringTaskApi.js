import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const R = ENDPOINTS.RECURRING_TASKS;

export const recurringTaskService = {
  getAll: (params) => api.get(R.LIST, { params }),
  getById: (id) => api.get(R.item(id)),
  create: (data) => api.post(R.LIST, data),
  update: (id, data) => api.put(R.item(id), data),
  delete: (id) => api.delete(R.item(id)),
  getStats: () => api.get(R.STATS),
  removeAttachment: (recurringId, filePath) =>
    api.delete(R.attachments(recurringId), { data: { file_path: filePath } }),
};

