import { ClipboardList, Clock, CheckCircle2, Circle, AlertCircle, Bell, CalendarX, CalendarCheck, Zap, Shield, FolderOpen, RefreshCw } from "lucide-react";

const TABS = [
  { key: "assigned_to_me",  label: "Assigned To Me"   },
  { key: "self",            label: "Self Tasks"       },
  { key: "assigned_by_me",  label: "Assigned By Me"   },
  { key: "create_by_me",    label: "Create By Me"     },
  { key: "all",             label: "All Tasks"        },
];

const TABLE_COLS = [
  { label: "#",             key: "task_id"                },
  { label: "Title",         key: "title"                  },
  { label: "Last Remark",   key: "last_remark"            },
  { label: "Status",        key: "status"                 },
  { label: "Due Date",      key: "due_date"               },
  { label: "Reminder Date", key: "reminder_date"          },
  { label: "Category",      key: "category_id"            },
  { label: "Priority",      key: "priority"               },
  { label: "Assigned By",   key: "assigned_by"            },
  { label: "Assigned To",   key: "first_assigned_to_name" },
  { label: "Created At",    key: "created_at"             },
  { label: "Type",          key: "task_type"              },
  { label: "Created By",    key: "created_by_name"        },
];

// ── SINGLE SOURCE OF TRUTH (6 cards per row) ─────────────────────────────────
const STAT_CARDS = [
  { row: 1, key: "open_tasks",      label: "Open Tasks",       icon: FolderOpen,    bg: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-100", ring: "ring-fuchsia-400", barColor: "#c026d3", rowBg: "bg-fuchsia-50/50", badgeCls: ""                                                                 },
  { row: 1, key: "updated_tasks",   label: "Not Viewed",       icon: RefreshCw,     bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-100",   ring: "ring-amber-400",   barColor: "#e0df83", rowBg: "bg-amber-50/50",   badgeCls: "bg-amber-200 text-amber-900 border border-amber-500 font-bold"    },
  { row: 1, key: "total",           label: "Total Tasks",      icon: ClipboardList, bg: "bg-indigo-50",  text: "text-indigo-600",  border: "border-indigo-100",  ring: "ring-indigo-400",  barColor: "#696969", rowBg: "bg-slate-50",      badgeCls: ""                                                                  },
  { row: 1, key: "pending",         label: "Pending",          icon: Circle,        bg: "bg-slate-50",   text: "text-slate-600",   border: "border-slate-100",   ring: "ring-slate-400",   barColor: "#00eeff", rowBg: "bg-slate-100/70",  badgeCls: "bg-slate-200 text-slate-800 border border-slate-400 font-bold"     },
  { row: 1, key: "in_progress",     label: "In Progress",      icon: Clock,         bg: "bg-green-50",   text: "text-green-700",   border: "border-green-100",   ring: "ring-green-500",   barColor: "#0e79aa", rowBg: "bg-green-100/50",  badgeCls: "bg-green-200 text-green-900 border border-green-400 font-bold"     },
  { row: 1, key: "action_required", label: "Action Required",  icon: Zap,           bg: "bg-violet-50",  text: "text-violet-600",  border: "border-violet-100",  ring: "ring-violet-400",  barColor: "#f80511", rowBg: "bg-violet-100/50", badgeCls: ""                                                                 },
  { row: 2, key: "completed",       label: "Completed",        icon: CheckCircle2,  bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", ring: "ring-emerald-400", barColor: "#2bff00", rowBg: "bg-teal-100/50",   badgeCls: "bg-teal-200 text-teal-900 border border-teal-400 font-bold"       },
  { row: 2, key: "overdue",         label: "Overdue",          icon: CalendarX,     bg: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-100",    ring: "ring-rose-500",    barColor: "#d33759d5", rowBg: "bg-red-100/70",    badgeCls: "bg-red-200 text-red-900 border border-red-500 font-bold"          },
  { row: 2, key: "new_today",       label: "New Today",        icon: AlertCircle,   bg: "bg-sky-50",     text: "text-sky-600",     border: "border-sky-100",     ring: "ring-sky-400",     barColor: "#0011ff", rowBg: "bg-blue-100/60",   badgeCls: "bg-blue-200 text-blue-900 border border-blue-400 font-bold"       },
  { row: 2, key: "reminder",        label: "Reminders",        icon: Bell,          bg: "bg-yellow-50",  text: "text-yellow-600",  border: "border-yellow-100",  ring: "ring-yellow-500",  barColor: "#ff8800", rowBg: "bg-orange-100/60", badgeCls: "bg-orange-200 text-orange-900 border border-orange-400 font-bold"  },
  { row: 2, key: "upcoming_due",    label: "Upcoming Due",     icon: CalendarCheck, bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-100",    ring: "ring-blue-400",    barColor: "#ffe600", rowBg: "bg-amber-100/60",  badgeCls: "bg-amber-200 text-amber-900 border border-amber-400 font-bold"    },
  { row: 2, key: "creator_pending", label: "Pending Approval", icon: Shield,        bg: "bg-purple-50",  text: "text-purple-600",  border: "border-purple-100",  ring: "ring-purple-500",  barColor: "#8800ff", rowBg: "bg-purple-100/60", badgeCls: "bg-purple-200 text-purple-900 border border-purple-400 font-bold" },
];


// ── STAT_CARDS se derive ────────────────────────────────────────────────────
const SC             = Object.fromEntries(STAT_CARDS.map((c) => [c.key, c]));
const STAT_COLOR_MAP = Object.fromEntries(STAT_CARDS.map((c) => [c.key, c.barColor]));
const STAT_BG_MAP    = Object.fromEntries(STAT_CARDS.map((c) => [c.key, c.rowBg]));
const STAT_BADGE_MAP = Object.fromEntries(STAT_CARDS.map((c) => [c.key, c.badgeCls]));


// ── ROW_META builder ────────────────────────────────────────────────────────
const makeRowMeta = (key, overrides = {}) => ({
  bg:              SC[key]?.rowBg    ?? "",
  barColor:        SC[key]?.barColor ?? "#e2e8f0",
  badgeCls:        SC[key]?.badgeCls ?? "",
  badge:           null,
  dueDateCls:      "text-slate-500",
  reminderDateCls: "text-slate-500",
  ...overrides,
});

const ROW_META = {
  creator_pending: makeRowMeta("creator_pending", { badge: "Approval", dueDateCls: "text-red-700 font-bold" }),
  reminder:        makeRowMeta("reminder",        { badge: "Reminder", reminderDateCls: "text-orange-700 font-semibold" }),
  overdue:         makeRowMeta("overdue",         { badge: "Overdue", dueDateCls: "text-red-700 font-bold" }),
  due_today:       makeRowMeta("upcoming_due",    { badge: "Due Today", dueDateCls: "text-blue-700 font-semibold" }),
  upcoming_due:    makeRowMeta("upcoming_due",    { badge: "Upcoming Due", dueDateCls: "text-blue-700 font-semibold" }),
  in_progress:     makeRowMeta("in_progress",     { badge: "In Progress" }),
  pending:         makeRowMeta("pending",         { badge: "Pending" }),
  new:             makeRowMeta("new_today",       { badge: "New" }),
  updated:         makeRowMeta("updated_tasks",   { badge: "Not Viewed" }),
  completed:       makeRowMeta("completed",       { badge: "Completed" }),
  closed: {
    bg: "bg-zinc-100/70",
    barColor: SC.total?.barColor ?? "#696969",
    badgeCls: "bg-zinc-200 text-zinc-700 border border-zinc-400 font-bold",
    badge: "Closed",
    dueDateCls: "text-slate-500",
    reminderDateCls: "text-slate-500",
  },
};

const EMPTY_META = { bg: "", barColor: "#e2e8f0", badgeCls: "", badge: null, dueDateCls: "text-slate-500", reminderDateCls: "text-slate-500" };


// ── Color legend ────────────────────────────────────────────────────────────
const COLOR_LEGEND = [
  { label: "Pending Approval",              key: "creator_pending" },
  { label: "Reminder",                      key: "reminder"        },
  { label: "Overdue",                       key: "overdue"         },
  { label: "Upcoming Due / Due Today",      key: "upcoming_due"    },
  { label: "In Progress",                   key: "in_progress"     },
  { label: "New Today",                     key: "new_today"       },
  { label: "Completed",                     key: "completed"       },
].map(({ label, key }) => ({ label, barColor: SC[key]?.barColor }));


const QUICK_FILTER_LABELS = {
  open_tasks:      "Open tasks (in progress)",
  updated_tasks:   "Tasks with unseen updates",
  total:           "All tasks",
  pending:         "Pending tasks",
  in_progress:     "In Progress tasks",
  completed:       "Completed tasks",
  action_required: "Action Required tasks",
  overdue:         "Overdue tasks",
  new_today:       "New tasks (today)",
  reminder:        "Tasks with reminders",
  upcoming_due:    "Upcoming due tasks",
  creator_pending: "Awaiting your approval",
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Sub Page
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// taskColors.js — SINGLE SOURCE OF TRUTH
// These are the barColors for STAT_CARDS — no new color, same values
// TasksPage ROW_META:
//   approval   → rc("approval")  → STAT_COLOR_MAP.creator_pending → #8800ff
//   overdue    → rc("overdue")   → STAT_COLOR_MAP.overdue         → #ff0000
//   due_today  → rc("due_today") → STAT_COLOR_MAP.upcoming_due    → #ffe600
//   reminder   → rc("reminder")  → STAT_COLOR_MAP.reminder        → #ff8800
//   new/updated→ rc("new")       → STAT_COLOR_MAP.new_today       → #0011ff
//   completed  → STAT_COLOR_MAP.completed                         → #2bff00
//   in_progress→ STAT_COLOR_MAP.in_progress                       → #0e79aa
//   pending    → STAT_COLOR_MAP.pending                           → #00eeff
//   closed/tot → STAT_COLOR_MAP.total                             → #696969
// ─────────────────────────────────────────────────────────────────────────────

const TASK_COLORS = {
  approval:     { bar: "#8800ff", tag: "Approval",    tagCls: "bg-purple-200 text-purple-900 border border-purple-400 font-bold" },
  overdue:      { bar: "#ff0000", tag: "Overdue",     tagCls: "bg-red-200 text-red-900 border border-red-500 font-bold"         },
  due_today:    { bar: "#ffe600", tag: "Due Today",   tagCls: "bg-amber-200 text-amber-900 border border-amber-400 font-bold"   },
  reminder:     { bar: "#ff8800", tag: "Reminder",    tagCls: "bg-orange-200 text-orange-900 border border-orange-400 font-bold"},
  upcoming_due: { bar: "#ffe600", tag: "Upcoming Due",tagCls: "bg-amber-200 text-amber-900 border border-amber-400 font-bold"   },
  new_today:    { bar: "#0011ff", tag: "New",         tagCls: "bg-blue-200 text-blue-900 border border-blue-400 font-bold"      },
  completed:    { bar: "#2bff00", tag: null,          tagCls: ""                                                                },
  in_progress:  { bar: "#0e79aa", tag: null,          tagCls: ""                                                                },
  pending:      { bar: "#00eeff", tag: null,          tagCls: ""                                                                },
  closed:       { bar: "#696969", tag: "Closed",      tagCls: "bg-zinc-200 text-zinc-700 border border-zinc-400 font-bold"      },
  default:      { bar: "#e2e8f0", tag: null,          tagCls: ""                                                                },
};

const DONE_STATUSES = ["completed", "closed"]; 


// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const SIDEBAR_TABS = [
  { key: "action_required", label: "Action Required", icon: Zap         },
  { key: "active",          label: "Active",          icon: Circle       },
  { key: "all",             label: "All",             icon: ClipboardList },
  { key: "completed",       label: "Done",            icon: CheckCircle2 },
];

const ACTIVE_STATUSES = ["pending", "in_progress", "on_hold", "forwarded", "pending_approval", "overdue"];


/** Dashboard stat keys — shared with notification templates */
const DASHBOARD_STAT_KEYS = STAT_CARDS.map((c) => c.key);

export { TABS, TABLE_COLS, STAT_CARDS, DASHBOARD_STAT_KEYS, SC, ROW_META, EMPTY_META, COLOR_LEGEND, QUICK_FILTER_LABELS, TASK_COLORS, DONE_STATUSES, SIDEBAR_TABS, ACTIVE_STATUSES }