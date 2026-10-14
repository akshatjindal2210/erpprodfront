/** Push branding — icons from `appIcons.js` (same as PWA / launcher style). */

import { APP_ICONS, appIcon } from "@/config/appIcons";

export const PUSH_APP_BRAND = {
  task: { label: "Task", icon: APP_ICONS.task, badge: APP_ICONS.task, defaultUrl: "/task/dashboard/tasks" },
  ims: { label: "IMS", icon: APP_ICONS.ims, badge: APP_ICONS.ims, defaultUrl: "/ims/dashboard" },
  rmstore: { label: "RM Store", icon: APP_ICONS.rmstore, badge: APP_ICONS.rmstore, defaultUrl: "/rmstore/dashboard" },
  hrms: { label: "HRMS", icon: APP_ICONS.hrms, badge: APP_ICONS.hrms, defaultUrl: "/hrms/dashboard" },
  purchase: { label: "Purchase", icon: APP_ICONS.purchase, badge: APP_ICONS.purchase, defaultUrl: "/purchase/dashboard" },
  production: { label: "Production", icon: APP_ICONS.production, badge: APP_ICONS.production, defaultUrl: "/production/dashboard" },
  engineering: { label: "Engineering", icon: APP_ICONS.engineering, badge: APP_ICONS.engineering, defaultUrl: "/engineering/dashboard" },
  core: { label: "Admin Console", icon: APP_ICONS.core, badge: APP_ICONS.core, defaultUrl: "/settings" },
  settings: { label: "Admin Console", icon: APP_ICONS.settings, badge: APP_ICONS.settings, defaultUrl: "/settings" },
  home: { label: "Home", icon: APP_ICONS.home, badge: APP_ICONS.home, defaultUrl: "/home" },
};

const DEFAULT_BRAND = {
  label: "JFL ERP",
  icon: APP_ICONS.task,
  badge: APP_ICONS.task,
  defaultUrl: "/",
};

export function normalizePushAppType(appType) {
  const key = String(appType ?? "task").trim().toLowerCase().replace(/\s+/g, "_");
  if (key === "admin" || key === "admin_console") return "settings";
  if (Object.prototype.hasOwnProperty.call(PUSH_APP_BRAND, key)) return key;
  return "task";
}

export function resolvePushAppBrand(appType) {
  return PUSH_APP_BRAND[normalizePushAppType(appType)] ?? DEFAULT_BRAND;
}

export function formatPushTitle(appType, title) {
  const brand = resolvePushAppBrand(appType);
  const clean = String(title ?? "").trim();
  if (!clean) return brand.label;
  const lower = clean.toLowerCase();
  if (lower.startsWith(`${brand.label.toLowerCase()} ·`) || lower.startsWith(`${brand.label.toLowerCase()}:`)) {
    return clean;
  }
  return `${brand.label} · ${clean}`;
}

export function pushIconUrl(appType, origin) {
  const brand = resolvePushAppBrand(appType);
  const path = brand.icon || appIcon("task");
  if (!origin) return path;
  return `${origin.replace(/\/$/, "")}${path}`;
}
