import api from "@/apps/task/lib/helpers/apiHelper";
import { ENDPOINTS } from "@/apps/task/lib/config/endpoints";

const H = ENDPOINTS.HOLIDAYS;
const multipart = { headers: { "Content-Type": "multipart/form-data" } };

export const holidayService = {
  getAll: (params) => api.post(H.LIST, params || {}),
  getById: (id) => api.post(H.GET, { id }),
  create: (data) => api.post(H.CREATE, data),
  update: (id, data) => api.post(H.UPDATE, { id, ...(data || {}) }),
  delete: (id) => api.post(H.DELETE, { id }),

  bulkPreview: (rows) => api.post(H.BULK_PREVIEW, { data: rows }),

  bulkCreate: (rows) => api.post(H.BULK, { data: rows }),

  bulkUpload: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(H.BULK_UPLOAD, formData, multipart);
  },
};
