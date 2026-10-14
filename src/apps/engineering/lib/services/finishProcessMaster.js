import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/engineering/lib/config/endpoints";
import { createProductionErpHelpers } from "@/apps/rmstore/lib/services/production";

const EP = ENDPOINTS.FINISH_PROCESS_MASTER;

export const finishProcessMasterService = {
  getAll: (params) => api(EP.LIST, { method: "POST", body: params }),
  getById: (production_id) => api(EP.GET, { method: "POST", body: { production_id } }),
  create: (data) => api(EP.CREATE, { method: "POST", body: data }),
  update: (production_id, data) => api(EP.UPDATE, { method: "POST", body: { production_id, ...data } }),
  delete: (production_id) => api(EP.DELETE, { method: "POST", body: { production_id } }),
};

export const finishProcessMasterHelpers = createProductionErpHelpers(EP);
