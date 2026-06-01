/**
 * Permission modules UI.
 * Data: portalModules.data.js (sync with backend/src/config/portalModules.js).
 */
import { APP_GATES, APP_META, MODULES, PORTAL_APP_KEYS, SETTINGS_MODULES } from "./portalModules.data.js";

export { APP_GATES, APP_META, MODULES, PORTAL_APP_KEYS, SETTINGS_MODULES };

export const APP_TYPE_LABELS = Object.fromEntries(
  PORTAL_APP_KEYS.map((key) => [key, APP_META[key].label])
);

export const MODULE_APP_KEY = Object.fromEntries(
  PORTAL_APP_KEYS.flatMap((app) => [
    ...MODULES[app].map((m) => [m.name, app]),
  ])
);

export const APP_ACCESS = Object.fromEntries(
  PORTAL_APP_KEYS.map((id) => [
    id,
    {
      id,
      label: APP_META[id].label,
      hasModulePermissions: APP_META[id].permissions,
    },
  ])
);

const GATE_NAMES = new Set(Object.values(APP_GATES));

export function appType(mod) {
  const fromDb = String(mod?.app_type ?? "").trim().toLowerCase();
  if (PORTAL_APP_KEYS.includes(fromDb)) return fromDb;
  const name = String(mod?.name ?? "").toLowerCase();
  return MODULE_APP_KEY[name] ?? "core";
}

export function isAppGateModule(modOrName) {
  return false;
}

export function isSettingsCoreModule(mod) {
  return SETTINGS_MODULES.includes(String(mod?.name ?? "").toLowerCase());
}

export function shouldIncludeInUserPermissionForm(mod) {
  return true;
}

export function partitionModulesForUserForm(modules = []) {
  const imsModules = [];
  const coreModules = [];
  const taskModules = [];
  const sort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

  for (const mod of modules) {
    const t = appType(mod);
    if (t === "ims") imsModules.push(mod);
    else if (t === "core" && isSettingsCoreModule(mod)) coreModules.push(mod);
    else if (t === "task") taskModules.push(mod);
  }

  return {
    imsModules: imsModules.sort(sort),
    coreModules: coreModules.sort(sort),
    taskModules: taskModules.sort(sort),
  };
}

function permFor(permissions, moduleName) {
  if (!Array.isArray(permissions)) return null;
  const key = String(moduleName).toLowerCase();
  return permissions.find((p) => String(p.module_name ?? "").toLowerCase() === key);
}

export function resolveAppAccessEnabled(appId, permissions = []) {
  if (appId === "core") {
    return SETTINGS_MODULES.some((name) => !!permFor(permissions, name)?.can_view);
  }

  return permissions.some((p) => {
    if (!p?.can_view) return false;
    const t = String(p.module_app_type ?? "").trim().toLowerCase();
    return t === appId;
  });
}

/** DB / socket may send true/false, 1/0, or "t"/"f" strings. */
export function normalizeAppAccessFlag(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "false" || v === "0" || v === "f" || v === "no" || v === "off") return false;
    return v === "true" || v === "1" || v === "t" || v === "yes" || v === "on";
  }
  return !!value;
}

export function normalizeAppAccess(appAccess = {}) {
  const out = {};
  for (const [key, val] of Object.entries(appAccess || {})) {
    out[key] = normalizeAppAccessFlag(val);
  }
  return out;
}

export function userHasAppAccess(appId, role, permissions = [], appAccess = {}) {
  if (role?.toLowerCase() === "super_admin") return true;

  const normalized = normalizeAppAccess(appAccess);
  const hasStoredAppAccess = Object.keys(normalized).length > 0;

  // User has rows in mst_user_app_access — app toggle is source of truth (not module fallback).
  if (hasStoredAppAccess) {
    return normalizeAppAccessFlag(normalized[appId]);
  }

  return resolveAppAccessEnabled(appId, permissions);
}

export function emptyPermRow() {
  return {
    can_view: false,
    can_view_days: 0,
    can_add: false,
    can_edit: false,
    can_edit_days: 0,
    can_delete: false,
    can_authorize: false,
  };
}

export function clearModulePermissions(prev, moduleIds = []) {
  const updated = { ...prev };
  const empty = emptyPermRow();
  for (const id of moduleIds) {
    if (updated[id]) updated[id] = { ...updated[id], ...empty };
  }
  return updated;
}

export function setAppGatePermission(prev, moduleId, enabled) {
  if (!moduleId) return prev;
  const row = prev[moduleId] || emptyPermRow();
  return {
    ...prev,
    [moduleId]: {
      ...row,
      can_view: enabled,
      ...(enabled
        ? {}
        : {
            can_add: false,
            can_edit: false,
            can_delete: false,
            can_authorize: false,
            can_view_days: 0,
            can_edit_days: 0,
          }),
    },
  };
}

export function moduleIdsForAppType(modules, appTypeKey) {
  const key = String(appTypeKey ?? "core").toLowerCase();
  if (!PORTAL_APP_KEYS.includes(key)) return [];
  if (key === "core") {
    return modules.filter((m) => isSettingsCoreModule(m)).map((m) => m.id);
  }
  return modules
    .filter((m) => appType(m) === key)
    .map((m) => m.id);
}

export function getModulesForAppKey(
  appKey,
  { imsModules = [], coreModules = [], taskModules = [] } = {}
) {
  if (appKey === "ims") return imsModules;
  if (appKey === "core") return coreModules;
  if (appKey === "task") return taskModules;
  return [];
}

export function sanitizePermissionsPayload(permissions) {
  return permissions;
}
