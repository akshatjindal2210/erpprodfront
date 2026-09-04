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

/** DB / API may send boolean, 1/0, or "t"/"f". Missing is_active = active (helper views omit the column). */
export function isModuleActive(mod) {
  if (!mod) return false;
  if (!Object.prototype.hasOwnProperty.call(mod, "is_active")) return true;
  const v = mod.is_active;
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "false" || s === "0" || s === "f" || s === "no" || s === "off") return false;
    return s === "true" || s === "1" || s === "t" || s === "yes" || s === "on";
  }
  return !!v;
}

export function shouldIncludeInUserPermissionForm(mod) {
  return true;
}

export function partitionModulesForUserForm(modules = []) {
  const imsModules = [];
  const coreModules = [];
  const taskModules = [];
  const rmStoreModules = [];
  const hrmsModules = [];
  const sort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

  for (const mod of modules) {
    if (!shouldIncludeInUserPermissionForm(mod)) continue;
    const t = appType(mod);
    if (t === "ims") imsModules.push(mod);
    else if (t === "core" && isSettingsCoreModule(mod)) coreModules.push(mod);
    else if (t === "task") taskModules.push(mod);
    else if (t === "rmstore") rmStoreModules.push(mod);
    else if (t === "hrms") hrmsModules.push(mod);
  }

  return {
    imsModules: imsModules.sort(sort),
    coreModules: coreModules.sort(sort),
    taskModules: taskModules.sort(sort),
    rmStoreModules: rmStoreModules.sort(sort),
    hrmsModules: hrmsModules.sort(sort),
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
  { imsModules = [], coreModules = [], taskModules = [], rmStoreModules = [], hrmsModules = [] } = {}
) {
  if (appKey === "ims") return imsModules;
  if (appKey === "core") return coreModules;
  if (appKey === "task") return taskModules;
  if (appKey === "rmstore") return rmStoreModules;
  if (appKey === "hrms") return hrmsModules;
  return [];
}

export function sanitizePermissionsPayload(permissions, modules = []) {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    return permissions;
  }
  const activeIds = new Set(
    (Array.isArray(modules) ? modules : [])
      .filter(shouldIncludeInUserPermissionForm)
      .map((m) => Number(m.id))
      .filter(Number.isFinite)
  );
  if (!activeIds.size) return permissions;

  const out = {};
  for (const [id, row] of Object.entries(permissions)) {
    const mid = Number(id);
    if (activeIds.has(mid)) out[id] = row;
  }
  return out;
}
