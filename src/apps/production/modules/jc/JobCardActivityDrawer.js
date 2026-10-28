"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import { planService } from "@/apps/production/lib/services/plan";
import { jobCardService } from "@/apps/production/lib/services/jobCard";

/**
 * History drawer.
 * - Planning Table: pass plan_docno / planLineDocno (+ fromPlanTable) → one selected plan line.
 * - Maintain Job Card: pass JC docno → all plan_rows for that card.
 */
export default function JobCardActivityDrawer({ card, onClose }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const planLineId = Number(card?.plan_docno ?? card?.planLineDocno);
  const jcDocno = Number(card?.docno ?? card?.job_card_docno);
  const selectedLineOnly = Boolean(card?.fromPlanTable);

  useEffect(() => {
    let cancel = false;
    setLoading(true);

    (async () => {
      try {
        if (selectedLineOnly && Number.isFinite(planLineId) && planLineId > 0) {
          const res = await planService.getById(planLineId);
          if (!cancel) setRows(res?.data ? [res.data] : []);
          return;
        }
        if (Number.isFinite(jcDocno) && jcDocno > 0) {
          const res = await jobCardService.getById(jcDocno);
          if (!cancel) setRows(Array.isArray(res?.data?.plan_rows) ? res.data.plan_rows : []);
          return;
        }
        if (!cancel) setRows([]);
      } catch {
        if (!cancel) toast.error("Failed to load history.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [selectedLineOnly, planLineId, jcDocno]);

  const titleNo = card?.job_card_no || card?.pjobcardno || "";

  return (
    <Drawer
      isOpen
      onClose={onClose}
      onSubmit={onClose}
      title="History"
      description={
        selectedLineOnly
          ? titleNo
            ? `Selected line · ${titleNo}`
            : "Selected plan line"
          : titleNo
            ? `Plan · ${titleNo}`
            : "Production plan"
      }
      maxWidth="max-w-lg"
      closeOnOutside
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-indigo-600" size={20} />
        </div>
      ) : !rows.length ? (
        <p className="py-8 text-center text-xs text-slate-500">
          {selectedLineOnly ? "No history for this line." : "No plan rows."}
        </p>
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
                <tr key={r.docno || `${r.proccode}-${r.maccode}-${r.stage_no}`} className="border-t border-slate-100">
                  <td className="p-2">{r.process_name || r.proccode || "—"}</td>
                  <td className="p-2">{r.machine_name || r.maccode || "—"}</td>
                  <td className="p-2">{r.stage_no ?? "—"}</td>
                  <td className="p-2 whitespace-nowrap">
                    {r.plan_start ? String(r.plan_start).slice(0, 10) : "—"} → {r.plan_end ? String(r.plan_end).slice(0, 10) : "—"}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {r.actual_start ? new Date(r.actual_start).toLocaleString() : "—"}
                    {r.actual_end ? ` / ${new Date(r.actual_end).toLocaleString()}` : ""}
                  </td>
                  <td className="p-2 uppercase">{r.status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Drawer>
  );
}
