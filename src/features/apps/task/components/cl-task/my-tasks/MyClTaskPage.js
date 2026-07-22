"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { Calendar, History, RefreshCcw, ClipboardList, Loader2, Eye, Play } from "lucide-react";
import { toast } from "react-toastify";

import { useViewMode } from "@/core/hooks/useViewMode";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_DATE } from "@/features/apps/ims/helpers/listPageShellClasses";
import { applyClientSearch, sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";
import { useAppliedListSearch } from "@/features/apps/ims/helpers/useAppliedListSearch";

import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import DataTable from "@/core/components/ui/DataTable";
import ImsSegmentedTabs from "@/features/apps/ims/components/common/ImsSegmentedTabs";

import { clTaskService } from "@/features/apps/task/services/clTaskApi";
import { useClTaskFilters } from "@/features/apps/task/hooks/useClTaskFilters";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { filterRowsByViewDays } from "@/core/utils/permissionDays";
import {
  canStartClTaskNow,
  formatDueTimeLabel,
  getClTaskFillBlockedReasonClient,
  getISTDateString,
  isClTaskMissed,
} from "@/features/apps/task/helpers/clTaskTimeHelper";
import {
  getClTaskTypeLabel,
  getClTaskTypeTheme,
  getClTaskRowClassName,
} from "@/features/apps/task/helpers/clTaskTypeStyle";
import { formatScheduledDate, formatDateTime } from "@/features/apps/task/helpers/utilHelper";
import { toYmdClient } from "@/features/apps/task/services/reportApi";
import { stripHtml } from "@/features/apps/task/helpers/clTaskFormHelper";
import {
  rowMatchesPersonScope,
  rowMatchesDepartmentScope,
  rowMatchesDesignationScope,
  CL_ORG_FILTER_CLASS,
} from "@/features/apps/task/helpers/clTaskScopeHelper";
import ClTaskSubmitModal from "./ClTaskSubmitModal";
import ClTaskHistoryEditModal from "./ClTaskHistoryEditModal";
import MyClTaskCard from "./MyClTaskCard";

const TABS = [
  { id: "due", label: "Due Task", icon: Calendar },
  { id: "history", label: "Submit Task", icon: History },
];

const HISTORY_STATUS_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Pending Approval", value: "awaiting_verification" },
  { label: "Completed", value: "completed" },
];

/** Sentinel for “show every assignee” (default remains current user). */
const PERSON_ALL = "__all__";

function dueRowId(row) {
  if (!row) return "";
  if (row.instance_id != null && row.instance_id !== "") return `i-${row.instance_id}`;
  return `m-${row.cl_task_id}`;
}

export default function MyClTaskPage() {
  const canAccess = useCanAccess();
  const viewAccess = canAccess("cl_task", "view");
  const roleLc = String(useSelector((s) => s.auth?.role) || "").toLowerCase();
  const currentUser = useSelector((s) => s.auth?.user);
  const selfId = currentUser?.id;
  const canFilterAll =
    roleLc === "super_admin" || roleLc === "admin" || roleLc === "executive_assistant";

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
    allUsers,
  } = useClTaskFilters();

  const [tab, setTab] = useState("due");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [selected, setSelected] = useState(null);
  const [submitTask, setSubmitTask] = useState(null);
  const [viewTask, setViewTask] = useState(null);
  const [viewMode, handleViewMode] = useViewMode();
  const [params, setParams] = useState({ sortKey: "scheduled_date", sortDir: "asc" });

  // Privileged roles: default Person filter = current user (own tasks).
  useEffect(() => {
    if (!canFilterAll || selfId == null) return;
    if (!selectedPerson) {
      setSelectedPerson(String(selfId));
    }
  }, [canFilterAll, selfId, selectedPerson, setSelectedPerson]);

  const applyList = useCallback((list) => {
    setAllRows(Array.isArray(list) ? list : []);
    setDisplayLimit(100);
    setSelected(null);
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const query = {
        tab,
        limit: 1000,
        sortBy: tab === "history" ? "submitted_at" : "scheduled_date",
        order: tab === "history" ? "DESC" : "ASC",
        ...(appliedSearch ? { search: appliedSearch } : {}),
      };
      const res = await clTaskService.getMy(query);
      const body = res?.data?.data;
      const list = Array.isArray(body?.data) ? body.data : (Array.isArray(body) ? body : []);
      applyList(list);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load my CL tasks");
      applyList([]);
    } finally {
      setLoading(false);
    }
  }, [tab, appliedSearch, applyList]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const query = {
          tab,
          limit: 1000,
          sortBy: tab === "history" ? "submitted_at" : "scheduled_date",
          order: tab === "history" ? "DESC" : "ASC",
          ...(appliedSearch ? { search: appliedSearch } : {}),
        };
        const res = await clTaskService.getMy(query);
        if (cancelled) return;
        const body = res?.data?.data;
        const list = Array.isArray(body?.data) ? body.data : (Array.isArray(body) ? body : []);
        applyList(list);
      } catch (err) {
        if (cancelled) return;
        toast.error(err.response?.data?.message || "Failed to load my CL tasks");
        applyList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, appliedSearch, applyList]);

  useEffect(() => {
    if (tab === "history") {
      setParams((p) => ({ ...p, sortKey: "submitted_at", sortDir: "desc" }));
    } else {
      setParams((p) => ({ ...p, sortKey: "scheduled_date", sortDir: "asc" }));
    }
  }, [tab]);

  const onTabChange = useCallback(
    (next) => {
      if (next === tab) return;
      resetSearch();
      setSelected(null);
      setTab(next);
    },
    [tab, resetSearch],
  );

  const filteredRows = useMemo(() => {
    let data = filterRowsByViewDays(allRows, viewAccess.days, [
      "submitted_at",
      "scheduled_date",
      "created_at",
      "updated_at",
    ]);
    if (tab === "due") {
      data = data.filter((r) => !(isClTaskMissed(r) || r?.is_missed === true));
    }

    // Super Admin / Admin / EA: client-side assignee filters (default = self).
    if (canFilterAll) {
      if (selectedDepartment) {
        data = data.filter((r) => rowMatchesDepartmentScope(r, selectedDepartment, allUsers));
      }
      if (selectedDesignation) {
        data = data.filter((r) => rowMatchesDesignationScope(r, selectedDesignation, allUsers));
      }
      const personScope =
        selectedPerson && selectedPerson !== PERSON_ALL
          ? selectedPerson
          : selectedPerson === PERSON_ALL
            ? null
            : selfId;
      if (personScope != null && personScope !== "") {
        data = data.filter((r) => rowMatchesPersonScope(r, personScope, allUsers));
      }
    }

    if (tab === "history") {
      if (historyStatus && historyStatus !== "all") {
        data = data.filter((r) => String(r.status) === historyStatus);
      }
      if (dateFrom) {
        data = data.filter((r) => (toYmdClient(r.submitted_at) || "") >= dateFrom);
      }
      if (dateTo) {
        data = data.filter((r) => (toYmdClient(r.submitted_at) || "") <= dateTo);
      }
    }
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [
    allRows,
    tempSearch,
    params.sortKey,
    params.sortDir,
    tab,
    historyStatus,
    dateFrom,
    dateTo,
    viewAccess.days,
    canFilterAll,
    selectedDepartment,
    selectedDesignation,
    selectedPerson,
    selfId,
    allUsers,
  ]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const selectedRecord = useMemo(
    () => filteredRows.find((t) => dueRowId(t) === String(selected)) || null,
    [filteredRows, selected],
  );

  const openSubmit = useCallback((row) => {
    if (!row || tab !== "due") return;
    const blocked = getClTaskFillBlockedReasonClient(row);
    if (blocked) {
      toast.info(blocked);
      return;
    }
    if (!canStartClTaskNow(row)) {
      toast.info("This task cannot be submitted right now");
      return;
    }
    setSelected(dueRowId(row));
    setSubmitTask(row);
  }, [tab]);

  const openView = useCallback((row) => {
    if (!row) return;
    setSelected(dueRowId(row));
    setViewTask({ ...row, _viewOnly: true });
  }, []);

  const assigneeExtraFilters = useMemo(() => {
    if (!canFilterAll) return [];
    return [
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
      {
        label: "Users",
        key: "person_id",
        value: selectedPerson || (selfId != null ? String(selfId) : ""),
        searchable: true,
        placeholder: "Search users…",
        variant: "quick",
        className: CL_ORG_FILTER_CLASS,
        options: [
          { label: "All Users", value: PERSON_ALL },
          ...personOptions.map((p) => ({ label: p.name, value: String(p.id) })),
        ],
      },
    ];
  }, [
    canFilterAll,
    selectedDepartment,
    selectedDesignation,
    selectedPerson,
    selfId,
    departmentsLists,
    designationsLists,
    personOptions,
  ]);

  const historyExtraFilters = useMemo(
    () => [
      ...assigneeExtraFilters,
      {
        label: "Status",
        key: "status",
        value: historyStatus,
        variant: "quick",
        options: HISTORY_STATUS_OPTIONS,
      },
    ],
    [assigneeExtraFilters, historyStatus],
  );

  const dueExtraFilters = useMemo(() => assigneeExtraFilters, [assigneeExtraFilters]);

  const applyAssigneeFilters = useCallback(
    (data = {}) => {
      if (!canFilterAll) return;
      setSelectedDepartment(data.department_id || "");
      setSelectedDesignation(data.designation_id || "");
      if (data.person_id === PERSON_ALL) {
        setSelectedPerson(PERSON_ALL);
      } else if (data.person_id) {
        setSelectedPerson(String(data.person_id));
      } else if (selfId != null) {
        setSelectedPerson(String(selfId));
      }
    },
    [canFilterAll, selfId, setSelectedDepartment, setSelectedDesignation, setSelectedPerson],
  );

  const resetAssigneeFilters = useCallback(() => {
    if (!canFilterAll) return;
    setSelectedDepartment("");
    setSelectedDesignation("");
    if (selfId != null) setSelectedPerson(String(selfId));
    else setSelectedPerson("");
  }, [canFilterAll, selfId, setSelectedDepartment, setSelectedDesignation, setSelectedPerson]);

  const canSubmitSelected =
    tab === "due" &&
    selectedRecord &&
    canStartClTaskNow(selectedRecord) &&
    !getClTaskFillBlockedReasonClient(selectedRecord);

  const HEADERS = useMemo(() => {
    if (tab === "history") {
      return [
        [
          "Title",
          "title",
          (v) => (
            <span className="font-bold text-slate-800 text-[11px] tracking-tight truncate" title={v}>
              {v || "—"}
            </span>
          ),
          { fixed: true, width: "240px" },
        ],
        [
          "Type",
          "task_type",
          (_v, row) => {
            const theme = getClTaskTypeTheme(row);
            return (
              <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${theme.badge}`}>
                {getClTaskTypeLabel(row)}
              </span>
            );
          },
          { width: "110px" },
        ],
        [
          "Submitted",
          "submitted_at",
          (v) => <span className={IMS_TABLE_CELL_DATE}>{formatDateTime(v)}</span>,
          { width: "150px" },
        ],
        [
          "Status",
          "status",
          (v, row) => {
            const st = String(v || "");
            const done = st === "completed";
            const awaiting = st === "awaiting_verification";
            const label = done
              ? "● COMPLETED"
              : awaiting
                ? "● PENDING APPROVAL"
                : st === "pending"
                  ? "● PENDING"
                  : `● ${(st || "unknown").replace(/_/g, " ").toUpperCase()}`;
            return (
              <div className="flex flex-col gap-0.5 leading-tight">
                <span
                  className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${
                    done
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                      : awaiting
                        ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  {label}
                </span>
                {!done && row.verification_user_name ? (
                  <span className="text-[9px] text-slate-400 truncate">→ {row.verification_user_name}</span>
                ) : null}
                {done && row.score != null ? (
                  <span className="text-[9px] font-bold text-amber-700">
                    Score {Number.isFinite(Number(row.score)) ? `${Math.round((Number(row.score) / 10) * 1000) / 10}%` : "—"}
                  </span>
                ) : null}
              </div>
            );
          },
          { width: "150px" },
        ],
      ];
    }

    return [
      [
        "Title",
        "title",
        (v, row) => {
          const desc = stripHtml(row.description);
          return (
            <div className="flex flex-col leading-tight py-0.5 min-w-0 gap-0.5">
              <span className="font-bold text-slate-800 text-[12px] tracking-tight truncate" title={v}>
                {v || "—"}
              </span>
              {/* {desc ? (
                <span className="text-[10px] text-slate-500 truncate" title={desc}>{desc}</span>
              ) : null} */}
            </div>
          );
        },
        { fixed: true, width: "260px" },
      ],
      [
        "Type",
        "task_type",
        (_v, row) => {
          const theme = getClTaskTypeTheme(row);
          return (
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${theme.badge}`}>
              {getClTaskTypeLabel(row)}
            </span>
          );
        },
        { width: "110px" },
      ],
      [
        "Scheduled Date",
        "scheduled_date",
        (v) => <span className={IMS_TABLE_CELL_DATE}>{formatScheduledDate(v)}</span>,
        { width: "110px" },
      ],
      [
        "Due Time",
        "due_time",
        (v, row) =>
          row.task_type === "frequently" && v ? (
            <span className="text-[10px] font-bold text-indigo-600 uppercase">{formatDueTimeLabel(v)}</span>
          ) : (
            <span className="text-[10px] text-slate-400">Anytime</span>
          ),
        { width: "100px" },
      ],
      [
        "Weightage",
        "weightage",
        (v, row) => (
          <span className="text-[11px] font-bold text-slate-700">{v ?? row.wastage ?? "—"}/10</span>
        ),
        { width: "90px", align: "center" },
      ],
      [
        "Reject",
        "reject_count",
        (v, row) =>
          Number(v) > 0 ? (
            <div className="flex flex-col gap-0.5 min-w-0 max-w-[200px]">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 w-fit">
                Rejected · {v} {Number(v) === 1 ? "time" : "times"}
              </span>
              {row.verifier_remark ? (
                <span className="text-[10px] text-rose-800/90 line-clamp-2" title={row.verifier_remark}>
                  {row.verifier_remark}
                </span>
              ) : (
                <span className="text-[10px] text-rose-500 italic">No reason</span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-slate-300">—</span>
          ),
        { width: "180px" },
      ],
    ];
  }, [tab]);

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "CL Task",
    rows: filteredRows,
    headers: HEADERS,
  });

  const today = getISTDateString();

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                active={tab}
                onChange={onTabChange}
                tabs={TABS}
              />
            }
            actions={
              <>
                {tab === "due" ? (
                  <button
                    type="button"
                    disabled={!canSubmitSelected}
                    onClick={() => openSubmit(selectedRecord)}
                    className="h-9 shrink-0 px-4 rounded-none border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    <Play size={14} fill="currentColor" /> Submit
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!selectedRecord}
                    onClick={() => openView(selectedRecord)}
                    className="h-9 shrink-0 px-4 rounded-none border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider disabled:opacity-40 shadow-none"
                  >
                    <Eye size={14} /> View
                  </button>
                )}

                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />

                <button
                  type="button"
                  onClick={fetchTasks}
                  disabled={loading}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center disabled:opacity-60"
                  aria-label="Refresh"
                >
                  <RefreshCcw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
                </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={loading || exportDisabled}
                onExport={handleExport}
              />
            }
          />
        </ListPageToolbar>

        <ListPageFilterStrip>
          {tab === "history" ? (
            <DateRangeFilter
              showDate
              applyExtrasOnChange
              fromDate={dateFrom}
              toDate={dateTo}
              extraFilters={historyExtraFilters}
              onApply={(data = {}) => {
                if (data.searchSubmit) applySearchFromInput();
                applyAssigneeFilters(data);
                setHistoryStatus(data.status || "all");
                setDateFrom(data.fromDate || "");
                setDateTo(data.toDate || "");
                setDisplayLimit(100);
                setSelected(null);
              }}
              onReset={() => {
                resetSearch();
                resetAssigneeFilters();
                setHistoryStatus("all");
                setDateFrom("");
                setDateTo("");
                setDisplayLimit(100);
                setSelected(null);
              }}
              searchValue={tempSearch}
              onSearchChange={setTempSearch}
              searchVariant="quick"
              searchPlaceholder="Search title, person, description…"
              searchLabel="Search"
            />
          ) : (
            <DateRangeFilter
              showDate={false}
              applyExtrasOnChange={canFilterAll}
              extraFilters={dueExtraFilters}
              onApply={(data = {}) => {
                if (data.searchSubmit) applySearchFromInput();
                applyAssigneeFilters(data);
                setDisplayLimit(100);
                setSelected(null);
              }}
              onReset={() => {
                resetSearch();
                resetAssigneeFilters();
                setDisplayLimit(100);
                setSelected(null);
              }}
              searchValue={tempSearch}
              onSearchChange={setTempSearch}
              searchVariant="quick"
              searchPlaceholder="Search title, person, description…"
              searchLabel="Search"
            />
          )}
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          {viewMode === "card" ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 bg-slate-50/60">
              {loading && items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                  <Loader2 size={28} className="animate-spin text-indigo-500" />
                  <p className="text-sm font-medium">Loading…</p>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
                    <ClipboardList size={22} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    {tab === "due" ? "No due tasks today" : "No submitted tasks"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {items.map((task) => (
                    <MyClTaskCard
                      key={dueRowId(task)}
                      task={task}
                      tab={tab}
                      selected={String(selected) === dueRowId(task)}
                      onSelect={(row) => setSelected(dueRowId(row))}
                      onStart={tab === "due" ? openSubmit : openView}
                    />
                  ))}
                </div>
              )}
              {!loading && items.length < totalItems ? (
                <div className="flex justify-center py-4">
                  <button
                    type="button"
                    onClick={() => setDisplayLimit((n) => n + 100)}
                    className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                  >
                    Load more
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <DataTable
              headers={HEADERS}
              data={items}
              loading={loading}
              viewMode="table"
              allowCopy
              showSelection
              skeletonCount={40}
              emptyIcon={ClipboardList}
              sortKey={params.sortKey ?? ""}
              sortDir={params.sortDir}
              getRowClassName={getClTaskRowClassName}
              onSort={(key) => {
                setDisplayLimit(100);
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }}
              selectedId={selected}
              onSelect={setSelected}
              getRowId={(item) => dueRowId(item)}
              onRowDoubleClick={tab === "due" ? openSubmit : openView}
              onLoadMore={() => {
                if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
              }}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
            />
          )}
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} · {today}
            {tab === "due" ? " · Select + Submit, or double-click" : " · View only"}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <span className="text-[9px] font-bold text-sky-600 uppercase">Open</span>
            <span className="text-[9px] font-bold text-emerald-600 uppercase">Daily</span>
            <span className="text-[9px] font-bold text-amber-600 uppercase">Weekly</span>
            <span className="text-[9px] font-bold text-orange-600 uppercase">Monthly</span>
            <span className="text-[9px] font-bold text-rose-600 uppercase">Yearly</span>
          </div>
        </div>
      </div>

      <ClTaskSubmitModal
        task={submitTask}
        onClose={() => setSubmitTask(null)}
        onSuccess={() => {
          setSubmitTask(null);
          fetchTasks();
        }}
      />
      <ClTaskHistoryEditModal
        task={viewTask}
        viewOnly
        onClose={() => setViewTask(null)}
        onSuccess={() => setViewTask(null)}
      />
    </div>
  );
}
