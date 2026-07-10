import { getSelectedFinancialYear } from "@/features/apps/ims/helpers/financialYear";

/** Only super admin may filter dashboard widgets by user; everyone else sees all data (date filters still apply). */
export function canFilterDashboardByUser(role, user) {
  const normalized = String(role || user?.type || "").toLowerCase().trim();
  return normalized === "super_admin" || normalized === "super admin";
}

/** Runtime filters sent with widget preview + live dashboard queries. */
export function buildDashboardRuntimeFilters({ searchParams, canFilterByUser, today }) {
  const urlUserId = String(searchParams?.get("df_user") || "").trim();
  const { id: fyId } = getSelectedFinancialYear();
  return {
    fromDate: String(searchParams?.get("df_from") || today).trim(),
    toDate: String(searchParams?.get("df_to") || today).trim(),
    userId: canFilterByUser ? urlUserId : "",
    fyuid: fyId ? String(fyId).trim() : "",
  };
}
