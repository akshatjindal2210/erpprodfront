"use client";

/**
 * Change Override Customer — columns, search parts, status helpers.
 * Used by StickerOverrideCustomerPage.js (same pattern as qcHoldColumns.js).
 */

import { ScanLine } from "lucide-react";
import { formatDateTime } from "@/platform/utils/core/utilHelper";

export const OVERRIDE_CUSTOMER_CARD_CONFIG = {
  titleKey: "packing_number",
  badgeIndices: [4],
  detailIndices: [1, 2, 3],
  footerKey: "requested_at",
  className: "rounded-none border border-slate-200 shadow-none",
};

export const OVERRIDE_STATUS_FILTER_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

export function resolveOverrideRowStatus(row) {
  if (row?.status === "rejected" || row?.status === "approved" || row?.status === "pending") {
    return row.status;
  }
  return row?.approved === true ? "approved" : "pending";
}

export function overrideStatusLabel(status) {
  const labels = { approved: "Approved", pending: "Pending", rejected: "Rejected" };
  return labels[status] || labels.pending;
}

export function overrideStatusBadgeClass(status) {
  const colors = {
    approved: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rejected: "bg-rose-50 text-rose-600 border-rose-100",
    pending: "bg-amber-50 text-amber-600 border-amber-100",
  };
  return colors[status] || colors.pending;
}

export function overrideSearchParts(row) {
  const parts = [
    row?.packing_number,
    row?.itemdcode,
    row?.item_name,
    row?.from_customer,
    row?.to_customer,
    row?.from_customer_name,
    row?.to_customer_name,
    row?.requested_by_name,
    row?.approved_by_name,
    row?.remarks,
    row?.status,
    row?.request_id,
  ];
  if (Array.isArray(row?.box_no_uids)) {
    parts.push(...row.box_no_uids);
  }
  return parts.filter((p) => p != null && p !== "");
}

export function buildOverrideApiFilters({ fromDate, toDate, status }) {
  return {
    ...(fromDate && { from_date: `${fromDate} 00:00:00` }),
    ...(toDate && { to_date: `${toDate} 23:59:59` }),
    ...(status !== "all" && { status }),
  };
}

export const OVERRIDE_CUSTOMER_HEADERS = [
  [
    "Packing No",
    "packing_number",
    (v) => (
      <div className="flex items-center gap-2">
        <ScanLine size={12} className="text-indigo-500" />
        <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v}</span>
      </div>
    ),
    { fixed: true, width: "140px" },
  ],
  [
    "Item Code",
    "itemdcode",
    (v, row) => (
      <span className="text-[10px] font-bold text-slate-600 uppercase max-w-[150px]">
        {row.item_name || "—"}
      </span>
    ),
    {
      width: "120px",
      copyValue: (row) => row.item_name || row.itemdcode || "—",
    },
  ],
  [
    "Box No UIDs",
    "box_no_uids",
    (v) => (
      <div className="flex flex-wrap gap-1 max-w-[300px]">
        {v && Array.isArray(v) ? (
          v.map((code, idx) => (
            <span
              key={idx}
              className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 text-[9px] font-mono"
            >
              {code}
            </span>
          ))
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </div>
    ),
    { width: "250px", sortable: false },
  ],
  [
    "Transfer Flow",
    "from_customer",
    (v, row) => (
      <div
        className="flex items-center gap-2 text-[10px] py-1 select-text"
        title={`${row.from_customer_name || "—"} → ${row.to_customer_name || "—"}`}
      >
        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-medium">
          {row.from_customer_name || "—"}
        </span>
        <span className="text-indigo-400 font-bold" aria-hidden>
          →
        </span>
        <span className="px-1.5 py-0.5 bg-indigo-50 rounded text-indigo-700 font-bold">
          {row.to_customer_name || "—"}
        </span>
      </div>
    ),
    {
      width: "340px",
      copyValue: (row) => `${row.from_customer_name || "—"} → ${row.to_customer_name || "—"}`,
    },
  ],
  [
    "Status",
    "status",
    (v, row) => {
      const status = resolveOverrideRowStatus(row);
      return (
        <span
          className={`px-2 py-0.5 rounded-full text-[9px] border font-black uppercase flex items-center gap-1 w-fit ${overrideStatusBadgeClass(status)}`}
        >
          <span className="text-[12px]">●</span> {overrideStatusLabel(status)}
        </span>
      );
    },
    {
      width: "160px",
      copyValue: (row) => overrideStatusLabel(resolveOverrideRowStatus(row)),
    },
  ],
  [
    "Requested By",
    "requested_by_name",
    (v) => <span className="text-[10px] font-bold text-slate-500 uppercase">{v || "—"}</span>,
    { width: "130px" },
  ],
  [
    "Requested At",
    "requested_at",
    (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>,
    { width: "140px" },
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
  [
    "Remarks",
    "remarks",
    (v) => (
      <span
        className="block text-[10px] text-slate-500 line-clamp-4 whitespace-pre-wrap break-words min-w-0 max-w-full"
        title={v ? String(v) : ""}
      >
        {v || "—"}
      </span>
    ),
    { width: "220px", wrap: true },
  ],
];
