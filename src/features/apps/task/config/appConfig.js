// ─── CENTRAL CONFIG — Sidebar + Navbar + Roles + Permissions ─────────────────

import { LayoutDashboard, CheckSquare, Shield, List, CalendarDays, Recycle, Bell, BarChart3 } from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════
// 1. ROLES
// ════════════════════════════════════════════════════════════════════════════
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  EXECUTIVE_ASSISTANT: "executive_assistant",
  USER: "user",
};

const ALL   = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER, ROLES.EXECUTIVE_ASSISTANT];
const STAFF = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
const SUPER = [ROLES.SUPER_ADMIN];
/** Task Report menu — EA + managers (user+manager); not plain user / user+executive designation */
const TASK_REPORT_MENU_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EXECUTIVE_ASSISTANT, ROLES.USER];

// ─── Dashboard visibility toggle ─────────────────────────────────────────────
// true  = hide Dashboard from user/team (admin & super_admin only)
// false = show Dashboard to all roles (original behaviour)
// To enable user dashboard in the future, set this to false — no other changes needed.
export const HIDE_DASHBOARD_FROM_USERS = true;

const DASHBOARD_ROLES = HIDE_DASHBOARD_FROM_USERS ? STAFF : ALL;

// ════════════════════════════════════════════════════════════════════════════
// 2. SIDEBAR MENU
// ════════════════════════════════════════════════════════════════════════════
export const SIDEBAR_MENU = [
  { name: "Dashboard",      icon: LayoutDashboard, href: "/task/dashboard",                roles: DASHBOARD_ROLES },
  { name: "Tasks",          icon: CheckSquare,     href: "/task/dashboard/tasks",          roles: ALL   },
  { name: "Reports",        icon: BarChart3,       href: "/task/dashboard/reports",        roles: TASK_REPORT_MENU_ROLES },
  { name: "Recurring Task", icon: Recycle,         href: "/task/dashboard/recurring-task", roles: ALL   },
  // { name: "CL Task",        icon: ClipboardList,   href: "/task/dashboard/cl-task",                roles: ALL, module: "cl_task" },
  // { name: "My CL Tasks",    icon: ListTodo,        href: "/task/dashboard/cl-task/my-tasks",       roles: ALL   },
  // { name: "CL Verification", icon: UserCheck,      href: "/task/dashboard/cl-task/verification",   roles: ALL, module: "cl_task_verification" },
  // { name: "CL Task Report", icon: ListCheck,       href: "/task/dashboard/cl-task/report",         roles: ALL, module: "task_report" },
  // { name: "Red Ticket",     icon: AlertTriangle,   href: "/task/dashboard/red-ticket",             roles: ALL, module: "red_ticket" },
  { name: "Category",       icon: List,            href: "/task/dashboard/category",       roles: STAFF },
  { name: "Holiday",        icon: CalendarDays,    href: "/task/dashboard/holidays",       roles: STAFF },
  { name: "Logs",           icon: Shield,          href: "/task/dashboard/logs",           roles: ALL },
  { name: "Notifications",  icon: Bell,            href: "/task/dashboard/notifications",  roles: SUPER },
];

// ════════════════════════════════════════════════════════════════════════════
// 3. NAVBAR SEARCH PAGES
// ════════════════════════════════════════════════════════════════════════════
export const NAVBAR_PAGES = [
  { label: "Dashboard",       path: "/task/dashboard",                   icon: "🏠",     category: "Main",        roles: DASHBOARD_ROLES },
  { label: "Tasks",           path: "/task/dashboard/tasks",             icon: "✅",     category: "Management",  roles: ALL   },
  { label: "Reports",         path: "/task/dashboard/reports",           icon: "📊",     category: "Management",  roles: TASK_REPORT_MENU_ROLES },
  { label: "Recurring Task",  path: "/task/dashboard/recurring-task",    icon: "✅",     category: "Management",  roles: ALL   },
  // { label: "CL Task",         path: "/task/dashboard/cl-task",                icon: "📋",     category: "Management",  roles: ALL, module: "cl_task" },
  // { label: "My CL Tasks",     path: "/task/dashboard/cl-task/my-tasks",       icon: "📝",     category: "Management",  roles: ALL   },
  // { label: "CL Verification", path: "/task/dashboard/cl-task/verification", icon: "✅",     category: "Management",  roles: ALL, module: "cl_task_verification" },
  // { label: "CL Task Report",  path: "/task/dashboard/cl-task/report",         icon: "📊",     category: "Management",  roles: ALL, module: "task_report" },
  // { label: "Red Ticket",      path: "/task/dashboard/red-ticket",             icon: "🎫",     category: "Management",  roles: ALL, module: "red_ticket" },
  { label: "Category",        path: "/task/dashboard/category",          icon: "🏷️",     category: "Master Data", roles: STAFF },
  { label: "Holiday",         path: "/task/dashboard/holidays",          icon: "📅",     category: "Master Data", roles: STAFF },
  { label: "Logs",            path: "/task/dashboard/logs",              icon: "📋",     category: "System",      roles: SUPER },
  { label: "Notifications",   path: "/task/dashboard/notifications",     icon: "🔔",     category: "System",      roles: SUPER },
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
  executive_assistant: {
    label:          "Executive Assistant",
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
  task_report: {
    read:   TASK_REPORT_MENU_ROLES,
    update: STAFF,
    delete: SUPER,
  },
  logs: {
    create: SUPER,
    read:   ALL,
    update: SUPER,
    delete: SUPER,
  },
  notifications: {
    read:   SUPER,
    update: SUPER,
  },
  // cl_task: {
  //   create: ALL,
  //   read:   ALL,
  //   update: ALL,
  //   delete: ALL,
  // },
  // cl_task_verification: {
  //   read:   ALL,
  //   update: ALL,
  //   delete: ALL,
  // },
  // task_report: {
  //   read:   ALL,
  //   update: ALL,
  //   delete: ALL,
  // },
  // red_ticket: {
  //   create: ALL,
  //   read:   ALL,
  //   update: ALL,
  //   delete: ALL,
  // },
  dashboard: {
    read: DASHBOARD_ROLES,
  },
};

// ─── path → feature map ───────────────────────────────────────────────────────
const PATH_FEATURE_MAP = {
  "/task/dashboard":              { feature: "dashboard",   action: "read" },
  "/task/dashboard/users":        { feature: "users",       action: "read" },
  "/task/dashboard/category":     { feature: "category",    action: "read" },
  "/task/dashboard/holidays":     { feature: "holiday",     action: "read" },
  "/task/dashboard/departments":  { feature: "department",  action: "read" },
  "/task/dashboard/designations": { feature: "designation", action: "read" },
  "/task/dashboard/logs":         { feature: "logs",        action: "read" },
  "/task/dashboard/tasks":        { feature: "tasks",       action: "read" },
  "/task/dashboard/reports":      { feature: "tasks",       action: "read" },
  "/task/dashboard/cl-task/report": { feature: "task_report", action: "read" },
  "/task/dashboard/recurring-task": { feature: "tasks",       action: "read" },
  // "/task/dashboard/cl-task":        { feature: "cl_task",     action: "read" },
  // "/task/dashboard/cl-task/my-tasks": { feature: "tasks",     action: "read" },
  // "/task/dashboard/cl-task/verification": { feature: "cl_task_verification", action: "read" },
  // "/task/dashboard/red-ticket":     { feature: "red_ticket",  action: "read" },
  "/task/dashboard/notifications":  { feature: "notifications", action: "read" },
};

// ════════════════════════════════════════════════════════════════════════════
// 7. HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

function normalizeTaskRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "team") return ROLES.EXECUTIVE_ASSISTANT;
  return r;
}

function designationName(user) {
  return String(user?.designation?.name ?? user?.designation_name ?? "").toLowerCase().trim();
}

export function isManagerDesignation(user) {
  return designationName(user) === "manager";
}

export function isExecutiveDesignation(user) {
  const d = designationName(user);
  if (!d) return false;
  if (d === "manager") return false;
  return d === "executive" || d === "executive assistant" || d.includes("executive");
}

/** Task Report page only — admin-like filters & data (not global app staff) */
export function hasFullTaskReportAccess(role) {
  const r = normalizeTaskRole(role);
  return STAFF.includes(r) || r === ROLES.EXECUTIVE_ASSISTANT;
}

/** Task Report: admin/EA = all; user+manager = own dept; others = no */
export function canAccessTaskReport(role, user = null) {
  const r = normalizeTaskRole(role);
  if (hasFullTaskReportAccess(role)) return true;
  if (r !== ROLES.USER) return false;

  const d = designationName(user);
  if (!d) return false;

  if (isExecutiveDesignation(user)) return false;
  return isManagerDesignation(user);
}

/** Sidebar / navbar report link */
export function canShowTaskReportMenu(role, user = null) {
  if (hasFullTaskReportAccess(role)) return true;
  return canAccessTaskReport(role, user);
}

export function getTaskHomePath(role) {
  if (!HIDE_DASHBOARD_FROM_USERS) return "/task/dashboard";
  const normalizedRole = normalizeTaskRole(role);
  return STAFF.includes(normalizedRole) ? "/task/dashboard" : "/task/dashboard/tasks";
}

export function canViewTaskDashboard(role) {
  if (!HIDE_DASHBOARD_FROM_USERS) return true;
  return STAFF.includes(normalizeTaskRole(role));
}

export function getSidebarMenu(role) {
  if (!role) return [];
  return SIDEBAR_MENU.filter((item) => item.roles.includes(normalizeTaskRole(role)));
}

export function getNavbarPages(role) {
  if (!role) return [];
  return NAVBAR_PAGES.filter((page) => page.roles.includes(normalizeTaskRole(role)));
}

export function getProfileDropdown(role) {
  if (!role) return [];
  return PROFILE_DROPDOWN.filter((item) => item.roles.includes(normalizeTaskRole(role)));
}

export function getRoleConfig(role) {
  const normalizedRole = normalizeTaskRole(role);
  return ROLE_CONFIG[normalizedRole] ?? ROLE_CONFIG["user"];
}

export function hasAccess(role, path, user = null) {
  const normalizedRole = normalizeTaskRole(role);
  if (path === "/task/dashboard/reports") {
    return canAccessTaskReport(role, user);
  }
  const rule = PATH_FEATURE_MAP[path];
  if (!rule) return true;

  // When HIDE_DASHBOARD_FROM_USERS is false, /task/dashboard is open to all roles
  if (rule.feature === "dashboard" && !HIDE_DASHBOARD_FROM_USERS) return true;

  const permissions = FEATURE_PERMISSIONS[rule.feature];
  if (!permissions) return false;

  return permissions[rule.action]?.includes(normalizedRole) ?? false;
}

export function can(role, feature, action) {
  const normalizedRole = normalizeTaskRole(role);
  const permissions = FEATURE_PERMISSIONS[feature];
  if (!permissions) return false;
  return permissions[action]?.includes(normalizedRole) ?? false;
}
