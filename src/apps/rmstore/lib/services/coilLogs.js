import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const coilTransactionLogService = {
  getAll: (params) => api(ENDPOINTS.COIL_TRANSACTION_LOGS.LIST, { method: "POST", body: params }),
};

export const stickerDownloadLogService = {
  getAll: (params) => api(ENDPOINTS.STICKER_DOWNLOAD_LOGS.LIST, { method: "POST", body: params }),
};
