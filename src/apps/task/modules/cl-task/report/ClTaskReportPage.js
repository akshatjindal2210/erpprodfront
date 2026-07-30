"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { RefreshCcw, BarChart3, Loader2, Users, ClipboardList, CheckCircle2, Circle, Percent, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";

import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ExportMenu from "@/ui/common/list/ExportMenu";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";

import { useClTaskFilters } from "@/apps/task/lib/hooks/useClTaskFilters";
import { CL_ORG_FILTER_CLASS } from "@/apps/task/lib/helpers/clTaskScopeHelper";
import { hasFullTaskReportAccess, isManagerDesignation, isExecutiveDesignation } from "@/apps/task/lib/config/appConfig";
import { reportPanelService, defaultReportDateRange, toYmdClient } from "@/apps/task/lib/services/reportApi";
import { formatScheduledDate } from "@/apps/task/lib/helpers/utilHelper";
import { StatCard } from "@/apps/task/lib/common";
import TaskReportFormModal from "./TaskReportFormModal";
import ReportBookingCalendar, { SCORE_CELL_TONES } from "./ReportBookingCalendar";
import ScoreFormulaPanel, { ScoreFormulaTrigger } from "./ScoreFormulaPanel";
import { buildClReportExportRows, buildClReportXlsxRowStyles } from "./reportExcelExport";
import { FILTER_DATE_RANGE_MAX_DAYS, FILTER_DATE_RANGE_MAX_YEARS, filterDateRangeDayCount, parseFilterDateInput } from "@/platform/utils/core/utilHelper";

const REPORT_STAT_CARDS = [
  { key: "users", label: "Users", icon: Users, bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100", barColor: "#4f46e5" },
  { key: "tasks", label: "Tasks", icon: ClipboardList, bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-100", barColor: "#696969" },
  { key: "done", label: "Done", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", barColor: "#059669" },
  { key: "not_done", label: "Not Done", icon: Circle, bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100", barColor: "#e11d48" },
  { key: "score", label: "Score %", icon: Percent, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100", barColor: "#d97706" },
  { key: "mis", label: "Red / MIS", icon: AlertTriangle, bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100", barColor: "#be123c" },
];

/** View access gated by RootLayout (module `task_report`). */
export default function ClTaskReportPage() {
  const role = useSelector((s) => s.auth?.role);
  const currentUser = useSelector((s) => s.auth?.user);
  const roleLc = String(role || "").toLowerCase();
  const userType = String(currentUser?.type || "").toLowerCase();
  const isSuperAdmin = roleLc === "super_admin" || userType === "super_admin";
  /** Same as Task Report: admin / super_admin / EA see all. */
  const canSeeAll = hasFullTaskReportAccess(role);
  /** Manager (user + manager designation, not executive): own dept team. */
  const isManagerScope =
    !canSeeAll &&
    roleLc === "user" &&
    isManagerDesignation(currentUser) &&
    !isExecutiveDesignation(currentUser);
  const canUseOrgFilters = canSeeAll || isManagerScope;
  const selfId = currentUser?.id;
  const managerDeptId =
    currentUser?.department?.id ?? currentUser?.department_id ?? "";

  const {
    selectedDepartment,
    setSelectedDepartment,
    selectedDesignation,
    setSelectedDesignation,
    selectedPerson,
    setSelectedPerson,
    departmentsLists,
    designationsLists,
    personOptions,
    clearFilters,
  } = useClTaskFilters();

  /** Applied range/filters — sent to backend only on Search / Reset / Refresh / first load. */
  const [dateFrom, setDateFrom] = useState(() => defaultReportDateRange().dateFrom);
  const [dateTo, setDateTo] = useState(() => defaultReportDateRange().dateTo);
  /** Quick search — filters already-loaded rows on the client only. */
  const [quickSearch, setQuickSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [scoreFormulaOpen, setScoreFormulaOpen] = useState(false);

  /** Manager: lock department to own dept (Task Report pattern). */
  useEffect(() => {
    if (!isManagerScope || !managerDeptId) return;
    setSelectedDepartment(String(managerDeptId));
  }, [isManagerScope, managerDeptId, setSelectedDepartment]);

  const fetchReport = useCallback(
    async (overrides = {}) => {
      const from = toYmdClient(overrides.dateFrom ?? dateFrom) || "";
      const to = toYmdClient(overrides.dateTo ?? dateTo) || "";
      if (!from || !to) {
        toast.error("Enter valid From and To dates (DD/MM/YYYY).");
        return;
      }
      if (from > to) {
        toast.error("From date cannot be after To date.");
        return;
      }
      const span = filterDateRangeDayCount(from, to);
      if (!span) {
        toast.error("Enter valid From and To dates (DD/MM/YYYY).");
        return;
      }
      if (span > FILTER_DATE_RANGE_MAX_DAYS) {
        toast.error(
          `The date range is too large. Please choose From and To dates within ${FILTER_DATE_RANGE_MAX_YEARS} years.`,
        );
        return;
      }
      const department_id =
        overrides.department_id !== undefined ? overrides.department_id : selectedDepartment;
      const designation_id =
        overrides.designation_id !== undefined ? overrides.designation_id : selectedDesignation;
      const person_id = overrides.person_id !== undefined ? overrides.person_id : selectedPerson;

      setLoading(true);
      try {
        const params = {
          date_from: from,
          date_to: to,
        };
        if (canSeeAll) {
          if (department_id) params.department_id = department_id;
          if (designation_id) params.designation_id = designation_id;
          if (person_id) params.person_id = person_id;
        } else if (isManagerScope) {
          /** Backend applies team_department_id from session; optional person within team. */
          if (person_id) params.person_id = person_id;
          if (designation_id) params.designation_id = designation_id;
        } else if (selfId) {
          params.person_id = selfId;
        }

        const res = await reportPanelService.getDaily(params);
        const payload = res?.data?.data ?? res?.data ?? null;
        setData(payload && typeof payload === "object" ? payload : null);
      } catch (err) {
        toast.error(err.response?.data?.message || err?.message || "Failed to load CL task report");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [
      dateFrom,
      dateTo,
      selectedDepartment,
      selectedDesignation,
      selectedPerson,
      canSeeAll,
      isManagerScope,
      selfId,
    ],
  );

  /** First load only — later loads happen on Search / Reset / Refresh. */
  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once with defaults
  }, []);

  const handleFilterApply = (f = {}) => {
    const fromRaw = f.fromDate !== undefined ? f.fromDate : dateFrom;
    const toRaw = f.toDate !== undefined ? f.toDate : dateTo;
    const from = toYmdClient(fromRaw) || parseFilterDateInput(fromRaw) || "";
    const to = toYmdClient(toRaw) || parseFilterDateInput(toRaw) || "";

    if (f.searchSubmit) {
      if (!from || !to) {
        toast.error("Enter valid From and To dates (DD/MM/YYYY).");
        return;
      }
      if (from > to) {
        toast.error("From date cannot be after To date.");
        return;
      }
      const days = filterDateRangeDayCount(from, to);
      if (!days) {
        toast.error("Enter valid From and To dates (DD/MM/YYYY).");
        return;
      }
      if (days > FILTER_DATE_RANGE_MAX_DAYS) {
        toast.error(
          `The date range is too large. Please choose From and To dates within ${FILTER_DATE_RANGE_MAX_YEARS} years.`,
        );
        return;
      }
    }

    const department_id =
      canSeeAll && f.department_id !== undefined ? f.department_id || "" : selectedDepartment;
    const designation_id =
      canUseOrgFilters && f.designation_id !== undefined
        ? f.designation_id || ""
        : selectedDesignation;
    const person_id =
      canUseOrgFilters && f.person_id !== undefined ? f.person_id || "" : selectedPerson;

    if (from) setDateFrom(from);
    if (to) setDateTo(to);
    if (canSeeAll && f.department_id !== undefined) setSelectedDepartment(department_id);
    if (canUseOrgFilters && f.designation_id !== undefined) setSelectedDesignation(designation_id);
    if (canUseOrgFilters && f.person_id !== undefined) setSelectedPerson(person_id);

    /** Search button → backend reload; dropdown/date changes filter loaded rows instantly. */
    if (f.searchSubmit) {
      fetchReport({
        dateFrom: from,
        dateTo: to,
        department_id: canSeeAll ? department_id : "",
        designation_id: canUseOrgFilters ? designation_id : "",
        person_id: canUseOrgFilters ? person_id : "",
      });
    }
  };

  const handleReset = () => {
    const next = defaultReportDateRange();
    setQuickSearch("");
    if (canSeeAll) {
      clearFilters();
    } else if (isManagerScope) {
      setSelectedDesignation("");
      setSelectedPerson("");
      if (managerDeptId) setSelectedDepartment(String(managerDeptId));
    }
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    fetchReport({
      dateFrom: next.dateFrom,
      dateTo: next.dateTo,
      department_id: canSeeAll ? "" : isManagerScope ? String(managerDeptId || "") : "",
      designation_id: "",
      person_id: "",
    });
  };

  const extraFilters = useMemo(() => {
    if (!canUseOrgFilters) return [];
    const filters = [];
    if (canSeeAll) {
      filters.push(
        {
          label: "Department",
          key: "department_id",
          value: selectedDepartment || "",
          searchable: true,
          placeholder: "Search departments…",
          variant: "quick",
          className: CL_ORG_FILTER_CLASS,
          options: [
            { label: "All Departments", value: "" },
            ...departmentsLists.map((d) => ({ label: d.name, value: String(d.id) })),
          ],
        },
        {
          label: "Designation",
          key: "designation_id",
          value: selectedDesignation || "",
          searchable: true,
          placeholder: "Search designations…",
          variant: "quick",
          className: CL_ORG_FILTER_CLASS,
          options: [
            { label: "All Designations", value: "" },
            ...designationsLists.map((d) => ({ label: d.name, value: String(d.id) })),
          ],
        },
      );
    }
    filters.push({
      label: "Users",
      key: "person_id",
      value: selectedPerson || "",
      searchable: true,
      placeholder: "Search users…",
      variant: "quick",
      className: CL_ORG_FILTER_CLASS,
      options: [
        { label: isManagerScope ? "All Team" : "All Users", value: "" },
        ...personOptions.map((p) => ({ label: p.name, value: String(p.id) })),
      ],
    });
    return filters;
  }, [
    canSeeAll,
    canUseOrgFilters,
    isManagerScope,
    selectedDepartment,
    selectedDesignation,
    selectedPerson,
    departmentsLists,
    designationsLists,
    personOptions,
  ]);

  const summary = data?.summary;
  const days = data?.days ?? [];
  const users = data?.users ?? [];
  const dateColumns = data?.date_columns ?? null;
  const rangeFrom = data?.date_from || dateFrom;
  const rangeTo = data?.date_to || dateTo;

  const deptNameById = useMemo(() => {
    const map = new Map();
    for (const d of departmentsLists || []) {
      map.set(String(d.id), String(d.name || "").trim().toLowerCase());
    }
    return map;
  }, [departmentsLists]);

  const desigNameById = useMemo(() => {
    const map = new Map();
    for (const d of designationsLists || []) {
      map.set(String(d.id), String(d.name || "").trim().toLowerCase());
    }
    return map;
  }, [designationsLists]);

  const clientFrom = toYmdClient(dateFrom) || dateFrom;
  const clientTo = toYmdClient(dateTo) || dateTo;

  /** Clip calendar columns to the From–To selection (instant, no API wait). */
  const visibleDateColumns = useMemo(() => {
    const raw =
      Array.isArray(dateColumns) && dateColumns.length
        ? dateColumns.map((d) => toYmdClient(d)).filter(Boolean)
        : [];
    if (!raw.length) return null;
    if (!clientFrom || !clientTo) return raw;
    return raw.filter((ymd) => ymd >= clientFrom && ymd <= clientTo);
  }, [dateColumns, clientFrom, clientTo]);

  const taskInDateWindow = useCallback(
    (task) => {
      if (!clientFrom || !clientTo) return true;
      const scores = task?.day_scores;
      if (scores && typeof scores === "object" && Object.keys(scores).length) {
        return Object.keys(scores).some((k) => {
          const ymd = toYmdClient(k);
          return ymd && ymd >= clientFrom && ymd <= clientTo;
        });
      }
      const start =
        toYmdClient(task?.startDate) || toYmdClient(task?.scheduled_date) || "";
      const end = toYmdClient(task?.endDate) || start;
      if (!start) return true;
      return start <= clientTo && end >= clientFrom;
    },
    [clientFrom, clientTo],
  );

  /** Instant client filter: quick search + org dropdowns + date window on loaded rows. */
  const filteredUsers = useMemo(() => {
    const q = String(quickSearch || "").trim().toLowerCase();
    const deptWant = selectedDepartment
      ? deptNameById.get(String(selectedDepartment)) || ""
      : "";
    const desigWant = selectedDesignation
      ? desigNameById.get(String(selectedDesignation)) || ""
      : "";
    const personWant = selectedPerson ? String(selectedPerson) : "";

    return users
      .map((u) => {
        if (personWant && String(u.person_id) !== personWant) return null;

        const uDept = String(u.department_name || "").trim().toLowerCase();
        const uDesig = String(u.designation_name || "").trim().toLowerCase();
        if (deptWant && uDept !== deptWant) return null;
        if (desigWant && uDesig !== desigWant) return null;

        const personHit =
          !q ||
          String(u.person_name || "")
            .toLowerCase()
            .includes(q);
        let tasks = (u.tasks || []).filter(taskInDateWindow);
        if (q) {
          tasks = tasks.filter(
            (t) =>
              personHit ||
              String(t.title || "")
                .toLowerCase()
                .includes(q) ||
              String(t.department_name || "")
                .toLowerCase()
                .includes(q) ||
              String(t.designation_name || "")
                .toLowerCase()
                .includes(q),
          );
        }
        if (!personHit && tasks.length === 0) return null;
        if (!q && tasks.length === 0) return null;
        return { ...u, tasks: q && personHit ? (u.tasks || []).filter(taskInDateWindow) : tasks };
      })
      .filter(Boolean)
      .map((u, idx) => ({ ...u, sno: idx + 1 }));
  }, [
    users,
    quickSearch,
    selectedDepartment,
    selectedDesignation,
    selectedPerson,
    deptNameById,
    desigNameById,
    taskInDateWindow,
  ]);

  const filteredDays = useMemo(() => {
    const q = String(quickSearch || "").trim().toLowerCase();
    const personWant = selectedPerson ? String(selectedPerson) : "";
    const deptWant = selectedDepartment
      ? deptNameById.get(String(selectedDepartment)) || ""
      : "";
    const desigWant = selectedDesignation
      ? desigNameById.get(String(selectedDesignation)) || ""
      : "";

    return days
      .map((day) => {
        const dayYmd = toYmdClient(day.date);
        if (clientFrom && clientTo && dayYmd && (dayYmd < clientFrom || dayYmd > clientTo)) {
          return null;
        }
        const tasks = (day.tasks || []).filter((t) => {
          if (personWant && String(t.person_id) !== personWant) return false;
          if (deptWant && String(t.department_name || "").trim().toLowerCase() !== deptWant) {
            return false;
          }
          if (desigWant && String(t.designation_name || "").trim().toLowerCase() !== desigWant) {
            return false;
          }
          if (!q) return true;
          return (
            String(t.person_name || "")
              .toLowerCase()
              .includes(q) ||
            String(t.title || "")
              .toLowerCase()
              .includes(q)
          );
        });
        /** Keep day row so backend day_score_pct stays available for headers. */
        return { ...day, tasks };
      })
      .filter(Boolean);
  }, [
    days,
    quickSearch,
    selectedPerson,
    selectedDepartment,
    selectedDesignation,
    deptNameById,
    desigNameById,
    clientFrom,
    clientTo,
  ]);

  const exportRows = useMemo(() => buildClReportExportRows(filteredUsers), [filteredUsers]);

  const exportHeaders = useMemo(
    () => [
      ["S.No.", "sno"],
      ["Date", "scheduled_date"],
      ["Person", "person_name"],
      ["Department", "department_name"],
      ["Designation", "designation_name"],
      ["Section", "section"],
      ["Task", "title"],
      ["Status", "status"],
      ["Score", "score_display"],
      ["Weightage", "weightage"],
    ],
    [],
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "CL Task Report",
    rows: exportRows,
    headers: exportHeaders,
    getXlsxRowStyles: buildClReportXlsxRowStyles,
    xlsxPreambleRows: () => {
      if (!rangeFrom || !rangeTo) return undefined;
      return [
        [`CL Task Report · ${formatScheduledDate(rangeFrom)} → ${formatScheduledDate(rangeTo)}`],
        [`Exported: ${new Date().toLocaleString()}`],
      ];
    },
  });

  const summaryStats = useMemo(() => {
    if (loading && !summary) {
      return { users: "…", tasks: "…", done: "…", not_done: "…", score: "…", mis: "…" };
    }
    const usersCount = filteredUsers.length;
    const tasksCount = filteredUsers.reduce((n, u) => n + (u.tasks?.length || 0), 0);
    let done = 0;
    let notDone = 0;
    let mis = 0;
    for (const u of filteredUsers) {
      mis += Number(u.mis_score_total) || 0;
      for (const t of u.tasks || []) {
        if (t.done_verified) done += 1;
        else notDone += 1;
      }
    }
    /**
     * Score % = average of visible users' period %.
     * Prefer average of backend day_pct_by_date over visible date columns
     * (so Users / From–To filters update without Search).
     */
    const periodParts = [];
    for (const u of filteredUsers) {
      const cols = visibleDateColumns || [];
      if (cols.length && u.day_pct_by_date && typeof u.day_pct_by_date === "object") {
        let sum = 0;
        for (const ymd of cols) sum += Number(u.day_pct_by_date[ymd]) || 0;
        periodParts.push(Math.round((sum / cols.length) * 10) / 10);
      } else if (u.period_score_pct != null && Number.isFinite(Number(u.period_score_pct))) {
        periodParts.push(Number(u.period_score_pct));
      }
    }
    let scoreVal = "—";
    if (periodParts.length) {
      scoreVal = `${Math.round((periodParts.reduce((a, b) => a + b, 0) / periodParts.length) * 10) / 10}%`;
    } else if (summary?.period_score_pct != null && Number.isFinite(Number(summary.period_score_pct))) {
      scoreVal = `${summary.period_score_pct}%`;
    }

    return {
      users: usersCount,
      tasks: tasksCount,
      done,
      not_done: notDone,
      score: scoreVal,
      mis,
    };
  }, [filteredUsers, summary, loading, visibleDateColumns]);

  const viewingLabel = canSeeAll
    ? selectedPerson
      ? personOptions.find((p) => String(p.id) === String(selectedPerson))?.name || "Person"
      : "All persons"
    : isManagerScope
      ? selectedPerson
        ? personOptions.find((p) => String(p.id) === String(selectedPerson))?.name || "Person"
        : "My team"
      : currentUser?.name || "My report";

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <div className="flex items-center gap-2 px-1 shrink-0 min-w-0">
                  <BarChart3 size={16} className="text-indigo-600 shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 shrink-0">
                    CL Task Report
                  </span>
                  <span className="text-[11px] text-slate-300 hidden sm:inline">|</span>
                  <span className="text-[11px] font-bold text-indigo-800 truncate hidden sm:inline">
                    {viewingLabel}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums hidden lg:inline">
                    {formatScheduledDate(rangeFrom)} → {formatScheduledDate(rangeTo)}
                  </span>
                </div>
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={() => fetchReport()}
                  disabled={loading}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none inline-flex items-center justify-center gap-2 text-[11px] font-bold uppercase shadow-none shrink-0 disabled:opacity-60"
                  aria-label="Refresh"
                >
                  <RefreshCcw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
                  Refresh
                </button>
                {isSuperAdmin ? (
                  <ScoreFormulaTrigger onClick={() => setScoreFormulaOpen(true)} />
                ) : null}
              </>
            }
            viewToggle={
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-9 border border-slate-300 bg-white overflow-visible relative z-[80]">
                  <ExportMenu
                    disabled={loading || exportDisabled}
                    exporting={exporting}
                    onExport={handleExport}
                  />
                </div>
              </div>
            }
          />
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate
            applyExtrasOnChange
            fromDate={dateFrom}
            toDate={dateTo}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            onExtraFilterChange={(key, v) => {
              if (!canUseOrgFilters) return;
              if (key === "department_id" && canSeeAll) setSelectedDepartment(v);
              else if (key === "designation_id" && canSeeAll) setSelectedDesignation(v);
              else if (key === "person_id") setSelectedPerson(v);
            }}
            searchValue={quickSearch}
            onSearchChange={setQuickSearch}
            applyOnSearchEnter={false}
            searchVariant="quick"
            searchPlaceholder={
              canUseOrgFilters ? "Quick search task or person..." : "Quick search task..."
            }
            searchLabel="Quick search"
          />
        </ListPageFilterStrip>

        {/* Compact StatCards — same stack style as Tasks page */}
        <div className="shrink-0 relative z-0 px-3 py-2 border-b border-slate-200 bg-slate-50/80">
          <div className="flex gap-2 overflow-x-auto md:grid md:grid-cols-3 lg:grid-cols-6 md:overflow-visible pb-0.5 md:pb-0">
            {REPORT_STAT_CARDS.map(({ key, label, icon, bg, text, border, barColor }) => (
              <div key={key} className="rounded-none shrink-0 w-[9.5rem] md:w-auto md:min-w-0">
                <StatCard
                  label={label}
                  value={summaryStats[key]}
                  icon={icon}
                  iconBg={bg}
                  iconText={text}
                  borderColor={border}
                  barColor={barColor}
                />
              </div>
            ))}
          </div>
        </div>

        <ReportBookingCalendar
          users={filteredUsers}
          days={filteredDays}
          dateFrom={clientFrom || rangeFrom}
          dateTo={clientTo || rangeTo}
          dateColumns={visibleDateColumns}
          loading={loading}
          onSelectTask={setSelectedTask}
        />

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {summary
              ? `${filteredUsers.length} users · ${filteredUsers.reduce(
                  (n, u) => n + (u.tasks?.length || 0),
                  0,
                )} tasks`
              : "CL Task Report"}
          </span>
          {/* Color legend — same tones as score cells */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">
            {Object.values(SCORE_CELL_TONES).map(({ swatch, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className={`w-3.5 h-3.5 rounded-sm border shrink-0 ${swatch}`} />
                {label}
              </span>
            ))}
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider inline-flex items-center gap-1">
            {loading ? <Loader2 size={10} className="animate-spin" /> : null}
            Filters = this page · Search = backend reload
          </span>
        </div>
      </div>

      <TaskReportFormModal
        open={!!selectedTask}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSaved={() => fetchReport()}
        onSwitchTask={setSelectedTask}
      />

      {isSuperAdmin ? (
        <ScoreFormulaPanel
          open={scoreFormulaOpen}
          onClose={() => setScoreFormulaOpen(false)}
          users={filteredUsers}
          dateCols={visibleDateColumns || []}
          dateFrom={clientFrom || rangeFrom}
          dateTo={clientTo || rangeTo}
          formulas={data?.score_formulas}
          summary={summary}
        />
      ) : null}
    </div>
  );
}
