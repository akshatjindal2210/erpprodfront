export function parseTaskSpecialPermissions(user) {
  if (!user?.special_permissions) return {};
  let raw = user.special_permissions;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? raw : {};
}

/** Default CL verification person stored on the assignee's user profile. */
export function getTaskDefaultVerifierId(user) {
  const perms = parseTaskSpecialPermissions(user);
  const id = perms?.task?.verification_user_id;
  if (id == null || id === "") return null;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}
