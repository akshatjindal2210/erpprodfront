import { Boxes, Home, ListTodo, Settings } from "lucide-react";
import { ROUTES } from "@/config/routes";
import { userHasAppAccess } from "@/config/moduleAppRegistry";
import { getTaskHomePath } from "@/features/apps/task/config/appConfig";

export const APP_SHELL = {
  PORTAL: "portal",
  IMS: "ims",
  STANDALONE: "standalone",
  SETTINGS: "settings",
};

/** Top navbar 9-dot launcher — fixed order: Home → IMS → Task → Settings. */
export const APPS = [
  {
    id: "home",
    name: "Home",
    href: ROUTES.HOME,
    shell: APP_SHELL.PORTAL,
    icon: Home,
    accent: "from-slate-600 to-slate-800",
    inLauncher: true,
  },
  {
    id: "ims",
    name: "IMS",
    subtitle: "Inventory",
    href: ROUTES.IMS_DASHBOARD,
    shell: APP_SHELL.IMS,
    icon: Boxes,
    accent: "from-blue-500 to-blue-700",
    inLauncher: true,
  },
  {
    id: "task",
    name: "Task",
    subtitle: "Tasks",
    href: ROUTES.TASK_DASHBOARD,
    shell: APP_SHELL.STANDALONE,
    icon: ListTodo,
    accent: "from-violet-500 to-violet-700",
    inLauncher: true,
  },
  {
    id: "settings",
    name: "Settings",
    href: ROUTES.SETTINGS,
    shell: APP_SHELL.SETTINGS,
    icon: Settings,
    accent: "from-amber-500 to-orange-600",
    inLauncher: true,
  },
];

/** @deprecated Use userHasAppAccess("ims", role, permissions) */
export function userHasImsAccess(role, permissions) {
  return userHasAppAccess("ims", role, permissions);
}

/** 9-dot launcher — only apps the user may open (Home always; others by app/module access). */
export function getLauncherApps(role = null, permissions = [], appAccess = {}) {
  return APPS.filter((app) => {
    if (!app.inLauncher) return false;
    
    // Home is always available
    if (app.id === "home") return true;
    
    // Super Admin sees everything
    if (role?.toLowerCase() === "super_admin") return true;

    // Map app.id to app_access keys (settings -> core)
    const appId = app.id === "settings" ? "core" : app.id;
    
    const hasAccess = userHasAppAccess(appId, role, permissions, appAccess);
    // console.log(`App: ${app.id}, appId: ${appId}, hasAccess: ${hasAccess}`);
    return hasAccess;
  }).map((app) =>
    // Task launcher entry — user home path controlled by HIDE_DASHBOARD_FROM_USERS in appConfig
    app.id === "task" ? { ...app, href: getTaskHomePath(role) } : app
  );
}

export function isPortalShellPath(pathname) {
  return pathname === ROUTES.HOME || pathname.startsWith(`${ROUTES.HOME}/`);
}

export function isPortalShell(shell, pathname) {
  return shell === APP_SHELL.PORTAL || isPortalShellPath(pathname);
}

export function isSettingsShellPath(pathname) {
  return pathname === ROUTES.SETTINGS || pathname.startsWith(`${ROUTES.SETTINGS}/`);
}

export function isSettingsShell(shell, pathname) {
  return shell === APP_SHELL.SETTINGS || isSettingsShellPath(pathname);
}
