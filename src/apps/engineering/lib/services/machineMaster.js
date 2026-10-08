import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/engineering/lib/config/endpoints";

export const machineMasterService = {
  getAll: (params) => api(ENDPOINTS.MACHINE_MASTER.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.MACHINE_MASTER.GET, { method: "POST", body: { id } }),
  create: (data) => {
    if (data instanceof FormData) {
      return api(ENDPOINTS.MACHINE_MASTER.CREATE, { method: "POST", body: data });
    }
    return api(ENDPOINTS.MACHINE_MASTER.CREATE, { method: "POST", body: data });
  },
  update: (id, data) => {
    if (data instanceof FormData) {
      data.append("id", String(id));
      return api(ENDPOINTS.MACHINE_MASTER.UPDATE, { method: "POST", body: data });
    }
    return api(ENDPOINTS.MACHINE_MASTER.UPDATE, { method: "POST", body: { id, ...data } });
  },
  delete: (id) => api(ENDPOINTS.MACHINE_MASTER.DELETE, { method: "POST", body: { id } }),
};
