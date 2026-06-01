import { Zap, Package, Truck, Users, Database, FileSearch, BarChart3, Map, Boxes, ClipboardCheck, ListChecksIcon, Locate, ClipboardList, Scale, Sticker, Ship, History } from "lucide-react";
import { ROUTES } from "@/features/apps/ims/utils/routes";

export const NAV_REGISTRY = [
  { id: "dashboard", name: "Dashboard", icon: <Zap size={16} />, href: ROUTES.DASHBOARD, module: null },
  {
    id: "masters-group",
    name: "Masters",
    icon: <Package size={16} />,
    module: null,
    subItems: [
      { id: "product-master", name: "Product Master", icon: <Package size={14} />, href: ROUTES.PRODUCT_MASTER, module: "product_master" },
      { id: "customer-list", name: "Customer Master", icon: <Users size={14} />, href: ROUTES.CUSTOMER_MASTER, module: "customer_master" },
      { id: "customer-item-code", name: "Customer Item Code", icon: <Map size={14} />, href: ROUTES.CUSTOMER_ITEM_CODE, module: "customer_item_code" },
      { id: "packing-standard", name: "Packing Standard", icon: <ClipboardList size={14} />, href: ROUTES.PACKING_STANDARD, module: "packing_standard" },
      { id: "location-master", name: "Store Location Master", icon: <Locate size={14} />, href: ROUTES.LOCATION_MASTER, module: "location_master" },
    ],
  },
  { id: "packing-entry", name: "Packing Entry", icon: <Truck size={16} />, href: ROUTES.PACKING_ENTRY, module: "packing_entry" },
  { id: "inventory-box-table", name: "Boxes", icon: <Boxes size={16} />, href: ROUTES.BOX_TABLE, module: "boxes" },
  { id: "inward-entry", name: "Store In", icon: <ClipboardCheck size={16} />, href: ROUTES.INVENTORY_INWARD, module: "inventory_inwards" },
  { id: "forwarding-note", name: "Forwarding Note", icon: <FileSearch size={16} />, href: ROUTES.FORWARDING_NOTE, module: "forwarding_note_master" },
  { id: "store-outward", name: "Store Out", icon: <Truck size={16} />, href: ROUTES.OUT_ENTRY, module: "out_entry" },
  { id: "sticker-override", name: "Change / Override Customer", icon: <Map size={16} />, href: ROUTES.STICKER_OVERRIDE, module: "change_override_customer" },
  { id: "stock-adjustment", name: "Stock Adjustment", icon: <Scale size={16} />, href: ROUTES.STOCK_ADJUSTMENT, module: "stock_adjustment" },
  { id: "inventory-report", name: "Inventory Report", icon: <BarChart3 size={16} />, href: ROUTES.ANALYTICS, module: "inventory_report" },
  {
    id: "logs-group",
    name: "Logs",
    icon: <Database size={16} />,
    module: null,
    subItems: [
      { id: "logs", name: "Activity Logs", icon: <Database size={14} />, href: ROUTES.LOGS, module: "activity_logs" },
      { id: "box-transaction-logs", name: "Box Transaction Logs", icon: <History size={14} />, href: ROUTES.BOX_TRANSACTION_LOGS, module: "box_transaction_logs" },
      { id: "sticker-dashboard", name: "Sticker Download Logs", icon: <Sticker size={14} />, href: ROUTES.STICKER_MANAGEMENT, module: "sticker_download_logs" },
    ],
  },
];
