// ─── CENTRAL CONFIG — Sidebar + Navbar + Roles + Permissions ─────────────────

import { LayoutDashboard, CheckSquare, Shield, List, CalendarDays, ListCheck, Recycle } from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════
// 1. ROLES
// ════════════════════════════════════════════════════════════════════════════
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  TEAM: "team",
  USER: "user",
};

const ALL   = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER, ROLES.TEAM];
const STAFF = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
const SUPER = [ROLES.SUPER_ADMIN];

// ════════════════════════════════════════════════════════════════════════════
// 2. SIDEBAR MENU
// ════════════════════════════════════════════════════════════════════════════
export const SIDEBAR_MENU = [
  { name: "Dashboard",      icon: LayoutDashboard, href: "/task/dashboard",                roles: ALL   },
  { name: "Tasks",          icon: CheckSquare,     href: "/task/dashboard/tasks",          roles: ALL   },
  { name: "Reports",        icon: ListCheck,       href: "/task/dashboard/reports",        roles: ALL   },
  { name: "Recurring Task", icon: Recycle,         href: "/task/dashboard/recurring-task", roles: ALL   },
  { name: "Category",       icon: List,            href: "/task/dashboard/category",       roles: STAFF },
  { name: "Holiday",        icon: CalendarDays,    href: "/task/dashboard/holidays",       roles: STAFF },
  { name: "Logs",           icon: Shield,          href: "/task/dashboard/logs",           roles: ALL },
];

// ════════════════════════════════════════════════════════════════════════════
// 3. NAVBAR SEARCH PAGES
// ════════════════════════════════════════════════════════════════════════════
export const NAVBAR_PAGES = [
  { label: "Dashboard",       path: "/task/dashboard",                   icon: "🏠",     category: "Main",        roles: ALL   },
  { label: "Tasks",           path: "/task/dashboard/tasks",             icon: "✅",     category: "Management",  roles: ALL   },
  { label: "Reports",         path: "/task/dashboard/reports",           icon: "✅",     category: "Management",  roles: ALL   },
  { label: "Recurring Task",  path: "/task/dashboard/recurring-task",    icon: "✅",     category: "Management",  roles: ALL   },
  { label: "Category",        path: "/task/dashboard/category",          icon: "🏷️",     category: "Master Data", roles: STAFF },
  { label: "Holiday",         path: "/task/dashboard/holidays",          icon: "📅",     category: "Master Data", roles: STAFF },
  { label: "Logs",            path: "/task/dashboard/logs",              icon: "📋",     category: "System",      roles: SUPER },
];

// ════════════════════════════════════════════════════════════════════════════
// 4. NAVBAR PROFILE DROPDOWN
// ════════════════════════════════════════════════════════════════════════════
export const PROFILE_DROPDOWN = [
  { label: "Logs",     href: "/task/dashboard/logs",  icon: Shield,      roles: ALL },
  { label: "My Tasks", href: "/task/dashboard/tasks", icon: CheckSquare, roles: ALL },
];

// ════════════════════════════════════════════════════════════════════════════
// 5. ROLE DISPLAY CONFIG
// ════════════════════════════════════════════════════════════════════════════
export const ROLE_CONFIG = {
  super_admin: {
    label:          "Super Admin",
    badgeClass:     "bg-purple-100 text-purple-700 border border-purple-200",
    avatarGradient: "from-purple-600 to-indigo-500",
  },
  admin: {
    label:          "Admin",
    badgeClass:     "bg-blue-100 text-blue-700 border border-blue-200",
    avatarGradient: "from-blue-600 to-cyan-500",
  },
  user: {
    label:          "User",
    badgeClass:     "bg-slate-100 text-slate-600 border border-slate-200",
    avatarGradient: "from-slate-500 to-slate-400",
  },
  team: {
    label:          "Team",
    badgeClass:     "bg-emerald-100 text-emerald-700 border border-emerald-200",
    avatarGradient: "from-emerald-600 to-teal-500",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 6. FEATURE PERMISSIONS (CRUD)
// ════════════════════════════════════════════════════════════════════════════
export const FEATURE_PERMISSIONS = {
  category: {
    create: STAFF,
    read:   STAFF,
    update: STAFF,
    delete: SUPER,
  },
  holiday: {
    create: STAFF,
    read:   STAFF,
    update: STAFF,
    delete: SUPER,
  },
  department: {
    create: STAFF,
    read:   ALL,
    update: STAFF,
    delete: SUPER,
  },
  designation: {
    create: STAFF,
    read:   ALL,
    update: STAFF,
    delete: SUPER,
  },
  users: {
    create: SUPER,
    read:   STAFF,
    update: SUPER,
    delete: SUPER,
  },
  tasks: {
    create: ALL,
    read:   ALL,
    update: ALL,
    delete: ALL,
  },
  logs: {
    create: SUPER,
    read:   ALL,
    update: SUPER,
    delete: SUPER,
  },
};

// ─── path → feature map ───────────────────────────────────────────────────────
const PATH_FEATURE_MAP = {
  "/task/dashboard/users":        { feature: "users",       action: "read" },
  "/task/dashboard/category":     { feature: "category",    action: "read" },
  "/task/dashboard/holidays":     { feature: "holiday",     action: "read" },
  "/task/dashboard/departments":  { feature: "department",  action: "read" },
  "/task/dashboard/designations": { feature: "designation", action: "read" },
  "/task/dashboard/logs":         { feature: "logs",        action: "read" },
  "/task/dashboard/tasks":        { feature: "tasks",       action: "read" },
  "/task/dashboard/reports":      { feature: "tasks",       action: "read" },
  "/task/dashboard/recurring-task": { feature: "tasks",       action: "read" },
};

// ════════════════════════════════════════════════════════════════════════════
// 7. HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

export function getSidebarMenu(role) {
  if (!role) return [];
  const normalizedRole = role === "executive_assistant" ? "team" : role;
  return SIDEBAR_MENU.filter((item) => item.roles.includes(normalizedRole));
}

export function getNavbarPages(role) {
  if (!role) return [];
  const normalizedRole = role === "executive_assistant" ? "team" : role;
  return NAVBAR_PAGES.filter((page) => page.roles.includes(normalizedRole));
}

export function getProfileDropdown(role) {
  if (!role) return [];
  const normalizedRole = role === "executive_assistant" ? "team" : role;
  return PROFILE_DROPDOWN.filter((item) => item.roles.includes(normalizedRole));
}

export function getRoleConfig(role) {
  const normalizedRole = role === "executive_assistant" ? "team" : role;
  return ROLE_CONFIG[normalizedRole] ?? ROLE_CONFIG["user"];
}

export function hasAccess(role, path) {
  const normalizedRole = role === "executive_assistant" ? "team" : role;
  const rule = PATH_FEATURE_MAP[path];
  if (!rule) return true;

  const permissions = FEATURE_PERMISSIONS[rule.feature];
  if (!permissions) return false;

  return permissions[rule.action]?.includes(normalizedRole) ?? false;
}

export function can(role, feature, action) {
  const normalizedRole = role === "executive_assistant" ? "team" : role;
  const permissions = FEATURE_PERMISSIONS[feature];
  if (!permissions) return false;
  return permissions[action]?.includes(normalizedRole) ?? false;
}
