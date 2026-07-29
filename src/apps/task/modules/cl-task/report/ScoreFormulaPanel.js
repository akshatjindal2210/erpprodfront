"use client";

import { Calculator } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import { formatScheduledDate } from "@/apps/task/lib/helpers/utilHelper";
import { toYmdClient } from "@/apps/task/lib/services/reportApi";

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function periodFromDayMap(dayPctByDate, dateCols = []) {
  if (!dateCols.length) return null;
  let sum = 0;
  for (const ymd of dateCols) sum += Number(dayPctByDate?.[ymd]) || 0;
  return round1(sum / dateCols.length);
}

/** Average of visible users' period (from backend day maps). */
function avgPeriodPct(users = [], dateCols = []) {
  const parts = [];
  for (const u of users) {
    if (dateCols.length && u.day_pct_by_date) {
      const p = periodFromDayMap(u.day_pct_by_date, dateCols);
      if (p != null) parts.push(p);
    } else if (u.period_score_pct != null && Number.isFinite(Number(u.period_score_pct))) {
      parts.push(Number(u.period_score_pct));
    }
  }
  if (!parts.length) return null;
  return round1(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/**
 * Super Admin only — formulas + backend values, grouped per user.
 */
export default function ScoreFormulaPanel({
  open,
  onClose,
  users = [],
  dateCols = [],
  dateFrom = "",
  dateTo = "",
  formulas = null,
  summary = null,
}) {
  const f = formulas && typeof formulas === "object" ? formulas : {};
  const cols = (dateCols || []).map((d) => toYmdClient(d)).filter(Boolean);
  const viewScore = avgPeriodPct(users, cols);
  const scorePct =
    viewScore != null
      ? `${viewScore}%`
      : summary?.period_score_pct != null && Number.isFinite(Number(summary.period_score_pct))
        ? `${summary.period_score_pct}%`
        : "—";

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Score formula (Super Admin)"
      maxWidth="max-w-2xl"
      description={`${formatScheduledDate(dateFrom)} → ${formatScheduledDate(dateTo)} · values from backend`}
    >
      <div className="text-[11px] text-slate-700 space-y-4">
        <div className="space-y-1">
          {f.person_day ? (
            <p>
              <span className="font-bold">Person day %:</span> {f.person_day}
            </p>
          ) : null}
          {f.day ? (
            <p>
              <span className="font-bold">Day %:</span> {f.day}
            </p>
          ) : null}
          {f.person ? (
            <p>
              <span className="font-bold">Person period %:</span> {f.person}
            </p>
          ) : null}
          {f.overall ? (
            <p>
              <span className="font-bold">Score %:</span> {f.overall}
            </p>
          ) : null}
          {!f.person_day && !f.day && !f.person && !f.overall ? (
            <p className="text-slate-400">No score_formulas from API. Restart backend / Search again.</p>
          ) : null}
        </div>

        <p className="font-mono text-[12px] font-bold text-amber-900 border-t border-b border-amber-200 py-2">
          Score % (visible users) = {scorePct}
        </p>

        {!users.length ? <p className="text-slate-400">No users in view.</p> : null}

        {users.map((u) => {
          const breakdown =
            u.day_pct_breakdown_by_date && typeof u.day_pct_breakdown_by_date === "object"
              ? u.day_pct_breakdown_by_date
              : null;
          const map = u.day_pct_by_date && typeof u.day_pct_by_date === "object" ? u.day_pct_by_date : {};
          const ymds = (cols.length ? cols : Object.keys(breakdown || map)).filter((ymd) => {
            const b = breakdown?.[ymd];
            if (b?.parts?.length) return true;
            return Number(map[ymd]) > 0;
          });
          const period =
            cols.length && map
              ? periodFromDayMap(map, cols)
              : u.period_score_pct != null && Number.isFinite(Number(u.period_score_pct))
                ? Number(u.period_score_pct)
                : null;

          return (
            <div
              key={u.person_id ?? u.person_name}
              className="border border-slate-200 bg-white px-2.5 py-2 space-y-1.5"
            >
              <p className="text-[12px] font-bold text-slate-900">
                {u.person_name || "—"}
                <span className="font-medium text-slate-500">
                  {" "}
                  · {u.designation_name || "—"} · {u.department_name || "—"}
                </span>
              </p>
              <p className="font-mono text-[11px] font-bold text-amber-800">
                Person period % = {period != null ? `${period}%` : "—"}
              </p>

              {ymds.length ? (
                ymds.map((ymd) => {
                  const b = breakdown?.[ymd];
                  const pct = b?.result ?? (Number(map[ymd]) || 0);
                  return (
                    <div key={`${u.person_id}-${ymd}`} className="pl-1 border-l-2 border-slate-100">
                      <p className="font-bold text-slate-800">
                        {formatScheduledDate(toYmdClient(ymd) || ymd)} = {pct}%
                      </p>
                      {b?.expression ? (
                        <p className="font-mono text-[10px] text-slate-600 break-all">{b.expression}</p>
                      ) : null}
                      {(b?.parts || []).map((p, i) => (
                        <p key={i} className="font-mono text-[10px] text-slate-500 pl-2">
                          · {p.title}: {p.pct}% × weightage {p.weightage}
                        </p>
                      ))}
                    </div>
                  );
                })
              ) : (
                <p className="text-slate-400 font-mono text-[10px]">No scored days in this range.</p>
              )}
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}

export function ScoreFormulaTrigger({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 px-2.5 border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded-none inline-flex items-center gap-1.5 text-[10px] font-bold uppercase shrink-0"
      title="Show score formulas"
    >
      <Calculator size={14} />
      Score formula
    </button>
  );
}
