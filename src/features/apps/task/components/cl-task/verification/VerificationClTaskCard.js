import { Clock, User, Star, ShieldCheck, Calendar, Zap, FileText } from "lucide-react";
import { formatDateTime, formatScheduledDate } from "@/features/apps/task/helpers/utilHelper";
import { stripHtml } from "@/features/apps/task/helpers/clTaskFormHelper";
import ClTaskCardFormPreview from "../shared/ClTaskCardFormPreview";

const TYPE_BADGE = {
  open: "bg-sky-50 text-sky-700 border-sky-200",
  frequently: "bg-violet-50 text-violet-700 border-violet-200",
};

const BAR_COLOR = "#6366f1";

export default function VerificationClTaskCard({ task, onVerify }) {
  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
  const description = stripHtml(task.description) || stripHtml(task.sop_description);
  const scoringOn = task.verification_required !== false;

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full"
      style={{ backgroundColor: `${BAR_COLOR}0d` }}
    >
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: BAR_COLOR }} />

      <div className="px-3 py-2.5 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1 mb-1">
            <span className={`px-1.5 py-px rounded text-[8px] font-bold uppercase border ${TYPE_BADGE[task.task_type] || ""}`}>
              {capitalize(task.task_type)}
            </span>
            {task.recurrence_type && (
              <span className="px-1.5 py-px rounded text-[8px] font-bold uppercase text-violet-600 bg-violet-50">
                {task.recurrence_type}
              </span>
            )}
            <span className="px-1.5 py-px rounded text-[8px] font-bold uppercase border bg-indigo-50 text-indigo-700 border-indigo-200">
              Awaiting Verify
            </span>
          </div>
          <h3 className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2" title={task.title}>
            {task.title}
          </h3>
          {description && (
            <div className="mt-1 flex items-start gap-1 min-w-0">
              <FileText size={10} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 line-clamp-2 leading-snug min-w-0 flex-1" title={description}>
                {description}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 text-[9px]">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">
            <Zap size={9} /> Wattage {task.wastage ?? "—"}/10
          </span>
          {scoringOn && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">
              <Star size={9} /> Score 1–10
            </span>
          )}
          {task.reject_count > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-bold">
              {task.reject_count}x reject
            </span>
          )}
        </div>

        <ClTaskCardFormPreview formSchema={task.form_schema} maxLabels={3} />

        <div className="text-[10px] text-slate-600 space-y-1 border-t border-slate-100 pt-2">
          <div className="flex items-center gap-1 truncate">
            <User size={10} className="text-slate-400 shrink-0" />
            <span className="font-medium truncate">{task.person_name || "—"}</span>
          </div>
          {task.department_name && (
            <div className="flex items-center gap-1 truncate">
              <span className="text-slate-400">Dept</span>
              <span className="font-medium truncate">{task.department_name}</span>
            </div>
          )}
          <div className="flex items-center gap-1 truncate">
            <Calendar size={10} className="text-slate-400 shrink-0" />
            <span className="text-slate-400">Scheduled</span>
            <span className="font-medium">{formatScheduledDate(task.scheduled_date)}</span>
          </div>
          <div className="flex items-center gap-1 truncate">
            <Clock size={10} className="text-slate-400 shrink-0" />
            <span className="text-slate-400">Submitted</span>
            <span className="font-medium truncate">{formatDateTime(task.submitted_at)}</span>
          </div>
        </div>

        {task.person_remark && (
          <div className="text-[10px] text-slate-600 bg-amber-50 rounded-lg px-2 py-1.5 border border-amber-100">
            <span className="font-bold text-amber-700">Remark: </span>
            {task.person_remark}
          </div>
        )}

        {onVerify && (
        <button
          type="button"
          onClick={() => onVerify(task)}
          className="w-full py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-1.5 shadow-sm mt-auto"
        >
          <ShieldCheck size={14} /> Verify & Score
        </button>
        )}
      </div>
    </div>
  );
}
