/** Only super admin may filter dashboard widgets by user; everyone else sees all data (date filters still apply). */
export function canFilterDashboardByUser(role, user) {
  const normalized = String(role || user?.type || "").toLowerCase().trim();
  return normalized === "super_admin" || normalized === "super admin";
}