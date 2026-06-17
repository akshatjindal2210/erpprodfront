import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const R = ENDPOINTS.RED_TICKETS;

export const redTicketService = {
  getAll: (params) => api.get(R.LIST, { params }),
  getById: (id) => api.get(R.item(id)),
  create: (data) => api.post(R.LIST, data),
  update: (id, data) => api.put(R.item(id), data),
  delete: (id) => api.delete(R.item(id)),
};
