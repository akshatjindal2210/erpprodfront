import { normalizeAppAccess } from "@/config/moduleAppRegistry";

/** Roles that may legitimately have no department / designation in DB. */
const ROLES_WITHOUT_ORG_PROFILE = new Set([
  "super_admin",
  "admin",
  "executive_assistant",
]);

export function roleMayOmitOrgProfile(roleOrType) {
  const r = String(roleOrType || "").toLowerCase().trim();
  return ROLES_WITHOUT_ORG_PROFILE.has(r);
}

export function buildCredentialsFromMe(d, existing = {}) {
  const type = d.type ?? d.role ?? existing.type ?? "user";
  return {
    id: d.id,
    name: d.name || existing.name || "",
    email: d.email ?? existing.email ?? "",
    role: d.role ?? d.type ?? existing.type ?? "user",
    type,
    designation: d.designation ?? existing.designation ?? null,
    designation_name:
      d.designation_name ?? d.designation?.name ?? existing.designation_name ?? null,
    department: d.department ?? existing.department ?? null,
    department_id: d.department_id ?? d.department?.id ?? existing.department_id ?? null,
    special_permissions: d.special_permissions ?? existing.special_permissions ?? {},
    permissions: Array.isArray(d.permissions) ? d.permissions : existing.permissions || [],
    app_access: normalizeAppAccess(d.app_access ?? existing.app_access),
  };
}

export function authProfileUnchanged(currentUser, role, me, authState = {}) {
  if (!currentUser?.id || !me?.id) return false;
  if (Number(currentUser.id) !== Number(me.id)) return false;

  const nextRole = me.type ?? me.role ?? role ?? "user";
  const prevRole = currentUser.type ?? currentUser.role ?? role ?? "user";
  if (String(prevRole) !== String(nextRole)) return false;

  const prevPerms = JSON.stringify(authState.permissions ?? []);
  const nextPerms = JSON.stringify(Array.isArray(me.permissions) ? me.permissions : []);
  if (prevPerms !== nextPerms) return false;

  const prevApps = JSON.stringify(normalizeAppAccess(authState.app_access));
  const nextApps = JSON.stringify(normalizeAppAccess(me.app_access));
  if (prevApps !== nextApps) return false;

  const prevDesig = String(currentUser.designation_name ?? currentUser.designation?.name ?? "");
  const nextDesig = String(me.designation_name ?? me.designation?.name ?? "");
  if (prevDesig !== nextDesig) return false;

  const prevDept = String(currentUser.department_id ?? currentUser.department?.id ?? "");
  const nextDept = String(me.department_id ?? me.department?.id ?? "");
  if (prevDept !== nextDept) return false;

  const prevSpecial = JSON.stringify(currentUser.special_permissions ?? {});
  const nextSpecial = JSON.stringify(me.special_permissions ?? {});
  return prevSpecial === nextSpecial;
}
