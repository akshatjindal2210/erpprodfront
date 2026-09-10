"use client";

/**
 * QC Hold list — columns, search parts, tab filters, empty states.
 * Used by Page.js (same pattern as masterColumns.js for Daily Production).
 */

import { Activity, Clock } from "lucide-react";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { formatActivityLogActionLabel, getActivityLogActionBadgeClass, getActivityLogEventLabel } from "@/platform/utils/core/activityLogDisplay";
import { QC_HOLD_PARTIAL_ENABLED } from "@/apps/ims/lib/utils/qcHoldTypes";

export const QC_HOLD_STATUS_TABS = [
  { id: "transactions", label: "Transaction", icon: Activity },
  { id: "pending", label: "Pending", icon: Clock },
];

export const QC_HOLD_PENDING_FILTERS = [
  { id: "all", label: "All Open" },
  { id: "awaiting_approval", label: "Awaiting Approval" },
  { id: "partial", label: "Partial Progress" },
  { id: "complete", label: "Complete" },
];

/** Pending dropdown — hides Partial when partial QC is off. */
export function activeQcHoldPendingFilters() {
  return QC_HOLD_PENDING_FILTERS.filter((tab) => QC_HOLD_PARTIAL_ENABLED || tab.id !== "partial");
}

export function qcHoldPendingFilterOptions() {
  return activeQcHoldPendingFilters().map((tab) => ({ label: tab.label, value: tab.id }));
}

export const QC_HOLD_TX_ACTION_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Create", value: "CREATE" },
  { label: "Submit", value: "SUBMIT" },
  { label: "Approve", value: "APPROVE" },
  { label: "Delete", value: "DELETE" },
];

export function matchesQcHoldTxActionFilter(row, actionFilter) {
  if (!actionFilter || actionFilter === "all") return true;
  return String(row?.action_type || "").toUpperCase() === String(actionFilter).toUpperCase();
}

export const QC_HOLD_CARD_CONFIG = {
  titleKey: "packing_number",
  badgeIndices: [4],
  detailIndices: [2, 5, 8, 7],
  footerKey: "created_at",
  className: "rounded-none border border-slate-200 shadow-none",
};

export function statusBadge(status) {
  const s = String(status || "pending").toLowerCase();
  if (s === "complete") {
    return { text: "COMPLETE", className: "bg-emerald-50 text-emerald-600 border-emerald-100" };
  }
  if (s === "partial") {
    return { text: "PARTIAL", className: "bg-indigo-50 text-indigo-600 border-indigo-100" };
  }
  return { text: "PENDING", className: "bg-amber-50 text-amber-600 border-amber-100" };
}

function fmtSubmissionBrief(sub, { holdStatus } = {}) {
  if (!sub) return null;
  const st = String(sub.submission_type || "").toLowerCase();
  const holdComplete = String(holdStatus || "").toLowerCase() === "complete";
  // After the hold is fully cleared, don't keep labeling past batches as "Partial".
  const type =
    st === "full" ? "Full" : st === "revert" ? "Revert" : holdComplete ? null : "Partial";
  const pass = Number(sub.completed_qty) || 0;
  const reject = Number(sub.rejected_qty) || 0;
  const parts = [];
  if (st === "revert") {
    parts.push("no change");
  } else {
    if (pass > 0) parts.push(`${pass.toLocaleString()} pass`);
    if (reject > 0) parts.push(`${reject.toLocaleString()} reject`);
  }
  const qtyText = parts.join(" · ") || "—";
  return type ? `${type} · ${qtyText}` : qtyText;
}

function fmtApprovedSubmissions(row) {
  const subs = row.approved_submissions;
  if (!Array.isArray(subs) || subs.length === 0) return null;
  const holdStatus = rowHoldStatus(row);
  return subs.map((sub) => fmtSubmissionBrief(sub, { holdStatus })).filter(Boolean).join(" | ");
}

export function qcHoldSearchParts(row) {
  const parts = [];
  const push = (...vals) => {
    for (const v of vals) {
      if (v == null || v === "") continue;
      parts.push(String(v));
    }
  };
  const pushNum = (...vals) => {
    for (const v of vals) {
      if (v == null || v === "") continue;
      parts.push(String(v));
      const n = Number(v);
      if (Number.isFinite(n)) parts.push(n.toLocaleString());
    }
  };
  const pushDate = (...vals) => {
    for (const v of vals) {
      if (!v) continue;
      const formatted = formatDateTime(v);
      if (formatted && formatted !== "—") parts.push(formatted);
    }
  };

  push(row.hold_id, row.packing_number, row.item_code, row.item_dcode, row.remarks, row.reason, rowHoldStatus(row));
  push(statusBadge(rowHoldStatus(row)).text);
  pushNum(row.qty, row.total_qty, row.completed_qty, row.rejected_qty, row.balance_qty);
  push(fmtApprovedSubmissions(row));
  push(fmtSubmissionBrief(row.pending_submission, { holdStatus: rowHoldStatus(row) }));
  if (row.has_pending_submission) parts.push("Awaiting approval");
  push(row.created_by_name, row.updated_by_name, row.approved_by_name);
  pushDate(row.created_at, row.updated_at, row.approved_at);
  return parts;
}

export function buildQcHoldApiFilters(pendingFilter) {
  if (pendingFilter === "complete") return { status: "complete", date_on: "activity" };
  return { open_only: true };
}

/** Balance-aware status — cleared holds are complete even if API status was stale. */
export function rowHoldStatus(row) {
  const balanceQty = Math.max(0, Number(row?.balance_qty) || 0);
  if (row?.balance_qty != null && balanceQty <= 0) return "complete";
  const completedQty = Number(row?.completed_qty) || 0;
  const rejectedQty = Number(row?.rejected_qty) || 0;
  if (row?.balance_qty != null && balanceQty > 0 && (completedQty > 0 || rejectedQty > 0)) {
    return "partial";
  }
  if (row?.balance_qty != null && balanceQty > 0) return "pending";
  return String(row?.status || "pending").toLowerCase();
}

/** Pending dropdown — All Open / Awaiting Approval / Partial Progress / Complete. */
export function matchesQcHoldPendingFilter(row, pendingFilter) {
  const status = rowHoldStatus(row);
  if (pendingFilter === "complete") return status === "complete";
  if (status === "complete") return false;
  if (pendingFilter === "partial") return status === "partial";
  if (pendingFilter === "awaiting_approval") return Boolean(row?.has_pending_submission);
  return true;
}

export function canEditQcHoldRow(row) {
  if (!row?.hold_id) return false;
  return rowHoldStatus(row) === "pending" && !row.has_pending_submission;
}

function parseCompletedBoxUids(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map((v) => String(v).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Print after submit or approve — completion boxes, or original boxes on revert. */
export function canPrintQcHoldStickersRow(row) {
  if (!row?.hold_id) return false;
  if (row.has_pending_submission) {
    const pendingType = String(row.pending_submission?.submission_type || "").toLowerCase();
    if (pendingType === "revert") return false;
    const pendingQty =
      Number(row.pending_completed_qty) ||
      Number(row.pending_submission?.completed_qty) ||
      0;
    return pendingQty > 0;
  }
  const lastApproved = Array.isArray(row.approved_submissions)
    ? row.approved_submissions[row.approved_submissions.length - 1]
    : null;
  if (String(lastApproved?.submission_type || "").toLowerCase() === "revert") {
    if (parseCompletedBoxUids(lastApproved?.completed_box_uids).length) return true;
    return (Number(row.completed_qty) || 0) > 0;
  }
  return (Number(row.completed_qty) || 0) > 0;
}

export function getQcHoldEmptyState(statusTab, pendingFilter, txActionFilter) {
  if (statusTab === "transactions") {
    if (txActionFilter && txActionFilter !== "all") {
      const label = QC_HOLD_TX_ACTION_FILTER_OPTIONS.find((o) => o.value === txActionFilter)?.label || txActionFilter;
      return {
        message: `No ${String(label).toLowerCase()} transactions`,
        subMessage: "No matching records in this date range",
      };
    }
    return {
      message: "No transactions",
      subMessage: "No QC hold activity in this date range",
    };
  }
  if (pendingFilter === "complete") {
    return {
      message: "No completed holds",
      subMessage: "Fully cleared holds — print completion stickers or re-print original boxes after revert",
    };
  }
  if (pendingFilter === "partial") {
    return {
      message: "No partial progress holds",
      subMessage: "Holds where some qty is already approved and balance is still left on hold",
    };
  }
  if (pendingFilter === "awaiting_approval") {
    return {
      message: "Nothing awaiting approval",
      subMessage: "Holds with a submit waiting for super admin approval",
    };
  }
  return {
    message: "No open holds",
    subMessage: "All incomplete holds — new, partial, and awaiting approval",
  };
}

export const QC_HOLD_HEADERS = [
  ["ID", "hold_id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "72px" }],
  ["Packing No.", "packing_number", (v) => <span className="font-mono font-bold text-[10px] text-slate-700">{v || "—"}</span>, { width: "110px" }],
  ["Item Code", "item_code", (v) => <span className="font-bold text-[11px] uppercase">{v || "—"}</span>, { width: "200px" }],
  ["Reason", "reason", (v) => <span className="text-[10px] text-slate-700 truncate block max-w-[160px]" title={v || ""}>{v || "—"}</span>, { width: "160px" }],
  ["Status", "status", (v, row) => {
    const { text, className } = statusBadge(rowHoldStatus(row) || v);
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${className}`}>
          {text}
        </span>
        {row.has_pending_submission ? (
          <span className="text-[8px] font-bold uppercase text-violet-600">Awaiting approval</span>
        ) : null}
      </div>
    );
  }, { width: "110px" }],
  ["Total Qty", "total_qty", (v, row) => <span className="font-black text-slate-800 text-[11px]">{Number(v ?? row.qty ?? 0).toLocaleString()}</span>, { width: "100px", align: "center" }],
  ["Completed", "completed_qty", (v) => (
    <span className="text-[10px] font-bold text-emerald-700" title="Total approved pass qty">
      {Number(v || 0).toLocaleString()}
    </span>
  ), { width: "100px", align: "center" }],
  ["Rejected", "rejected_qty", (v) => (
    <span className="text-[10px] font-bold text-rose-700" title="Total approved reject qty">
      {Number(v || 0).toLocaleString()}
    </span>
  ), { width: "100px", align: "center" }],
  ["Balance", "balance_qty", (v) => (
    <span className="text-[10px] font-black text-amber-700" title="Qty left on hold">
      {Number(v ?? 0).toLocaleString()}
    </span>
  ), { width: "100px", align: "center" }],
  ["Approved submits", "approved_submissions", (_v, row) => {
    const text = fmtApprovedSubmissions(row);
    return text ? (
      <span className="text-[10px] font-semibold text-indigo-800 leading-snug block max-w-[200px]" title={text}>
        {text}
      </span>
    ) : (
      <span className="text-[10px] text-slate-300">—</span>
    );
  }, { width: "200px" }],
  ["Pending submit", "pending_submission", (_v, row) => {
    const text = fmtSubmissionBrief(row.pending_submission, { holdStatus: rowHoldStatus(row) });
    if (!text) return <span className="text-[10px] text-slate-300">—</span>;
    return (
      <div className="flex flex-col gap-0.5 max-w-[160px]">
        <span className="text-[10px] font-bold text-violet-800 leading-snug" title={text}>
          {text}
        </span>
        <span className="text-[8px] font-black uppercase text-violet-600">Awaiting approval</span>
      </div>
    );
  }, { width: "160px" }],
  ["Remark", "remarks", (v) => <span className="text-[10px] text-slate-500 truncate block max-w-[160px]" title={v || ""}>{v || "—"}</span>, { width: "160px" }],
  ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ["Approved By", "approved_by_name", (_v, row) => {
    const name = row?.last_approved_submission?.approved_by || row?.approved_by_name || null;
    return <span className="text-[10px] text-slate-500">{name || "—"}</span>;
  }, { width: "110px" }],
  ["Approved At", "approved_at", (_v, row) => {
    const at = row?.last_approved_submission?.approved_at || row?.approved_at || null;
    return <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(at)}</span>;
  }, { width: "150px" }],
];

function parseTxPayload(data) {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return typeof data === "object" ? data : null;
}

function txInfoValue(row, key) {
  const info = parseTxPayload(row?.log_data)?.info;
  if (!info || typeof info !== "object") return null;
  const v = info[key];
  if (v == null || v === "") return null;
  return String(v);
}

function txDisplayPacking(row) {
  return row?.packing_number || txInfoValue(row, "Packing no") || null;
}

function txDisplayItem(row) {
  return row?.item_code || txInfoValue(row, "Item code") || null;
}

function txDisplayQty(row) {
  const completed = Number(txInfoValue(row, "Completed qty")) || 0;
  const rejected = Number(txInfoValue(row, "Rejected qty")) || 0;
  const snap = parseTxPayload(row?.log_data)?.more?.hold_data;
  const snapQty = snap && typeof snap === "object" ? snap.qty : null;
  const candidates = [
    completed + rejected,
    txInfoValue(row, "Completed qty"),
    txInfoValue(row, "Qty"),
    row?.qty,
    snapQty,
  ];
  for (const raw of candidates) {
    if (raw == null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n.toLocaleString();
  }
  return null;
}

function txEventLabel(row) {
  const fromLog = getActivityLogEventLabel(row?.log_data);
  if (fromLog) return fromLog;
  const action = String(row?.action_type || "").toUpperCase();
  if (action === "CREATE") return "Put on hold";
  if (action === "SUBMIT") return "Submitted — awaiting approval";
  if (action === "APPROVE") return "Approved";
  if (action === "DELETE") return "Hold deleted";
  return row?.description || null;
}

export function qcHoldTxSearchParts(row) {
  return [
    row?.user_name,
    row?.action_type,
    row?.description,
    row?.entity_id,
    row?.packing_number,
    row?.item_code,
    txEventLabel(row),
    txDisplayPacking(row),
    txDisplayItem(row),
    row?.created_by_name,
    row?.updated_by_name,
    row?.approved_by_name,
    row?.user_name,
    txDisplayQty(row),
    formatDateTime(row?.hold_created_at),
    formatDateTime(row?.hold_updated_at),
    formatDateTime(row?.hold_approved_at),
    formatDateTime(row?.created_at),
  ].filter((v) => v != null && v !== "");
}

export const QC_HOLD_TX_CARD_CONFIG = {
  titleKey: "description",
  badgeIndices: [3],
  detailIndices: [0, 1, 4],
  footerKey: "hold_created_at",
  className: "rounded-none border border-slate-200 shadow-none",
};

export const QC_HOLD_TX_HEADERS = [
  ["ID", "entity_id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v || "—"}</span>, { fixed: true, width: "72px" }],
  ["Packing No.", "packing_number", (_v, row) => (
    <span className="font-mono font-bold text-[10px] text-slate-700">{txDisplayPacking(row) || "—"}</span>
  ), { width: "110px" }],
  ["Item Code", "item_code", (_v, row) => (
    <span className="font-bold text-[11px] uppercase">{txDisplayItem(row) || "—"}</span>
  ), { width: "200px" }],
  ["Action", "action_type", (v) => (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${getActivityLogActionBadgeClass(v)}`}>
      {formatActivityLogActionLabel(v)}
    </span>
  ), { width: "110px" }],
  ["Event", "log_data", (_v, row) => {
    const text = txEventLabel(row) || "—";
    return (
      <span className="text-[10px] font-bold text-slate-800 leading-snug block max-w-[240px]" title={text}>
        {text}
      </span>
    );
  }, { width: "240px" }],
  ["Qty", "qty", (_v, row) => (
    <span className="font-black text-slate-800 text-[11px]">{txDisplayQty(row) || "—"}</span>
  ), { width: "100px", align: "center" }],
  ["Remark", "description", (v) => <span className="text-[10px] text-slate-500 truncate block max-w-[200px]" title={v || ""}>{v || "—"}</span>, { width: "200px" }],
  ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Created At", "hold_created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Updated At", "hold_updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Approved At", "hold_approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
];
