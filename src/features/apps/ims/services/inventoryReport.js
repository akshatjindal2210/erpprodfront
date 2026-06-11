import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";

export const inventoryReportService = {
  getReport: (params) =>
    api(ENDPOINTS.INVENTORY_REPORT.LIST, { method: "POST", body: params }),
  getFilterOptions: (filters = {}, fields = null) =>
    api(ENDPOINTS.INVENTORY_REPORT.LIST, {
      method: "POST",
      body: {
        action: "filter_options",
        filters,
        ...(Array.isArray(fields) && fields.length ? { fields } : {}),
      },
    }),
  /** One backend round-trip for the full report (used on load / refresh). */
  fetchAll: () =>
    api(ENDPOINTS.INVENTORY_REPORT.LIST, {
      method: "POST",
      body: {
        fetchAll: true,
        page: 1,
        limit: 50000,
        filters: {},
        includeTotals: true,
        sortBy: "packing_number",
        order: "DESC",
      },
    }),
};

