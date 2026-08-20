"use client";

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { schedulePlanningService } from "@/apps/ims/lib/services/schedulePlanning";

const LABEL = "block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1";
const BTN =
  "h-8 px-3 text-[11px] font-bold uppercase border border-slate-300 rounded-none hover:bg-slate-50 disabled:opacity-40 text-slate-700";

export default function DispatchRejectModal({ open, item, onClose, onSaved }) {
  const [reason, setReason] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setRemark(item?.item_remark ? String(item.item_remark) : "");
    }
  }, [open, item]);

  const handleClose = () => {
    setReason("");
    setRemark("");
    onClose?.();
  };

  const handleSubmit = async () => {
    const actionReason = String(reason || "").trim();
    if (!actionReason) {
      toast.error("Please enter reject reason.");
      return;
    }
    if (!item?.fin_year_id) {
      toast.error("Financial year not found for this item.");
      return;
    }

    setSaving(true);
    try {
      const res = await schedulePlanningService.reject({
        fin_year_id: String(item.fin_year_id),
        schno: item.schno,
        itemdcode: item.itemdcode,
        schmonth: item.schmonth,
        schdt: item.schdt,
        acc_code: item.acc_code,
        acc_name: item.acc_name,
        item_code: item.item_code,
        itemdesc: item.itemdesc,
        totalqty: Number(item.totalqty ?? item.total_qty ?? 0),
        action_reason: actionReason,
        item_remark: remark.trim() || null,
      });
      if (!res?.success) throw new Error(res?.message || "Could not reject this item.");
      toast.success("Item rejected successfully.");
      onSaved?.();
      handleClose();
    } catch (err) {
      toast.error(err?.message || "Failed to reject item.");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2 w-full">
      <button type="button" onClick={handleClose} disabled={saving} className={BTN}>
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={saving || !String(reason || "").trim()}
        className="h-8 px-4 text-[11px] font-bold uppercase text-white rounded-none flex items-center gap-1.5 disabled:opacity-50 bg-rose-600 hover:bg-rose-700"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
        Reject
      </button>
    </div>
  );

  if (!open || !item) return null;

  return (
    <Drawer isOpen={open} onClose={handleClose} title="Reject Item" maxWidth="max-w-md" footer={footer}>
      <div className="space-y-4 pb-2">
        <div className="border border-slate-200 rounded-sm overflow-hidden bg-white">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <div className="w-1 h-4 bg-rose-500 rounded-full shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Item Details</span>
          </div>
          <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
            <div>
              <span className={LABEL}>Sch No</span>
              <span className="text-[12px] font-semibold text-slate-800">{item.schno ?? "—"}</span>
            </div>
            <div>
              <span className={LABEL}>Item Code</span>
              <span className="text-[12px] font-semibold text-slate-800 uppercase">{item.item_code ?? "—"}</span>
            </div>
            <div className="col-span-2">
              <span className={LABEL}>Customer</span>
              <span className="text-[12px] text-slate-800 leading-snug block">{item.acc_name ?? "—"}</span>
            </div>
            <div className="col-span-2">
              <span className={LABEL}>Description</span>
              <span className="text-[12px] text-slate-700 leading-snug break-words block">{item.itemdesc ?? "—"}</span>
            </div>
            <div>
              <span className={LABEL}>Qty</span>
              <span className="text-[12px] font-semibold text-slate-800">
                {Number(item.totalqty ?? item.total_qty ?? 0).toLocaleString()}
              </span>
            </div>
            {item.action_date ? (
              <div>
                <span className={LABEL}>Due Date</span>
                <span className="text-[12px] text-amber-700 font-medium">{item.action_date}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border border-slate-200 rounded-sm overflow-hidden bg-white">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <div className="w-1 h-4 bg-rose-500 rounded-full shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Reject</span>
          </div>
          <div className="px-4 py-4 space-y-4">
            <div>
              <label className={LABEL}>
                Reason <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reject reason..."
                className="w-full h-8 px-2 text-[11px] text-slate-800 border border-slate-200 rounded-none focus:border-rose-500 outline-none bg-white"
              />
            </div>
            <FormTextarea
              label="Remark"
              labelClassName={LABEL}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Optional remark..."
              rows={2}
            />
          </div>
        </div>
      </div>
    </Drawer>
  );
}
