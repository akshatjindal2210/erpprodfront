"use client";

/**
 * QC Hold list — columns, search parts, tab filters, empty states.
 * Used by Page.js (same pattern as masterColumns.js for Daily Production).
 */

import { CheckCircle, Clock, Layers } from "lucide-react";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { QC_HOLD_PARTIAL_ENABLED } from "@/apps/ims/lib/utils/qcHoldTypes";

export const QC_HOLD_STATUS_TABS = [
  { id: "complete", label: "Complete", icon: CheckCircle },
  { id: "partial", label: "Partial", icon: Layers },
  { id: "pending", label: "Pending", icon: Clock },
];

/** List tabs — hides Partial when QC_HOLD_PARTIAL_ENABLED is false. */
export function activeQcHoldStatusTabs() {
  return QC_HOLD_STATUS_TABS.filter((tab) => QC_HOLD_PARTIAL_ENABLED || tab.id !== "partial");
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

function fmtSubmissionBrief(sub) {
  if (!sub) return null;
  const st = String(sub.submission_type || "").toLowerCase();
  const type = st === "full" ? "Full" : st === "revert" ? "Revert" : "Partial";
  const pass = Number(sub.completed_qty) || 0;
  const reject = Number(sub.rejected_qty) || 0;
  const parts = [];
  if (st === "revert") {
    parts.push("no change");
  } else {
    if (pass > 0) parts.push(`${pass.toLocaleString()} pass`);
    if (reject > 0) parts.push(`${reject.toLocaleString()} reject`);
  }
  return `${type} · ${parts.join(" · ") || "—"}`;
}

function fmtApprovedSubmissions(row) {
  const subs = row.approved_submissions;
  if (!Array.isArray(subs) || subs.length === 0) return null;
  return subs.map(fmtSubmissionBrief).filter(Boolean).join(" | ");
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

  push(row.hold_id, row.packing_number, row.item_code, row.item_dcode, row.remarks, row.reason, row.status);
  push(statusBadge(row.status).text);
  pushNum(row.qty, row.total_qty, row.completed_qty, row.rejected_qty, row.balance_qty);
  push(fmtApprovedSubmissions(row));
  push(fmtSubmissionBrief(row.pending_submission));
  if (row.has_pending_submission) parts.push("Awaiting approval");
  push(row.created_by_name, row.updated_by_name, row.approved_by_name);
  pushDate(row.created_at, row.updated_at, row.approved_at);
  return parts;
}

export function buildQcHoldApiFilters(statusTab) {
  if (statusTab === "complete") return { status: "complete" };
  if (statusTab === "partial") return { status: "partial" };
  return { open_only: true };
}

export function isIncompleteQcHoldRow(row) {
  return String(row?.status || "pending").toLowerCase() !== "complete";
}

export function rowHoldStatus(row) {
  return String(row?.status || "pending").toLowerCase();
}

export function canEditQcHoldRow(row) {
  if (!row?.hold_id) return false;
  return String(row.status || "pending").toLowerCase() === "pending" && !row.has_pending_submission;
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

export function getQcHoldEmptyState(statusTab, pendingFilter) {
  if (statusTab === "partial") {
    return {
      message: "No partial holds",
      subMessage: "After partial approve — e.g. 1,000 of 10,000 cleared, 9,000 balance left (also in Pending until complete)",
    };
  }
  if (statusTab === "complete") {
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
    const { text, className } = statusBadge(v);
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
    const text = fmtSubmissionBrief(row.pending_submission);
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
  ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
  ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
];
