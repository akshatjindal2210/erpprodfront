import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";

export const logService = {
  getAll:   (params)    =>   api(ENDPOINTS.ACTIVITY_LOGS.LIST, { method: "POST", body: params }),
};

