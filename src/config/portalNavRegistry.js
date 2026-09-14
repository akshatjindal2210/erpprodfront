"use client";

/**
 * Portal sidebar app-groups — one expandable group per app the logged-in user
 * has access to. Each group's subItems are that app's own NAV_REGISTRY, with
 * the same nested groups (Masters, Logs, …) used inside the app shell so the
 * home sidebar matches the in-app sidebar.
 *
 * Sidebar.js still runs the existing per-item permission filter (canSeeNavItem
 * + useCanAccess), so page-level access is enforced by the SAME logic used
 * inside each per-app shell. This file just decides which app-groups to emit.
 *
 * Adding a new app later? Only extend PORTAL_APP_GROUPS below — no other
 * sidebar code needs to change.
 */

import { Boxes, Warehouse, ListTodo, Users, ShoppingCart, Factory, Settings } from "lucide-react";
import { NAV_REGISTRY as IMS_NAV_REGISTRY } from "@/apps/ims/lib/config/navRegistry";
import { RM_STORE_NAV_REGISTRY } from "@/apps/rmstore/lib/config/navRegistry";
import { TASK_NAV_REGISTRY } from "@/apps/task/lib/config/navRegistry";
import { HRMS_NAV_REGISTRY } from "@/apps/hrms/lib/config/navRegistry";
import { PURCHASE_NAV_REGISTRY } from "@/apps/purchase/lib/config/navRegistry";
import { PRODUCTION_NAV_REGISTRY } from "@/apps/production/lib/config/navRegistry";
import { SETTINGS_NAV_REGISTRY } from "@/apps/settings/configuration/config/settingsNavRegistry";
import { userHasAppAccess } from "@/config/moduleAppRegistry";
import { getQuickLaunchCodeForHref } from "@/config/quickLaunchCodes";

/**
 * Ordered list of apps to consider for the portal sidebar. `appKey` matches
 * `PORTAL_APP_KEYS` (moduleAppRegistry) — "core" for the Admin Console shell.
 */
export const PORTAL_APP_GROUPS = [
  { id: "ims",        name: "IMS",        appKey: "ims",        code: "IMS", icon: <Boxes size={16} />,        registry: IMS_NAV_REGISTRY },
  { id: "rmstore",    name: "RM Store",   appKey: "rmstore",    code: "RMS", icon: <Warehouse size={16} />,    registry: RM_STORE_NAV_REGISTRY },
  { id: "task",       name: "Task",       appKey: "task",       code: "TSK", icon: <ListTodo size={16} />,     registry: TASK_NAV_REGISTRY },
  { id: "hrms",       name: "HRMS",       appKey: "hrms",       code: "HR",  icon: <Users size={16} />,        registry: HRMS_NAV_REGISTRY },
  { id: "purchase",   name: "Purchase",   appKey: "purchase",   code: "PU",  icon: <ShoppingCart size={16} />, registry: PURCHASE_NAV_REGISTRY },
  { id: "production", name: "Production", appKey: "production", code: "PR",  icon: <Factory size={16} />,      registry: PRODUCTION_NAV_REGISTRY },
  { id: "core",       name: "Admin Console", appKey: "core",    code: "AC",  icon: <Settings size={16} />,     registry: SETTINGS_NAV_REGISTRY },
];

/** Clone an app registry, prefix ids so IMS/RM Store "masters-group" don't collide, keep nested groups. */
function cloneAppNav(registry = [], idPrefix = "") {
  return (Array.isArray(registry) ? registry : []).map((item) => {
    const id = idPrefix ? `${idPrefix}-${item.id || item.name}` : (item.id || item.name);
    const cloned = {
      ...item,
      id,
      shortcutCode: item.shortcutCode || getQuickLaunchCodeForHref(item.href),
    };
    if (Array.isArray(item.subItems) && item.subItems.length) {
      cloned.subItems = cloneAppNav(item.subItems, id);
    }
    return cloned;
  });
}

/**
 * Build the portal-shell sidebar registry from the currently-logged-in user's
 * app access. Returns [] when the user has no app access (Sidebar just shows
 * PORTAL_NAV + shortcuts — no crash).
 */
export function buildPortalAppGroupsNav({ role, permissions = [], appAccess = {} } = {}) {
  return PORTAL_APP_GROUPS
    .filter((app) => userHasAppAccess(app.appKey, role, permissions, appAccess))
    .map((app) => ({
      id: `portal-app-${app.id}`,
      name: app.name,
      icon: app.icon,
      module: null,
      shortcutCode: app.code || null,
      subItems: cloneAppNav(app.registry, app.id),
    }))
    .filter((group) => group.subItems.length > 0);
}
