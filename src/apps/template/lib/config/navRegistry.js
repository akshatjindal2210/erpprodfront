"use client";

import { Zap, ClipboardList } from "lucide-react";
import { ROUTES } from "@/apps/template/lib/utils/routes";

export const TEMPLATE_NAV_REGISTRY = [
  { id: "dashboard", name: "Dashboard", icon: <Zap size={16} />, href: ROUTES.TEMPLATE_DASHBOARD, module: null },
  { id: "records", name: "Records", icon: <ClipboardList size={16} />, href: ROUTES.TEMPLATE_RECORDS, module: "template_record" },
];
