import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";
import { getSelectedFinancialYear } from "@/features/apps/ims/helpers/financialYear";

function finYearBody(extra = {}) {
  const { id } = getSelectedFinancialYear();
  const fin_year_id = id != null ? String(id).trim() : "";
  if (!fin_year_id) {
    throw new Error("Please select a financial year.");
  }
  return { fin_year_id, ...extra };
}

export const schedulePlanningService = {
  list: (filters = {}) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.LIST, {
      method: "POST",
      body: finYearBody(filters),
    }),

  actionDates: async () => {
    const res = await api(ENDPOINTS.SCHEDULE_PLANNING.ACTION_DATES, {
      method: "POST",
      body: finYearBody(),
    });
    const nested = res?.data && typeof res.data === "object" && !Array.isArray(res.data) ? res.data : null;
    const reasons = Array.isArray(res?.reasons)
      ? res.reasons
      : Array.isArray(nested?.reject_reasons)
        ? nested.reject_reasons
        : [];
    return { ...res, reasons };
  },

  save: (body) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.SAVE, {
      method: "POST",
      body: finYearBody(body),
    }),

  reject: (body) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.REJECT, {
      method: "POST",
      body: finYearBody(body),
    }),

  hold: (body) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.HOLD, {
      method: "POST",
      body: finYearBody(body),
    }),

  readyToDispatch: (body) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.READY_TO_DISPATCH, {
      method: "POST",
      body: finYearBody(body),
    }),

  transactions: (body) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.TRANSACTIONS, {
      method: "POST",
      body: finYearBody(body),
    }),

  shortage: (body) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.SHORTAGE, {
      method: "POST",
      body: finYearBody(body),
    }),

  complete: (body) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.COMPLETE, {
      method: "POST",
      body: finYearBody(body),
    }),

  remove: (body) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.DELETE, {
      method: "POST",
      body: finYearBody(body),
    }),

  /** Dispatch-plan helper — no fin_year_id required. Caller must pass permission_module + permission_action. */
  dispatchHelper: (body = {}) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.DISPATCH_HELPER, {
      method: "POST",
      body,
    }),

  /** Current-month Plan/Hold lines for one customer (FN item picker). Passes fin_year for IMS merge. */
  customerMonthSchedules: (body = {}) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.CUSTOMER_MONTH_SCHEDULES, {
      method: "POST",
      body: finYearBody(body),
    }),

  /** Mark a dispatch plan item as complete. fin_year_id must be included in body (taken from row data). */
  dispatchComplete: (body = {}) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.COMPLETE, {
      method: "POST",
      body,
    }),

  /** Reschedule a dispatch plan item to a new target date. fin_year_id must be included in body (taken from row data). */
  dispatchReschedule: (body = {}) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.SAVE, {
      method: "POST",
      body,
    }),
};
