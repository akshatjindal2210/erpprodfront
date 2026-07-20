import { useState, useMemo, useEffect } from "react";
import { Clock, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { normalizeToEntries } from "@/features/apps/task/helpers/clTaskFormHelper";
import { formatDateTime, formatScheduledDate } from "@/features/apps/task/helpers/utilHelper";
import { formatStoredScoreAsPercent } from "@/features/apps/task/helpers/clTaskScoreHelper";
import ClTaskFormEntriesView from "./ClTaskFormEntriesView";
import { ClFormSection } from "./clTaskFormUi";

function dedupeFills(fills) {
  const seen = new Set();
  const out = [];
  for (const fill of fills || []) {
    const id = Number(fill?.instance_id);
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    out.push(fill);
  }
  return out;
}

/**
 * Collapsible timeline of submits for one CL master + person.
 * Only includes fills for the opened task (`clTaskId`).
 */
export default function ClTaskSubmissionFillsList({
  fills = [],
  schema,
  clTaskId = null,
  personId = null,
  currentInstanceId = null,
  /** Hide the row already shown as the main form above. */
  excludeCurrent = false,
  title,
  emptyLabel = "No previous submissions yet",
  defaultCollapsed = true,
  onOpenFill,
}) {
  const list = useMemo(() => {
    return dedupeFills(fills).filter((fill) => {
      if (clTaskId != null && Number(fill.cl_task_id) !== Number(clTaskId)) return false;
      if (personId != null && fill.person_id != null && Number(fill.person_id) !== Number(personId)) {
        return false;
      }
      if (
        excludeCurrent &&
        currentInstanceId != null &&
        Number(fill.instance_id) === Number(currentInstanceId)
      ) {
        return false;
      }
      return true;
    });
  }, [fills, clTaskId, personId, currentInstanceId, excludeCurrent]);

  const [sectionOpen, setSectionOpen] = useState(!defaultCollapsed);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  useEffect(() => {
    setSectionOpen(!defaultCollapsed);
    const next = new Set();
    if (currentInstanceId != null && !excludeCurrent) {
      next.add(Number(currentInstanceId));
    }
    setExpandedIds(next);
  }, [clTaskId, currentInstanceId, excludeCurrent, defaultCollapsed, list.length]);

  const toggleFill = (id) => {
    const key = Number(id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!list.length) {
    if (excludeCurrent) return null;
    return (
      <ClFormSection title={title || "Submission history"}>
        <p className="text-xs text-slate-400">{emptyLabel}</p>
      </ClFormSection>
    );
  }

  const sectionTitle = title
    ? `${title} (${list.length})`
    : `Submission history (${list.length})`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setSectionOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-slate-50 hover:bg-slate-100/80 border-b border-slate-100"
      >
        {sectionOpen ? (
          <ChevronDown size={14} className="text-slate-500 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-slate-500 shrink-0" />
        )}
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          {sectionTitle}
        </span>
        <span className="ml-auto text-[10px] font-bold text-slate-400 tabular-nums">
          {list.length}
        </span>
      </button>

      {sectionOpen ? (
        <div className="p-3 space-y-2">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Each row is one submission (time + form data). Reject count is tracked per
            submission and is not the same as the number of rows in this list.
          </p>
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {list.map((fill, i) => {
              const fillEntries = normalizeToEntries(fill.form_responses);
              const id = Number(fill.instance_id) || i;
              const isCurrent =
                currentInstanceId != null &&
                Number(fill.instance_id) === Number(currentInstanceId);
              const open = expandedIds.has(id);

              return (
                <div
                  key={fill.instance_id || `fill-${i}`}
                  className={`rounded-xl border overflow-hidden ${
                    isCurrent
                      ? "border-indigo-300 bg-indigo-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <button
                      type="button"
                      onClick={() => toggleFill(id)}
                      className="inline-flex items-center gap-1.5 text-left min-w-0"
                    >
                      {open ? (
                        <ChevronDown size={13} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={13} className="text-slate-400 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-slate-700">
                        Submit #{i + 1}
                        {isCurrent ? " · viewing" : ""}
                      </span>
                    </button>
                    {fill.submitted_at ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                        <Clock size={11} />
                        {formatDateTime(fill.submitted_at)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        {formatScheduledDate(fill.scheduled_date)}
                      </span>
                    )}
                    <span className="text-[11px] font-semibold capitalize text-slate-600">
                      {String(fill.status || "").replace(/_/g, " ")}
                    </span>
                    {fill.score != null ? (
                      <span className="text-[11px] font-bold text-amber-700">
                        Score {formatStoredScoreAsPercent(fill.score)}
                      </span>
                    ) : null}
                    {Number(fill.reject_count) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700">
                        <AlertTriangle size={10} />
                        Rejected {fill.reject_count}{" "}
                        {Number(fill.reject_count) === 1 ? "time" : "times"}
                      </span>
                    ) : null}
                    {typeof onOpenFill === "function" && fill.instance_id && !isCurrent ? (
                      <button
                        type="button"
                        onClick={() => onOpenFill(fill)}
                        className="ml-auto text-[10px] font-bold uppercase tracking-wide text-indigo-700 hover:text-indigo-900"
                      >
                        Open
                      </button>
                    ) : null}
                  </div>

                  {open ? (
                    <div className="p-3 space-y-2">
                      {fill.person_remark ? (
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-500">Assignee remark: </span>
                          {fill.person_remark}
                        </p>
                      ) : null}
                      {fill.verifier_remark ? (
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-500">Verifier remark: </span>
                          {fill.verifier_remark}
                        </p>
                      ) : null}
                      {fillEntries.length ? (
                        <ClTaskFormEntriesView
                          schema={fill.form_schema || schema}
                          entries={fillEntries}
                        />
                      ) : (
                        <p className="text-xs text-slate-400">No form data</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
