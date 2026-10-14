/**
 * Single source for portal app icons (PWA shortcuts + push).
 * Files live in /public/push-icons/{id}.svg — same look as 9-dot launcher.
 */

export const APP_ICONS = {
  home: "/push-icons/home.svg",
  ims: "/push-icons/ims.svg",
  rmstore: "/push-icons/rmstore.svg",
  task: "/push-icons/task.svg",
  hrms: "/push-icons/hrms.svg",
  purchase: "/push-icons/purchase.svg",
  production: "/push-icons/production.svg",
  engineering: "/push-icons/engineering.svg",
  settings: "/push-icons/settings.svg",
  core: "/push-icons/core.svg",
};

/** 9 apps — same order as JFL APPS launcher. */
export const PWA_SHORTCUTS = [
  { id: "home", name: "Home", shortName: "Home", url: "/home" },
  { id: "ims", name: "IMS", shortName: "IMS", url: "/ims/dashboard" },
  { id: "rmstore", name: "RM Store", shortName: "RM Store", url: "/rmstore/dashboard" },
  { id: "task", name: "Task", shortName: "Task", url: "/task/dashboard" },
  { id: "hrms", name: "HRMS", shortName: "HRMS", url: "/hrms/dashboard" },
  { id: "purchase", name: "Purchase", shortName: "Purchase", url: "/purchase/dashboard" },
  { id: "production", name: "Production", shortName: "Production", url: "/production/dashboard" },
  { id: "engineering", name: "Engineering", shortName: "Engineering", url: "/engineering/dashboard" },
  { id: "settings", name: "Admin Console", shortName: "Admin", url: "/settings" },
];

export function appIcon(id) {
  const key = String(id || "task").toLowerCase();
  if (key === "admin" || key === "admin_console") return APP_ICONS.settings;
  return APP_ICONS[key] || APP_ICONS.task;
}
