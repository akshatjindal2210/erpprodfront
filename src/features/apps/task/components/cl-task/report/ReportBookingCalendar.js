"use client";

import { useMemo, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { buildDateColumns, weekdayLong, isWeekendYmd, istYmd, toYmdClient } from "@/features/apps/task/services/reportApi";

/** Compact stack — more rows visible */
const DAY_W = 78;
const SNO_W = 32;
const LABEL_W = 176;
const ROW_H = 26;
const GROUP_H = 28;
const SECTION_H = 18;
const HEADER_H = 46;

/** YYYY-MM-DD → DD/MM/YYYY */
function formatDmy(ymd) {
  const s = toYmdClient(ymd);
  if (!s || s.length < 10) return s || "—";
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}

const SECTION_ORDER = ["open", "daily", "weekly", "monthly", "yearly", "other"];
const SECTION_LABEL = {
  open: "Open",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  other: "Other",
};

function taskSectionKey(task) {
  const type = String(task.task_type || "").toLowerCase();
  const recur = String(task.recurrence_type || "").toLowerCase();
  if (type === "open") return "open";
  if (type === "frequently") {
    if (recur === "weekly") return "weekly";
    if (recur === "monthly") return "monthly";
    if (recur === "daily") return "daily";
    if (recur === "yearly") return "yearly";
    return "daily";
  }
  return "other";
}

function groupTasksBySection(tasks = []) {
  const buckets = Object.fromEntries(SECTION_ORDER.map((k) => [k, []]));
  for (const t of tasks) {
    const key = taskSectionKey(t);
    (buckets[key] || buckets.other).push(t);
  }
  return SECTION_ORDER.filter((k) => buckets[k].length > 0).map((key) => ({
    key,
    label: SECTION_LABEL[key],
    tasks: buckets[key],
  }));
}

function resolveCellScore(task, ymd, today) {
  if (!ymd || ymd > today) return 0;
  if (task?.day_scores && typeof task.day_scores === "object" && ymd in task.day_scores) {
    const n = Number(task.day_scores[ymd]);
    return Number.isFinite(n) ? n : 0;
  }
  if (task.score_pct != null && task.score_pct !== "") {
    const n = Number(task.score_pct);
    return Number.isFinite(n) ? n : 0;
  }
  if (task.effective_score_raw != null && task.effective_score_raw !== "") {
    const raw = Number(task.effective_score_raw);
    return Number.isFinite(raw) && raw > 0 ? Math.round((Math.min(10, raw) / 10) * 1000) / 10 : 0;
  }
  if (task.effective_score != null && task.effective_score !== "") {
    const n = Number(task.effective_score);
    return Number.isFinite(n) ? n : 0;
  }
  const legacy = Number(task.score);
  return Number.isFinite(legacy) && legacy > 0
    ? Math.round((Math.min(10, legacy) / 10) * 1000) / 10
    : 0;
}

/** True when this day should show a score cell for the task. */
function cellMatched(task, ymd, today) {
  if (!ymd || !task) return false;
  const scores = task.day_scores;
  if (scores && typeof scores === "object" && Object.keys(scores).length > 0) {
    if (ymd in scores) return ymd <= today;
    if (task.not_done && task.scheduled_date && ymd === task.scheduled_date && ymd <= today) {
      return true;
    }
    return false;
  }
  const start = task.startDate;
  const end = task.endDate || start;
  return Boolean(start && end && ymd >= start && ymd <= end);
}

function formatSignedScore(n) {
  if (n > 0) return `${n}%`;
  if (n < 0) return `${n}%`;
  return "0%";
}

function barTone(task, score) {
  if (task.is_red_flag) return "bg-rose-500 text-white border-rose-600";
  if (score < 0) return "bg-rose-100 text-rose-800 border-rose-300";
  if (task.day_scores && score > 0) {
    return "bg-slate-600 text-white border-slate-700";
  }
  if (task.done_verified) return "bg-slate-600 text-white border-slate-700";
  if (task.status === "awaiting_verification") return "bg-indigo-500 text-white border-indigo-600";
  if (task.not_done) return "bg-amber-200 text-slate-800 border-amber-300";
  if (score > 0) return "bg-emerald-100 text-emerald-800 border-emerald-300";
  return "bg-slate-100 text-slate-600 border-slate-300";
}

export default function ReportBookingCalendar({
  users = [],
  days = [],
  dateFrom,
  dateTo,
  /** Backend-owned day list (`data.date_columns`). Preferred over client From–To. */
  dateColumns = null,
  loading = false,
  onSelectTask,
}) {
  const today = istYmd();
  const scrollRef = useRef(null);

  /** Columns come from backend range — no frontend year/day cap. */
  const dateCols = useMemo(() => {
    if (Array.isArray(dateColumns) && dateColumns.length) {
      return dateColumns.map((d) => toYmdClient(d)).filter(Boolean);
    }
    return buildDateColumns(dateFrom, dateTo);
  }, [dateColumns, dateFrom, dateTo]);

  const dateIndex = useMemo(() => {
    const map = new Map();
    dateCols.forEach((ymd, i) => map.set(ymd, i));
    return map;
  }, [dateCols]);

  const groupedUsers = useMemo(() => {
    const normalizeTask = (task, fallbackDate = "") => {
      const start =
        toYmdClient(task.startDate) ||
        toYmdClient(task.scheduled_date) ||
        toYmdClient(fallbackDate);
      const end = toYmdClient(task.endDate) || start;
      let day_scores = task.day_scores;
      if (day_scores && typeof day_scores === "object") {
        const normalized = {};
        for (const [k, v] of Object.entries(day_scores)) {
          const ymd = toYmdClient(k);
          if (!ymd) continue;
          normalized[ymd] = Number(v) || 0;
        }
        day_scores = normalized;
      }
      return {
        ...task,
        startDate: start,
        endDate: end || start,
        scheduled_date: toYmdClient(task.scheduled_date) || start,
        day_scores,
      };
    };

    let list;
    if (Array.isArray(users) && users.length) {
      list = users.map((u, idx) => ({
        sno: u.sno ?? idx + 1,
        person_id: u.person_id,
        person_name: u.person_name || "—",
        department_name: u.department_name || "",
        designation_name: u.designation_name || "",
        tasks: (u.tasks || []).map((t) => normalizeTask(t)),
      }));
    } else {
      const byPerson = new Map();
      for (const day of days) {
        const dayYmd = toYmdClient(day.date);
        for (const task of day.tasks || []) {
          const pid = String(task.person_id ?? "unknown");
          if (!byPerson.has(pid)) {
            byPerson.set(pid, {
              person_id: task.person_id,
              person_name: task.person_name || "—",
              department_name: task.department_name || "",
              designation_name: task.designation_name || "",
              tasks: [],
            });
          }
          byPerson.get(pid).tasks.push(normalizeTask(task, dayYmd));
        }
      }
      list = [...byPerson.values()]
        .sort((a, b) =>
          String(a.person_name).localeCompare(String(b.person_name), undefined, {
            sensitivity: "base",
          }),
        )
        .map((u, idx) => ({ ...u, sno: idx + 1 }));
    }

    return list.map((u) => ({
      ...u,
      sections: groupTasksBySection(u.tasks),
    }));
  }, [users, days]);

  const leftSticky = SNO_W + LABEL_W;
  const gridWidth = leftSticky + dateCols.length * DAY_W;
  const todayIdx = dateIndex.has(today) ? dateIndex.get(today) : -1;

  /** Long ranges: jump so today is visible */
  useEffect(() => {
    if (!scrollRef.current || todayIdx < 0) return;
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayIdx * DAY_W - 80);
    });
  }, [todayIdx, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-slate-300" size={24} />
      </div>
    );
  }

  if (!dateCols.length) {
    return (
      <p className="flex-1 py-10 text-center text-sm text-slate-400 bg-white">No dates</p>
    );
  }

  if (!groupedUsers.length) {
    return (
      <div className="flex-1 py-10 text-center bg-white px-4">
        <p className="text-sm text-slate-500 font-medium">No CL tasks in this window</p>
        <p className="text-xs text-slate-400 mt-1">
          {toYmdClient(dateFrom)} → {toYmdClient(dateTo)} · change From–To + Search
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        <div style={{ minWidth: gridWidth }}>
          <div
            className="sticky top-0 z-20 border-b border-slate-300 bg-white"
            style={{ minWidth: gridWidth, height: HEADER_H }}
          >
            <div className="flex h-full">
              <div
                className="sticky left-0 z-30 flex shrink-0 border-r border-slate-300 bg-slate-50"
                style={{ width: leftSticky }}
              >
                <div
                  className="flex items-end justify-center border-r border-slate-200 pb-1"
                  style={{ width: SNO_W }}
                >
                  <span className="text-[8px] font-bold uppercase text-slate-500">#</span>
                </div>
                <div className="flex-1 flex items-end px-1.5 pb-1">
                  <span className="text-[8px] font-bold uppercase text-slate-500">User / Task</span>
                </div>
              </div>

              <div className="flex flex-col flex-1">
                <div className="flex h-[18px] border-b border-slate-100">
                  {dateCols.map((ymd) => {
                    const weekend = isWeekendYmd(ymd);
                    const isToday = ymd === today;
                    return (
                      <div
                        key={`wd-${ymd}`}
                        className={`shrink-0 flex items-center justify-center border-r border-slate-100 ${
                          isToday ? "bg-emerald-50" : weekend ? "bg-rose-50/40" : ""
                        }`}
                        style={{ width: DAY_W }}
                      >
                        <span
                          className={`text-[8px] font-bold leading-none ${
                            weekend
                              ? "text-rose-600"
                              : isToday
                                ? "text-emerald-700"
                                : "text-slate-500"
                          }`}
                        >
                          {weekdayLong(ymd)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-1">
                  {dateCols.map((ymd) => {
                    const weekend = isWeekendYmd(ymd);
                    const isToday = ymd === today;
                    const dmy = formatDmy(ymd);
                    return (
                      <div
                        key={`dn-${ymd}`}
                        title={`${weekdayLong(ymd)} · ${dmy}`}
                        className={`shrink-0 flex items-center justify-center border-r border-slate-100 px-0.5 ${
                          isToday ? "bg-emerald-50" : weekend ? "bg-rose-50/30" : ""
                        }`}
                        style={{ width: DAY_W }}
                      >
                        <span
                          className={`text-[9px] font-bold tabular-nums leading-tight text-center ${
                            isToday
                              ? "text-emerald-800"
                              : weekend
                                ? "text-rose-600"
                                : "text-slate-800"
                          }`}
                        >
                          {dmy}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {groupedUsers.map((user, uIdx) => (
            <div key={user.person_id ?? uIdx} className="border-b border-slate-200">
              {/* User — single compact line */}
              <div
                className="flex bg-slate-100 border-b border-slate-200"
                style={{ minWidth: gridWidth, height: GROUP_H }}
              >
                <div
                  className="sticky left-0 z-10 flex shrink-0 border-r border-slate-300 bg-slate-100"
                  style={{ width: leftSticky }}
                >
                  <div
                    className="flex items-center justify-center border-r border-slate-200 text-[10px] font-bold text-slate-700 tabular-nums"
                    style={{ width: SNO_W }}
                  >
                    {user.sno}
                  </div>
                  <div className="flex-1 min-w-0 px-1.5 flex items-center gap-1.5">
                    <p
                      className="text-[10px] font-bold text-slate-900 truncate min-w-0"
                      title={`${user.person_name} · ${user.designation_name || "—"} · ${user.department_name || "—"}`}
                    >
                      {user.person_name}
                      <span className="font-medium text-slate-500">
                        {" "}
                        · {user.designation_name || "—"} · {user.department_name || "—"}
                      </span>
                    </p>
                    {(user.final_score_pct != null || user.weighted_score_pct != null) &&
                    Number(user.final_score_pct ?? user.weighted_score_pct) >= 0 ? (
                      <span
                        className={`shrink-0 text-[9px] font-black tabular-nums px-1 py-0.5 border ${
                          Number(user.mis_score_total) < 0
                            ? "text-rose-700 bg-rose-50 border-rose-200"
                            : "text-amber-700 bg-amber-50 border-amber-200"
                        }`}
                        title={
                          Number(user.mis_score_total)
                            ? `Task ${user.weighted_score_pct ?? 0}% · Red ticket / MIS ${user.mis_score_total} → Final ${user.final_score_pct ?? user.weighted_score_pct}%`
                            : "Weightage-weighted final score %"
                        }
                      >
                        {user.final_score_pct ?? user.weighted_score_pct}%
                      </span>
                    ) : null}
                  </div>
                </div>
                {dateCols.map((ymd) => (
                  <div
                    key={`uh-${user.person_id}-${ymd}`}
                    className={`shrink-0 border-r border-slate-100 ${ymd === today ? "bg-emerald-50/50" : ""}`}
                    style={{ width: DAY_W }}
                  />
                ))}
              </div>

              {(user.sections || []).map((section) => (
                <div key={`${user.person_id}-${section.key}`}>
                  <div
                    className="flex bg-indigo-50/60 border-b border-indigo-100"
                    style={{ minWidth: gridWidth, height: SECTION_H }}
                  >
                    <div
                      className="sticky left-0 z-10 flex shrink-0 border-r border-slate-300 bg-indigo-50"
                      style={{ width: leftSticky }}
                    >
                      <div style={{ width: SNO_W }} className="border-r border-indigo-100/40" />
                      <div className="flex-1 px-1.5 pl-2 flex items-center">
                        <span className="text-[8px] font-black uppercase tracking-wider text-indigo-700">
                          {section.label}
                        </span>
                      </div>
                    </div>
                    {dateCols.map((ymd) => (
                      <div
                        key={`sh-${user.person_id}-${section.key}-${ymd}`}
                        className={`shrink-0 border-r border-indigo-100/30 ${ymd === today ? "bg-emerald-50/20" : ""}`}
                        style={{ width: DAY_W }}
                      />
                    ))}
                  </div>

                  {section.tasks.map((task, tIdx) => {
                    const zebra = tIdx % 2 === 1;
                    const fullTitle = task.title || "Task";
                    const attempts =
                      Number(task.fill_count) > 1 ? ` · ${task.fill_count} submits` : "";

                    return (
                      <div
                        key={
                          task.cl_task_id != null
                            ? `m-${user.person_id}-${task.cl_task_id}`
                            : (task.instance_id ?? `${user.person_id}-${section.key}-${tIdx}`)
                        }
                        className={`flex border-b border-slate-100 ${zebra ? "bg-slate-50/40" : "bg-white"}`}
                        style={{ minWidth: gridWidth, height: ROW_H }}
                      >
                        <div
                          className={`sticky left-0 z-10 flex shrink-0 border-r border-slate-300 ${
                            zebra ? "bg-slate-50" : "bg-white"
                          }`}
                          style={{ width: leftSticky }}
                        >
                          <div className="border-r border-slate-100" style={{ width: SNO_W }} />
                          <div className="flex-1 min-w-0 px-1.5 pl-2 flex items-center">
                            <p
                              className="text-[9px] font-semibold text-slate-700 truncate"
                              title={`${fullTitle}${attempts}`}
                            >
                              {fullTitle}
                              {Number(task.fill_count) > 1 ? (
                                <span className="ml-1 text-[8px] font-bold text-slate-400 tabular-nums">
                                  ×{task.fill_count}
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </div>

                        {dateCols.map((ymd) => {
                          const isToday = ymd === today;
                          const matched = cellMatched(task, ymd, today);
                          const score = matched ? resolveCellScore(task, ymd, today) : 0;
                          const label = formatSignedScore(score);

                          return (
                            <div
                              key={`tc-${task.instance_id}-${ymd}`}
                              className={`shrink-0 border-r border-slate-100 flex items-center justify-center ${
                                isToday ? "bg-emerald-50/40" : ""
                              }`}
                              style={{ width: DAY_W, height: ROW_H }}
                            >
                              <button
                                type="button"
                                disabled={!matched}
                                onClick={() => matched && onSelectTask?.(task)}
                                title={
                                  matched
                                    ? `${fullTitle} · ${weekdayLong(ymd)} · ${label}${attempts}`
                                    : `${formatDmy(ymd)} · no task`
                                }
                                className={`w-[calc(100%-2px)] h-5 rounded-sm border text-[9px] font-black tabular-nums ${
                                  matched
                                    ? `hover:brightness-95 ${barTone(task, score)}`
                                    : "bg-slate-50 text-slate-400 border-slate-200 cursor-default"
                                }`}
                              >
                                {label}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
