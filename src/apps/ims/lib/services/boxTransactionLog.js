import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";

export const boxTransactionLogService = {
  getAll: (params) =>
    api(ENDPOINTS.BOX_TRANSACTION_LOGS.LIST, { method: "POST", body: params }),
};

