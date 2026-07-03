import { NAV_REGISTRY } from "@/features/apps/ims/config/navRegistry";
import { SETTINGS_NAV_REGISTRY } from "@/features/admin/configuration/config/settingsNavRegistry";
import { SIDEBAR_MENU as TASK_SIDEBAR_MENU } from "@/features/apps/task/config/appConfig";

const HOME_PAGES = [
  { value: "default", label: "Home", module: null, href: "/home", roles: null },
];

function slugify(value = "default") {
  return (
    String(value || "default")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "default"
  );
}

function hrefTailKey(href = "") {
  const parts = String(href || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);
  if (parts.length === 0) return "default";
  if (["ims", "task", "settings", "home"].includes(parts[0])) {
    parts.shift();
  }
  return slugify(parts.join("-") || "default");
}

export function flattenNavRegistry(registry = [], { includeGroupInLabel = true } = {}) {
  const pages = [];

  const addPage = (item, groupName = "") => {
    if (!item?.href) return;
    const pageKey = item.id || hrefTailKey(item.href);
    const label =
      groupName && includeGroupInLabel
        ? `${groupName} > ${item.name || pageKey}`
        : item.name || pageKey;
    pages.push({
      value: pageKey,
      label,
      module: item.module || null,
      href: item.href,
      roles: item.roles || null,
      requiredPermission: item.requiredPermission || null,
    });
  };

  const walk = (items = [], groupName = "") => {
    items.forEach((item) => {
      if (Array.isArray(item.subItems) && item.subItems.length) {
        walk(item.subItems, item.name || groupName);
      }
      addPage(item, groupName);
    });
  };

  walk(registry);
  const dedup = new Map();
  pages.forEach((page) => {
    if (!dedup.has(page.value)) dedup.set(page.value, page);
  });
  return Array.from(dedup.values());
}

export function flattenTaskSidebar(menu = []) {
  return menu
    .filter((item) => item?.href)
    .map((item) => ({
      value: hrefTailKey(item.href),
      label: item.name || hrefTailKey(item.href),
      module: item.module || null,
      href: item.href,
      roles: item.roles || null,
      requiredPermission: item.requiredPermission || null,
    }));
}

const APP_NAV_PAGES = {
  home: HOME_PAGES,
  ims: flattenNavRegistry(NAV_REGISTRY),
  task: flattenTaskSidebar(TASK_SIDEBAR_MENU),
  settings: flattenNavRegistry(SETTINGS_NAV_REGISTRY, { includeGroupInLabel: false }),
};

export function getAppNavPages(appKey = "ims") {
  const key = String(appKey || "ims").trim().toLowerCase();
  return APP_NAV_PAGES[key] || HOME_PAGES;
}

export function canSeeNavPage(item = {}, role = "", canAccess = null) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "super_admin" || normalizedRole === "super admin") return true;
  if (item.requiredPermission && canAccess) {
    return canAccess(item.requiredPermission, "view").allowed;
  }
  if (Array.isArray(item.roles) && item.roles.length) {
    return item.roles.some((entry) => String(entry || "").trim().toLowerCase() === normalizedRole);
  }
  return true;
}

export function isNavPageAllowed(page = {}, canAccess, role = "") {
  if (!canSeeNavPage(page, role, canAccess)) return false;
  if (!page.module) return true;
  return canAccess(page.module, "view").allowed;
}

export function filterAppNavPagesByAccess(appKey = "ims", canAccess, role = "") {
  return getAppNavPages(appKey).filter((page) => isNavPageAllowed(page, canAccess, role));
}

export function getDefaultPageKeyForApp(appKey = "ims", canAccess, role = "") {
  const pages = filterAppNavPagesByAccess(appKey, canAccess, role);
  if (pages.length === 0) return "default";
  const preferred = pages.find((page) => page.value === "dashboard") || pages[0];
  return preferred?.value || "default";
}

export function getPageByKey(appKey = "ims", pageKey = "default") {
  const key = String(pageKey || "default").trim().toLowerCase();
  return getAppNavPages(appKey).find((page) => page.value === key) || null;
}

export function resolvePageKeyFromPathname(appKey = "ims", pathname = "") {
  const cleanPath = String(pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  const pages = [...getAppNavPages(appKey)].sort(
    (a, b) => String(b.href || "").length - String(a.href || "").length,
  );
  for (const page of pages) {
    const href = String(page.href || "").replace(/\/+$/, "");
    if (!href) continue;
    if (cleanPath === href || cleanPath.startsWith(`${href}/`)) {
      return page.value;
    }
  }
  return null;
}

export function isAppMainDashboardRoute(appKey = "ims", pathname = "", pageKey = "") {
  if (String(pageKey || "") !== "dashboard") return false;
  const cleanPath = String(pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  const mainRoutes = {
    ims: "/ims/dashboard",
    task: "/task/dashboard",
    settings: "/settings/dashboard",
    home: "/home",
  };
  return cleanPath === mainRoutes[String(appKey || "").toLowerCase()];
}
