"use client";

/**
 * Stock Adjustment — columns, search parts, status filters.
 * Used by Page.js (same pattern as qcHoldColumns.js).
 */

import dayjs from "dayjs";
import { formatDateTime, docDateToDayjs } from "@/platform/utils/core/utilHelper";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { plainRemarksForDisplay } from "@/apps/ims/modules/stock-adjustment/StockAdjustmentModal";

export const STOCK_ADJUSTMENT_CARD_CONFIG = {
  titleKey: "item_code",
  badgeIndices: [9],
  detailIndices: [1, 2, 3, 6],
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

export function rowMatchesStockAdjustmentDateRange(row, fromDate, toDate) {
  const day = rowCreatedDay(row);
  if (!day) return true;
  if (fromDate) {
    const from = dayjs(fromDate).startOf("day");
    if (from.isValid() && day.isBefore(from, "day")) return false;
  }
  if (toDate) {
    const to = dayjs(toDate).startOf("day");
    if (to.isValid() && day.isAfter(to, "day")) return false;
  }
  return true;
}

export function rowMatchesStockAdjustmentStatus(row, status) {
  if (!status || status === "all") return true;
  if (status === "approved") return Boolean(row?.approved);
  if (status === "pending") return !row?.approved;
  return true;
}

/** Client-side date, status, and text search — no extra API round-trips. */
export function filterStockAdjustmentRows(
  rows = [],
  { fromDate, toDate, status, search, sortKey, sortDir } = {}
) {
  let list = Array.isArray(rows) ? rows : [];
  list = list.filter(
    (row) =>
      rowMatchesStockAdjustmentDateRange(row, fromDate, toDate) &&
      rowMatchesStockAdjustmentStatus(row, status)
  );
  const q = String(search ?? "").trim();
  if (q) {
    list = applyClientSearch(list, search, { getParts: (row) => stockAdjustmentSearchParts(row), skipSort: !!sortKey });
  }
  return sortRowsByKey(list, sortKey, sortDir);
}

export function stockAdjustmentSearchParts(row) {
  const parts = [
    row?.adjustment_id,
    row?.entry_type,
    row?.entry_type === "add" ? "Add (+)" : row?.entry_type === "minus" ? "Minus (-)" : row?.entry_type === "update" ? "Update" : null,
    row?.packing_number,
    row?.financial_year,
    row?.acc_name,
    row?.acc_code,
    row?.item_code,
    row?.item_desc,
    row?.item_dcode,
    row?.qty,
    row?.unit,
    row?.box_count_impact,
    plainRemarksForDisplay(row?.remarks),
    row?.created_by_name,
    row?.updated_by_name,
    row?.approved_by_name,
    row?.approved ? "AUTHORIZED" : "PENDING",
    row?.qty_update_plan?.box_no_uid,
    row?.qty_update_plan?.box_uid,
  ];

  if (Array.isArray(row?.minus_customer_lines)) {
    for (const line of row.minus_customer_lines) {
      parts.push(line?.acc_name, line?.acc_code, line?.qty);
    }
  }

  return parts.filter((p) => p != null && p !== "");
}

export function stockAdjustmentCustomerCell(v, row) {
  const lines =
    row.entry_type === "minus" && Array.isArray(row.minus_customer_lines)
      ? row.minus_customer_lines
      : null;

  if (lines && lines.length > 1) {
    const title = lines
      .map((l) => {
        const name = l.acc_name || l.acc_code || "—";
        const q = Number(l.qty || 0);
        return q > 0 ? `${name} (−${q.toLocaleString()} PCS)` : name;
      })
      .join(", ");
    const label = lines
      .map((l) => l.acc_name || l.acc_code || "—")
      .join(", ");
    return (
      <span
        className="text-[10px] text-slate-700 font-bold uppercase block max-w-[140px] sm:max-w-[220px] leading-snug whitespace-normal break-words"
        title={title}
      >
        {label}
      </span>
    );
  }

  const label =
    (lines?.length === 1 ? lines[0].acc_name || lines[0].acc_code : null) ||
    (typeof v === "string" ? v.replace(/\s*·\s*/g, ", ") : v) ||
    (typeof row.acc_name === "string" ? row.acc_name.replace(/\s*·\s*/g, ", ") : row.acc_name) ||
    "—";

  return (
    <span
      className="text-[10px] text-slate-700 font-bold uppercase truncate block max-w-[140px] sm:max-w-[220px]"
      title={String(label)}
    >
      {label}
    </span>
  );
}

export const STOCK_ADJUSTMENT_HEADERS = [
  ["ADJ ID", "adjustment_id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "80px" }],
  ["Type", "entry_type", (v) => (<span className="text-[10px] font-black uppercase text-slate-700">{v === "add" ? "Add (+)" : v === "minus" ? "Minus (-)" : v === "update" ? "Update" : "—"}</span>), { width: "72px", align: "center" }],
  ["Packing no.", "packing_number", (v) => (<span className="font-mono text-[10px] text-slate-700 truncate block max-w-[120px]">{v || "—"}</span>), { width: "120px" }],
  ["Fin. year", "financial_year", (v) => (<span className="text-[10px] text-slate-600">{v || "—"}</span>), { width: "80px", align: "center" }],
  ["Customer", "acc_name", stockAdjustmentCustomerCell, { width: "200px", wrap: true }],

  ["Total qty", "qty", (v, row) => (
    <div className="flex items-baseline gap-1 py-1 justify-center">
      <span className={`font-black text-[12px] ${Number(v) < 0 ? "text-rose-600" : "text-emerald-600"}`}>
        {Number(v) > 0 ? `+${v}` : v}
      </span>
      <span className="text-[9px] text-slate-400 font-bold uppercase italic">{row.unit || "PCS"}</span>
    </div>
  ), { width: "100px", align: "center" }],

  ["Box impact", "box_count_impact", (v) => (<span className="text-[10px] font-bold text-slate-700 tabular-nums">{v != null ? v : "—"}</span>), { width: "80px", align: "center" }],

  ["Item code", "item_code", (v) => (<span className="font-bold text-slate-800 uppercase text-[10px] tracking-tight">{v || "—"}</span>), { width: "120px" }],

  ["Description", "item_desc", (v) => (
    <span className="text-[10px] text-slate-600 truncate block max-w-[200px]" title={v || ""}>
      {v || "—"}
    </span>
  ), { width: "200px" }],

  ["Remarks", "remarks", (v) => (
    <span className="text-[10px] text-slate-500 truncate block max-w-[180px]">
      {plainRemarksForDisplay(v) || "—"}
    </span>
  ), { width: "180px" }],
  ["Status", "approved", (v) => (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
      {v ? "● AUTHORIZED" : "○ PENDING"}
    </span>
  ), { width: "120px" }],
  ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
  ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
];
