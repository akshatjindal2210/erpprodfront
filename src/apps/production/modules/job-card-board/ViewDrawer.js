"use client";

/** View one prod_plan line on Board (read-only). Operator mapping = Card Calendar only. */

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import { planService } from "@/apps/production/lib/services/plan";
import { resolvePlanLineDocno } from "@/apps/production/modules/job-card-board/board";
import { DrawerSection, DrawerDetailField } from "@/apps/production/modules/shortage/primeItem";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import { IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { PROCESS_STATUS_LABELS, PROCESS_STATUS_BADGE } from "@/apps/production/lib/constants/processStatus";

function day(v) {
  if (!v) return "—";
  return String(v).slice(0, 10);
}

function when(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function qtyLabel(d) {
  const line = Number(d?.line_qty ?? d?.qty) || 0;
  const total = Number(d?.plan_qty ?? d?.qty) || 0;
  if (d?.multi_jc_split && total > line) return `${line.toLocaleString()} / ${total.toLocaleString()}`;
  return line.toLocaleString();
}

export default function JobCardViewDrawer({ card, onClose }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const docno = resolvePlanLineDocno(card);
    if (!docno) {
      toast.error("Plan line not found.");
      onCloseRef.current?.();
      return undefined;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await planService.getById(docno);
        if (!cancelled) setDetail(res?.data || null);
      } catch (err) {
        if (!cancelled) {
          toast.error(err?.message || "Failed to load plan line.");
          onCloseRef.current?.();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [card?.id, card?.planLineDocno]);

  const statusKey = String(detail?.status || card?.status || "pending").toLowerCase();
  const title = detail?.pjobcardno || card?.job_card_no || "Plan Line";

  return (
    <Drawer
      isOpen
      onClose={onClose}
      onSubmit={onClose}
      title={`View ${title}`}
      description={detail?.prime_item_code || card?.prime_item_code ? `Prime · ${detail?.prime_item_code || card?.prime_item_code}` : undefined}
      maxWidth="max-w-xl"
      footer={<RmStoreDrawerFooter onClose={onClose} readOnly />}
    >
      {loading || !detail ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[11px] text-slate-500">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          <DrawerSection title="Plan Line" bar="bg-indigo-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
              <DrawerDetailField
                label="Job Card No"
                value={<span className="font-mono font-bold text-indigo-700">{detail.pjobcardno || "—"}</span>}
              />
              <DrawerDetailField
                label="Prime Item"
                value={<span className="font-bold uppercase">{detail.prime_item_code || "—"}</span>}
              />
              <DrawerDetailField label="Process" value={detail.process_name || detail.proccode || "—"} />
              <DrawerDetailField label="Machine" value={detail.machine_name || detail.maccode || "—"} />
              <DrawerDetailField label="Stage" value={detail.stage_no != null ? String(detail.stage_no) : "—"} />
              <DrawerDetailField label="Qty" value={qtyLabel(detail)} />
              <DrawerDetailField label="Status"
                value={
                  <span className={`border px-2 py-0.5 text-[9px] font-black uppercase ${PROCESS_STATUS_BADGE[statusKey] || ""}`}>
                    {PROCESS_STATUS_LABELS[statusKey] || statusKey}
                  </span>
                }
              />
              <DrawerDetailField label="Est. Shifts" value={detail.est_shifts != null ? String(detail.est_shifts) : "—"} />
              <DrawerDetailField label="Est. Hours" value={detail.est_hours != null ? String(detail.est_hours) : "—"} />
              {detail.est_error ? (
                <DrawerDetailField label="Est. Note" value={<span className="text-amber-700 text-xs">{detail.est_error}</span>} />
              ) : null}
            </div>
          </DrawerSection>

          <DrawerSection title="Schedule" bar="bg-slate-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
              <DrawerDetailField label="Plan Start" value={<span className="tabular-nums">{day(detail.plan_start)}</span>} />
              <DrawerDetailField label="Plan End" value={<span className="tabular-nums">{day(detail.plan_end)}</span>} />
              <DrawerDetailField label="Actual Start" value={<span className={`${IMS_TABLE_CELL_TEXT} tabular-nums`}>{when(detail.actual_start)}</span>} />
              <DrawerDetailField label="Actual End" value={<span className={`${IMS_TABLE_CELL_TEXT} tabular-nums`}>{when(detail.actual_end)}</span>} />
            </div>
          </DrawerSection>
        </div>
      )}
    </Drawer>
  );
}
