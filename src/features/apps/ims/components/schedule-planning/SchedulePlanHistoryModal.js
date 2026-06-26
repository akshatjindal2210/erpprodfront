"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Drawer from "@/core/components/ui/Drawer";
import { formatDateTime, formatDocDate } from "@/core/utils/utilHelper";
import { schedulePlanningService } from "@/features/apps/ims/services/schedulePlanning";
import { formatTxnTargetDates, formatSchHeaderDate } from "./schedulePlanningColumns";

function actionBadgeClass(actionType) {
  const t = String(actionType || "").toLowerCase();
  if (t === "plan") return "bg-cyan-50 text-cyan-700 border-cyan-200";
  if (t === "hold") return "bg-orange-50 text-orange-700 border-orange-200";
  if (t === "reject") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

export default function SchedulePlanHistoryModal({ open, onClose, item, stackLevel = 0 }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!open || !item?.schno || item?.itemdcode == null) {
      setRows([]);
      return;
    }
    setLoading(true);
    void schedulePlanningService
      .transactions({ schno: item.schno, itemdcode: item.itemdcode })
      .then((res) => setRows(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [open, item?.schno, item?.itemdcode]);

  if (!open || !item) return null;

  const title = `History — Sch ${item.schno} · ${item.item_code || item.itemdcode}`;

  return (
    <Drawer isOpen={open} onClose={onClose} title={title} maxWidth="max-w-4xl" stackLevel={stackLevel}>
      <div className="space-y-3 pb-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] border border-slate-200 bg-slate-50 p-2.5">
          <span><span className="text-[9px] font-bold text-slate-500 uppercase mr-1">Sch</span><span className="font-bold">{item.schno}</span></span>
          <span><span className="text-[9px] font-bold text-slate-500 uppercase mr-1">Item</span><span className="font-bold">{item.item_code || "—"}</span></span>
          <span className="min-w-0 flex-1"><span className="text-[9px] font-bold text-slate-500 uppercase mr-1">Party</span><span className="font-bold break-words">{item.acc_name || "—"}</span></span>
          <span><span className="text-[9px] font-bold text-slate-500 uppercase mr-1">Date</span><span className="font-bold">{formatSchHeaderDate(item.schdt)}</span></span>
        </div>
        {item.itemdesc ? <p className="text-[10px] text-slate-500 italic pl-1">{item.itemdesc}</p> : null}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[11px] font-bold uppercase">Loading history...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[11px] font-bold uppercase">No transaction history yet</div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.txn_id} className="border border-slate-200 bg-white p-2.5">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase border ${actionBadgeClass(row.action_type)}`}>
                    {row.action_label || row.action_type}
                  </span>
                  <span className="text-[10px] text-slate-500">{formatDateTime(row.created_at)}</span>
                  <span className="text-[10px] text-slate-600">{row.from_status_label || "—"} → {row.to_status_label || "—"}</span>
                  <span className="text-[10px] font-bold text-slate-700 uppercase ml-auto">{row.created_by_name || "—"}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                  {(row.action_date || row.action_reason) ? (
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Date / Reason</span>
                      <p className="text-slate-700 break-words">
                        {row.action_date ? formatDocDate(row.action_date) : "—"}
                        {row.action_reason ? ` · ${row.action_reason}` : ""}
                      </p>
                    </div>
                  ) : null}
                  {row.remark ? (
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Remark</span>
                      <p className="text-slate-600 break-words">{row.remark}</p>
                    </div>
                  ) : null}
                  <div className={row.remark && !(row.action_date || row.action_reason) ? "" : "sm:col-span-2"}>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Details</span>
                    <p className="text-amber-900 break-words">{formatTxnTargetDates(null, row.action_type, row)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
