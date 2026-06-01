import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";

export const inventoryReportService = {
  getReport: (params) =>
    api(ENDPOINTS.INVENTORY_REPORT.LIST, { method: "POST", body: params }),
  getFilterOptions: (filters = {}) =>
    api(ENDPOINTS.INVENTORY_REPORT.LIST, {
      method: "POST",
      body: { action: "filter_options", filters },
    }),
};

