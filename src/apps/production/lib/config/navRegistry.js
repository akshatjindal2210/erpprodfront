"use client";

import { Zap, Package, AlertTriangle, History, ClipboardList, Wrench, LayoutGrid, CalendarDays, Factory, ClipboardPen, Table2, Users } from "lucide-react";
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
  { id: "tooling", name: "Tooling", icon: <Wrench size={16} />, href: ROUTES.PRODUCTION_TOOLING, module: "production_tooling" },
  { id: "job-card", name: "Maintain Job Card", icon: <ClipboardList size={16} />, href: ROUTES.PRODUCTION_JOB_CARD, module: "production_job_card" },
  {
    id: "production-planning-group",
    name: "Production Planning",
    icon: <Factory size={16} />,
    module: "production_planning",
    subItems: [
      { id: "job-card-board", name: "Card Board", icon: <LayoutGrid size={14} />, href: ROUTES.PRODUCTION_JOB_CARD_BOARD, module: "production_planning" },
      { id: "job-card-calendar", name: "Card Calendar", icon: <CalendarDays size={14} />, href: ROUTES.PRODUCTION_JOB_CARD_CALENDAR, module: "production_planning" },
      { id: "planning-table", name: "Table View", icon: <Table2 size={14} />, href: ROUTES.PRODUCTION_PLANNING_TABLE, module: "production_planning" },
    ],
  },
  { id: "production-entry", name: "Production Entry", icon: <ClipboardPen size={16} />, href: ROUTES.PRODUCTION_ENTRY, module: "production_entry" },
  { id: "manpower", name: "Manpower", icon: <Users size={16} />, href: ROUTES.PRODUCTION_MANPOWER, module: "production_manpower" },
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
