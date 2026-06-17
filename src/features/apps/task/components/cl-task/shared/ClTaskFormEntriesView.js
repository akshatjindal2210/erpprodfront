import { Trash2, ListChecks } from "lucide-react";
import ClTaskCustomFieldRenderer from "./ClTaskCustomFieldRenderer";
import { normalizeToEntries, parseFormSchema } from "@/features/apps/task/helpers/clTaskFormHelper";
import { formatDateTime } from "@/features/apps/task/helpers/utilHelper";

function entrySummary(schema, responses) {
  const fields = parseFormSchema(schema);
  const parts = fields
    .slice(0, 2)
    .map((f) => {
      const val = responses?.[f.id];
      if (val?.file_name) return val.file_name;
      if (val !== undefined && val !== null && val !== "") return String(val);
      return null;
    })
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : "Filled";
}

export default function ClTaskFormEntriesView({
  schema,
  formResponses,
  entries: entriesProp,
  onRemove,
  compact = false,
}) {
  const fields = parseFormSchema(schema);
  const entries = entriesProp ?? normalizeToEntries(formResponses);

  if (!fields.length || !entries.length) return null;

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => (
        <div
          key={entry.id || i}
          className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700">Entry #{i + 1}</p>
                {compact ? (
                  <p className="text-[11px] text-slate-400 truncate">{entrySummary(schema, entry.responses)}</p>
                ) : entry.filled_at ? (
                  <p className="text-[11px] text-slate-400">{formatDateTime(entry.filled_at)}</p>
                ) : null}
              </div>
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                title="Remove entry"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          {!compact && (
            <div className="p-3">
              <ClTaskCustomFieldRenderer
                schema={schema}
                values={entry.responses || {}}
                readOnly
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ClTaskFormEntriesHeader({ count }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
      <ListChecks size={14} className="text-indigo-500" />
      {count} form {count === 1 ? "entry" : "entries"} submitted
    </div>
  );
}
