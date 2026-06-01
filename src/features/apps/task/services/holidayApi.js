import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const H = ENDPOINTS.HOLIDAYS;
const multipart = { headers: { "Content-Type": "multipart/form-data" } };

export const holidayService = {
  getAll: (params) => api.get(H.LIST, { params }),
  getById: (id) => api.get(H.item(id)),
  create: (data) => api.post(H.LIST, data),
  update: (id, data) => api.put(H.item(id), data),
  delete: (id) => api.delete(H.item(id)),

  bulkUpload: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(H.BULK_UPLOAD, formData, multipart);
  },
};

