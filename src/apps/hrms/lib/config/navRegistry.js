"use client";

import { Zap, Clock, Users, ScrollText, CalendarCheck } from "lucide-react";
import { ROUTES } from "@/apps/hrms/lib/utils/routes";

export const HRMS_NAV_REGISTRY = [
  { id: "dashboard", name: "Dashboard", icon: <Zap size={16} />, href: ROUTES.HRMS_DASHBOARD, module: null },
  { id: "hrms-employees", name: "Employee Master", icon: <Users size={16} />, href: ROUTES.HRMS_EMPLOYEES, module: "hrms_employee" },
  { id: "attendance-group", name: "Attendance", icon: <Clock size={16} />, module: null,
    subItems: [
      { id: "attendance", name: "Daily Attendance", icon: <CalendarCheck size={14} />, href: ROUTES.HRMS_ATTENDANCE, module: "hrms_attendance" },
      { id: "attendance-log", name: "Attendance Log", icon: <ScrollText size={14} />, href: ROUTES.HRMS_ATTENDANCE_LOG, module: "hrms_attendance_log" },
    ],
  },
];
