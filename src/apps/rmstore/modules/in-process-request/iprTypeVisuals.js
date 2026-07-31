"use client";

import { IPR_REQUEST_TYPE, IPR_REJECTION_SCOPE_LABEL, getIprTypeDisplay } from "@/apps/rmstore/lib/services/inProcessRequest";

const BADGE = "inline-block px-1.5 py-0.5 text-[8px] font-bold border rounded-sm leading-snug";

const REJECTION_SCOPE_BADGE = {
  coil: "bg-amber-50 text-amber-900 border-amber-300",
  lot: "bg-yellow-50 text-yellow-900 border-yellow-300",
};

export function IprRequestTypeCell({ row, requestType, rejectionType, inline = false }) {
  const data = row ?? { request_type: requestType, rejection_type: rejectionType };
  const type = data.request_type || IPR_REQUEST_TYPE.REJECTION;
  const { label, className } = getIprTypeDisplay(data);
  const isRejection = type === IPR_REQUEST_TYPE.REJECTION;
  const scopeKey = data.rejection_type === "lot" ? "lot" : "coil";

  return (
    <div
      className={`flex min-w-0 flex-wrap items-center gap-1 py-0.5 ${
        inline ? "inline-flex" : "justify-center"
      }`}
    >
      <span className={`${BADGE} whitespace-nowrap ${className}`}>{label}</span>
      {isRejection && (
        <span className={`${BADGE} font-black uppercase tracking-wide ${REJECTION_SCOPE_BADGE[scopeKey]}`}>
          {IPR_REJECTION_SCOPE_LABEL[scopeKey]}
        </span>
      )}
    </div>
  );
}
