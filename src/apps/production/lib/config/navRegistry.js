"use client";

import { Zap, Package, AlertTriangle, History } from "lucide-react";
import { ROUTES } from "@/apps/production/lib/utils/routes";

export const PRODUCTION_NAV_REGISTRY = [
  { id: "dashboard", name: "Dashboard", icon: <Zap size={16} />, href: ROUTES.PRODUCTION_DASHBOARD, module: null },
  {
    id: "masters-group",
    name: "Masters",
    icon: <Package size={16} />,
    module: null,
    subItems: [
      { id: "product-master", name: "Product Master", icon: <Package size={14} />, href: ROUTES.PRODUCTION_MASTER, module: "production_master" },
    ],
  },
  { id: "shortage", name: "Shortage", icon: <AlertTriangle size={16} />, href: ROUTES.PRODUCTION_SHORTAGE, module: "production_shortage" },
  {
    id: "production-logs-group",
    name: "Logs",
    icon: <History size={16} />,
    module: null,
    subItems: [
      {
        id: "production-activity-logs",
        name: "Activity Logs",
        icon: <History size={14} />,
        href: ROUTES.PRODUCTION_ACTIVITY_LOGS,
        module: "production_activity_logs",
      },
    ],
  },
];
