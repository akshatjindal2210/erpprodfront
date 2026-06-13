"use client";

import { User, MapPin } from "lucide-react";
import { formatDateTime, formatDate } from "@/core/utils/utilHelper";
import {
  getAuditExecutionStatusLabel,
  renderAuditExecutionStatusBadge,
  renderAuditLocationResultBadge,
  getAuditLocationResultLabel,
} from "./auditStatusHelpers";
import {
  getLocationStatusBadgeClass,
  getLocationStatusLabel,
  isLocationSubmittedRow,
  formatLocationScorePct,
  computeAuditBatchScore,
} from "./auditScanHelpers";
import {
  getAssignedUsersLabel,
  renderLocationStatusBadge,
  renderLocationUsersCell,
  renderLocationBoxesCell,
  renderLocationScoreCell,
  renderAuditBatchScoreCell,
} from "./auditListHelpers";

export const AUDIT_MASTER_HEADERS = [
  ["Audit ID", "audit_id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">#{v}</span>, { width: "80px" }],
  ["Assigned Users", "assigned_user_names", (v, row) => (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
        <User size={12} />
      </div>
      <span className="font-bold text-slate-800 text-[11px] leading-snug whitespace-normal break-words">
        {v || getAssignedUsersLabel(row)}
      </span>
    </div>
  ), {
    width: "200px",
    wrap: true,
    copyValue: (item) => getAssignedUsersLabel(item),
  }],
  ["Date Range", "start_date", (v, row) => (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] font-bold text-slate-700">{formatDate(row.start_date)} — {formatDate(row.end_date)}</span>
    </div>
  ), {
    width: "180px",
    copyValue: (item) => `${formatDate(item.start_date)} — ${formatDate(item.end_date)}`,
  }],
  ["Locations", "locations", (v) => (
    <div className="flex flex-wrap gap-1 py-1">
      {v?.map((loc) => (
        <span key={loc.location_id} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getLocationStatusBadgeClass(loc.status)}`}>
          {loc.location_no}
        </span>
      ))}
    </div>
  ), {
    width: "250px",
    wrap: true,
    copyValue: (item) => {
      const locs = Array.isArray(item.locations) ? item.locations : [];
      const names = locs.map((loc) => loc?.location_no).filter(Boolean);
      return names.length ? names.join(", ") : "—";
    },
  }],
  ["Status", "status", (v) => renderAuditExecutionStatusBadge(v), {
    width: "130px",
    copyValue: (item) => getAuditExecutionStatusLabel(item.status),
  }],
  ["Score", "audit_batch_score", (v, row) => renderAuditBatchScoreCell(row), {
    width: "90px",
    copyValue: (item) => {
      const batch = computeAuditBatchScore(item);
      return batch ? formatLocationScorePct(batch.score_pct) : "Pending";
    },
  }],
  ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-500 italic whitespace-normal break-words leading-tight">{v || "—"}</span>, { width: "180px", wrap: true }],
  ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
];

export function buildAuditLocationHeaders({ canViewAudit, openLocationComparison }) {
  return [
    ["Location", "location_no", (v, row) => {
      const submitted = isLocationSubmittedRow(row);
      const canOpen = submitted && canViewAudit;
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (canOpen) openLocationComparison(row);
          }}
          disabled={!canOpen}
          className={`flex items-center gap-2 text-left group ${canOpen ? "cursor-pointer" : "cursor-default"}`}
          title={
            !canViewAudit
              ? "View permission required"
              : submitted
                ? "Click — comparison report"
                : "Comparison available after submit"
          }
        >
          <MapPin size={12} className={`shrink-0 ${canOpen ? "text-indigo-500 group-hover:text-indigo-700" : "text-slate-400"}`} />
          <span className={`font-black uppercase text-[11px] ${canOpen ? "text-slate-800 group-hover:text-indigo-700 group-hover:underline" : row.is_history_row ? "text-slate-500" : "text-slate-600"}`}>
            {v || "—"}
          </span>
          {row.is_history_row && (
            <span className="px-1 py-0.5 rounded text-[8px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
              Prev
            </span>
          )}
        </button>
      );
    }, { width: "120px" }],
    ["Audit ID", "audit_id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">#{v}</span>, { width: "80px" }],
    ["Users", "assigned_user_name", (v, row) => renderLocationUsersCell(row), {
      width: "200px",
      wrap: true,
      copyValue: (item) => item.users_label || item.assigned_user_name,
    }],
    ["Boxes", "expected_count", (v, row) => renderLocationBoxesCell(row), {
      width: "130px",
      wrap: true,
      copyValue: (item) => `${item.scanned_count ?? 0} / ${item.expected_count ?? 0}`,
    }],
    ["Score", "score_pct", (v, row) => renderLocationScoreCell(row), {
      width: "80px",
      copyValue: (item) =>
        isLocationSubmittedRow(item) ? formatLocationScorePct(item.score_pct) : "—",
    }],
    ["Difference", "difference_boxes", (v, row) => {
      const submitted = isLocationSubmittedRow(row);
      const canOpen = submitted && canViewAudit;
      if (!submitted) {
        return <span className="text-[10px] text-slate-400 italic">After submit</span>;
      }
      const missing = Array.isArray(row.missing_boxes) ? row.missing_boxes : [];
      const extra = Array.isArray(row.extra_boxes) ? row.extra_boxes : [];
      const boxes = Array.isArray(v) && v.length ? v : [...missing, ...extra];
      const inner = !boxes.length ? (
        <span className="text-[10px] text-emerald-600 font-bold">All matched</span>
      ) : (
        <div className="flex flex-wrap gap-0.5 max-w-[220px] py-0.5">
          {missing.map((uid) => (
            <span
              key={`m-${uid}`}
              className="px-1 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
              title="Missing"
            >
              {uid}
            </span>
          ))}
          {extra.map((uid) => (
            <span
              key={`e-${uid}`}
              className="px-1 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-800 border border-rose-200"
              title="Extra"
            >
              {uid}
            </span>
          ))}
        </div>
      );

      if (!canOpen) return inner;

      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openLocationComparison(row);
          }}
          className="text-left w-full group"
          title="Click — full comparison report"
        >
          <span className="block text-[9px] font-bold text-indigo-500 uppercase mb-0.5 group-hover:underline">
            View comparison
          </span>
          {inner}
        </button>
      );
    }, {
      width: "200px",
      wrap: true,
      copyValue: (item) => {
        if (!isLocationSubmittedRow(item)) return "After submit";
        const missing = Array.isArray(item.missing_boxes) ? item.missing_boxes : [];
        const extra = Array.isArray(item.extra_boxes) ? item.extra_boxes : [];
        const boxes = [...missing, ...extra];
        return boxes.length ? boxes.join(", ") : "All matched";
      },
    }],
    ["Date Range", "start_date", (v, row) => (
      <span className="text-[10px] font-bold text-slate-700">{formatDate(row.start_date)} — {formatDate(row.end_date)}</span>
    ), {
      width: "170px",
      copyValue: (item) => `${formatDate(item.start_date)} — ${formatDate(item.end_date)}`,
    }],
    ["Status", "location_status", (v) => renderLocationStatusBadge(v), {
      width: "110px",
      copyValue: (item) => getLocationStatusLabel(item.location_status),
    }],
    ["Audit result", "result_rejected", (v, row) =>
      isLocationSubmittedRow(row)
        ? renderAuditLocationResultBadge(v ?? false)
        : renderAuditLocationResultBadge(null),
      {
        width: "96px",
        align: "center",
        copyValue: (item) =>
          isLocationSubmittedRow(item) ? getAuditLocationResultLabel(Boolean(item.result_rejected)) : "—",
      },
    ],
    ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-500 italic whitespace-normal break-words leading-tight">{v || "—"}</span>, { width: "160px", wrap: true }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "140px" }],
  ];
}
