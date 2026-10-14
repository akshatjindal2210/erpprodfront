"use client";

import { ArrowDown } from "lucide-react";
import { asList, normalizeRmItems } from "@/apps/engineering/modules/process-mapping/ProcessStagesBlock";

/**
 * Simple view — same idea as editor: Stage card → Process | Machines | RM, ↓ between stages.
 */
export default function ProcessMappingView({
  stages = [],
  defaultRm = [],
  accent = "indigo",
  emptyHint = "No mapping yet.",
  title = null,
}) {
  const list = asList(stages).filter((st) => asList(st.processes).length > 0);
  const isEmerald = accent === "emerald";
  const border = isEmerald ? "border-emerald-200" : "border-indigo-200";
  const head = isEmerald ? "bg-emerald-50 text-emerald-800" : "bg-indigo-50 text-indigo-800";
  const badge = isEmerald ? "bg-emerald-600" : "bg-indigo-600";

  if (!list.length) {
    return <p className="text-[11px] text-slate-500">{emptyHint}</p>;
  }

  return (
    <div className="space-y-2">
      {title ? (
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{title}</p>
      ) : null}

      {list.map((stage, sIdx) => (
        <div key={stage.key || `s-${sIdx}`}>
          {sIdx > 0 && (
            <div className="flex justify-center py-1 text-slate-400">
              <ArrowDown size={16} strokeWidth={2.25} />
            </div>
          )}

          <div className={`rounded-lg border bg-white ${border}`}>
            <div className={`flex items-center gap-2 rounded-t-lg border-b px-3 py-2 ${border} ${head}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${badge}`}>
                {sIdx + 1}
              </span>
              <span className="text-[11px] font-black uppercase tracking-wide">Stage {sIdx + 1}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-1.5 font-bold">Process</th>
                    <th className="px-3 py-1.5 font-bold">Machines</th>
                    <th className="px-3 py-1.5 font-bold">RM</th>
                  </tr>
                </thead>
                <tbody>
                  {asList(stage.processes).map((proc, pIdx) => {
                    const machines = asList(proc.machines);
                    const rms = asList(proc.rm_items).length
                      ? normalizeRmItems(proc.rm_items)
                      : normalizeRmItems(defaultRm);
                    return (
                      <tr key={proc.process_id || pIdx} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-2 align-top">
                          <span className="text-[12px] font-bold text-slate-800">
                            {proc.process_name || `Process ${proc.process_id}`}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-slate-600">
                          {machines.length
                            ? machines.map((m) => m.machine_label || `Machine ${m.machine_id}`).join(", ")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-slate-600">
                          {rms.length ? rms.map((r) => r.rm_item_code).join(", ") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
