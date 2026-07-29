import { CheckCircle, Clock, Calendar, AlertTriangle } from "lucide-react";
import { formatDateTime, formatScheduledDate } from "@/apps/task/lib/helpers/utilHelper";
import { stripHtml } from "@/apps/task/lib/helpers/clTaskFormHelper";
import { canSubmitPreviousTask, getISTDateString } from "@/apps/task/lib/helpers/clTaskTimeHelper";
import ClTaskAttachmentsField from "../shared/ClTaskAttachmentBlock";

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
  awaiting_verification: "Awaiting Verification",
  completed: "Completed",
};

const ROW_COLORS = {
  pending: "#f59e0b",
  awaiting_verification: "#6366f1",
  completed: "#10b981",
};

function blendWithWhite(hex, alpha = 0.09) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const br = Math.round(r * alpha + 255 * (1 - alpha));
  const bg = Math.round(g * alpha + 255 * (1 - alpha));
  const bb = Math.round(b * alpha + 255 * (1 - alpha));
  return `rgb(${br},${bg},${bb})`;
}

export default function MyClTaskTableRow({ task, index, tab, variant = "all", onSubmit, submitting }) {
  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
  const isPending = task.status === "pending";
  const today = getISTDateString();
  const scheduled = String(task.scheduled_date).slice(0, 10);
  const isToday = scheduled === today;
  const isPast = scheduled < today;
  const isPrevious = tab === "previous";

  let canSubmit = false;
  let lockedPrevious = false;

  if (variant === "due") {
    canSubmit = isPending;
  } else if (variant === "open") {
    canSubmit = isPending && (!isPast || canSubmitPreviousTask());
    lockedPrevious = isPending && isPast && !isToday && !canSubmitPreviousTask();
  } else {
    canSubmit = isPending && (tab === "today" || (isPrevious && canSubmitPreviousTask()));
    lockedPrevious = isPending && isPrevious && !canSubmitPreviousTask();
  }

  const isRejected = Number(task.reject_count) > 0;
  const barColor = isRejected ? "#e11d48" : ROW_COLORS[task.status] || "#94a3b8";
  const stickyBg = blendWithWhite(barColor, isRejected ? 0.14 : 0.09);
  const rowBg = { backgroundColor: isRejected ? "#fff1f2" : `${barColor}18` };
  const description = stripHtml(task.description) || stripHtml(task.sop_description);

  return (
    <tr className="transition-colors hover:brightness-[0.98]" style={rowBg}>
      <td className="w-1 p-0 sticky left-0 z-[2]" style={{ backgroundColor: stickyBg }}>
        <div className="w-[5px] min-h-[52px]" style={{ backgroundColor: barColor }} />
      </td>

      <td
        className="px-2 py-3 w-8 text-xs font-mono sticky left-[5px] z-[2] border-r border-slate-200 text-slate-400"
        style={{ backgroundColor: stickyBg }}
      >
        {index}
      </td>

      <td
        className="px-4 py-3 font-medium text-slate-800 max-w-[220px] sticky left-[42px] z-[2] border-r border-slate-200"
        style={{ backgroundColor: stickyBg }}
      >
        <div className="truncate font-semibold" title={task.title}>{task.title}</div>
        {task.person_name ? (
          <p className="text-[10px] text-slate-500 truncate mt-0.5 font-normal" title={task.person_name}>
            Assignee: {task.person_name}
          </p>
        ) : null}
        {description && (
          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 font-normal" title={description}>
            {description}
          </p>
        )}
        <div className="mt-0.5">
          <ClTaskAttachmentsField value={task.attachment} readOnly label="" />
        </div>
        {isRejected ? (
          <div className="mt-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 space-y-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-rose-700">
              <AlertTriangle size={10} /> Rejected · {task.reject_count}{" "}
              {Number(task.reject_count) === 1 ? "time" : "times"}
            </span>
            {task.verifier_remark ? (
              <p className="text-[10px] text-rose-800/90 leading-snug line-clamp-2" title={task.verifier_remark}>
                <span className="font-bold">Reason: </span>
                {task.verifier_remark}
              </p>
            ) : null}
          </div>
        ) : null}
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${TYPE_BADGE[task.task_type] || ""}`}>
          {capitalize(task.task_type)}
        </span>
        {task.recurrence_type && (
          <span className="ml-1 text-[10px] text-slate-400 uppercase">{task.recurrence_type}</span>
        )}
      </td>
      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatScheduledDate(task.scheduled_date)}</td>
      <td className="px-4 py-3 text-slate-600 font-medium">{task.weightage ?? task.wastage ?? "—"}</td>
      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDateTime(task.end_date_time)}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${STATUS_BADGE[task.status] || ""}`}>
          {STATUS_LABEL[task.status] || capitalize(task.status)}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">
        {task.score != null && Number.isFinite(Number(task.score))
          ? `${Math.round((Number(task.score) / 10) * 1000) / 10}%`
          : "—"}
      </td>

      <td
        className="px-3 py-3 text-center sticky right-0 z-[2] border-l border-slate-200 min-w-[120px]"
        style={{ backgroundColor: stickyBg }}
      >
        {canSubmit && (
          <button
            type="button"
            disabled={submitting === task.instance_id}
            onClick={() => onSubmit(task)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60"
          >
            <CheckCircle size={13} />
            {submitting === task.instance_id ? "Opening…" : "Start & Fill"}
          </button>
        )}
        {lockedPrevious && (
          <span className="text-[10px] text-rose-500 font-medium">Locked after 11 AM</span>
        )}
        {task.status === "awaiting_verification" && (
          <span className="text-[10px] text-indigo-500 font-medium inline-flex items-center justify-center gap-1">
            <Clock size={11} /> Under review
          </span>
        )}
        {task.status === "completed" && (
          <span className="text-[10px] text-emerald-600 font-medium inline-flex items-center justify-center gap-1">
            <CheckCircle size={11} /> Done
          </span>
        )}
        {tab === "future" && isPending && (
          <span className="text-[10px] text-slate-400 inline-flex items-center justify-center gap-1">
            <Calendar size={11} /> Upcoming
          </span>
        )}
      </td>
    </tr>
  );
}
