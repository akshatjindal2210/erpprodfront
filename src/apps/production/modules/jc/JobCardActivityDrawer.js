"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import { jobCardService } from "@/apps/production/lib/services/jobCard";

export default function JobCardActivityDrawer({ card, onClose }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancel = false;
    jobCardService
      .getById(card.docno)
      .then((res) => !cancel && setRows(res?.data?.plan_rows || []))
      .catch(() => !cancel && toast.error("Failed to load plan."))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [card.docno]);

  return (
    <Drawer isOpen onClose={onClose} onSubmit={onClose} title="Production Plan" description={card.job_card_no} maxWidth="max-w-lg" closeOnOutside>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-indigo-600" size={20} />
        </div>
      ) : !rows.length ? (
        <p className="py-8 text-center text-xs text-slate-500">No plan rows.</p>
      ) : (
        <div className="overflow-x-auto border border-slate-200">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-slate-50 font-bold uppercase text-slate-500">
              <tr>
                <th className="p-2">Proc</th>
                <th className="p-2">Mach</th>
                <th className="p-2">St</th>
                <th className="p-2">Plan</th>
                <th className="p-2">Actual</th>
                <th className="p-2">Stat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.docno} className="border-t border-slate-100">
                  <td className="p-2">{r.process_name || r.proccode}</td>
                  <td className="p-2">{r.machine_name || "—"}</td>
                  <td className="p-2">{r.stage_no ?? "—"}</td>
                  <td className="p-2 whitespace-nowrap">
                    {r.plan_start ? String(r.plan_start).slice(0, 10) : "—"} → {r.plan_end ? String(r.plan_end).slice(0, 10) : "—"}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {r.actual_start ? new Date(r.actual_start).toLocaleString() : "—"}
                    {r.actual_end ? ` / ${new Date(r.actual_end).toLocaleString()}` : ""}
                  </td>
                  <td className="p-2 uppercase">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Drawer>
  );
}
