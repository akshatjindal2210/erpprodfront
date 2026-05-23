import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const boxTransactionLogService = {
  getAll: (params) =>
    api(ENDPOINTS.BOX_TRANSACTION_LOGS.LIST, { method: "POST", body: params }),
};
