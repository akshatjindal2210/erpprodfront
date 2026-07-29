import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const inventoryReportService = {
  list: (params) => api(ENDPOINTS.INVENTORY_REPORT.LIST, { method: "POST", body: params }),
};
