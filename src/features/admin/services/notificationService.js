import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const N = ENDPOINTS.NOTIFICATIONS;

/** Global notification admin API (super admin — templates, send, logs). */
export const notificationService = {
  getChannels: () => api.post(N.CHANNELS, {}),
  getTemplates: () => api.post(N.TEMPLATES, {}),
  updateTemplate: (key, data) => api.put(N.template(key), data),
  getLogs: (params) => api.post(N.LOGS, params),
  sendInstant: (data) => api.post(N.SEND, data),
};
