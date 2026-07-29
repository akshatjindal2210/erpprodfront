"use client";

import { Zap, Package, Locate, Factory, FileText, ClipboardCheck, Layers, Warehouse, ShieldCheck, ShieldX, ClipboardList, LogOut, BarChart3, History, Sticker, Scale, RefreshCcw } from "lucide-react";
import { ROUTES } from "@/apps/rmstore/lib/utils/routes";

export const RM_STORE_NAV_REGISTRY = [
  {
    id: "dashboard",
    name: "Dashboard",
    icon: <Zap size={16} />,
    href: ROUTES.RM_STORE_DASHBOARD,
    module: null,
  },
  {
    id: "masters-group",
    name: "Masters",
    icon: <Package size={16} />,
    module: null,
    subItems: [
      {
        id: "production-master",
        name: "Production Master",
        icon: <Factory size={14} />,
        href: ROUTES.RM_PRODUCTION_MASTER,
        module: "rm_production_master",
      },
      {
        id: "rm-spec-master",
        name: "RM Spec Master",
        icon: <FileText size={14} />,
        href: ROUTES.RM_SPEC_MASTER,
        module: "rm_spec_master",
      },
      {
        id: "rm-store-location-master",
        name: "RM Store Location Master",
        icon: <Locate size={14} />,
        href: ROUTES.RM_STORE_LOCATION_MASTER,
        module: "rm_store_location_master",
      },
    ],
  },
  {
    id: "mrn-portal",
    name: "MRN Portal",
    icon: <ClipboardCheck size={16} />,
    href: ROUTES.RM_MRN_PORTAL,
    module: "rm_mrn_portal",
  },
  {
    id: "rm-coils",
    name: "Coils",
    icon: <Layers size={16} />,
    href: ROUTES.RM_COIL_TABLE,
    module: "rm_coils",
  },
  {
    id: "rm-store-in",
    name: "Store In",
    icon: <Warehouse size={16} />,
    href: ROUTES.RM_STORE_IN,
    module: "rm_inventory_inwards",
  },
  {
    id: "rm-qc-check",
    name: "QC Check",
    icon: <ShieldCheck size={16} />,
    href: ROUTES.RM_QC_CHECK,
    module: "rm_qc_check",
  },
  {
    id: "rm-qc-rejection",
    name: "RM Rejection",
    icon: <ShieldX size={16} />,
    href: ROUTES.RM_QC_REJECTION,
    module: "rm_qc_rejection",
  },
  {
    id: "rm-issue-request",
    name: "Issue Request",
    icon: <ClipboardList size={16} />,
    href: ROUTES.RM_ISSUE_REQUEST,
    module: "rm_issue_request",
  },
  {
    id: "rm-in-process-request",
    name: "In-process Request",
    icon: <RefreshCcw size={16} />,
    href: ROUTES.RM_IN_PROCESS_REQUEST,
    module: "rm_issue_request",
  },
  {
    id: "rm-store-out",
    name: "Store Out",
    icon: <LogOut size={16} />,
    href: ROUTES.RM_STORE_OUT,
    module: "rm_out_entry",
  },
  {
    id: "rm-stock-adjustment",
    name: "Stock Adjustment",
    icon: <Scale size={16} />,
    href: ROUTES.RM_STOCK_ADJUSTMENT,
    module: "rm_stock_adjustment",
  },
  {
    id: "rm-inventory-report",
    name: "RM Inventory",
    icon: <BarChart3 size={16} />,
    href: ROUTES.RM_INVENTORY_REPORT,
    module: "rm_inventory_report",
  },
  {
    id: "rm-logs-group",
    name: "Logs",
    icon: <History size={16} />,
    module: null,
    subItems: [
      {
        id: "rm-activity-logs",
        name: "Activity Logs",
        icon: <History size={14} />,
        href: ROUTES.RM_ACTIVITY_LOGS,
        module: "rm_activity_logs",
      },
      {
        id: "rm-coil-tx-logs",
        name: "Coil Transaction Logs",
        icon: <History size={14} />,
        href: ROUTES.RM_COIL_TRANSACTION_LOGS,
        module: "rm_coil_transaction_logs",
      },
      {
        id: "rm-sticker-dl-logs",
        name: "Sticker Download Logs",
        icon: <Sticker size={14} />,
        href: ROUTES.RM_STICKER_DOWNLOAD_LOGS,
        module: "rm_coil_download_logs",
      },
    ],
  },
];
