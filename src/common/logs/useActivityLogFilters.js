"use client";

/**
 * Shared filter config for every Activity Logs page.
 *
 *  Per-app pages (IMS, HRMS, …):
 *    Normal user  → no extra filters (backend already scopes to req.user.id).
 *    Super admin  → user / module / action_type dropdowns.
 *
 *  Home (crossApp):
 *    Everyone     → App / action (own logs; backend scopes non-admin to self).
 *    Super admin  → also user + module dropdowns.
 */

import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { selectRole, selectPermissions, selectAppAccess } from "@/platform/store/slices/authSlice";
import { getDashboardFilterUsers } from "@/common/dashboard-builder/services/dashboardApi";
import { MODULES, APP_TYPE_LABELS, PORTAL_APP_KEYS } from "@/config/portalModules.data";
import { userHasAppAccess } from "@/config/moduleAppRegistry";

/** Auth events are platform-level, not per-app module actions. */
const AUTH_ACTION_TYPE_OPTIONS = [
  { value: "LOGIN", label: "Login" },
  { value: "LOGOUT", label: "Logout" },
];

/** Action types written by platform/middleware/activityLogger.js + logActivity.js. */
const APP_ACTION_TYPE_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "CREATE", label: "Create" },
  // UPDATE also matches legacy MODIFY rows on the backend.
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
  { value: "APPROVE", label: "Approve" },
  { value: "SUBMIT", label: "Submit" },
  { value: "LOCK", label: "Lock" },
  { value: "UNLOCK", label: "Unlock" },
];

function actionTypeOptions({ crossApp = false, appType = "" } = {}) {
  const scopedToApp = !crossApp || Boolean(String(appType || "").trim());
  if (scopedToApp) return APP_ACTION_TYPE_OPTIONS;
  return [
    APP_ACTION_TYPE_OPTIONS[0],
    ...AUTH_ACTION_TYPE_OPTIONS,
    ...APP_ACTION_TYPE_OPTIONS.slice(1),
  ];
}

function moduleOptionsForApp(appType, allowedApps = null) {
  const key = String(appType || "").toLowerCase();
  if (key && Array.isArray(MODULES[key])) {
    const appLabel = APP_TYPE_LABELS[key] || "Modules";
    return [
      { value: "", label: `All ${appLabel} Modules` },
      ...MODULES[key].map((m) => ({ value: m.name, label: m.label })),
    ];
  }

  const apps = allowedApps || PORTAL_APP_KEYS;
  const out = [{ value: "", label: "All Modules" }];
  for (const app of apps) {
    const appLabel = APP_TYPE_LABELS[app] || app;
    for (const m of MODULES[app] || []) {
      out.push({ value: m.name, label: `${appLabel} · ${m.label}` });
    }
  }
  return out;
}

export function useActivityLogFilters({ appType, crossApp = false, values = {} } = {}) {
  const role = useSelector(selectRole);
  const permissions = useSelector(selectPermissions);
  const appAccess = useSelector(selectAppAccess);
  const isSuperAdmin = String(role || "").toLowerCase().trim() === "super_admin";

  const allowedApps = useMemo(
    () => PORTAL_APP_KEYS.filter((key) => userHasAppAccess(key, role, permissions, appAccess)),
    [role, permissions, appAccess],
  );

  const appFilterOptions = useMemo(
    () => [
      { value: "", label: "All Apps" },
      ...allowedApps.map((key) => ({
        value: key,
        label: APP_TYPE_LABELS[key] || key,
      })),
    ],
    [allowedApps],
  );

  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!isSuperAdmin) return undefined;
    let cancelled = false;
    getDashboardFilterUsers()
      .then((res) => {
        const rows = Array.isArray(res?.data?.users) ? res.data.users : [];
        if (!cancelled) setUsers(rows);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  const userOptions = useMemo(
    () => [
      { value: "", label: "All Users" },
      ...users.map((u) => ({
        value: String(u.id),
        label: u.name || u.username || `User #${u.id}`,
      })),
    ],
    [users],
  );

  const moduleOptions = useMemo(
    () => moduleOptionsForApp(crossApp ? values.app_type : appType, allowedApps),
    [crossApp, values.app_type, appType, allowedApps],
  );

  const extraFilters = useMemo(() => {
    const showAdminFilters = isSuperAdmin || crossApp;
    if (!showAdminFilters) return [];

    const filters = [];

    if (crossApp) {
      filters.push({
        key: "app_type",
        label: "App",
        options: appFilterOptions,
        preserveOrder: true,
        value: values.app_type || "",
      });
    }

    if (isSuperAdmin) {
      filters.push({
        key: "user_id",
        label: "User",
        placeholder: "Filter by user…",
        searchable: true,
        options: userOptions,
        preserveOrder: true,
        value: values.user_id || "",
      });
      filters.push({
        key: "module",
        label: "Module",
        options: moduleOptions,
        preserveOrder: true,
        value: values.module || "",
      });
    }

    const selectedApp = crossApp ? values.app_type : appType;
    filters.push({
      key: "action_type",
      label: "Action",
      options: actionTypeOptions({ crossApp, appType: selectedApp }),
      preserveOrder: true,
      value: values.action_type || "",
    });

    return filters;
  }, [
    isSuperAdmin,
    crossApp,
    appType,
    appFilterOptions,
    userOptions,
    moduleOptions,
    values.app_type,
    values.user_id,
    values.module,
    values.action_type,
  ]);

  return { isSuperAdmin, extraFilters };
}
