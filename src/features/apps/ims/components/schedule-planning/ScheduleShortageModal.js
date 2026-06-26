"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/core/components/ui/Drawer";
import { schedulePlanningService } from "@/features/apps/ims/services/schedulePlanning";
import { formatSchHeaderDate } from "./schedulePlanningColumns";

const INPUT = "h-8 px-2 text-[11px] border border-slate-200 rounded-none focus:border-indigo-500 outline-none bg-white w-full";

export default function ScheduleShortageModal({ open, onClose, item, stackLevel = 1 }) {
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);

  const originalQty = Number(item?.totalqty ?? item?.total_qty ?? 0);

  useEffect(() => {
    if (!open || !item) return;
    setQty(String(originalQty || ""));
  }, [open, item, originalQty]);

  if (!open || !item) return null;

  const handleSubmit = async () => {
    const shortageQty = Number(qty);
    if (!Number.isFinite(shortageQty) || shortageQty < 0) {
      toast.error("Enter a valid shortage quantity.");
      return;
    }
    setSaving(true);
    try {
      const res = await schedulePlanningService.shortage({
        schno: item.schno,
        itemdcode: item.itemdcode,
        item_code: item.item_code,
        itemdesc: item.itemdesc,
        schmonth: item.schmonth,
        schdt: item.schdt,
        acc_code: item.acc_code,
        acc_name: item.acc_name,
        original_qty: originalQty,
        shortage_qty: shortageQty,
      });
      if (res?.success === false) {
        toast.error(res?.message || "Could not submit shortage.");
        return;
      }
      toast.success(res?.message || "Shortage submitted successfully.");
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not submit shortage.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Create Shortage"
      maxWidth="max-w-md"
      stackLevel={stackLevel}
      footer={(
        <div className="flex justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-8 px-4 text-[10px] font-bold uppercase border border-slate-300 bg-white text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="h-8 px-4 text-[10px] font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Submit
          </button>
        </div>
      )}
    >
      <div className="space-y-3 text-[11px]">
        <div className="grid grid-cols-2 gap-2 border border-slate-200 bg-slate-50 p-3">
          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Sch No</span>
            <span className="font-bold">{item.schno}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Item</span>
            <span className="font-bold">{item.item_code || "—"}</span>
          </div>
          <div className="col-span-2">
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Party</span>
            <span className="font-bold break-words">{item.acc_name || "—"}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Schedule Date</span>
            <span className="font-bold">{formatSchHeaderDate(item.schdt)}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Schedule Qty</span>
            <span className="font-bold tabular-nums">{originalQty.toLocaleString()}</span>
          </div>
        </div>

        {item.itemdesc ? (
          <p className="text-[10px] text-slate-500 italic border-l-2 border-slate-200 pl-2">{item.itemdesc}</p>
        ) : null}

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Shortage Qty</label>
          <input
            type="number"
            min={0}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className={INPUT}
          />
          <p className="text-[9px] text-slate-400 mt-1">Change the quantity and submit.</p>
        </div>
      </div>
    </Drawer>
  );
}
