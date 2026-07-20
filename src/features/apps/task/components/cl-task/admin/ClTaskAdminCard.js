import { Trash2, Calendar, User, ShieldCheck, Zap, Building2, FileText } from "lucide-react";
import { formatDateTime, formatScheduledDate } from "@/features/apps/task/helpers/utilHelper";
import { stripHtml } from "@/features/apps/task/helpers/clTaskFormHelper";
import ClTaskCardFormPreview from "../shared/ClTaskCardFormPreview";
const TYPE_BADGE = {
  open: "bg-sky-50 text-sky-700 border-sky-200",
  frequently: "bg-violet-50 text-violet-700 border-violet-200",
};

const STATUS_BADGE = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  awaiting_verification: "bg-indigo-50 text-indigo-700 border-indigo-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const STATUS_LABEL = {
  pending: "Pending",
  awaiting_verification: "Under Review",
  completed: "Completed",
};

const BAR_COLORS = {
  pending: "#f59e0b",
  awaiting_verification: "#6366f1",
  completed: "#10b981",
};

export default function ClTaskAdminCard({ task, index, onDelete }) {
  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
  const barColor = BAR_COLORS[task.status] || "#94a3b8";
  const description = stripHtml(task.description) || stripHtml(task.sop_description);
  return (
    <div
      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full"
      style={{ backgroundColor: `${barColor}0d` }}
    >
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: barColor }} />

      <div className="px-3 py-2.5 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1 mb-1">
              <span className="text-[10px] text-slate-400 font-mono">#{index}</span>
              <span className={`px-1.5 py-px rounded text-[8px] font-bold uppercase border ${TYPE_BADGE[task.task_type] || ""}`}>
                {capitalize(task.task_type)}
              </span>
              {task.recurrence_type && (
                <span className="px-1.5 py-px rounded text-[8px] font-bold uppercase text-violet-600 bg-violet-50">
                  {task.recurrence_type}
                </span>
              )}
              <span className={`px-1.5 py-px rounded text-[8px] font-bold uppercase border ${STATUS_BADGE[task.status] || ""}`}>
                {STATUS_LABEL[task.status] || capitalize(task.status)}
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
          {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(task)}
            className="p-1 rounded-md text-rose-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 text-[9px]">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">
            <Zap size={9} /> Weightage {task.weightage ?? task.wastage ?? "—"}/10
          </span>
          {task.verification_required !== false && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-bold">
              <ShieldCheck size={9} /> Verify
            </span>
          )}
          {task.reject_count > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-bold">
              {task.reject_count}x reject
            </span>
          )}
        </div>

        <ClTaskCardFormPreview formSchema={task.form_schema} maxLabels={3} />

        <div className="text-[10px] text-slate-600 space-y-1 border-t border-slate-100 pt-2 mt-auto">
          <div className="flex items-center gap-1 truncate">
            <Calendar size={10} className="text-slate-400 shrink-0" />
            <span className="text-slate-400">Scheduled</span>
            <span className="font-medium">{formatScheduledDate(task.scheduled_date)}</span>
          </div>
          <div className="flex items-center gap-1 truncate">
            <Calendar size={10} className="text-slate-400 shrink-0" />
            <span className="text-slate-400">Due</span>
            <span className="font-medium truncate">{formatDateTime(task.end_date_time)}</span>
          </div>
          <div className="flex items-center gap-1 truncate">
            <User size={10} className="text-slate-400 shrink-0" />
            <span className="font-medium truncate">{task.person_name || "—"}</span>
          </div>
          {task.verification_user_name && (
            <div className="flex items-center gap-1 truncate">
              <ShieldCheck size={10} className="text-indigo-400 shrink-0" />
              <span className="text-slate-400">Verifier</span>
              <span className="font-medium truncate">{task.verification_user_name}</span>
            </div>
          )}
          {(task.department_name || task.designation_name) && (
            <div className="flex items-center gap-1 truncate">
              <Building2 size={10} className="text-slate-400 shrink-0" />
              <span className="font-medium truncate">
                {[task.department_name, task.designation_name].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-[9px] text-slate-400 pt-1 border-t border-slate-50">
          <span className="font-semibold text-slate-600">
            Score:{" "}
            {task.score != null && Number.isFinite(Number(task.score))
              ? `${Math.round((Number(task.score) / 10) * 1000) / 10}%`
              : "—"}
          </span>
          <span className="truncate">{formatDateTime(task.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
