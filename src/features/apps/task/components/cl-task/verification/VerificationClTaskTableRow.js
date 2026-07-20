import { Star, AlertTriangle, ShieldCheck } from "lucide-react";
import { formatDateTime, formatScheduledDate } from "@/features/apps/task/helpers/utilHelper";
import { stripHtml } from "@/features/apps/task/helpers/clTaskFormHelper";

const TYPE_BADGE = {
  open: "bg-sky-50 text-sky-700 border-sky-200",
  frequently: "bg-violet-50 text-violet-700 border-violet-200",
};

const BAR_COLOR = "#6366f1";

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

export default function VerificationClTaskTableRow({ task, index, onVerify }) {
  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
  const scoringOn = task.verification_required !== false;
  const stickyBg = blendWithWhite(BAR_COLOR, 0.09);
  const rowBg = { backgroundColor: `${BAR_COLOR}18` };
  const description = stripHtml(task.description) || stripHtml(task.sop_description);

  return (
    <tr className="transition-colors hover:brightness-[0.98]" style={rowBg}>
      <td className="w-1 p-0 sticky left-0 z-[2]" style={{ backgroundColor: stickyBg }}>
        <div className="w-[5px] min-h-[52px]" style={{ backgroundColor: BAR_COLOR }} />
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
        {description && (
          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 font-normal" title={description}>
            {description}
          </p>
        )}
        {task.reject_count > 0 && (
          <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold text-rose-600">
            <AlertTriangle size={10} /> {task.reject_count}x reject
          </span>
        )}
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${TYPE_BADGE[task.task_type] || ""}`}>
          {capitalize(task.task_type)}
        </span>
        {task.recurrence_type && (
          <span className="ml-1 text-[10px] text-slate-400 uppercase">{task.recurrence_type}</span>
        )}
      </td>
      <td className="px-4 py-3 text-slate-600 max-w-[130px] truncate">{task.person_name || "—"}</td>
      <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate">{task.department_name || "—"}</td>
      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatScheduledDate(task.scheduled_date)}</td>
      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDateTime(task.submitted_at)}</td>
      <td className="px-4 py-3 text-slate-600 font-medium">{task.weightage ?? task.wastage ?? "—"}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        {scoringOn ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
            <Star size={10} /> Score req.
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">No score</span>
        )}
      </td>

      <td
        className="px-3 py-3 text-center sticky right-0 z-[2] border-l border-slate-200 min-w-[110px]"
        style={{ backgroundColor: stickyBg }}
      >
        {onVerify && (
        <button
          type="button"
          onClick={() => onVerify(task)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
        >
          <ShieldCheck size={13} /> Verify
        </button>
        )}
      </td>
    </tr>
  );
}
