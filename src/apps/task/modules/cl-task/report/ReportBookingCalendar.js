"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { buildDateColumns, weekdayLong, isWeekendYmd, istYmd, toYmdClient } from "@/apps/task/lib/services/reportApi";

/** Compact stack — more rows visible */
const DAY_W = 78;
const SNO_W = 32;
const LABEL_W_DEFAULT = 176;
const LABEL_W_MIN = 120;
const LABEL_W_MAX = 420;
const ROW_H = 26;
const GROUP_H = 28;
const SECTION_H = 18;
const HEADER_H = 56;

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
  if (!ymd) return 0;
  /** Future with no stored score stays 0 (shown as "0"). */
  if (ymd > today) {
    if (task?.day_scores && typeof task.day_scores === "object" && ymd in task.day_scores) {
      const n = Number(task.day_scores[ymd]);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

  /** Prefer per-day map — never paint the row's compiled % onto every column. */
  if (task?.day_scores && typeof task.day_scores === "object") {
    if (Object.keys(task.day_scores).length > 0) {
      if (!(ymd in task.day_scores)) return 0;
      const n = Number(task.day_scores[ymd]);
      return Number.isFinite(n) ? n : 0;
    }
  }

  /** No day_scores: only the scheduled day may use the row score. */
  const sched =
    toYmdClient(task.scheduled_date) ||
    toYmdClient(task.startDate) ||
    "";
  if (sched && ymd !== sched) return 0;

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

function resolveDayState(task, ymd, today, score) {
  if (!ymd) return "none";

  const start = toYmdClient(task?.startDate) || toYmdClient(task?.scheduled_date);
  if (start && ymd < start) return "none";

  if (ymd > today) {
    const states = task?.day_states;
    if (states && typeof states === "object" && ymd in states) {
      const s = String(states[ymd] || "").toLowerCase();
      if (s === "missed" || s === "pending" || s === "done") {
        if (task?.is_red_flag && (s === "done" || Number(score) > 0)) return "red";
        return s;
      }
    }
    if (Number(score) > 0) return task?.is_red_flag ? "red" : "done";
    return "none";
  }

  const states = task?.day_states;
  if (states && typeof states === "object" && ymd in states) {
    const s = String(states[ymd] || "").toLowerCase();
    if (s === "missed" || s === "pending" || s === "done") {
      /** Red only when that day is scored/done — not every pending day on a flagged row. */
      if (task?.is_red_flag && (s === "done" || Number(score) > 0)) {
        return "red";
      }
      return s;
    }
  }

  if (Number(score) > 0) {
    return task?.is_red_flag ? "red" : "done";
  }

  if (
    task?.day_scores &&
    typeof task.day_scores === "object" &&
    ymd in task.day_scores
  ) {
    if (Number(task.day_scores[ymd]) > 0) return task?.is_red_flag ? "red" : "done";
    /** Today still open → pending; past zero → missed */
    return ymd >= today ? "pending" : "missed";
  }

  /** No per-day map: only the scheduled day uses row status. */
  const sched = toYmdClient(task?.scheduled_date) || start;
  if (sched && ymd === sched) {
    if (task?.status === "awaiting_verification") return "pending";
    if (task?.status === "pending") return ymd >= today ? "pending" : "missed";
    if (task?.status === "completed") return Number(score) > 0 || task?.done_verified ? "done" : "pending";
  }

  if (start && ymd >= start && ymd <= today) {
    return ymd >= today ? "pending" : "missed";
  }
  return "none";
}

/**
 * Every day column shows a cell. No data (past or future) → "0" / none.
 */
function cellMatched(task, ymd) {
  return Boolean(ymd && task);
}

function formatCellLabel(kind, score) {
  if (kind === "none") return "0";
  if (kind === "missed") return "0%";
  if (kind === "pending") return Number(score) > 0 ? formatSignedScore(score) : "0%";
  if (kind === "done" || kind === "red") return formatSignedScore(score);
  return formatSignedScore(score);
}

function formatSignedScore(n) {
  if (n > 0) return `${n}%`;
  if (n < 0) return `${n}%`;
  return "0%";
}

/**
 * Report cell tones — distinct at a glance:
 * none = not assigned yet | missed = deadline passed | pending = due / action taken | done | red
 */
export const SCORE_CELL_TONES = {
  none: {
    cell: "bg-slate-100 text-slate-500 border-slate-200",
    swatch: "bg-slate-100 border-slate-200",
    label: "No task (0)",
  },
  missed: {
    cell: "bg-rose-100 text-rose-900 border-rose-300",
    swatch: "bg-rose-100 border-rose-300",
    label: "Missed",
  },
  pending: {
    cell: "bg-amber-100 text-amber-950 border-amber-300",
    swatch: "bg-amber-100 border-amber-300",
    label: "Pending / action",
  },
  done: {
    cell: "bg-emerald-100 text-emerald-900 border-emerald-300",
    swatch: "bg-emerald-100 border-emerald-300",
    label: "Done",
  },
  red: {
    cell: "bg-rose-200 text-rose-950 border-rose-400",
    swatch: "bg-rose-200 border-rose-400",
    label: "Red",
  },
};

function barTone(kind) {
  return SCORE_CELL_TONES[kind]?.cell || SCORE_CELL_TONES.none.cell;
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
  const [labelW, setLabelW] = useState(LABEL_W_DEFAULT);
  const resizingRef = useRef(false);

  const startLabelResize = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = labelW;
      const startX = e.clientX;
      const onMove = (ev) => {
        if (!resizingRef.current) return;
        const next = Math.min(LABEL_W_MAX, Math.max(LABEL_W_MIN, startWidth + (ev.clientX - startX)));
        setLabelW(next);
      };
      const onUp = () => {
        resizingRef.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      resizingRef.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [labelW],
  );

  /** Columns prefer backend `date_columns`; otherwise build from From–To (safety-capped). */
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
    const normalizeDayPctMap = (map) => {
      if (!map || typeof map !== "object") return map || {};
      const normalized = {};
      for (const [k, v] of Object.entries(map)) {
        const ymd = toYmdClient(k);
        if (ymd) normalized[ymd] = Number(v) || 0;
      }
      return normalized;
    };

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
      let day_states = task.day_states;
      if (day_states && typeof day_states === "object") {
        const normalized = {};
        for (const [k, v] of Object.entries(day_states)) {
          const ymd = toYmdClient(k);
          if (!ymd) continue;
          normalized[ymd] = String(v || "").toLowerCase();
        }
        day_states = normalized;
      }
      return {
        ...task,
        startDate: start,
        endDate: end || start,
        scheduled_date: toYmdClient(task.scheduled_date) || start,
        day_scores,
        day_states,
      };
    };

    let list;
    if (Array.isArray(users) && users.length) {
      list = users.map((u, idx) => ({
        ...u,
        sno: u.sno ?? idx + 1,
        person_name: u.person_name || "—",
        department_name: u.department_name || "",
        designation_name: u.designation_name || "",
        /** Keep backend day_pct_by_date / period_score_pct / breakdown on the person row. */
        day_pct_by_date: normalizeDayPctMap(u.day_pct_by_date),
        day_pct_breakdown_by_date: u.day_pct_breakdown_by_date || null,
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

  /** Period badge: avg of backend day_pct over visible columns (falls back to period_score_pct). */
  const userPeriodPctByPerson = useMemo(() => {
    const out = new Map();
    for (const u of users || []) {
      const pid = Number(u.person_id) || u.person_id;
      if (dateCols.length && u.day_pct_by_date && typeof u.day_pct_by_date === "object") {
        let sum = 0;
        for (const ymd of dateCols) sum += Number(u.day_pct_by_date[ymd]) || 0;
        out.set(pid, Math.round((sum / dateCols.length) * 10) / 10);
      } else if (u.period_score_pct != null && Number.isFinite(Number(u.period_score_pct))) {
        out.set(pid, Number(u.period_score_pct));
      }
    }
    return out;
  }, [users, dateCols]);

  const dayScoreByYmd = useMemo(() => {
    const map = new Map();
    const list = users || [];
    if (list.length) {
      for (const ymd of dateCols) {
        let sum = 0;
        for (const u of list) {
          sum += Number(u.day_pct_by_date?.[ymd]) || 0;
        }
        map.set(ymd, Math.round((sum / list.length) * 10) / 10);
      }
      return map;
    }
    for (const d of days || []) {
      const ymd = toYmdClient(d.date);
      if (!ymd) continue;
      map.set(ymd, Number(d.day_score_pct) || 0);
    }
    return map;
  }, [users, dateCols, days]);

  const leftSticky = SNO_W + labelW;
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
                <div
                  className="relative flex items-end px-1.5 pb-1 shrink-0"
                  style={{ width: labelW }}
                >
                  <span className="text-[8px] font-bold uppercase text-slate-500 truncate pr-1">
                    User / Task
                  </span>
                  <button
                    type="button"
                    aria-label="Resize task column"
                    title="Drag to resize"
                    onMouseDown={startLabelResize}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-400/50 active:bg-indigo-500/60 z-[40] border-0 bg-transparent p-0"
                  />
                </div>
              </div>

              <div className="flex flex-col flex-1">
                <div className="flex h-[16px] border-b border-slate-100">
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
                <div className="flex h-[18px] border-b border-slate-100">
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
                <div className="flex flex-1">
                  {dateCols.map((ymd) => {
                    const weekend = isWeekendYmd(ymd);
                    const isToday = ymd === today;
                    const headerPct = dayScoreByYmd.has(ymd) ? dayScoreByYmd.get(ymd) : 0;
                    return (
                      <div
                        key={`ds-${ymd}`}
                        title={`All users · ${weekdayLong(ymd)} · compiled ${formatSignedScore(headerPct)}`}
                        className={`shrink-0 flex items-center justify-center border-r border-slate-100 px-0.5 ${
                          isToday ? "bg-emerald-50" : weekend ? "bg-rose-50/20" : "bg-slate-50/80"
                        }`}
                        style={{ width: DAY_W }}
                      >
                        <span
                          className={`text-[8px] font-black tabular-nums ${
                            headerPct > 0 ? "text-amber-700" : "text-slate-500"
                          }`}
                        >
                          {formatSignedScore(headerPct)}
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
                    {(() => {
                      const pid = Number(user.person_id) || user.person_id;
                      const periodPct = userPeriodPctByPerson.get(pid);
                      const fallback = user.final_score_pct ?? user.weighted_score_pct;
                      const shown =
                        periodPct != null
                          ? periodPct
                          : fallback != null && Number(fallback) >= 0
                            ? Number(fallback)
                            : null;
                      if (shown == null) return null;
                      return (
                      <span
                        className={`shrink-0 text-[9px] font-black tabular-nums px-1 py-0.5 border ${
                          Number(user.mis_score_total) < 0
                            ? "text-rose-700 bg-rose-50 border-rose-200"
                            : "text-amber-700 bg-amber-50 border-amber-200"
                        }`}
                        title={
                          periodPct != null
                            ? `Period % from backend: ${shown}%`
                            : Number(user.mis_score_total)
                              ? `Task ${user.weighted_score_pct ?? 0}% · Red ticket / MIS ${user.mis_score_total} → Final ${user.final_score_pct ?? user.weighted_score_pct}%`
                              : "Weightage-weighted final score %"
                        }
                      >
                        {shown}%
                      </span>
                      );
                    })()}
                  </div>
                </div>
                {dateCols.map((ymd) => {
                  const userDayPct = Number(user.day_pct_by_date?.[ymd]) || 0;
                  return (
                    <div
                      key={`uh-${user.person_id}-${ymd}`}
                      title={`${user.person_name} · ${weekdayLong(ymd)} · ${formatSignedScore(userDayPct)}`}
                      className={`shrink-0 border-r border-slate-100 flex items-center justify-center ${
                        ymd === today ? "bg-emerald-50/50" : ""
                      }`}
                      style={{ width: DAY_W }}
                    >
                      <span
                        className={`text-[8px] font-black tabular-nums ${
                          userDayPct > 0 ? "text-amber-800" : "text-slate-400"
                        }`}
                      >
                        {formatSignedScore(userDayPct)}
                      </span>
                    </div>
                  );
                })}
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
                    const rowKey =
                      task.cl_task_id != null
                        ? `m-${user.person_id}-${task.cl_task_id}-${section.key}`
                        : `i-${user.person_id}-${task.instance_id ?? tIdx}-${section.key}`;

                    return (
                      <div
                        key={rowKey}
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
                          const matched = cellMatched(task, ymd);
                          const score = matched ? resolveCellScore(task, ymd, today) : 0;
                          const kind = matched
                            ? resolveDayState(task, ymd, today, score)
                            : "none";
                          const label = formatCellLabel(kind, score);
                          const stateLabel = SCORE_CELL_TONES[kind]?.label || kind;
                          const canOpen = matched && kind !== "none";

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
                                disabled={!canOpen}
                                onClick={() => canOpen && onSelectTask?.(task)}
                                title={`${fullTitle} · ${weekdayLong(ymd)} · ${stateLabel} · ${label}${attempts}`}
                                className={`w-[calc(100%-2px)] h-5 rounded-sm border text-[9px] font-semibold tabular-nums ${
                                  canOpen ? "hover:bg-white/60" : "cursor-default"
                                } ${barTone(kind)}`}
                              >
                                {label || "0"}
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
