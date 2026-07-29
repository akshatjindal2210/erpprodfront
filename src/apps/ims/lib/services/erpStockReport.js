import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";

export const erpStockReportService = {
  list: (params = {}) =>
    api(ENDPOINTS.ERP_STOCK_REPORT.LIST, {
      method: "POST",
      body: params,
    }),
};
