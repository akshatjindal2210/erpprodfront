import api from "@/apps/task/lib/helpers/apiHelper";
import { ENDPOINTS } from "@/apps/task/lib/config/endpoints";

const reminderService = {
  getAll: () => api.get(ENDPOINTS.REMINDERS.LIST),
};

export default reminderService;

