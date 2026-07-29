import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";

export const inventoryReportService = {
  list: ({ page = 1, limit = 100, filters = {}, sortKey = "packing_number", sortDir = "desc", includeTotals = false } = {}) =>
    api(ENDPOINTS.INVENTORY_REPORT.LIST, {
      method: "POST",
      body: { page, limit, filters, sortKey, sortDir, includeTotals },
    }),
};
