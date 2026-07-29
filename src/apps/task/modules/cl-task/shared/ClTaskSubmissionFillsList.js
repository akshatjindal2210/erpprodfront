import { useState, useMemo, useEffect } from "react";
import { Clock, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { normalizeToEntries } from "@/apps/task/lib/helpers/clTaskFormHelper";
import { formatDateTime, formatScheduledDate } from "@/apps/task/lib/helpers/utilHelper";
import { formatStoredScoreAsPercent } from "@/apps/task/lib/helpers/clTaskScoreHelper";
import ClTaskFormEntriesView from "./ClTaskFormEntriesView";
import { ClFormSection } from "./clTaskFormUi";

function fillKey(fill, index = 0) {
  if (fill?.fill_id != null && fill.fill_id !== "") return `fill:${fill.fill_id}`;
  if (fill?.id != null && String(fill.id).startsWith("fill_")) return `fill:${fill.id}`;
  const instanceId = Number(fill?.instance_id);
  if (instanceId) return `inst:${instanceId}`;
  return `idx:${index}`;
}

function dedupeFills(fills) {
  const seen = new Set();
  const out = [];
  (fills || []).forEach((fill, index) => {
    const key = fillKey(fill, index);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(fill);
  });
  return out;
}

/**
 * Same submissions list everywhere (submit / verify / report).
 * Expand to view; Edit (when onOpenFill) loads that fill into the main form.
 */
export default function ClTaskSubmissionFillsList({
  fills = [],
  schema,
  clTaskId = null,
  personId = null,
  currentInstanceId = null,
  currentFillId = null,
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
      if (!excludeCurrent) return true;

      const fillId = fill.fill_id ?? fill.id ?? null;
      if (currentFillId != null && fillId != null) {
        return String(fillId) !== String(currentFillId);
      }
      if (fillId != null && currentFillId == null) return true;
      if (
        currentInstanceId != null &&
        Number(fill.instance_id) === Number(currentInstanceId) &&
        fillId == null
      ) {
        return false;
      }
      return true;
    });
  }, [fills, clTaskId, personId, currentInstanceId, currentFillId, excludeCurrent]);

  const [sectionOpen, setSectionOpen] = useState(!defaultCollapsed);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  /** Reset section open only when the task/list context changes — not when switching fills. */
  useEffect(() => {
    setSectionOpen(!defaultCollapsed);
  }, [clTaskId, currentInstanceId, excludeCurrent, defaultCollapsed, list.length]);

  /** Keep individual rows collapsed when switching which fill is active. */
  useEffect(() => {
    setExpandedIds(new Set());
  }, [currentFillId, currentInstanceId, list.length]);

  if (!list.length) {
    if (excludeCurrent) return null;
    return (
      <ClFormSection title={title || "Previous submits"}>
        <p className="text-xs text-slate-400">{emptyLabel}</p>
      </ClFormSection>
    );
  }

  const sectionTitle = title
    ? `${title} (${list.length})`
    : `Previous submits (${list.length})`;

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
        <div className="p-3 space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {list.map((fill, i) => {
            const key = fillKey(fill, i);
            const fillId = fill.fill_id ?? fill.id ?? null;
            const isCurrent =
              currentFillId != null && fillId != null
                ? String(fillId) === String(currentFillId)
                : currentInstanceId != null &&
                  Number(fill.instance_id) === Number(currentInstanceId) &&
                  fillId == null;
            const open = expandedIds.has(key);
            const fillEntries = normalizeToEntries(fill.form_responses);
            const canEdit =
              typeof onOpenFill === "function" &&
              (fill.instance_id || fill.fill_id) &&
              !isCurrent;

            return (
              <div
                key={key}
                className={`rounded-xl border overflow-hidden ${
                  isCurrent
                    ? "border-indigo-300 bg-indigo-50/40"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
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
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => onOpenFill(fill)}
                      className="ml-auto text-[10px] font-bold uppercase tracking-wide text-indigo-700 hover:text-indigo-900"
                    >
                      Edit
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
      ) : null}
    </div>
  );
}
