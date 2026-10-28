import { ENDPOINTS } from "@/apps/production/lib/config/endpoints";
import { api } from "@/platform/api/apiClient";

/** Production plan lines (prod_plan) — requires production_planning view. */
export const planService = {
  getTable: (body = {}) => api(ENDPOINTS.PLAN.TABLE, { method: "POST", body }),
};
