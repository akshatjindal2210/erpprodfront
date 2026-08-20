import { ROUTES as IMS_ROUTES } from "@/config/routes";
import { ROUTES as RMSTORE_ROUTES } from "@/apps/rmstore/lib/utils/routes";
import { FileText, Activity, Shield, Clock, History, Zap, ClipboardCheck, ShieldCheck, LogOut, BarChart3 } from "lucide-react";
import { getShellAppFromPathname } from "@/config/appsRegistry";

const IMS = [
  { id: "home", label: "Home", icon: <FileText size={13} />, path: IMS_ROUTES.DASHBOARD },
  { id: "modules", label: "Module", icon: <Activity size={13} />, path: IMS_ROUTES.MODULES, module: "modules" },
  { id: "users", label: "User Management", icon: <Shield size={13} />, path: IMS_ROUTES.USERS, module: "users" },
  { id: "logs", label: "Activity Logs", icon: <Clock size={13} />, path: IMS_ROUTES.LOGS, module: "activity_logs" },
  { id: "box-tx", label: "Box Transaction Logs", icon: <History size={13} />, path: IMS_ROUTES.BOX_TRANSACTION_LOGS, module: "box_transaction_logs" },
];

const RMSTORE = [
  { id: "home", label: "Home", icon: <Zap size={13} />, path: RMSTORE_ROUTES.RM_STORE_DASHBOARD },
  { id: "mrn", label: "MRN Portal", icon: <ClipboardCheck size={13} />, path: RMSTORE_ROUTES.RM_MRN_PORTAL, module: "rm_mrn_portal" },
  { id: "qc", label: "QC Check", icon: <ShieldCheck size={13} />, path: RMSTORE_ROUTES.RM_QC_CHECK, module: "rm_qc_check" },
  { id: "out", label: "Store Out", icon: <LogOut size={13} />, path: RMSTORE_ROUTES.RM_STORE_OUT, module: "rm_out_entry" },
  { id: "inv", label: "RM Inventory", icon: <BarChart3 size={13} />, path: RMSTORE_ROUTES.RM_INVENTORY_REPORT, module: "rm_inventory_report" },
  { id: "logs", label: "Activity Logs", icon: <History size={13} />, path: RMSTORE_ROUTES.RM_ACTIVITY_LOGS, module: "rm_activity_logs" },
];

const BY_APP = { home: IMS, ims: IMS, rmstore: RMSTORE };

export function getQuickLinksForPathname(pathname) {
  return BY_APP[getShellAppFromPathname(pathname)?.id] ?? IMS;
}
