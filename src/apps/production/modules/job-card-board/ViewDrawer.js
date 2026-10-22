"use client";

/** View job card details on Board / Calendar (same place — no page redirect). */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import { jobCardService } from "@/apps/production/lib/services/jobCard";
import { DrawerSection, DrawerDetailField, PrimeItemSummary } from "@/apps/production/modules/shortage/primeItem";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import { IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { formatDocDate } from "@/platform/utils/core/utilHelper";
import { formatProductionDuration, displayDurationSeconds } from "@/apps/production/modules/job-card/jobCardProductionEstimate";

const STATUS_BADGE = {
  Pending: "bg-amber-50 text-amber-700 border-amber-100",
  Planning: "bg-sky-50 text-sky-700 border-sky-100",
  Running: "bg-indigo-50 text-indigo-700 border-indigo-100",
  Hold: "bg-rose-50 text-rose-700 border-rose-100",
  Complete: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

function Field({ label, children }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="text-[12px] font-semibold text-slate-800">{children}</div>
    </div>
  );
}

function PlanTable({ plan = [], estimate }) {
  if (!plan.length) {
    return <p className="px-4 py-3 text-[11px] font-semibold text-slate-400">No process plan saved.</p>;
  }
  const stages = estimate?.stages || [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-500">
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2">Process</th>
            <th className="px-3 py-2">Machine</th>
            <th className="px-3 py-2">RM</th>
            <th className="px-3 py-2 text-right">Est. time</th>
          </tr>
        </thead>
        <tbody>
          {plan.map((step) => {
            const st = stages.find((s) => Number(s.stage_no) === Number(step.stage_no));
            const macs = (step.machines || []).map((m) => m.machine_name || m.macname || m.name).filter(Boolean).join(", ") || "—";
            const rms = (step.rm_items || []).map((r) => r.rm_item_code).filter(Boolean).join(", ") || "—";
            const secs = displayDurationSeconds(st?.seconds);
            return (
              <tr key={step.stage_no} className="border-b border-slate-100">
                <td className="px-3 py-2 font-bold tabular-nums text-slate-700">{step.stage_no}</td>
                <td className="px-3 py-2 font-semibold uppercase text-slate-800">{step.process_name || "—"}</td>
                <td className="px-3 py-2 font-medium text-slate-600">{macs}</td>
                <td className="px-3 py-2 font-medium text-slate-600">{rms}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-700">
                  {secs != null ? formatProductionDuration(secs) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function JobCardViewDrawer({ card, onClose }) {
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
          toast.error(err?.message || "Failed to load job card.");
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

  const no = detail?.job_card_no || card.job_card_no || "Job Card";
  const shift = detail?.schedule_shift ?? card.shift;

  return (
    <Drawer
      isOpen
      onClose={onClose}
      onSubmit={onClose}
      title={`View ${no}`}
      description={detail?.prime_item_code ? `Prime item ${detail.prime_item_code}` : undefined}
      maxWidth="max-w-[1100px]"
      footer={<RmStoreDrawerFooter onClose={onClose} readOnly />}
    >
      {loading || !detail ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[11px] text-slate-500">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          <DrawerSection title="Prime Item Details" bar="bg-indigo-500">
            <PrimeItemSummary
              item={{
                ...detail,
                total_qty: detail.qty,
                gweight: detail.gweight,
                total_weight_kg: detail.total_weight_kg,
                weight_missing: detail.weight_missing,
                items: detail.items,
                rm: detail.rm,
                process_tooling: detail.process_tooling,
              }}
              jobCard
              extra={
                <DrawerDetailField
                  label="Job Card No"
                  value={<span className="font-mono font-bold text-indigo-700">{detail.job_card_no}</span>}
                />
              }
            />
          </DrawerSection>

          <div className="border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">Job Card</span>
              <span
                className={`border px-2 py-0.5 text-[9px] font-black uppercase ${
                  detail.approved ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {detail.approved ? "Authorized" : "Pending"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-4">
              <Field label="Doc Date">{formatDocDate(detail.doc_dt ?? detail.job_date) || "—"}</Field>
              <Field label="Status">
                <span className={`border px-2 py-0.5 text-[9px] font-black uppercase ${STATUS_BADGE[detail.status] || STATUS_BADGE.Pending}`}>
                  {detail.status || "—"}
                </span>
              </Field>
              <Field label="Schedule Shift">{shift ? `Shift ${shift}` : "—"}</Field>
              <Field label="Qty">
                <span className="font-mono tabular-nums text-indigo-700">{Number(detail.qty || 0).toLocaleString()}</span>
              </Field>
            </div>
          </div>

          <div className="border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                Process Plan · {detail.prime_item_code || "—"}
              </span>
              {detail.production_time?.total_seconds != null ? (
                <span className="text-[10px] font-bold tabular-nums text-slate-600">
                  Est. {formatProductionDuration(displayDurationSeconds(detail.production_time.total_seconds))}
                </span>
              ) : null}
            </div>
            <PlanTable plan={detail.process_plan} estimate={detail.production_time} />
          </div>

          <div className="px-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Remarks</p>
            <p className={`${IMS_TABLE_CELL_TEXT} mt-1 block break-words text-[12px] text-slate-800`}>{detail.remarks || "—"}</p>
          </div>
        </div>
      )}
    </Drawer>
  );
}
