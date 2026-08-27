import { ROUTES } from "@/config/routes";
import { ROUTES as RMSTORE_ROUTES } from "@/apps/rmstore/lib/utils/routes";
import { FileText, Activity, Shield, Clock, History, Zap, ClipboardCheck, ShieldCheck, ShieldX, LogOut, BarChart3, CheckSquare, Recycle, LayoutDashboard, ListTodo, AlertTriangle, Truck, Boxes, ClipboardList, FileSearch, Layers, Warehouse, UserCheck, ListCheck, Briefcase, Award, Video, PencilRuler, Package } from "lucide-react";
import { getShellAppFromPathname } from "@/config/appsRegistry";

/** Permission-filtered; Home / role-only links when no module. */
const IMS = [
  { id: "home", label: "Home", icon: <FileText size={13} />, path: ROUTES.DASHBOARD },
  { id: "packing-entry", label: "Packing Entry", icon: <Truck size={13} />, path: ROUTES.PACKING_ENTRY, module: "packing_entry" },
  { id: "boxes", label: "Boxes", icon: <Boxes size={13} />, path: ROUTES.BOX_TABLE, module: "boxes" },
  { id: "store-in", label: "Store In", icon: <ClipboardCheck size={13} />, path: ROUTES.INVENTORY_INWARD, module: "inventory_inwards" },
  { id: "schedule", label: "Schedule", icon: <ClipboardList size={13} />, path: ROUTES.SCHEDULE_PLANNING, module: "schedule_planning" },
  { id: "forwarding", label: "Forwarding Note", icon: <FileSearch size={13} />, path: ROUTES.FORWARDING_NOTE, module: "forwarding_note_master" },
  { id: "store-out", label: "Store Out", icon: <LogOut size={13} />, path: ROUTES.OUT_ENTRY, module: "out_entry" },
  { id: "inventory", label: "Inventory Report", icon: <BarChart3 size={13} />, path: ROUTES.ANALYTICS, module: "inventory_report" },
  { id: "modules", label: "Module", icon: <Activity size={13} />, path: ROUTES.MODULES, module: "modules" },
  { id: "users", label: "User Management", icon: <Shield size={13} />, path: ROUTES.USERS, module: "users" },
  { id: "logs", label: "Activity Logs", icon: <Clock size={13} />, path: ROUTES.LOGS, module: "activity_logs" },
  { id: "box-tx", label: "Box Transaction Logs", icon: <History size={13} />, path: ROUTES.BOX_TRANSACTION_LOGS, module: "box_transaction_logs" },
];

const HOME = [
  { id: "home", label: "Home", icon: <FileText size={13} />, path: ROUTES.HOME },
  { id: "ims", label: "IMS", icon: <Package size={13} />, path: ROUTES.DASHBOARD, appKey: "ims" },
  { id: "rmstore", label: "RM Store", icon: <Warehouse size={13} />, path: RMSTORE_ROUTES.RM_STORE_DASHBOARD, appKey: "rmstore" },
  { id: "task", label: "Task", icon: <CheckSquare size={13} />, path: "/task/dashboard", appKey: "task" },
  { id: "users", label: "User Management", icon: <Shield size={13} />, path: ROUTES.USERS, module: "users" },
  { id: "modules", label: "Module", icon: <Activity size={13} />, path: ROUTES.MODULES, module: "modules" },
  { id: "logs", label: "Activity Logs", icon: <Clock size={13} />, path: ROUTES.LOGS, module: "activity_logs" },
];

const RMSTORE = [
  { id: "home", label: "Home", icon: <Zap size={13} />, path: RMSTORE_ROUTES.RM_STORE_DASHBOARD },
  { id: "mrn", label: "MRN Portal", icon: <ClipboardCheck size={13} />, path: RMSTORE_ROUTES.RM_MRN_PORTAL, module: "rm_mrn_portal" },
  { id: "coils", label: "Coils", icon: <Layers size={13} />, path: RMSTORE_ROUTES.RM_COIL_TABLE, module: "rm_coils" },
  { id: "store-in", label: "Store In", icon: <Warehouse size={13} />, path: RMSTORE_ROUTES.RM_STORE_IN, module: "rm_inventory_inwards" },
  { id: "qc", label: "QC Check", icon: <ShieldCheck size={13} />, path: RMSTORE_ROUTES.RM_QC_CHECK, module: "rm_qc_check" },
  { id: "rejection", label: "RM Rejection", icon: <ShieldX size={13} />, path: RMSTORE_ROUTES.RM_REJECTION, module: "rm_rejection" },
  { id: "issue", label: "Issue Request", icon: <ClipboardList size={13} />, path: RMSTORE_ROUTES.RM_ISSUE_REQUEST, module: "rm_issue_request" },
  { id: "out", label: "Store Out", icon: <LogOut size={13} />, path: RMSTORE_ROUTES.RM_STORE_OUT, module: "rm_out_entry" },
  { id: "inv", label: "RM Inventory", icon: <BarChart3 size={13} />, path: RMSTORE_ROUTES.RM_INVENTORY_REPORT, module: "rm_inventory_report" },
  { id: "logs", label: "Activity Logs", icon: <History size={13} />, path: RMSTORE_ROUTES.RM_ACTIVITY_LOGS, module: "rm_activity_logs" },
];

const TASK = [
  { id: "home", label: "Dashboard", icon: <LayoutDashboard size={13} />, path: "/task/dashboard", roles: ["super_admin", "admin"] },
  { id: "tasks", label: "Tasks", icon: <CheckSquare size={13} />, path: "/task/dashboard/tasks" },
  { id: "reports", label: "Reports", icon: <BarChart3 size={13} />, path: "/task/dashboard/reports", reportMenu: true },
  { id: "recurring", label: "Recurring", icon: <Recycle size={13} />, path: "/task/dashboard/recurring-task" },
  { id: "cl-master", label: "CL Task Master", icon: <ClipboardList size={13} />, path: "/task/dashboard/cl-task", module: "cl_task_master" },
  { id: "cl-tasks", label: "CL Task", icon: <ListTodo size={13} />, path: "/task/dashboard/cl-tasks", module: "cl_task" },
  { id: "cl-verify", label: "CL Verification", icon: <UserCheck size={13} />, path: "/task/dashboard/cl-task/verification", module: "cl_task_verification" },
  { id: "cl-report", label: "CL Report", icon: <ListCheck size={13} />, path: "/task/dashboard/cl-task/report", module: "task_report" },
  { id: "red-ticket", label: "Red Ticket", icon: <AlertTriangle size={13} />, path: "/task/dashboard/red-ticket", module: "red_ticket" },
];

const SETTINGS = [
  { id: "home", label: "Dashboard", icon: <LayoutDashboard size={13} />, path: ROUTES.SETTINGS_DASHBOARD, roles: ["super_admin", "super admin"] },
  { id: "builder", label: "Dashboard Builder", icon: <PencilRuler size={13} />, path: ROUTES.SETTINGS_DASHBOARD_BUILDER, roles: ["super_admin", "super admin"] },
  { id: "users", label: "User Management", icon: <Shield size={13} />, path: ROUTES.USERS, module: "users" },
  { id: "departments", label: "Departments", icon: <Briefcase size={13} />, path: ROUTES.DEPARTMENTS, module: "departments" },
  { id: "designations", label: "Designations", icon: <Award size={13} />, path: ROUTES.DESIGNATIONS, module: "designations" },
  { id: "modules", label: "Module", icon: <Activity size={13} />, path: ROUTES.MODULES, module: "modules" },
  { id: "training", label: "Training", icon: <Video size={13} />, path: ROUTES.TRAINING, module: "training_videos" },
];

const BY_APP = { home: HOME, ims: IMS, rmstore: RMSTORE, task: TASK, settings: SETTINGS };

export function getQuickLinksForPathname(pathname) {
  return BY_APP[getShellAppFromPathname(pathname)?.id] ?? IMS;
}
