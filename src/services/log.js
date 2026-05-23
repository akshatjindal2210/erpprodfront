import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const logService = {
  getAll:   (params)    =>   api(ENDPOINTS.ACTIVITY_LOGS.LIST, { method: "POST", body: params }),
};
