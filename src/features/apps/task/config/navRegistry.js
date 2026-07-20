"use client";

import { LayoutDashboard, CheckSquare, Shield, List, CalendarDays, Recycle, BarChart3, ClipboardList, ListTodo, UserCheck, ListCheck, AlertTriangle } from "lucide-react";
import { SIDEBAR_MENU } from "@/features/apps/task/config/appConfig";

/** Map SIDEBAR_MENU → core Sidebar / RootLayout registry shape (IMS / Settings style). */
export const TASK_NAV_REGISTRY = SIDEBAR_MENU.map((item) => {
  const Icon = item.icon;
  return {
    id: item.href.replace(/\//g, "-").replace(/^-/, "") || item.name.toLowerCase(),
    name: item.name,
    icon: <Icon size={16} />,
    href: item.href,
    module: item.module ?? null,
    roles: item.roles,
  };
});

/** Fallback icon map if needed elsewhere — kept for search pages. */
export const TASK_NAV_ICONS = {
  Dashboard: LayoutDashboard,
  Tasks: CheckSquare,
  Reports: BarChart3,
  "Recurring Task": Recycle,
  "CL Task Master": ClipboardList,
  "CL Task": ListTodo,
  "CL Verification": UserCheck,
  "CL Task Report": ListCheck,
  "Red Ticket": AlertTriangle,
  Category: List,
  Holiday: CalendarDays,
  Logs: Shield,
};
