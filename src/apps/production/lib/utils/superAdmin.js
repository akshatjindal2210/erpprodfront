export function isProductionSuperAdmin(user) {
  return String(user?.type || user?.role || "").toLowerCase().trim() === "super_admin";
}
