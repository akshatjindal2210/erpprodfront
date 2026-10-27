"use client";

/** IMS-style activity log drawer — process / machine status changes for one job card. */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import { jobCardService } from "@/apps/production/lib/services/jobCard";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { PROCESS_STATUS, PROCESS_STATUS_LABELS, PROCESS_STATUS_BADGE, PROCESS_STATUS_DOT } from "@/apps/production/lib/constants/processStatus";

function FieldChip({ label, children }) {
  return (
    <div className="min-w-0 border border-slate-100 bg-slate-50 px-1.5 py-1">
      <div className="mb-0.5 text-[7px] font-black uppercase tracking-wide text-slate-400 leading-none">{label}</div>
      <div className="break-words text-[10px] font-bold leading-snug text-slate-800">{children}</div>
    </div>
  );
}

function statusDotClass(status) {
  const c = PROCESS_STATUS_DOT[status];
  if (status === PROCESS_STATUS.COMPLETE || c?.includes("emerald")) return "bg-emerald-500 border-emerald-200";
  if (status === PROCESS_STATUS.RUNNING || c?.includes("indigo")) return "bg-indigo-500 border-indigo-200";
  if (status === PROCESS_STATUS.PENDING || c?.includes("amber")) return "bg-amber-500 border-amber-200";
  if (c?.includes("sky")) return "bg-sky-500 border-sky-200";
  if (c?.includes("rose")) return "bg-rose-500 border-rose-200";
  return "bg-slate-400 border-slate-200";
}

export default function JobCardActivityDrawer({ card, onClose }) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await jobCardService.getById(card.docno);
        if (!cancelled) setDetail(res?.data || null);
      } catch (err) {
        if (!cancelled) {
          toast.error(err?.message || "Failed to load activity log.");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [card.docno]); // eslint-disable-line react-hooks/exhaustive-deps

  const logs = detail?.process_log || [];
  const no = detail?.job_card_no || card.job_card_no || "Job Card";
  const description = [
    no,
    detail?.prime_item_code || card.prime_item_code,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Drawer
      isOpen
      onClose={onClose}
      onSubmit={onClose}
      title="Activity Log"
      description={description}
      maxWidth="max-w-lg"
      closeOnOutside
      footer={
        <div className="text-[10px] font-medium text-slate-500">
          {loading ? "Loading…" : logs.length ? `${logs.length} event${logs.length === 1 ? "" : "s"}` : "No events"}
        </div>
      }
    >
      {loading || !detail ? (
        <div className="flex items-center justify-center gap-2 py-12 text-xs font-bold uppercase text-slate-500">
          <Loader2 size={14} className="animate-spin" /> Loading
        </div>
      ) : !logs.length ? (
        <div className="px-2 py-8 text-center">
          <p className="text-xs font-semibold text-slate-500">No status changes recorded.</p>
        </div>
      ) : (
        <>
          <div className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Events</div>
          <ol className="relative ml-2 border-l-2 border-slate-200 pl-5">
            {logs.map((log, idx) => {
              const status = log.status || log.to_status;
              const statusLabel = PROCESS_STATUS_LABELS[status] || status || "—";
              const isLast = idx === logs.length - 1;
              return (
                <li key={log.id || idx} className={`relative ${isLast ? "pb-1" : "pb-5"}`}>
                  <span
                    className={`absolute -left-[1.55rem] top-1.5 h-3 w-3 rounded-full border-2 ${statusDotClass(status)}`}
                    aria-hidden
                  />
                  <div className="border border-slate-200 bg-white">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${
                              PROCESS_STATUS_BADGE[status] || "border-slate-200 bg-slate-50 text-slate-600"
                            }`}
                          >
                            {statusLabel}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">
                            {log.changed_at ? formatDateTime(log.changed_at) : "—"}
                          </span>
                        </div>
                        <p className="text-[12px] font-bold leading-snug text-slate-900">
                          {log.process_name || `Process ${log.process_id}`}
                          {log.machine_name || log.machine_id
                            ? ` · ${log.machine_name || `Machine ${log.machine_id}`}`
                            : ""}
                        </p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          By {log.changed_by_name || log.changed_by || "—"}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[9px] text-slate-400">#{logs.length - idx}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 px-3 py-2">
                      <FieldChip label="Process">{log.process_name || log.process_id || "—"}</FieldChip>
                      <FieldChip label="Machine">{log.machine_name || (log.machine_id ? `M/C ${log.machine_id}` : "—")}</FieldChip>
                      <FieldChip label="Status">
                        <span className={`border px-1 py-0.5 text-[9px] font-black uppercase ${PROCESS_STATUS_BADGE[status] || ""}`}>
                          {statusLabel}
                        </span>
                      </FieldChip>
                      {log.remark ? (
                        <FieldChip label="Remark">{log.remark}</FieldChip>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Drawer>
  );
}
