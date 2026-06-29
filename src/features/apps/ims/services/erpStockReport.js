import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";

export const erpStockReportService = {
  list: (params = {}) =>
    api(ENDPOINTS.ERP_STOCK_REPORT.LIST, {
      method: "POST",
      body: params,
    }),
};
