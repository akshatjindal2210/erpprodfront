"use client";

/** View job card details on Board / Calendar (same place — no page redirect). */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import { jobCardService } from "@/apps/production/lib/services/jobCard";
import { helperPerms } from "@/apps/engineering/lib/helpers/helperPerms";
import { PLANNING_MODULE } from "@/apps/production/modules/job-card-board/board";
import { DrawerSection, DrawerDetailField, PrimeItemSummary } from "@/apps/production/modules/shortage/primeItem";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import { IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { formatDocDate } from "@/platform/utils/core/utilHelper";
import { formatProductionDuration, displayDurationSeconds, sumShownTimeSeconds } from "@/apps/production/modules/job-card/jobCardProductionEstimate";
import {
  JC_BOARD_PLAN_COL,
  JC_BOARD_PLAN_TABLE_MIN_W,
  JC_BOARD_PLAN_TD,
  JC_BOARD_PLAN_TH,
} from "@/apps/production/modules/job-card-board/jobCardBoardUi.config";

const STATUS_BADGE = {
  Pending: "bg-amber-50 text-amber-700 border-amber-100",
  Planning: "bg-sky-50 text-sky-700 border-sky-100",
  Running: "bg-indigo-50 text-indigo-700 border-indigo-100",
  Hold: "bg-rose-50 text-rose-700 border-rose-100",
  Complete: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const TH = JC_BOARD_PLAN_TH;
const TD = JC_BOARD_PLAN_TD;
const timeTd = `${TD} ${IMS_TABLE_CELL_TEXT} text-right tabular-nums text-[11px] whitespace-nowrap`;

/** Same badge as Maintain Job Card View: time · N shifts (8h) · qty pcs · stages */
function PlanBadge({ count, estimate, qty }) {
  const shownSec = sumShownTimeSeconds(estimate);
  const hasTime = estimate?.valid && (shownSec > 0 || estimate.total_seconds != null);
  return (
    <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
      {hasTime ? (
        <span className={`${IMS_TABLE_CELL_TEXT} text-[11px] font-semibold text-slate-700 tabular-nums`}>
          {formatProductionDuration(shownSec || estimate.total_seconds)}
          <span className="text-slate-300 mx-1.5">·</span>
          {estimate.shifts} shift{estimate.shifts === 1 ? "" : "s"} ({estimate.shift_hours}h)
          <span className="text-slate-300 mx-1.5">·</span>
          {Number(estimate.qty ?? qty ?? 0).toLocaleString()} pcs
        </span>
      ) : null}
      {count ? (
        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 uppercase">
          {count} stages
        </span>
      ) : null}
    </div>
  );
}

function stageEstimateRow(estimate, stageNo) {
  if (!estimate?.valid) return null;
  return (estimate.stages || []).find((s) => Number(s.stage_no) === Number(stageNo)) || null;
}

function machineTimeTitle(machines) {
  if (!machines?.length) return "";
  const totalSec = machines.reduce((s, m) => s + displayDurationSeconds(m.seconds), 0);
  const totalShifts = machines.reduce((s, m) => s + (Number(m.shifts) || 0), 0);
  const head =
    machines.length > 1
      ? `Multiple machines (${machines.length}) · Total ${formatProductionDuration(totalSec)} · ${totalShifts} shift${totalShifts === 1 ? "" : "s"}`
      : "";
  const lines = machines.map((m) => {
    const name = [m.machine_name, m.machine_number ? `(${m.machine_number})` : null].filter(Boolean).join(" ");
    const setup = displayDurationSeconds(m.setup_seconds);
    const run = displayDurationSeconds(m.run_seconds);
    const total = displayDurationSeconds(m.seconds);
    return `${name || "—"}: Setup ${formatProductionDuration(setup)} · Run ${formatProductionDuration(run)} · Total ${formatProductionDuration(total)} · ${m.shifts ?? 0} shift${m.shifts === 1 ? "" : "s"}`;
  });
  return [head, ...lines].filter(Boolean).join("\n");
}

/** Same Time Required / Shift Required cells as Maintain Job Card. */
function TimeShiftCells({ estimate, stageNo }) {
  const stageRow = stageEstimateRow(estimate, stageNo);
  const machines = stageRow?.machines || [];
  if (!machines.length) {
    const secs = displayDurationSeconds(stageRow?.seconds);
    if (secs > 0 || stageRow?.seconds != null) {
      return (
        <>
          <td className={timeTd}>
            <div className="leading-6 font-semibold text-slate-800">{formatProductionDuration(secs)}</div>
          </td>
          <td className={`${timeTd} border-r-0`}>
            <div className="leading-6 font-semibold text-indigo-700">{stageRow?.shifts ?? "—"}</div>
          </td>
        </>
      );
    }
    return (
      <>
        <td className={timeTd}>—</td>
        <td className={`${timeTd} border-r-0`}>—</td>
      </>
    );
  }
  const multi = machines.length > 1;
  const totalSec = machines.reduce((s, m) => s + displayDurationSeconds(m.seconds), 0);
  const totalShifts = machines.reduce((s, m) => s + (Number(m.shifts) || 0), 0);
  const title = machineTimeTitle(machines);
  return (
    <>
      <td className={timeTd} title={title}>
        <div className="leading-6 font-semibold text-slate-800">
          {formatProductionDuration(multi ? totalSec : displayDurationSeconds(machines[0].seconds))}
        </div>
      </td>
      <td className={`${timeTd} border-r-0`} title={title}>
        <div className="leading-6 font-semibold text-indigo-700">
          {multi ? totalShifts : machines[0].shifts ?? "—"}
        </div>
      </td>
    </>
  );
}

function PlanTable({ plan = [], estimate }) {
  if (!plan.length) {
    return <p className="px-4 py-3 text-[11px] font-semibold text-slate-400">No process plan saved.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" style={{ minWidth: JC_BOARD_PLAN_TABLE_MIN_W }}>
        <thead>
          <tr>
            <th className={`${TH} ${JC_BOARD_PLAN_COL.stage} text-center`}>Stage</th>
            <th className={`${TH} ${JC_BOARD_PLAN_COL.process}`}>Process</th>
            <th className={`${TH} ${JC_BOARD_PLAN_COL.machine}`}>M/C</th>
            <th className={`${TH} ${JC_BOARD_PLAN_COL.rm}`}>RM</th>
            <th className={`${TH} text-right`}>Time Required</th>
            <th className={`${TH} text-right border-r-0`}>Shift Required</th>
          </tr>
        </thead>
        <tbody>
          {plan.map((step) => {
            const macs =
              (step.machines || []).map((m) => m.machine_name || m.macname || m.name).filter(Boolean).join(", ") || "—";
            const rms = (step.rm_items || []).map((r) => r.rm_item_code).filter(Boolean).join(", ") || "—";
            return (
              <tr key={step.stage_no}>
                <td className={`${TD} text-center`}>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                    {step.stage_no}
                  </span>
                </td>
                <td className={`${TD} ${IMS_TABLE_CELL_TEXT} font-semibold uppercase text-slate-800`}>
                  {step.process_name || "—"}
                </td>
                <td className={`${TD} ${IMS_TABLE_CELL_TEXT}`}>{macs}</td>
                <td className={`${TD} ${IMS_TABLE_CELL_TEXT}`}>{rms}</td>
                <TimeShiftCells estimate={estimate} stageNo={step.stage_no} />
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
        const res = await jobCardService.getById(card.docno, helperPerms(PLANNING_MODULE, "view"));
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
  const scheduleShift = detail?.schedule_shift ?? card.shift;
  const estimate = detail?.production_time;
  const plan = detail?.process_plan || [];

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
          <DrawerSection
            title="Prime Item Details"
            bar="bg-indigo-500"
            badge={
              <span
                className={`border px-2 py-0.5 text-[9px] font-black uppercase ${
                  detail.approved ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {detail.approved ? "Authorized" : "Pending"}
              </span>
            }
          >
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
                <>
                  <DrawerDetailField
                    label="Job Card No"
                    value={<span className="font-mono font-bold text-indigo-700">{detail.job_card_no}</span>}
                  />
                  <DrawerDetailField
                    label="Plan Date"
                    value={
                      <span className="tabular-nums">
                        {formatDocDate(detail.jobcarddt ?? detail.job_date ?? detail.doc_dt) || "—"}
                      </span>
                    }
                  />
                  <DrawerDetailField
                    label="Status"
                    value={
                      <span className={`border px-2 py-0.5 text-[9px] font-black uppercase ${STATUS_BADGE[detail.status] || STATUS_BADGE.Pending}`}>
                        {detail.status || "—"}
                      </span>
                    }
                  />
                  <DrawerDetailField label="Schedule Shift" value={scheduleShift ? `Shift ${scheduleShift}` : "—"} />
                </>
              }
            />
          </DrawerSection>

          <div className="border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                Process Plan · {detail.prime_item_code || "—"}
              </span>
              <PlanBadge count={plan.length} estimate={estimate} qty={detail.qty} />
            </div>
            <PlanTable plan={plan} estimate={estimate} />
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
