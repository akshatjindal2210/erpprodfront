import { getSelectedFinancialYear } from "@/platform/utils/global/financialYear";

/** Super admin sees all users unless they pick one. Normal users always use their own {{userId}} / {{username}} / {{name}}. Date filters still apply. */
export function canFilterDashboardByUser(role, user) {
  const normalized = String(role || user?.type || "").toLowerCase().trim();
  return normalized === "super_admin" || normalized === "super admin";
}

/** Runtime filters sent with widget preview + live dashboard queries. */
export function buildDashboardRuntimeFilters({ searchParams, canFilterByUser, today }) {
  const urlUser = String(searchParams?.get("df_user") || "").trim();
  const urlFrom = String(searchParams?.get("df_from") || "").trim();
  const urlTo = String(searchParams?.get("df_to") || "").trim();
  const { id: fyId } = getSelectedFinancialYear();

  return {
    fromDate: urlFrom || today,
    toDate: urlTo || today,
    userId: canFilterByUser ? String(searchParams?.get("df_uid") || "").trim() : "",
    username: canFilterByUser ? urlUser : "",
    name: canFilterByUser ? String(searchParams?.get("df_name") || "").trim() : "",
    fyuid: fyId ? String(fyId).trim() : "",
  };
}
