"use client";

import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import dayjs from "dayjs";
import { docDateToDayjs } from "@/platform/utils/core/utilHelper";

/** Same list layout as IMS Stock Adjustment — RM labels (Heat / Coil impact). */
export const STOCK_ADJUSTMENT_CARD_CONFIG = {
  titleKey: "item_code",
  badgeIndices: [8],
  detailIndices: [1, 2, 4, 5],
  footerKey: "created_at",
  className: "rounded-none border border-slate-200 shadow-none",
};

export const STOCK_ADJUSTMENT_STATUS_FILTER_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Authorized", value: "approved" },
  { label: "Pending", value: "pending" },
];

export function buildStockAdjustmentApiFilters({ fromDate, toDate, status }) {
  return {
    ...(fromDate && { from_date: `${fromDate} 00:00:00` }),
    ...(toDate && { to_date: `${toDate} 23:59:59` }),
    ...(status !== "all" && { approved: status === "approved" }),
  };
}

function rowCreatedDay(row) {
  const raw = row?.created_at;
  if (raw == null || String(raw).trim() === "") return null;
  const d = docDateToDayjs(raw) || dayjs(raw);
  return d?.isValid() ? d.startOf("day") : null;
}

export function filterStockAdjustmentRows(
  rows = [],
  { fromDate, toDate, status, search, sortKey, sortDir } = {}
) {
  let list = Array.isArray(rows) ? rows : [];
  list = list.filter((row) => {
    const day = rowCreatedDay(row);
    if (day) {
      if (fromDate) {
        const from = dayjs(fromDate).startOf("day");
        if (from.isValid() && day.isBefore(from, "day")) return false;
      }
      if (toDate) {
        const to = dayjs(toDate).startOf("day");
        if (to.isValid() && day.isAfter(to, "day")) return false;
      }
    }
    if (status === "approved") return Boolean(row?.approved);
    if (status === "pending") return !row?.approved;
    return true;
  });

  const q = String(search ?? "").trim();
  if (q) {
    list = applyClientSearch(list, search, {
      getParts: (row) =>
        [
          row?.adjustment_id,
          row?.entry_type,
          row?.entry_type === "add" ? "Add (+)" : row?.entry_type === "minus" ? "Minus (-)" : null,
          row?.heat_no,
          row?.acc_name,
          row?.item_code,
          row?.item_desc,
          row?.qty,
          row?.coil_count_impact,
          row?.remarks,
          row?.approved ? "AUTHORIZED" : "PENDING",
          row?.created_by_name,
        ].filter((p) => p != null && p !== ""),
      skipSort: !!sortKey,
    });
  }
  return sortRowsByKey(list, sortKey, sortDir);
}

/**
 * Columns mirror IMS SA list:
 * ADJ ID | Type | Heat | Supplier | Total qty | Coil impact | Item | Desc | Remarks | Status | Created…
 * (Packing / Fin. year not used in RM — Heat + Coil impact instead of Packing + Box impact)
 */
export const STOCK_ADJUSTMENT_HEADERS = [
  [
    "ADJ ID",
    "adjustment_id",
    (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>,
    { fixed: true, width: "80px" },
  ],
  [
    "Type",
    "entry_type",
    (v) => (
      <span className="text-[10px] font-black uppercase text-slate-700">
        {v === "add" ? "Add (+)" : v === "minus" ? "Minus (-)" : "—"}
      </span>
    ),
    { width: "72px", align: "center" },
  ],
  [
    "Heat No.",
    "heat_no",
    (v) => (
      <span className="font-mono text-[10px] text-slate-700 truncate block max-w-[120px]">{v || "—"}</span>
    ),
    { width: "100px" },
  ],
  [
    "Supplier",
    "acc_name",
    (v) => (
      <span
        className="text-[10px] text-slate-700 font-bold uppercase truncate block max-w-[160px]"
        title={v || ""}
      >
        {v || "—"}
      </span>
    ),
    { width: "160px" },
  ],
  [
    "Total Qty",
    "qty",
    (v, row) => (
      <div className="flex items-baseline gap-1 py-1 justify-center">
        <span className={`font-black text-[12px] ${Number(v) < 0 ? "text-rose-600" : "text-emerald-600"}`}>
          {Number(v) > 0 ? `+${v}` : v}
        </span>
        <span className="text-[9px] text-slate-400 font-bold uppercase italic">{row.unit || "KG"}</span>
      </div>
    ),
    { width: "100px", align: "center" },
  ],
  [
    "Coil Impact",
    "coil_count_impact",
    (v) => (
      <span className="text-[10px] font-bold text-slate-700 tabular-nums">{v != null ? v : "—"}</span>
    ),
    { width: "90px", align: "center" },
  ],
  [
    "Item Code",
    "item_code",
    (v) => (
      <span className="font-bold text-slate-800 uppercase text-[10px] tracking-tight">{v || "—"}</span>
    ),
    { width: "120px" },
  ],
  [
    "Description",
    "item_desc",
    (v) => (
      <span className="text-[10px] text-slate-600 truncate block max-w-[200px]" title={v || ""}>
        {v || "—"}
      </span>
    ),
    { width: "200px" },
  ],
  [
    "Remarks",
    "remarks",
    (v) => (
      <span className="text-[10px] text-slate-500 truncate block max-w-[180px]">{v || "—"}</span>
    ),
    { width: "180px" },
  ],
  [
    "Status",
    "approved",
    (v) => (
      <span
        className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
          v
            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
            : "bg-amber-50 text-amber-600 border-amber-100"
        }`}
        title={v ? "Stock adjusted and authorized" : "Pending. The stock has not been adjusted yet."}
      >
        {v ? "● AUTHORIZED" : "○ PENDING"}
      </span>
    ),
    { width: "120px" },
  ],
  [
    "Created By",
    "created_by_name",
    (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>,
    { width: "110px" },
  ],
  [
    "Created At",
    "created_at",
    (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>,
    { width: "150px" },
  ],
  [
    "Updated By",
    "updated_by_name",
    (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>,
    { width: "110px" },
  ],
  [
    "Updated At",
    "updated_at",
    (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>,
    { width: "150px" },
  ],
  [
    "Approved By",
    "approved_by_name",
    (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>,
    { width: "110px" },
  ],
  [
    "Approved At",
    "approved_at",
    (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>,
    { width: "150px" },
  ],
];
