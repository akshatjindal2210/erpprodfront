import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const R = ENDPOINTS.CL_TASKS;

export const clTaskService = {
  getAll: (params) => api.get(R.LIST, { params }),
  getMy: (params) => api.get(R.MY, { params }),
  getVerification: (params) => api.get(R.VERIFICATION, { params }),
  getById: (id) => api.get(R.item(id)),
  create: (data) => { 
    console.log("cl task - create : ",data);
    return api.post(R.LIST, data); 
  },
  // create: (data) => api.post(R.LIST, data),
  submit: (id, data) => {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    if (isFormData) {
      return api.post(R.submit(id), data, {
        headers: { "Content-Type": undefined },
      });
    }
    return api.post(R.submit(id), data);
  },
  verify: (id, data) => api.post(R.verify(id), data),
  delete: (id) => api.delete(R.item(id)),
};
