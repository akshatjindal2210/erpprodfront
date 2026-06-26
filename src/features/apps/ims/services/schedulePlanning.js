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

  remove: (body) =>
    api(ENDPOINTS.SCHEDULE_PLANNING.DELETE, {
      method: "POST",
      body: finYearBody(body),
    }),
};
