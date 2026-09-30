"use client";

import { getIprTypeDisplay, isIprRejectionType, resolveIprCanonicalType } from "@/apps/rmstore/lib/services/inProcessRequest";

const BADGE = "inline-block px-1.5 py-0.5 text-[8px] font-bold border rounded-sm leading-snug";

export function IprRequestTypeCell({ row, requestType, rejectionType, inline = false }) {
  const data = row ?? { request_type: requestType, rejection_type: rejectionType, type: null };
  const { label, className } = getIprTypeDisplay(data);

  return (
    <div
      className={`flex min-w-0 flex-wrap items-center gap-1 py-0.5 ${
        inline ? "inline-flex" : "justify-center"
      }`}
    >
      <span className={`${BADGE} whitespace-nowrap ${className}`}>{label}</span>
    </div>
  );
}

/** Pending row tint — rejection vs update-status. */
export function isIprRejectionRow(row) {
  return isIprRejectionType(resolveIprCanonicalType(row)) || row?.request_type === "rejection";
}
