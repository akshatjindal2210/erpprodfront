import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const H = ENDPOINTS.HOLIDAYS;
const multipart = { headers: { "Content-Type": "multipart/form-data" } };

export const holidayService = {
  getAll: (params) => api.post(H.LIST, params || {}),
  getById: (id) => api.post(H.GET, { id }),
  create: (data) => api.post(H.CREATE, data),
  update: (id, data) => api.post(H.UPDATE, { id, ...(data || {}) }),
  delete: (id) => api.post(H.DELETE, { id }),

  bulkUpload: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(H.BULK_UPLOAD, formData, multipart);
  },
};
