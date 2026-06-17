import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const R = ENDPOINTS.REPORTS;

export const reportPanelService = {
  getDaily: (params) => api.get(R.DAILY, { params }),
  saveReview: (data) => api.post(R.REVIEW, data),
};

export function defaultReportDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(from), dateTo: fmt(to) };
}
