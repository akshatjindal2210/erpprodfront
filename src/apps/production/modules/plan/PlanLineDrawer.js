"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import { FormLabel, OK_INPUT } from "@/ui/common/Constants";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import { DrawerSection, DrawerDetailField } from "@/apps/production/modules/shortage/primeItem";
import { planService } from "@/apps/production/lib/services/plan";
import { PROCESS_STATUS_VALUES, PROCESS_STATUS_LABELS } from "@/apps/production/lib/constants/processStatus";

/**
 * Planning Table — View / Edit one prod_plan line (not Maintain Job Card).
 */
export default function PlanLineDrawer({ row, mode = "edit", onClose, onSaved }) {
  const isView = mode === "view";
  const [saving, setSaving] = useState(false);
  const [planStart, setPlanStart] = useState(row?.plan_start || "");
  const [planEnd, setPlanEnd] = useState(row?.plan_end || "");
  const [status, setStatus] = useState(row?.statusKey || "pending");

  if (!row) return null;

  const close = () => !saving && onClose?.();

  const submit = async () => {
    if (isView || saving) return;
    setSaving(true);
    try {
      const res = await planService.update(row.plan_docno || row.id, {
        plan_start: planStart || null,
        plan_end: planEnd || null,
        status,
      });
      if (res?.success === false) throw new Error(res?.message);
      toast.success(res?.message || "Plan line updated.");
      onSaved?.();
    } catch (err) {
      toast.error(err?.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <RmStoreDrawerFooter
      onClose={close}
      loading={saving}
      readOnly={isView}
      isEdit={!isView}
      canApprove={false}
      onSave={() => void submit()}
      saveLabel="Save"
      loadingLabel="Saving..."
    />
  );

  return (
    <Drawer
      isOpen
      onClose={close}
      onSubmit={isView ? close : () => void submit()}
      title={isView ? "View Plan Line" : "Edit Plan Line"}
      description={`${row.job_card_no || "—"} · ${row.process || "—"} · ${row.machine || "—"}`}
      maxWidth="max-w-xl"
      footer={footer}
    >
      <div className="space-y-3 pb-2">
        <DrawerSection title="Plan Line" bar="bg-indigo-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
            <DrawerDetailField label="Job Card No" value={<span className="font-mono font-bold text-indigo-700">{row.job_card_no}</span>} />
            <DrawerDetailField label="Prime Item" value={<span className="font-bold uppercase">{row.prime_item_code || "—"}</span>} />
            <DrawerDetailField label="Process" value={row.process || "—"} />
            <DrawerDetailField label="Machine" value={row.machine || "—"} />
            <DrawerDetailField label="Stage" value={row.stage != null ? String(row.stage) : "—"} />
            <DrawerDetailField label="Qty" value={Number(row.qty || 0).toLocaleString()} />
          </div>
        </DrawerSection>

        <DrawerSection title="Schedule" bar="bg-slate-400">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
            <div className="space-y-1">
              <FormLabel>Plan Start</FormLabel>
              {isView ? (
                <span className="text-[12px] font-semibold text-slate-800 tabular-nums block">{row.plan_start || "—"}</span>
              ) : (
                <input
                  type="date"
                  value={planStart}
                  onChange={(e) => setPlanStart(e.target.value)}
                  disabled={saving}
                  className={OK_INPUT}
                />
              )}
            </div>
            <div className="space-y-1">
              <FormLabel>Plan End</FormLabel>
              {isView ? (
                <span className="text-[12px] font-semibold text-slate-800 tabular-nums block">{row.plan_end || "—"}</span>
              ) : (
                <input
                  type="date"
                  value={planEnd}
                  onChange={(e) => setPlanEnd(e.target.value)}
                  disabled={saving}
                  className={OK_INPUT}
                />
              )}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <FormLabel>Status</FormLabel>
              {isView ? (
                <span className="text-[12px] font-semibold text-slate-800 block">{PROCESS_STATUS_LABELS[status] || status}</span>
              ) : (
                <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={saving} className={OK_INPUT}>
                  {PROCESS_STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {PROCESS_STATUS_LABELS[s] || s}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <DrawerDetailField label="Actual Start" value={row.actStart || "—"} />
            <DrawerDetailField label="Actual End" value={row.actEnd || "—"} />
          </div>
        </DrawerSection>

        {saving ? (
          <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Saving…
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
