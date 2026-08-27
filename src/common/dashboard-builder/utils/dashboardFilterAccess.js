import { getSelectedFinancialYear } from "@/platform/utils/global/financialYear";

function roleOf(role, user) {
  return String(role || user?.type || user?.role || "").toLowerCase().trim();
}

function designationOf(user) {
  return String(user?.designation?.name ?? user?.designation_name ?? "").toLowerCase().trim();
}

/**
 * Single source of truth for dashboard user dropdown:
 * - all        → SA / admin / EA (designation ignored)
 * - department → type=user + manager designation
 * - self       → everyone else (no dropdown)
 */
export function getDashboardUserFilterScope(role, user) {
  const r = roleOf(role, user);
  if (r === "super_admin" || r === "super admin" || r === "admin" || r === "executive_assistant") {
    return "all";
  }
  if (designationOf(user) === "manager") return "department";
  return "self";
}

export function canFilterDashboardByUser(role, user) {
  return getDashboardUserFilterScope(role, user) !== "self";
}

/** Normal manager defaults to own name; staff keeps All Users. */
export function shouldDefaultDashboardFilterToSelf(role, user) {
  return getDashboardUserFilterScope(role, user) === "department";
}

export function getDashboardSelfFilter(user) {
  const username = String(user?.username || user?.email || "").trim();
  return {
    userId: user?.id != null && user?.id !== "" ? String(user.id) : "",
    username,
    name: String(user?.name || "").trim() || username,
  };
}

export function buildDashboardRuntimeFilters({ searchParams, canFilterByUser, today }) {
  const { id: fyId } = getSelectedFinancialYear();
  return {
    fromDate: String(searchParams?.get("df_from") || "").trim() || today,
    toDate: String(searchParams?.get("df_to") || "").trim() || today,
    userId: canFilterByUser ? String(searchParams?.get("df_uid") || "").trim() : "",
    username: canFilterByUser ? String(searchParams?.get("df_user") || "").trim() : "",
    name: canFilterByUser ? String(searchParams?.get("df_name") || "").trim() : "",
    fyuid: fyId ? String(fyId).trim() : "",
  };
}
