"use client";

import { Calendar, Truck } from "lucide-react";
import { formatDateTime } from "@/core/utils/utilHelper";

export const SCHEDULE_PLANNING_TABS = [
  { id: "register", label: "Schedule Register", icon: Calendar },
  { id: "dispatch", label: "Today Dispatch Plan", icon: Truck },
];

export const SCHEDULE_PLANNING_CARD_CONFIG = {
  titleKey: "item_code",
  badgeIndices: [8],
  detailIndices: [2, 3, 5, 7],
  footerKey: "created_at",
  className: "rounded-none border border-slate-200 shadow-none",
};

export const SCHEDULE_PLANNING_HEADERS = [
  ["ID", "id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "72px" }],
  ["Item Code", "item_code", (v) => <span className="font-bold text-[11px] uppercase">{v || "—"}</span>, { width: "180px" }],
  ["Item Name", "item_name", (v) => <span className="text-[10px] text-slate-700 truncate block max-w-[200px]" title={v || ""}>{v || "—"}</span>, { width: "200px" }],
  ["Customer", "customer_name", (v) => <span className="text-[10px] text-slate-700 font-semibold">{v || "—"}</span>, { width: "180px" }],
  ["Order No", "order_no", (v) => <span className="font-mono text-[10px]">{v || "—"}</span>, { width: "120px" }],
  ["Order Qty", "order_qty", (v) => <span className="font-black text-slate-800 text-[11px]">{Number(v || 0).toLocaleString()}</span>, { width: "100px", align: "center" }],
  ["Planned Qty", "planned_qty", (v) => <span className="font-black text-indigo-700 text-[11px]">{Number(v || 0).toLocaleString()}</span>, { width: "100px", align: "center" }],
  ["Balance Qty", "balance_qty", (v) => <span className="font-black text-amber-700 text-[11px]">{Number(v || 0).toLocaleString()}</span>, { width: "100px", align: "center" }],
  ["Status", "status", (v) => {
    const s = String(v || "Pending").toLowerCase();
    let className = "bg-amber-50 text-amber-600 border-amber-100";
    if (s === "planned") className = "bg-emerald-50 text-emerald-600 border-emerald-100";
    if (s === "partial") className = "bg-indigo-50 text-indigo-600 border-indigo-100";
    
    return (
      <span className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${className}`}>
        {v || "Pending"}
      </span>
    );
  }, { width: "100px" }],
  ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
];

export const MOCK_SCHEDULE_DATA = [
  {
    id: "SP-001",
    item_code: "ITEM-A-101",
    item_name: "High Tensile Bolt M10",
    customer_name: "Auto Corp India",
    order_no: "PO-2024-001",
    order_qty: 5000,
    planned_qty: 2000,
    balance_qty: 3000,
    status: "Partial",
    created_at: "2024-06-20T10:00:00Z",
  },
  {
    id: "SP-002",
    item_code: "ITEM-B-202",
    item_name: "Steel Washer 12mm",
    customer_name: "Precision Engg",
    order_no: "PO-2024-005",
    order_qty: 10000,
    planned_qty: 10000,
    balance_qty: 0,
    status: "Planned",
    created_at: "2024-06-21T11:30:00Z",
  },
  {
    id: "SP-003",
    item_code: "ITEM-C-303",
    item_name: "Nylon Insert Nut M8",
    customer_name: "Global Fasteners",
    order_no: "PO-2024-012",
    order_qty: 2500,
    planned_qty: 0,
    balance_qty: 2500,
    status: "Pending",
    created_at: "2024-06-22T09:15:00Z",
  },
];
