import { CheckCircle, Clock, Calendar, User, Zap } from "lucide-react";
import { formatDateTime, formatScheduledDate } from "@/features/apps/task/helpers/utilHelper";
import { formatDueTimeLabel } from "@/features/apps/task/helpers/clTaskTimeHelper";
import { getClTaskTypeLabel, getClTaskTypeTheme } from "@/features/apps/task/helpers/clTaskTypeStyle";
import { stripHtml } from "@/features/apps/task/helpers/clTaskFormHelper";

const STATUS_BADGE = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  awaiting_verification: "bg-indigo-50 text-indigo-700 border-indigo-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const STATUS_LABEL = {
  pending: "Due",
  awaiting_verification: "Pending Approval",
  completed: "Completed",
};

export default function MyClTaskCard({
  task,
  tab = "due",
  selected = false,
  onSelect,
  onStart,
}) {
  const theme = getClTaskTypeTheme(task);
  const isHistory = tab === "history";
  const desc = stripHtml(task.description);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(task)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStart?.(task);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(task);
        }
      }}
      className={`group relative bg-white border rounded-xl overflow-hidden flex flex-col h-full transition-all duration-200 text-left cursor-pointer ${
        Number(task.reject_count) > 0 && !isHistory
          ? selected
            ? "border-rose-400 ring-2 ring-rose-200 shadow-sm"
            : "border-rose-300 shadow-sm shadow-rose-100"
          : selected
            ? theme.cardSelected
            : theme.cardBorder
      }`}
    >
      <div
        className={`h-1.5 w-full shrink-0 ${
          Number(task.reject_count) > 0 && !isHistory ? "bg-rose-500" : theme.bar
        }`}
      />

      <div className={`p-3.5 flex flex-col gap-2.5 flex-1 min-h-0 ${theme.soft}`}>
        <div className="flex flex-wrap items-center gap-1">
          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border ${theme.badge}`}>
            {getClTaskTypeLabel(task)}
          </span>
          {isHistory ? (
            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border ${STATUS_BADGE[task.status] || ""}`}>
              {STATUS_LABEL[task.status] || task.status}
            </span>
          ) : Number(task.reject_count) > 0 ? (
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase border border-rose-300 bg-rose-100 text-rose-800">
              Rejected · {task.reject_count}{" "}
              {Number(task.reject_count) === 1 ? "time" : "times"}
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 text-[13px] leading-snug line-clamp-2" title={task.title}>
            {task.title}
          </h3>
          {!isHistory && desc ? (
            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1" title={desc}>{desc}</p>
          ) : null}
        </div>

        <div className="mt-auto space-y-1.5 pt-2 border-t border-slate-100/80 text-[11px]">
          {isHistory ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                  <Clock size={11} /> Submitted
                </span>
                <span className="font-semibold tabular-nums">{formatDateTime(task.submitted_at) || "—"}</span>
              </div>
              {task.status === "awaiting_verification" && task.verification_user_name ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                    <User size={11} /> Approver
                  </span>
                  <span className="font-semibold truncate max-w-[55%] text-right">{task.verification_user_name}</span>
                </div>
              ) : null}
              {task.status === "completed" ? (
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                  <CheckCircle size={12} />
                  Completed{task.score != null ? ` · ${Math.round((Number(task.score) / 10) * 1000) / 10}%` : ""}
                </div>
              ) : null}
              {Number(task.reject_count) > 0 ? (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-400 uppercase text-[9px] font-bold tracking-wider">Rejects</span>
                    <span className="font-semibold text-rose-700">{task.reject_count}</span>
                  </div>
                  {task.verifier_remark ? (
                    <p className="text-[10px] text-rose-700/90 leading-snug line-clamp-2" title={task.verifier_remark}>
                      {task.verifier_remark}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {Number(task.reject_count) > 0 ? (
                <div className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-rose-800">
                      Rejected task
                    </span>
                    <span className="text-[10px] font-black tabular-nums text-rose-700 bg-white border border-rose-200 px-1.5 py-0.5 rounded">
                      {task.reject_count}{" "}
                      {Number(task.reject_count) === 1 ? "time" : "times"}
                    </span>
                  </div>
                  {task.verifier_remark ? (
                    <p className="text-[11px] text-rose-800/90 leading-snug line-clamp-3" title={task.verifier_remark}>
                      <span className="font-bold">Reason: </span>
                      {task.verifier_remark}
                    </p>
                  ) : (
                    <p className="text-[10px] text-rose-600/80 italic">No reason noted — refill carefully</p>
                  )}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                  <Calendar size={11} /> Date
                </span>
                <span className="font-semibold tabular-nums">{formatScheduledDate(task.scheduled_date)}</span>
              </div>
              {task.person_name ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                    <User size={11} /> Assignee
                  </span>
                  <span className="font-semibold truncate max-w-[55%] text-right">{task.person_name}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                  <Clock size={11} /> Fill before
                </span>
                <span className="font-semibold">
                  {task.task_type === "frequently" && task.due_time
                    ? formatDueTimeLabel(task.due_time)
                    : "Anytime"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                  <Zap size={11} /> Weightage
                </span>
                <span className="font-semibold">{task.weightage ?? task.wastage ?? "—"}/10</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
