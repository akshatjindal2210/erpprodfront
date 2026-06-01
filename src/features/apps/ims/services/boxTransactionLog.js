import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";

export const boxTransactionLogService = {
  getAll: (params) =>
    api(ENDPOINTS.BOX_TRANSACTION_LOGS.LIST, { method: "POST", body: params }),
};

