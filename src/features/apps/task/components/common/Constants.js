import { ArrowRight, ClipboardList, Settings, Shield, TrendingUp, User, UserIcon, Zap } from "lucide-react";

// Task
export const PRIORITIES = ["low", "medium", "high"];
export const TASK_STATUSES = ["pending", "completed"];
export const TASK_STATUSES_OPTIONS = ["pending", "in_progress", "completed"];

// export const TASK_STATUSES = ["pending", "in_progress", "on_hold", "completed"];
export const RECURRENCE_TYPES = ["daily", "weekly", "monthly", "yearly"];

export const WEEKDAYS = [
  { key: "0", label: "Sun" },
  { key: "1", label: "Mon" },
  { key: "2", label: "Tue" },
  { key: "3", label: "Wed" },
  { key: "4", label: "Thu" },
  { key: "5", label: "Fri" },
  { key: "6", label: "Sat" },
];

export const PRIORITY_CONFIG = {
  low:    { label: "Low",    badge: "bg-slate-100  text-slate-600  border-slate-200",  dot: "bg-slate-400"   },
  medium: { label: "Medium", badge: "bg-amber-50   text-amber-700  border-amber-200",  dot: "bg-amber-400"   },
  high:   { label: "High",   badge: "bg-rose-50    text-rose-700   border-rose-200",   dot: "bg-rose-500"    },
};

export const PRIORITY_CONFIG_DETAIL_PAGE = {
  low:    { label: "Low",    color: "text-slate-500", bg: "bg-slate-100 border-slate-200" },
  medium: { label: "Medium", color: "text-amber-600", bg: "bg-amber-50 border-amber-200"  },
  high:   { label: "High",   color: "text-rose-600",  bg: "bg-rose-50 border-rose-200"    },
};


export const TASK_STATUS_CONFIG = {
  pending:          { label: "Pending",          color: "bg-amber-100 text-amber-700 border-amber-200",       dot: "bg-amber-400"   },
  in_progress:      { label: "In Progress",      color: "bg-blue-100 text-blue-700 border-blue-200",          dot: "bg-blue-400"    },
  on_hold:          { label: "On Hold",          color: "bg-orange-100 text-orange-700 border-orange-200",    dot: "bg-orange-400"  },
  forwarded:        { label: "Forwarded",        color: "bg-violet-100 text-violet-700 border-violet-200",    dot: "bg-violet-400"  },
  pending_approval: { label: "Pending Approval", color: "bg-amber-100 text-amber-800 border-amber-300",       dot: "bg-amber-500"   },
  completed:        { label: "Completed",        color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
  overdue:          { label: "Overdue",          color: "bg-rose-100 text-rose-700 border-rose-200",          dot: "bg-rose-400"    },
  creator_pending:  { label: "Creator Review",    color: "bg-indigo-100 text-indigo-700 border-indigo-200",    dot: "bg-indigo-400" },
  creator_reject:   { label: "Rejected by Creator", color: "bg-rose-100 text-rose-700 border-rose-200",        dot: "bg-rose-500" },
};

export const TASK_STATUS_CONFIG_FOR_TABLE = {
  pending:     { label: "Pending",     badge: "bg-slate-100  text-slate-600  border-slate-200",   dot: "bg-slate-400"   },
  in_progress: { label: "In Progress", badge: "bg-indigo-50  text-indigo-700 border-indigo-200",  dot: "bg-indigo-500"  },
  completed:   { label: "Completed",   badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
};

export const MONTHS = [
  { value: "01", label: "January",   short: "Jan", days: 31 },
  { value: "02", label: "February",  short: "Feb", days: 28 },
  { value: "03", label: "March",     short: "Mar", days: 31 },
  { value: "04", label: "April",     short: "Apr", days: 30 },
  { value: "05", label: "May",       short: "May", days: 31 },
  { value: "06", label: "June",      short: "Jun", days: 30 },
  { value: "07", label: "July",      short: "Jul", days: 31 },
  { value: "08", label: "August",    short: "Aug", days: 31 },
  { value: "09", label: "September", short: "Sep", days: 30 },
  { value: "10", label: "October",   short: "Oct", days: 31 },
  { value: "11", label: "November",  short: "Nov", days: 30 },
  { value: "12", label: "December",  short: "Dec", days: 31 },
];


// User

// ── Matches DB ENUM: status ENUM('active','inactive','suspended')
export const USER_STATUSES = ["active", "inactive", "suspended"];

// ── Status badge styles (lowercase keys matching DB values)
export const USER_STATUS_CONFIG = {
  active:    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", label: "Active"    },
  inactive:  { bg: "bg-slate-100",  text: "text-slate-600",   border: "border-slate-200",   dot: "bg-slate-400",  label: "Inactive"  },
  suspended: { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    dot: "bg-rose-500",   label: "Suspended" },
};


export const USER_TYPE_CONFIG = {
  super_admin: {
    label: "Super Admin",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: <Shield size={12} className="text-amber-500" />
  },
  admin: {
    label: "Admin",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    icon: <Settings size={12} className="text-indigo-500" />
  },
  user: {
    label: "User",
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
    icon: <UserIcon size={12} className="text-slate-400" />
  }
};

// ── Avatar gradient colors
export const AVATAR_COLORS = [
  "from-violet-400 to-purple-500",
  "from-blue-400 to-cyan-500",
  "from-emerald-400 to-teal-500",
  "from-orange-400 to-amber-500",
  "from-rose-400 to-pink-500",
  "from-indigo-400 to-blue-500",
];

export function getAvatarColor(id) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}


// Dashboard

// ─── Status badge config ──────────────────────────────────────────────────────
export const STATUS_CFG = {
  active:    { label: "Active",    dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  inactive:  { label: "Inactive",  dot: "bg-slate-400",   badge: "bg-slate-100  text-slate-600  border-slate-200"   },
  suspended: { label: "Suspended", dot: "bg-rose-500",    badge: "bg-rose-50    text-rose-700   border-rose-200"    },
  pending:   { label: "Pending",   dot: "bg-amber-500",   badge: "bg-amber-50   text-amber-700  border-amber-200"   },
};

// ─── Status bar colors ────────────────────────────────────────────────────────
export const STATUS_BAR_COLOR = {
  active:    "bg-emerald-500",
  inactive:  "bg-slate-300",
  suspended: "bg-rose-500",
};

// ─── Avatar gradients ─────────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  "from-violet-400 to-purple-500",
  "from-blue-400   to-cyan-500",
  "from-emerald-400 to-teal-500",
  "from-orange-400 to-amber-500",
  "from-rose-400   to-pink-500",
  "from-indigo-400 to-blue-500",
];

export const getAvatarGradient = (id) => AVATAR_GRADIENTS[id % AVATAR_GRADIENTS.length];

// ─── Constants ────────────────────────────────────────────────────────────────
export const ROLE_LABELS = { super_admin: "Super Admin", admin: "Admin", user: "User" };


// ___ Navbar
export const PRIORITY_DOT  = { high: "bg-rose-500", medium: "bg-amber-400", low: "bg-slate-400" };

export const STATUS_BADGE  = {
  active:      "bg-emerald-50 text-emerald-700",
  inactive:    "bg-slate-100 text-slate-500",
  suspended:   "bg-rose-50 text-rose-600",
  pending:     "bg-amber-50 text-amber-700",
  in_progress: "bg-blue-50 text-blue-700",
  completed:   "bg-emerald-50 text-emerald-700",
};

// ___ Dashboard

export const FALLBACK = {
  totalUsers: 0, activeUsers: 0, inactiveUsers: 0, suspendedUsers: 0, newThisMonth: 0, totalDepts: 0,
  rootUsers:    { total: 0, active: 0, inactive: 0, suspended: 0 },
  tasks:        { total: 0, pending: 0, inProgress: 0, completed: 0, onHold: 0, overdue: 0, highPriority: 0, completedToday: 0 },
  usersByDept:  [], usersByStatus: [], recentUsers: [], topTasks: [], reminderTasks: [],
};

export const PIE_COLORS = ["#10b981", "#94a3b8", "#f43f5e", "#6366f1"];

export const STATUS_BADGE_DASHBOARD = {
  active:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive:    "bg-slate-50 text-slate-500 border-slate-200",
  suspended:   "bg-rose-50 text-rose-700 border-rose-200",
  pending:     "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  on_hold:     "bg-orange-50 text-orange-700 border-orange-200",
  overdue:     "bg-rose-50 text-rose-700 border-rose-200",
};

export const PRIORITY_BADGE = {
  high:   "bg-rose-50 text-rose-600 border-rose-200",
  medium: "bg-amber-50 text-amber-600 border-amber-200",
  low:    "bg-slate-50 text-slate-500 border-slate-200",
};

// ------- Task ------
// ── Tabs ──────────────────────────────────────────────────────────────────────
export const TABS = [
  // { key: "all",         label: "All Tasks"      },
  // { key: "created",     label: "Created by Me"  },
  // { key: "assigned_to", label: "Assigned to Me" },
  // { key: "self",        label: "My Self Tasks"  },
  { key: "action_required", label: "Action Required", icon: Zap         },
  { key: "assigned_to_me",  label: "Assigned To Me",  icon: ArrowRight  },
  { key: "assigned_by_me",  label: "Assigned By Me",  icon: TrendingUp  },
  { key: "self",            label: "Self Tasks",      icon: User        },
  { key: "all",             label: "All Tasks",       icon: ClipboardList },
];