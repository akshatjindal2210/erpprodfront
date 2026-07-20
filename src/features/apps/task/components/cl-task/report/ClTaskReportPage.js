"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { RefreshCcw, BarChart3, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ExportMenu from "@/core/components/common/ExportMenu";
import { exportListPageTable, notifyListPageExportResult } from "@/core/utils/listPageExport";

import { useClTaskFilters } from "@/features/apps/task/hooks/useClTaskFilters";
import { reportPanelService, defaultReportDateRange, toYmdClient } from "@/features/apps/task/services/reportApi";
import { formatScheduledDate } from "@/features/apps/task/helpers/utilHelper";
import TaskReportFormModal from "./TaskReportFormModal";
import ReportBookingCalendar from "./ReportBookingCalendar";
import { buildClReportExportRows, exportClTaskReportExcel } from "./reportExcelExport";

/** View access gated by RootLayout (module `task_report`). */
export default function ClTaskReportPage() {
  const role = useSelector((s) => s.auth?.role);
  const currentUser = useSelector((s) => s.auth?.user);
  const roleLc = String(role || "").toLowerCase();
  const canSeeAll = roleLc === "super_admin" || roleLc === "executive_assistant";
  const selfId = currentUser?.id;

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
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchReport = useCallback(
    async (overrides = {}) => {
      const from = overrides.dateFrom ?? dateFrom;
      const to = overrides.dateTo ?? dateTo;
      const department_id =
        overrides.department_id !== undefined ? overrides.department_id : selectedDepartment;
      const designation_id =
        overrides.designation_id !== undefined ? overrides.designation_id : selectedDesignation;
      const person_id = overrides.person_id !== undefined ? overrides.person_id : selectedPerson;

      setLoading(true);
      try {
        const res = await reportPanelService.getDaily({
          date_from: toYmdClient(from) || from,
          date_to: toYmdClient(to) || to,
          department_id: canSeeAll ? department_id || undefined : undefined,
          designation_id: canSeeAll ? designation_id || undefined : undefined,
          person_id: canSeeAll ? person_id || undefined : selfId || undefined,
        });
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
      selfId,
    ],
  );

  /** First load only — later loads happen on Search / Reset / Refresh. */
  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once with defaults
  }, []);

  const handleFilterApply = (f = {}) => {
    /** Only the Search button (searchSubmit) reloads from backend. */
    if (!f.searchSubmit) return;

    const from = toYmdClient(f.fromDate !== undefined ? f.fromDate : dateFrom) || dateFrom;
    const to = toYmdClient(f.toDate !== undefined ? f.toDate : dateTo) || dateTo;
    const department_id = canSeeAll ? f.department_id || "" : "";
    const designation_id = canSeeAll ? f.designation_id || "" : "";
    const person_id = canSeeAll ? f.person_id || "" : "";

    if (from) setDateFrom(from);
    if (to) setDateTo(to);
    if (canSeeAll) {
      setSelectedDepartment(department_id);
      setSelectedDesignation(designation_id);
      setSelectedPerson(person_id);
    }

    fetchReport({
      dateFrom: from,
      dateTo: to,
      department_id,
      designation_id,
      person_id,
    });
  };

  const handleReset = () => {
    const next = defaultReportDateRange();
    setQuickSearch("");
    if (canSeeAll) clearFilters();
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    fetchReport({
      dateFrom: next.dateFrom,
      dateTo: next.dateTo,
      department_id: "",
      designation_id: "",
      person_id: "",
    });
  };

  const extraFilters = useMemo(() => {
    if (!canSeeAll) return [];
    return [
      {
        label: "Department",
        key: "department_id",
        value: selectedDepartment || "",
        variant: "quick",
        options: [
          { label: "All Departments", value: "" },
          ...departmentsLists.map((d) => ({ label: d.name, value: String(d.id) })),
        ],
      },
      {
        label: "Designation",
        key: "designation_id",
        value: selectedDesignation || "",
        variant: "quick",
        options: [
          { label: "All Designations", value: "" },
          ...designationsLists.map((d) => ({ label: d.name, value: String(d.id) })),
        ],
      },
      {
        label: "Person",
        key: "person_id",
        value: selectedPerson || "",
        variant: "quick",
        options: [
          { label: "All Persons", value: "" },
          ...personOptions.map((p) => ({ label: p.name, value: String(p.id) })),
        ],
      },
    ];
  }, [
    canSeeAll,
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

  /** Quick search filters loaded report data on the client. */
  const filteredUsers = useMemo(() => {
    const q = String(quickSearch || "").trim().toLowerCase();
    if (!q) return users;
    return users
      .map((u) => {
        const personHit = String(u.person_name || "")
          .toLowerCase()
          .includes(q);
        const tasks = (u.tasks || []).filter(
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
        if (!personHit && tasks.length === 0) return null;
        return { ...u, tasks: personHit ? u.tasks || [] : tasks };
      })
      .filter(Boolean);
  }, [users, quickSearch]);

  const filteredDays = useMemo(() => {
    const q = String(quickSearch || "").trim().toLowerCase();
    if (!q) return days;
    return days
      .map((day) => {
        const tasks = (day.tasks || []).filter(
          (t) =>
            String(t.person_name || "")
              .toLowerCase()
              .includes(q) ||
            String(t.title || "")
              .toLowerCase()
              .includes(q),
        );
        if (!tasks.length) return null;
        return { ...day, tasks };
      })
      .filter(Boolean);
  }, [days, quickSearch]);

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

  const exportDisabled = !exportRows.length;

  const handleExport = useCallback(
    async (format) => {
      if (!exportRows.length) {
        toast.info("No rows to export.");
        return;
      }
      setExporting(true);
      try {
        if (format === "xlsx") {
          const { filename } = await exportClTaskReportExcel({
            users: filteredUsers,
            moduleName: "CL Task Report",
            rangeFrom,
            rangeTo,
          });
          toast.success(`Downloaded ${filename} (colored scores)`);
          return;
        }
        const { filename } = await exportListPageTable({
          moduleName: "CL Task Report",
          headers: exportHeaders,
          rows: exportRows,
          format,
        });
        const { message } = notifyListPageExportResult(format, filename);
        toast.success(message);
      } catch (err) {
        toast.error(err?.message || "Export failed.");
      } finally {
        setExporting(false);
      }
    },
    [exportRows, exportHeaders, filteredUsers, rangeFrom, rangeTo],
  );

  const summaryItems = [
    {
      label: "Users",
      value: quickSearch.trim() ? filteredUsers.length : summary?.total_users ?? users.length ?? "—",
      tone: "text-slate-800",
    },
    {
      label: "Tasks",
      value: quickSearch.trim()
        ? filteredUsers.reduce((n, u) => n + (u.tasks?.length || 0), 0)
        : summary?.total_tasks ?? "—",
      tone: "text-slate-800",
    },
    { label: "Done", value: summary?.done_verified ?? "—", tone: "text-emerald-700" },
    { label: "Not done", value: summary?.not_done ?? "—", tone: "text-rose-700" },
    {
      label: "Score %",
      value:
        summary?.final_score_pct != null || summary?.compiled_task_score_pct != null
          ? `${summary.final_score_pct ?? summary.net_score ?? summary.compiled_task_score_pct}%`
          : "—",
      tone: "text-amber-700",
    },
    {
      label: "Red / MIS",
      value: summary?.mis_score_total != null ? summary.mis_score_total : "—",
      tone: "text-rose-700",
    },
  ];

  const viewingLabel = canSeeAll
    ? selectedPerson
      ? personOptions.find((p) => String(p.id) === String(selectedPerson))?.name || "Person"
      : "All persons"
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
              </>
            }
            viewToggle={
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden md:flex flex-wrap items-center gap-2.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 mr-1">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-slate-600" /> Done
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-amber-200 border border-amber-300" /> Pending
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-indigo-500" /> Approval
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-rose-500" /> Red
                  </span>
                </div>
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
            fromDate={dateFrom}
            toDate={dateTo}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            onExtraFilterChange={(key, v) => {
              if (!canSeeAll) return;
              if (key === "department_id") setSelectedDepartment(v);
              else if (key === "designation_id") setSelectedDesignation(v);
              else if (key === "person_id") setSelectedPerson(v);
            }}
            searchValue={quickSearch}
            onSearchChange={setQuickSearch}
            applyOnSearchEnter={false}
            searchVariant="quick"
            searchPlaceholder={canSeeAll ? "Quick search task or person..." : "Quick search task..."}
            searchLabel="Quick search"
          />
        </ListPageFilterStrip>

        {/* Compact summary strip */}
        <div className="shrink-0 border-b border-slate-300 bg-slate-50 px-2 py-1 flex flex-wrap items-center gap-x-4 gap-y-0.5">
          {summaryItems.map((item) => (
            <span key={item.label} className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {item.label}{" "}
              <span className={`tabular-nums text-[12px] ${item.tone}`}>
                {loading && !summary ? "…" : item.value}
              </span>
            </span>
          ))}
        </div>

        <ReportBookingCalendar
          users={filteredUsers}
          days={filteredDays}
          dateFrom={rangeFrom}
          dateTo={rangeTo}
          dateColumns={dateColumns}
          loading={loading}
          onSelectTask={setSelectedTask}
        />

        <div className="px-3 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {summary
              ? `${filteredUsers.length} users · ${
                  quickSearch.trim()
                    ? filteredUsers.reduce((n, u) => n + (u.tasks?.length || 0), 0)
                    : summary.total_tasks
                } tasks`
              : "CL Task Report"}
          </span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider inline-flex items-center gap-1">
            {loading ? <Loader2 size={10} className="animate-spin" /> : null}
            Search = backend · Quick search = this page
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
    </div>
  );
}
