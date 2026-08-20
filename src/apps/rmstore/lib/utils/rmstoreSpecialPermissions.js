export function parseRmstoreSpecialPermissions(user) {
  const raw = user?.special_permissions;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw)?.rmstore || {};
    } catch {
      return {};
    }
  }
  return raw?.rmstore || {};
}

export function isRmstoreSuperAdmin(user) {
  return user?.type === "super_admin" || user?.role === "super_admin";
}

export function canTypeSpecValues(user) {
  if (isRmstoreSuperAdmin(user)) return true;
  return Boolean(parseRmstoreSpecialPermissions(user)?.type_spec_values);
}

/** SP1 — select any mapped RM for the job card item. */
export function canSelectMappedRm(user) {
  if (isRmstoreSuperAdmin(user)) return true;
  return parseRmstoreSpecialPermissions(user)?.issue_rm_mapped === true;
}

/** all = super admin (every RM wire); mapped = SP1; first = normal user (auto first mapped, dropdown disabled). */
export function issueRmSelectionMode(user) {
  if (isRmstoreSuperAdmin(user)) return "all";
  if (canSelectMappedRm(user)) return "mapped";
  return "first";
}

/** Submit in-process rejection requests (approval still required separately). */
export function canSubmitInProcessRejection(user) {
  if (isRmstoreSuperAdmin(user)) return true;
  return Boolean(parseRmstoreSpecialPermissions(user)?.in_process_rejection);
}
