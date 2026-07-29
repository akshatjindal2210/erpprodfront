import { Boxes, Home, ListTodo, Settings } from "lucide-react";
import { ROUTES } from "@/config/routes";
import { userHasAppAccess } from "@/config/moduleAppRegistry";
import { getTaskHomePath } from "@/apps/task/lib/config/appConfig";

export const APP_SHELL = {
  PORTAL: "portal",
  IMS: "ims",
  STANDALONE: "standalone",
  SETTINGS: "settings",
  TASK: "task",
  RM_STORE: "rmstore",
};

/** Top navbar 9-dot launcher — fixed order: Home → IMS → RM Store → Task → Settings. */
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
  // {
  //   id: "rmstore",
  //   name: "RM Store",
  //   subtitle: "Raw Material",
  //   href: ROUTES.RM_STORE_DASHBOARD,
  //   shell: APP_SHELL.RM_STORE,
  //   icon: Warehouse,
  //   accent: "from-teal-500 to-teal-700",
  //   inLauncher: true,
  // },
  {
    id: "task",
    name: "Task",
    subtitle: "Tasks",
    href: ROUTES.TASK_DASHBOARD,
    shell: APP_SHELL.TASK,
    icon: ListTodo,
    accent: "from-violet-500 to-violet-700",
    inLauncher: true,
  },
  {
    id: "settings",
    name: "Admin Console",
    href: ROUTES.SETTINGS,
    shell: APP_SHELL.SETTINGS,
    icon: Settings,
    accent: "from-amber-500 to-orange-600",
    inLauncher: true,
  },
];

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

export function isTaskShellPath(pathname) {
  return pathname === ROUTES.TASK_DASHBOARD || pathname?.startsWith(`${ROUTES.TASK_DASHBOARD}/`) || pathname?.startsWith("/task/");
}

export function isTaskShell(shell, pathname) {
  return shell === APP_SHELL.TASK || isTaskShellPath(pathname);
}

export function isRmStoreShellPath(pathname) {
  return (
    pathname === ROUTES.RM_STORE_DASHBOARD ||
    pathname?.startsWith(`${ROUTES.RM_STORE_DASHBOARD}/`) ||
    pathname?.startsWith("/rmstore/")
  );
}

export function isRmStoreShell(shell, pathname) {
  return shell === APP_SHELL.RM_STORE || isRmStoreShellPath(pathname);
}

/** Resolve launcher app label + home href for navbar breadcrumbs. */
export function getShellAppFromPathname(pathname) {
  if (isPortalShellPath(pathname)) {
    return { id: "home", name: "Home", href: ROUTES.HOME };
  }
  if (isSettingsShellPath(pathname)) {
    return { id: "settings", name: "Admin Console", href: ROUTES.SETTINGS };
  }
  if (isTaskShellPath(pathname)) {
    return { id: "task", name: "Task", href: ROUTES.TASK_DASHBOARD };
  }
  if (isRmStoreShellPath(pathname)) {
    return { id: "rmstore", name: "RM Store", href: ROUTES.RM_STORE_DASHBOARD };
  }
  if (pathname?.startsWith("/ims")) {
    return { id: "ims", name: "IMS", href: ROUTES.IMS_DASHBOARD };
  }
  return { id: "home", name: "Home", href: ROUTES.HOME };
}
