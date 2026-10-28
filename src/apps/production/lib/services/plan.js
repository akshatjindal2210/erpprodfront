import { ENDPOINTS } from "@/apps/production/lib/config/endpoints";
import { api } from "@/platform/api/apiClient";

/** prod_plan only — Board / Calendar / Table. Never writes prod_jc. */
export const planService = {
  getTable: (body = {}) => api(ENDPOINTS.PLAN.TABLE, { method: "POST", body }),
  getById: (docno) => api(ENDPOINTS.PLAN.GET, { method: "POST", body: { docno } }),
  update: (docno, data = {}) => api(ENDPOINTS.PLAN.UPDATE, { method: "POST", body: { docno, ...data } }),
  delete: (docno) => api(ENDPOINTS.PLAN.DELETE, { method: "POST", body: { docno } }),
};
