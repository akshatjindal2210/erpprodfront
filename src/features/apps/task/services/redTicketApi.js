import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const R = ENDPOINTS.RED_TICKETS;

export const redTicketService = {
  getAll: (params) => api.post(R.LIST, params || {}),
  getById: (id) => api.post(R.GET, { ticket_id: id }),
  create: (data) => api.post(R.CREATE, data),
  update: (id, data) => api.post(R.UPDATE, { ticket_id: id, ...(data || {}) }),
  delete: (id) => api.post(R.DELETE, { ticket_id: id }),
};
