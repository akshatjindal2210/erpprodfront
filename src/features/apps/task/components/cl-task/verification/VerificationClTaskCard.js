import { User, Clock, Star } from "lucide-react";
import { formatDateTime } from "@/features/apps/task/helpers/utilHelper";
import { getClTaskTypeLabel, getClTaskTypeTheme } from "@/features/apps/task/helpers/clTaskTypeStyle";
import { isClTaskMissed } from "@/features/apps/task/helpers/clTaskTimeHelper";

const STATUS_BADGE = {
  APPROVAL: "bg-indigo-50 text-indigo-700 border-indigo-100",
  COMPLETE: "bg-emerald-50 text-emerald-700 border-emerald-100",
  DUE: "bg-amber-50 text-amber-700 border-amber-100",
  OPEN: "bg-sky-50 text-sky-700 border-sky-100",
  MISSED: "bg-rose-50 text-rose-700 border-rose-100",
};

function cardStatusLabel(task) {
  const type = String(task?.task_type || "");
  const status = String(task?.status || "");
  if (type === "frequently" && (isClTaskMissed(task) || task?.is_missed === true)) return "MISSED";
  if (status === "completed") return "COMPLETE";
  if (status === "awaiting_verification") return "APPROVAL";
  if (type === "open") return "OPEN";
  return "DUE";
}

export default function VerificationClTaskCard({ task, selected = false, onSelect, onOpen }) {
  const theme = getClTaskTypeTheme(task);
  const statusLabel = cardStatusLabel(task);
  const statusCls = STATUS_BADGE[statusLabel] || STATUS_BADGE.APPROVAL;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(task)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen?.(task);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(task);
        }
      }}
      className={`group relative bg-white border rounded-xl overflow-hidden flex flex-col h-full transition-all duration-200 text-left ${
        selected ? theme.cardSelected : theme.cardBorder
      }`}
    >
      <div className={`h-1.5 w-full shrink-0 ${theme.bar}`} />

      <div className={`p-3.5 flex flex-col gap-2.5 flex-1 min-h-0 ${theme.soft}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border ${theme.badge}`}>
              {getClTaskTypeLabel(task)}
            </span>
            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border ${statusCls}`}>
              {statusLabel}
            </span>
          </div>
          {selected ? (
            <span className="shrink-0 w-2 h-2 rounded-full bg-indigo-600 mt-1" />
          ) : null}
        </div>

        <div className="min-w-0">
          <h3 className="font-bold text-slate-800 text-[12px] leading-snug line-clamp-2 uppercase tracking-tight">
            {task.title || "—"}
          </h3>
        </div>

        <div className="mt-auto space-y-1.5 pt-1 border-t border-slate-100/80">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
              <User size={11} /> Person
            </span>
            <span className="font-semibold text-slate-700 truncate max-w-[55%] text-right">
              {task.person_name || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
              <Clock size={11} /> Submitted
            </span>
            <span className="font-semibold text-slate-700 tabular-nums">
              {formatDateTime(task.submitted_at) || "—"}
            </span>
          </div>
          {task.status === "completed" && task.score != null ? (
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                <Star size={11} className="fill-amber-400 text-amber-400" /> Score
              </span>
              <span className="font-black text-amber-700">
                {Number.isFinite(Number(task.score))
                  ? `${Math.round((Number(task.score) / 10) * 1000) / 10}%`
                  : "—"}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
