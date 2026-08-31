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
  return String(user?.type || user?.role || "").toLowerCase().trim() === "super_admin";
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

/** Assign / manage FN item-wise bills (super_admin always). */
export function canManageForwardingBill(user) {
  if (isImsSuperAdmin(user)) return true;
  return Boolean(parseImsSpecialPermissions(user)?.ims?.manage_forwarding_bill);
}

/**
 * Packing sticker Deviation (qty + remarks) when monthly limit exceeded.
 * Super Admin always; others need special_permissions.ims.packing_deviation.
 */
export function canCreatePackingDeviation(user) {
  if (isImsSuperAdmin(user)) return true;
  const ims = parseImsSpecialPermissions(user)?.ims || {};
  return Boolean(ims.packing_deviation || ims.override_stock_shortage);
}
