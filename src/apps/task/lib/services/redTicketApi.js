import api from "@/apps/task/lib/helpers/apiHelper";
import { ENDPOINTS } from "@/apps/task/lib/config/endpoints";

const R = ENDPOINTS.RED_TICKETS;

export const redTicketService = {
  getAll: (params) => api.post(R.LIST, params || {}),
  getById: (id) => api.post(R.GET, { ticket_id: id }),
  create: (data) => api.post(R.CREATE, data),
  update: (id, data) => api.post(R.UPDATE, { ticket_id: id, ...(data || {}) }),
  delete: (id) => api.post(R.DELETE, { ticket_id: id }),
};
