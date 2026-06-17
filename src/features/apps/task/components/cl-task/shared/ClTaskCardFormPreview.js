import { ListChecks } from "lucide-react";
import { getFormFieldsSummary } from "@/features/apps/task/helpers/clTaskFormHelper";

export default function ClTaskCardFormPreview({ formSchema, maxLabels = 5, compact = false }) {
  const { total, requiredCount, requiredLabels, optionalCount } = getFormFieldsSummary(formSchema);
  if (!total) return null;

  const shown = requiredLabels.slice(0, maxLabels);
  const extra = requiredLabels.length - shown.length;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <ListChecks size={11} className="text-indigo-500 shrink-0" />
        <span>
          {requiredCount > 0
            ? `${requiredCount} required field${requiredCount === 1 ? "" : "s"}`
            : `${total} field${total === 1 ? "" : "s"}`}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
          <ListChecks size={11} className="text-indigo-500" />
          Form
        </span>
        <span className="text-[10px] text-slate-500 font-medium">
          {total} field{total === 1 ? "" : "s"}
          {requiredCount > 0 && ` · ${requiredCount} required`}
          {optionalCount > 0 && requiredCount > 0 && ` · ${optionalCount} optional`}
        </span>
      </div>
      {requiredCount > 0 ? (
        <div className="flex flex-wrap gap-1">
          {shown.map((label) => (
            <span
              key={label}
              className="inline-flex px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-semibold"
            >
              {label}
              <span className="text-rose-400 ml-0.5">*</span>
            </span>
          ))}
          {extra > 0 && (
            <span className="text-[9px] text-slate-400 font-medium self-center">+{extra} more</span>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-slate-500">No required fields — optional form only</p>
      )}
    </div>
  );
}
