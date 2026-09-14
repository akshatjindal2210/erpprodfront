/**
 * Quick Launch (Ctrl+K) — short code → route mapping.
 *
 * Extend this list to add new shortcuts. Every entry:
 *   - code   : 2–4 character uppercase (must be unique)
 *   - label  : human-readable page name shown in the suggestion list
 *   - route  : absolute path to navigate to
 *   - module : permission module_name (matches MODULES in portalModules.data.js).
 *              `null` = only gated by app access (used for app dashboards).
 *   - app    : app key from PORTAL_APP_KEYS (ims / rmstore / task / hrms /
 *              purchase / production / core). Used with userHasAppAccess so
 *              a user without app access can't jump into it.
 *
 * The dialog filters this list at runtime via useCanAccess + userHasAppAccess
 * so users never see (or can navigate to) codes they lack permission for.
 */

import { ROUTES } from "@/config/routes";

export const QUICK_LAUNCH_CODES = [
  // ── Portal / Home ───────────────────────────────────────────────
  { code: "HM",  label: "Home",                       route: ROUTES.HOME,                    module: null,                        app: null },
  { code: "PAL", label: "Portal Activity Logs",       route: ROUTES.ACTIVITY_LOGS,           module: null,                        app: null },

  // ── IMS ─────────────────────────────────────────────────────────
  { code: "IMS", label: "IMS Dashboard",              route: ROUTES.IMS_DASHBOARD,           module: null,                        app: "ims" },
  { code: "PM",  label: "Product Master",             route: ROUTES.PRODUCT_MASTER,          module: "product_master",            app: "ims" },
  { code: "CM",  label: "Customer Master",            route: ROUTES.CUSTOMER_MASTER,         module: "customer_master",           app: "ims" },
  { code: "CIC", label: "Customer Item Code",         route: ROUTES.CUSTOMER_ITEM_CODE,      module: "customer_item_code",        app: "ims" },
  { code: "PS",  label: "Packing Standard",           route: ROUTES.PACKING_STANDARD,        module: "packing_standard",          app: "ims" },
  { code: "LM",  label: "Store Location Master",      route: ROUTES.LOCATION_MASTER,         module: "location_master",           app: "ims" },
  { code: "TM",  label: "Tray Master",                route: ROUTES.TRAY_MASTER,             module: "tray_master",               app: "ims" },
  { code: "PE",  label: "Packing Entry",              route: ROUTES.PACKING_ENTRY,           module: "packing_entry",             app: "ims" },
  { code: "BX",  label: "Boxes",                      route: ROUTES.BOX_TABLE,               module: "boxes",                     app: "ims" },
  { code: "IS",  label: "Store In (Inventory Inward)",route: ROUTES.INVENTORY_INWARD,        module: "inventory_inwards",         app: "ims" },
  { code: "QH",  label: "QC Hold Material",           route: ROUTES.QC_HOLD_MATERIAL,        module: "qc_hold_material",          app: "ims" },
  { code: "SP",  label: "Schedule Planning",          route: ROUTES.SCHEDULE_PLANNING,       module: "schedule_planning",         app: "ims" },
  { code: "SG",  label: "Shortage",                   route: ROUTES.SHORTAGE,                module: "shortage",                  app: "ims" },
  { code: "FN",  label: "Forwarding Note",            route: ROUTES.FORWARDING_NOTE,         module: "forwarding_note_master",    app: "ims" },
  { code: "OS",  label: "Store Out (Out Entry)",      route: ROUTES.OUT_ENTRY,               module: "out_entry",                 app: "ims" },
  { code: "GE",  label: "Gate Entry",                 route: ROUTES.GATE_ENTRY,              module: "gate_entry",                app: "ims" },
  { code: "OC",  label: "Change / Override Customer", route: ROUTES.STICKER_OVERRIDE,        module: "change_override_customer",  app: "ims" },
  { code: "SA",  label: "Stock Adjustment",           route: ROUTES.STOCK_ADJUSTMENT,        module: "stock_adjustment",          app: "ims" },
  { code: "AU",  label: "Inventory Audit",            route: ROUTES.AUDIT,                   module: "audit",                     app: "ims" },
  { code: "IR",  label: "Inventory Report",           route: ROUTES.ANALYTICS,               module: "inventory_report",          app: "ims" },
  { code: "ES",  label: "ERP Stock Report",           route: ROUTES.ERP_STOCK_REPORT,        module: "erp_stock_report",          app: "ims" },
  { code: "AL",  label: "IMS Activity Logs",          route: ROUTES.LOGS,                    module: "activity_logs",             app: "ims" },
  { code: "BT",  label: "Box Transaction Logs",       route: ROUTES.BOX_TRANSACTION_LOGS,    module: "box_transaction_logs",      app: "ims" },
  { code: "SD",  label: "Sticker Download Logs",      route: ROUTES.STICKER_MANAGEMENT,      module: "sticker_download_logs",     app: "ims" },

  // ── RM Store ────────────────────────────────────────────────────
  { code: "RMS", label: "RM Store Dashboard",         route: ROUTES.RM_STORE_DASHBOARD,      module: null,                        app: "rmstore" },
  { code: "RPM", label: "RM Production Master",       route: ROUTES.RM_PRODUCTION_MASTER,    module: "rm_production_master",      app: "rmstore" },
  { code: "RSM", label: "RM Spec Master",             route: ROUTES.RM_SPEC_MASTER,          module: "rm_spec_master",            app: "rmstore" },
  { code: "RLM", label: "RM Store Location Master",   route: ROUTES.RM_STORE_LOCATION_MASTER,module: "rm_store_location_master",  app: "rmstore" },
  { code: "MRN", label: "MRN Portal",                 route: ROUTES.RM_MRN_PORTAL,           module: "rm_mrn_portal",             app: "rmstore" },
  { code: "COL", label: "Coils",                      route: ROUTES.RM_COIL_TABLE,           module: "rm_coils",                  app: "rmstore" },
  { code: "RSI", label: "RM Store In",                route: ROUTES.RM_STORE_IN,             module: "rm_inventory_inwards",      app: "rmstore" },
  { code: "QC",  label: "RM QC Check",                route: ROUTES.RM_QC_CHECK,             module: "rm_qc_check",               app: "rmstore" },
  { code: "RJ",  label: "RM Rejection",               route: ROUTES.RM_REJECTION,            module: "rm_rejection",              app: "rmstore" },
  { code: "IRQ", label: "Issue Request",              route: ROUTES.RM_ISSUE_REQUEST,        module: "rm_issue_request",          app: "rmstore" },
  { code: "IPR", label: "In-Process Request",         route: ROUTES.RM_IN_PROCESS_REQUEST,   module: "rm_in_process_request",     app: "rmstore" },
  { code: "RSO", label: "RM Store Out",               route: ROUTES.RM_STORE_OUT,            module: "rm_out_entry",              app: "rmstore" },
  { code: "RSA", label: "RM Stock Adjustment",        route: ROUTES.RM_STOCK_ADJUSTMENT,     module: "rm_stock_adjustment",       app: "rmstore" },
  { code: "RIN", label: "RM Inventory Report",        route: ROUTES.RM_INVENTORY_REPORT,     module: "rm_inventory_report",       app: "rmstore" },
  { code: "RAL", label: "RM Store Activity Logs",     route: ROUTES.RM_ACTIVITY_LOGS,        module: "rm_activity_logs",          app: "rmstore" },
  { code: "RCT", label: "Coil Transaction Logs",      route: ROUTES.RM_COIL_TRANSACTION_LOGS,module: "rm_coil_transaction_logs",  app: "rmstore" },
  { code: "RSD", label: "RM Sticker Download Logs",   route: ROUTES.RM_STICKER_DOWNLOAD_LOGS, module: "rm_coil_download_logs",     app: "rmstore" },

  // ── HRMS ────────────────────────────────────────────────────────
  { code: "HR",  label: "HRMS Dashboard",             route: ROUTES.HRMS_DASHBOARD,          module: null,                        app: "hrms" },
  { code: "EM",  label: "Employee Master",            route: ROUTES.HRMS_EMPLOYEES,          module: "hrms_employee",             app: "hrms" },
  { code: "DA",  label: "Daily Attendance",           route: ROUTES.HRMS_ATTENDANCE,         module: "hrms_attendance",           app: "hrms" },
  { code: "AT",  label: "Attendance Log",             route: ROUTES.HRMS_ATTENDANCE_LOG,     module: "hrms_attendance_log",       app: "hrms" },
  { code: "HAL", label: "HRMS Activity Logs",         route: ROUTES.HRMS_ACTIVITY_LOGS,      module: "hrms_activity_logs",        app: "hrms" },

  // ── Purchase ────────────────────────────────────────────────────
  { code: "PU",  label: "Purchase Dashboard",         route: ROUTES.PURCHASE_DASHBOARD,      module: null,                        app: "purchase" },
  { code: "PPM", label: "Purchase Product Master",    route: ROUTES.PURCHASE_MASTER,         module: "purchase_master",           app: "purchase" },
  { code: "PSH", label: "Purchase Shortage",          route: ROUTES.PURCHASE_SHORTAGE,       module: "purchase_shortage",         app: "purchase" },
  { code: "PUL", label: "Purchase Activity Logs",     route: ROUTES.PURCHASE_ACTIVITY_LOGS,  module: "purchase_activity_logs",    app: "purchase" },

  // ── Production ──────────────────────────────────────────────────
  { code: "PR",  label: "Production Dashboard",       route: ROUTES.PRODUCTION_DASHBOARD,    module: null,                        app: "production" },
  { code: "PRM", label: "Production Product Master",  route: ROUTES.PRODUCTION_MASTER,       module: "production_master",         app: "production" },
  { code: "PRS", label: "Production Shortage",        route: ROUTES.PRODUCTION_SHORTAGE,     module: "production_shortage",       app: "production" },
  { code: "PRL", label: "Production Activity Logs",   route: ROUTES.PRODUCTION_ACTIVITY_LOGS,module: "production_activity_logs",  app: "production" },

  // ── Task ────────────────────────────────────────────────────────
  { code: "TSK", label: "Task Dashboard",             route: ROUTES.TASK_DASHBOARD,          module: null,                        app: "task" },
  { code: "TL",  label: "Tasks",                      route: ROUTES.TASK_TASKS,              module: null,                        app: "task" },
  { code: "TR",  label: "Task Reports",               route: ROUTES.TASK_REPORTS,            module: null,                        app: "task" },
  { code: "REC", label: "Recurring Task",             route: ROUTES.TASK_RECURRING,          module: null,                        app: "task" },
  { code: "CLM", label: "CL Task Master",             route: ROUTES.TASK_CL_TASK,            module: "cl_task_master",            app: "task" },
  { code: "CL",  label: "CL Task",                    route: ROUTES.TASK_CL_TASKS,           module: "cl_task",                   app: "task" },
  { code: "CLV", label: "CL Verification",            route: ROUTES.TASK_CL_VERIFICATION,    module: "cl_task_verification",      app: "task" },
  { code: "CLR", label: "CL Task Report",             route: "/task/dashboard/cl-task/report", module: "task_report",             app: "task" },
  { code: "RT",  label: "Red Ticket",                 route: "/task/dashboard/red-ticket",   module: "red_ticket",                app: "task" },
  { code: "CAT", label: "Category",                   route: ROUTES.TASK_CATEGORY,           module: "category",                  app: "task" },
  { code: "HOL", label: "Holiday",                    route: ROUTES.TASK_HOLIDAYS,           module: "holiday",                   app: "task" },
  { code: "LG",  label: "Task Logs",                  route: ROUTES.TASK_LOGS,               module: null,                        app: "task" },

  // ── Admin Console (Settings) ────────────────────────────────────
  { code: "AC",  label: "Admin Console",              route: ROUTES.SETTINGS_DASHBOARD,      module: null,                        app: "core" },
  { code: "US",  label: "User Management",            route: ROUTES.SETTINGS_USERS,          module: "users",                     app: "core" },
  { code: "DP",  label: "Departments",                route: ROUTES.SETTINGS_DEPARTMENTS,    module: "departments",               app: "core" },
  { code: "DG",  label: "Designations",               route: ROUTES.SETTINGS_DESIGNATIONS,   module: "designations",              app: "core" },
  { code: "MD",  label: "System Module",              route: ROUTES.SETTINGS_MODULES,        module: "modules",                   app: "core" },
  { code: "TV",  label: "Training & SOPs",            route: ROUTES.SETTINGS_TRAINING,       module: "training_videos",           app: "core" },
];

/** O(1) lookup by uppercase code. */
export const QUICK_LAUNCH_CODES_BY_CODE = Object.fromEntries(
  QUICK_LAUNCH_CODES.map((entry) => [entry.code.toUpperCase(), entry]),
);

function normalizeHref(href) {
  const path = String(href || "").trim();
  if (!path) return "";
  if (path === "/") return "/";
  return path.replace(/\/+$/, "");
}

/** Sidebar / launcher: resolve the typed code for a nav href. */
export function getQuickLaunchCodeForHref(href) {
  const path = normalizeHref(href);
  if (!path) return null;
  const match = QUICK_LAUNCH_CODES.find((entry) => normalizeHref(entry.route) === path);
  return match?.code || null;
}
