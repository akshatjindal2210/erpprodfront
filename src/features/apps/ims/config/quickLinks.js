import { ROUTES } from "@/config/routes";
import { FileText, Activity, Shield, Clock, History } from "lucide-react";

export const QUICK_LINKS_CONFIG = [
  { id: "docs", label: "Home", icon: <FileText size={13} />, path: ROUTES.DASHBOARD }, 
  { id: "nodes", label: "Module", icon: <Activity size={13} />, path: ROUTES.MODULES, module: "modules" }, 
  { id: "security", label: "User Management", icon: <Shield size={13} />, path: ROUTES.USERS, module: "users" }, 
  { id: "logs", label: "Activity Logs", icon: <Clock size={13} />, path: ROUTES.LOGS, module: "activity_logs" },
  { id: "box-tx-logs", label: "Box Transaction Logs", icon: <History size={13} />, path: ROUTES.BOX_TRANSACTION_LOGS, module: "box_transaction_logs" },
];