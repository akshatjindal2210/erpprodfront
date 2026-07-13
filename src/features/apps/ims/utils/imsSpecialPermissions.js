export function parseImsSpecialPermissions(user) {
  if (!user?.special_permissions) return {};
  if (typeof user.special_permissions === "string") {
    try {
      return JSON.parse(user.special_permissions);
    } catch {
      return {};
    }
  }
  return user.special_permissions;
}

export function isImsSuperAdmin(user) {
  return user?.type === "super_admin" || user?.role === "super_admin";
}

export function canCreateInventoryOut(user) {
  if (isImsSuperAdmin(user)) return true;
  return Boolean(parseImsSpecialPermissions(user)?.ims?.inventory_out);
}

export function canApproveInventoryOut(user) {
  if (isImsSuperAdmin(user)) return true;
  return Boolean(parseImsSpecialPermissions(user)?.ims?.inventory_approve);
}

/** Direct FN create without schedule. Schedule-based New still works with module add only. */
export function canCreateDirectForwardingNote(user) {
  if (isImsSuperAdmin(user)) return true;
  return Boolean(parseImsSpecialPermissions(user)?.ims?.direct_forwarding_note);
}
