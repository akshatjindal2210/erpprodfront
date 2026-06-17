import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const N = ENDPOINTS.NOTIFICATIONS;

export const notificationService = {
  getChannels: () => api.get(N.CHANNELS),
  getTemplates: () => api.get(N.TEMPLATES),
  updateTemplate: (key, data) => api.put(N.template(key), data),
  getLogs: (params) => api.get(N.LOGS, { params }),
  sendInstant: (data) => api.post(N.SEND, data),
};
