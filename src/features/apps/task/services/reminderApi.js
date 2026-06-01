import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const reminderService = {
  getAll: () => api.get(ENDPOINTS.REMINDERS.LIST),
};

export default reminderService;

