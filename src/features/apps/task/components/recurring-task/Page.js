"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trash2, RefreshCcw, Edit3, X, Repeat, Clock, Loader2,
  CheckCircle2, Circle, CalendarPlus,
} from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useViewMode } from "@/core/hooks/useViewMode";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_DATE, IMS_TABLE_CELL_TEXT } from "@/features/apps/ims/helpers/listPageShellClasses";
import { applyClientSearch, sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";

import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import DataTable from "@/core/components/ui/DataTable";
import ActionButton from "@/core/components/ui/ActionButton";

import { recurringTaskService, taskService, DeleteModal, useRecurringFilters, StatCard } from "@/features/apps/task/common";
import RecurringTaskModal from "../tasks/RecurringTaskModal";
import RecurringTaskCard, { RECURRING_FILTER_COLORS } from "./RecurringTaskCard";
import { formatDate, formatDateTime, parseRecurrence } from "@/features/apps/task/helpers/utilHelper";

const MODULE = "recurring_task";

const RECURRING_STAT_CARDS = [
  { key: "total",    label: "Total",         icon: Repeat,       bg: "bg-indigo-50",  text: "text-indigo-600",  border: "border-indigo-100",  barColor: RECURRING_FILTER_COLORS.total },
  { key: "active",   label: "Active",        icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", barColor: RECURRING_FILTER_COLORS.active },
  { key: "inactive", label: "Inactive",      icon: Circle,       bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-100",   barColor: RECURRING_FILTER_COLORS.inactive },
  { key: "today",    label: "Created Today", icon: CalendarPlus, bg: "bg-sky-50",     text: "text-sky-600",     border: "border-sky-100",     barColor: RECURRING_FILTER_COLORS.today },
];

function isCreatedToday(row) {
  if (!row?.created_at) return false;
  const d = new Date(row.created_at);
  if (isNaN(d)) return false;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function ActiveToggle({ active, onToggle }) {
  return (
    <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          active ? "bg-emerald-500" : "bg-slate-300"
        }`}
        title={active ? "Set inactive" : "Set active"}
      >
        <span
          className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
            active ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </button>
      <span
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          active ? "text-emerald-600" : "text-slate-400"
        }`}
      >
        {active ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

export default function RecurringTasksPage() {
  const currentUser = useSelector((state) => state.auth.user);
  const isSuperAdmin = currentUser?.type === "super_admin";
  const isAdmin = currentUser?.type === "admin";

  const canAccess = useCanAccess();
  const canEdit = canAccess(MODULE, "edit").allowed;
  const canDelete = canAccess(MODULE, "delete").allowed;

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [tempSearch, setTempSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, today: 0 });

  const [statusFilter, setStatusFilter] = useState("All");
  const [quickFilter, setQuickFilter] = useState(null); // total | active | inactive | today
  const [params, setParams] = useState({
    pageSize: 1000,
    sortKey: "recurring_id",
    sortDir: "asc",
  });

  const { selectedUser, setSelectedUser, teamMemberOptions } = useRecurringFilters(currentUser);

  const [modalOpen, setModalOpen] = useState(false);
  const [selfModal, setSelfModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);

  const computeLocalStats = useCallback((rows) => {
    const list = Array.isArray(rows) ? rows : [];
    return {
      total: list.length,
      active: list.filter((r) => r.is_active === 1 || r.is_active === true).length,
      inactive: list.filter((r) => !(r.is_active === 1 || r.is_active === true)).length,
      today: list.filter(isCreatedToday).length,
    };
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      // Always load full set (user-scoped); Active/Inactive/Today filtered client-side for stable stats
      const res = await recurringTaskService.getAll({
        page: 1,
        limit: params.pageSize,
        sortBy: params.sortKey,
        order: params.sortDir,
        user_id: selectedUser || undefined,
      });
      const body = res?.data;
      const nested = body?.data;
      const list = Array.isArray(nested)
        ? nested
        : (nested?.data ?? nested?.items ?? body?.items ?? []);
      const safeList = Array.isArray(list) ? list : [];
      setAllRows(safeList);
      setDisplayLimit(100);

      const apiStats = nested?.stats ?? body?.stats;
      if (apiStats && (apiStats.total != null || apiStats.active != null)) {
        setStats({
          total: Number(apiStats.total) || 0,
          active: Number(apiStats.active) || 0,
          inactive: Number(apiStats.inactive) || 0,
          today: Number(apiStats.today) || 0,
        });
      } else {
        setStats(computeLocalStats(safeList));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err?.message || "Failed to load recurring tasks");
      setAllRows([]);
      setStats({ total: 0, active: 0, inactive: 0, today: 0 });
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, selectedUser, computeLocalStats]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredRows = useMemo(() => {
    let data = allRows;

    const activeKey = quickFilter || (
      statusFilter === "Active" ? "active" :
      statusFilter === "Inactive" ? "inactive" : null
    );

    if (activeKey === "active") {
      data = data.filter((r) => r.is_active === 1 || r.is_active === true);
    } else if (activeKey === "inactive") {
      data = data.filter((r) => !(r.is_active === 1 || r.is_active === true));
    } else if (activeKey === "today") {
      data = data.filter(isCreatedToday);
    }

    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, {
        getParts: (row) => [
          row.title,
          row.recurrence_type,
          parseRecurrence(row),
          row.recurring_id,
        ],
        skipSort: !!params.sortKey,
      });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir, statusFilter, quickFilter]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const activeStatKey = quickFilter || (
    statusFilter === "Active" ? "active" :
    statusFilter === "Inactive" ? "inactive" : null
  );

  const handleStatClick = (key) => {
    setSelected(null);
    setDisplayLimit(100);
    if (key === "total") {
      setQuickFilter("total");
      setStatusFilter("All");
      return;
    }
    if (key === "active") {
      setQuickFilter("active");
      setStatusFilter("Active");
      return;
    }
    if (key === "inactive") {
      setQuickFilter("inactive");
      setStatusFilter("Inactive");
      return;
    }
    if (key === "today") {
      setQuickFilter("today");
      setStatusFilter("All");
    }
  };

  const selectedRecord = useMemo(
    () => filteredRows.find((r) => r.recurring_id === selected) || null,
    [filteredRows, selected],
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((r) => r.recurring_id === selected),
    [filteredRows, selected],
  );

  const openEditModal = useCallback(
    (row) => {
      if (!canEdit || !row) return;
      setEditTask(row);
      if (row.task_type === "self") setSelfModal(true);
      else setModalOpen(true);
    },
    [canEdit],
  );

  const openDeleteModal = useCallback(
    (row) => {
      if (!canDelete || !row) return;
      setDeleteTask({ ...row, id: row.recurring_id });
    },
    [canDelete],
  );

  const { tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpen || selfModal || !!deleteTask,
    selectedId: selected,
    getSelectedRow,
    openEdit: canEdit ? openEditModal : undefined,
    openDelete: canDelete ? openDeleteModal : undefined,
    canDeleteSelection: useCallback(() => !!selected && canDelete, [selected, canDelete]),
  });

  const handleFilterApply = (data = {}) => {
    if (data.is_active !== undefined) {
      const next = data.is_active || "All";
      setStatusFilter(next);
      if (next === "Active") setQuickFilter("active");
      else if (next === "Inactive") setQuickFilter("inactive");
      else setQuickFilter(null);
    }
    if (data.user_id !== undefined) setSelectedUser(data.user_id || "");
  };

  const handleReset = () => {
    setTempSearch("");
    setSelected(null);
    setStatusFilter("All");
    setQuickFilter(null);
    setSelectedUser("");
    setParams({
      pageSize: 1000,
      sortKey: "recurring_id",
      sortDir: "asc",
    });
  };

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const handleToggle = useCallback(async (recurringId) => {
    try {
      const response = await taskService.toggleStatus(recurringId);
      const next = response.data?.is_active;
      setAllRows((prev) => {
        const updated = prev.map((t) =>
          t.recurring_id === recurringId ? { ...t, is_active: next } : t,
        );
        setStats(computeLocalStats(updated));
        return updated;
      });
    } catch {
      toast.error("Failed to toggle status");
    }
  }, [computeLocalStats]);

  const statCardCls = (key) =>
    activeStatKey === key
      ? "shadow-[0_8px_16px_-4px_rgba(0,0,0,0.15)] -translate-y-0.5 ring-1 ring-indigo-200"
      : "hover:shadow-sm hover:scale-[1.01]";

  const extraFilters = useMemo(() => {
    const filters = [
      {
        label: "Status",
        key: "is_active",
        value: statusFilter,
        preserveOrder: true,
        variant: "quick",
        options: [
          { label: "All Status", value: "All" },
          { label: "Active", value: "Active" },
          { label: "Inactive", value: "Inactive" },
        ],
      },
    ];
    if (isAdmin || isSuperAdmin) {
      filters.push({
        label: "Users",
        key: "user_id",
        value: selectedUser ? String(selectedUser) : "",
        searchable: true,
        variant: "quick",
        placeholder: "Search users…",
        options: [
          { label: "All Users", value: "" },
          ...(teamMemberOptions || []).map((u) => ({
            label: u.name || u.label || String(u.id),
            value: String(u.id ?? u.value),
          })),
        ],
      });
    }
    return filters;
  }, [statusFilter, isAdmin, isSuperAdmin, selectedUser, teamMemberOptions]);

  const HEADERS = useMemo(
    () => [
      [
        "#",
        "recurring_id",
        (v) => <span className={IMS_TABLE_CELL_TEXT}>{v ?? "—"}</span>,
        { fixed: true, width: "70px", align: "center" },
      ],
      [
        "Task Title",
        "title",
        (v) => (
          <span className="font-semibold text-slate-800 text-[12px] leading-tight line-clamp-1" title={v}>
            {v || "—"}
          </span>
        ),
        { width: "240px" },
      ],
      [
        "Recurrence",
        "recurrence_type",
        (_v, row) => (
          <span className={`${IMS_TABLE_CELL_TEXT} whitespace-nowrap`}>
            {parseRecurrence(row) || "—"}
          </span>
        ),
        { width: "140px" },
      ],
      [
        "Next Occurrence",
        "next_occurrence",
        (v) => (
          <span className={`${IMS_TABLE_CELL_DATE} inline-flex items-center gap-1`}>
            <Clock size={10} className="text-slate-400 shrink-0" />
            {v ? formatDateTime(v) : "—"}
          </span>
        ),
        { width: "160px" },
      ],
      [
        "End Date",
        "end_date",
        (v) => <span className={IMS_TABLE_CELL_DATE}>{v ? formatDateTime(v) : "—"}</span>,
        { width: "140px" },
      ],
      [
        "Active",
        "is_active",
        (v, row) => (
          <ActiveToggle
            active={v === 1 || v === true}
            onToggle={() => handleToggle(row.recurring_id)}
          />
        ),
        { width: "110px" },
      ],
      [
        "Created At",
        "created_at",
        (v) => <span className={IMS_TABLE_CELL_DATE}>{v ? formatDate(v) : "—"}</span>,
        { width: "110px" },
      ],
    ],
    [handleToggle],
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Recurring Tasks",
    rows: filteredRows,
    headers: HEADERS,
  });

  return (
    <>
      <div className={IMS_LIST_PAGE_SHELL}>
        <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
          <ListPageToolbar>
            <ListPageToolbarLayout
              actions={
                <>
                  <ActionButton
                    module={MODULE}
                    action="edit"
                    variant="outline"
                    label="Edit"
                    icon={Edit3}
                    disabled={!selectedRecord}
                    record={selectedRecord}
                    onClick={() => openEditModal(selectedRecord)}
                    className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                  />
                  <ActionButton
                    module={MODULE}
                    action="delete"
                    variant="danger"
                    label="Delete"
                    icon={Trash2}
                    disabled={!selectedRecord}
                    onClick={() => openDeleteModal(selectedRecord)}
                    className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                  />
                  <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                  <button
                    type="button"
                    onClick={fetchTasks}
                    disabled={loading}
                    className="h-9 shrink-0 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center disabled:opacity-60"
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

            {selected && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-600 uppercase truncate">
                  Selected: {selectedRecord?.title || `#${selected}`}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase shrink-0"
                >
                  <X size={14} /> Clear
                </button>
              </div>
            )}
          </ListPageToolbar>

          <ListPageFilterStrip>
            <DateRangeFilter
              showDate={false}
              applyExtrasOnChange
              extraFilters={extraFilters}
              searchValue={tempSearch}
              onSearchChange={setTempSearch}
              applyOnSearchEnter={false}
              showSearchButton={false}
              searchPlaceholder="Search by title, recurrence…"
              searchLabel="Quick Search"
              onApply={handleFilterApply}
              onReset={handleReset}
            />
          </ListPageFilterStrip>

          <div className="shrink-0 px-3 py-2 border-b border-slate-200 bg-slate-50/80">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {RECURRING_STAT_CARDS.map(({ key, label, icon, bg, text, border, barColor }) => (
                <div
                  key={key}
                  onClick={() => handleStatClick(key)}
                  className={`cursor-pointer transition-all rounded-none ${statCardCls(key)}`}
                >
                  <StatCard
                    label={label}
                    value={stats[key] ?? 0}
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

          {quickFilter && quickFilter !== "total" && (
            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border-b border-indigo-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                Showing:{" "}
                {quickFilter === "active"
                  ? "Active"
                  : quickFilter === "inactive"
                    ? "Inactive"
                    : "Created Today"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setQuickFilter(null);
                  setStatusFilter("All");
                }}
                className="ml-auto text-[11px] font-bold uppercase text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
              >
                <X size={12} /> Clear
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
            {viewMode === "card" ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 custom-scrollbar bg-slate-50/60">
                {loading && items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                    <Loader2 size={28} className="animate-spin text-indigo-500" />
                    <p className="text-sm font-medium">Loading recurring tasks…</p>
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                    <div className="w-12 h-12 rounded-none bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
                      <Repeat size={22} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No recurring tasks found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                    {items.map((row) => (
                      <RecurringTaskCard
                        key={row.recurring_id}
                        task={row}
                        isSelected={selected === row.recurring_id}
                        onToggle={(id) => setSelected(selected === id ? null : id)}
                        onEdit={openEditModal}
                        onDelete={openDeleteModal}
                        handleToggle={handleToggle}
                      />
                    ))}
                  </div>
                )}
                {!loading && items.length < totalItems && (
                  <div className="flex justify-center py-4">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-indigo-600 border border-indigo-200 rounded-none hover:bg-indigo-50"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <DataTable
                headers={HEADERS}
                data={items}
                loading={loading}
                viewMode="table"
                showSelection
                idKey="recurring_id"
                getRowId={(row) => row.recurring_id}
                selectedId={selected}
                onSelect={setSelected}
                emptyIcon={Repeat}
                sortKey={params.sortKey}
                sortDir={params.sortDir}
                onSort={(key) => {
                  setDisplayLimit(100);
                  setParams((p) => ({
                    ...p,
                    sortKey: key,
                    sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                  }));
                }}
                onLoadMore={handleLoadMore}
                hasMore={items.length < totalItems}
                totalItems={totalItems}
                allowCopy
                {...tableHotkeyProps}
              />
            )}
          </div>

          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-3">
            <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
              {[
                { label: "Total", color: RECURRING_FILTER_COLORS.total },
                { label: "Active", color: RECURRING_FILTER_COLORS.active },
                { label: "Inactive", color: RECURRING_FILTER_COLORS.inactive },
                { label: "Created Today", color: RECURRING_FILTER_COLORS.today },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{label}</span>
                </div>
              ))}
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
              Showing {items.length} of {totalItems}
            </span>
          </div>
        </div>
      </div>

      <DeleteModal
        item={deleteTask}
        onClose={() => setDeleteTask(null)}
        onSuccess={() => {
          fetchTasks();
          setSelected(null);
        }}
        service={recurringTaskService}
        entityLabel="Recurring Task"
      />

      <RecurringTaskModal
        open={modalOpen || selfModal}
        onClose={() => {
          setModalOpen(false);
          setSelfModal(false);
          setEditTask(null);
        }}
        onSuccess={() => {
          setModalOpen(false);
          setSelfModal(false);
          setEditTask(null);
          fetchTasks();
          setSelected(null);
        }}
        editTask={editTask}
        taskType={editTask?.task_type ?? "assigned"}
        currentUser={currentUser}
      />
    </>
  );
}
