"use client";

import { Zap, Package, AlertTriangle, History } from "lucide-react";
import { ROUTES } from "@/apps/purchase/lib/utils/routes";

export const PURCHASE_NAV_REGISTRY = [
  { id: "dashboard", name: "Dashboard", icon: <Zap size={16} />, href: ROUTES.PURCHASE_DASHBOARD, module: null },
  {
    id: "masters-group",
    name: "Masters",
    icon: <Package size={16} />,
    module: null,
    subItems: [
      { id: "product-master", name: "Product Master", icon: <Package size={14} />, href: ROUTES.PURCHASE_MASTER, module: "purchase_master" },
    ],
  },
  { id: "shortage", name: "Shortage", icon: <AlertTriangle size={16} />, href: ROUTES.PURCHASE_SHORTAGE, module: "purchase_shortage" },
  {
    id: "purchase-logs-group",
    name: "Logs",
    icon: <History size={16} />,
    module: null,
    subItems: [
      {
        id: "purchase-activity-logs",
        name: "Activity Logs",
        icon: <History size={14} />,
        href: ROUTES.PURCHASE_ACTIVITY_LOGS,
        module: "purchase_activity_logs",
      },
    ],
  },
];
