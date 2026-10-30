import { ENDPOINTS } from "@/apps/production/lib/config/endpoints";
import { api } from "@/platform/api/apiClient";

/** prod_plan only — Board / Calendar / Table. Never writes prod_jc. */
export const planService = {
  getTable: (body = {}) => api(ENDPOINTS.PLAN.TABLE, { method: "POST", body }),
  getById: (docno) => api(ENDPOINTS.PLAN.GET, { method: "POST", body: { docno } }),
  update: (docno, data = {}) => api(ENDPOINTS.PLAN.UPDATE, { method: "POST", body: { docno, ...data } }),
  delete: (docno) => api(ENDPOINTS.PLAN.DELETE, { method: "POST", body: { docno } }),
  getShifts: () => api(ENDPOINTS.PLAN.SHIFTS, { method: "POST", body: {} }),
  getShiftOp: (body) => api(ENDPOINTS.PLAN.SHIFT_OP_GET, { method: "POST", body }),
  saveShiftOp: (body) => api(ENDPOINTS.PLAN.SHIFT_OP_SAVE, { method: "POST", body }),
  updateShiftOp: (body) => api(ENDPOINTS.PLAN.SHIFT_OP_UPDATE, { method: "POST", body }),
  deleteShiftOp: (body) => api(ENDPOINTS.PLAN.SHIFT_OP_DELETE, { method: "POST", body }),
  getEmployeesViews: (params = {}) =>
    api(ENDPOINTS.PLAN.EMPLOYEES_HELPER, {
      method: "POST",
      body: { permission_module: "production_planning", permission_action: "view", ...params },
    }),
};
