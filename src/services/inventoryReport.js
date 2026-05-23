import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const inventoryReportService = {
  getReport: (params) =>
    api(ENDPOINTS.INVENTORY_REPORT.LIST, { method: "POST", body: params }),
  getFilterOptions: (filters = {}) =>
    api(ENDPOINTS.INVENTORY_REPORT.LIST, {
      method: "POST",
      body: { action: "filter_options", filters },
    }),
};
