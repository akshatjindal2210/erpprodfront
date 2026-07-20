"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Loader2, User, X, Minimize2, Maximize2, RefreshCcw, Edit3, Trash2, Copy, Eye } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";

import {
  taskService,
  StatCard,
  DeleteModal,
  useViewMode,
  usePersistedScroll,
  TABS,
  STAT_CARDS,
  COLOR_LEGEND,
  QUICK_FILTER_LABELS,
  getRowMeta,
  getActiveStatKey,
  EmptyState,
  TaskCard,
  getTaskDataTableRowClassName,
} from "@/features/apps/task/common";

const FETCH_LIMIT = 1000;
const DISPLAY_CHUNK = 100;
import { categoryService } from "@/features/apps/task/services/categoryApi";
import { userService } from "@/features/apps/task/services/userApi";
import { mapTaskUserToOption, extractList } from "@/features/apps/task/helpers/utilHelper";
import { TASK_STATUSES, PRIORITIES, TASK_STATUS_CONFIG, PRIORITY_CONFIG } from "@/features/apps/task/components/common/Constants";
import { buildTaskDetailUrl } from "@/features/apps/task/helpers/taskRouteHelper";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";

import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import ImsSegmentedTabs from "@/features/apps/ims/components/common/ImsSegmentedTabs";
import DataTable from "@/core/components/ui/DataTable";
import ActionButton from "@/core/components/ui/ActionButton";

import TaskModal from "@/features/apps/task/components/tasks/TaskModal";
import { buildTaskListHeaders, buildTaskExportHeaders } from "@/features/apps/task/components/tasks/taskListTableHeaders";
import { TASK_FILTER_SS, readSessionString, writeSessionString, clearSessionKeys, readQuickFilterSession } from "@/features/apps/task/helpers/taskListFilterSession";

const MODULE = "tasks";

export default function TasksPage() {
  const currentUser = useSelector((state) => state.auth.user);
  const router = useRouter();
  const canAccess = useCanAccess();
  const canEdit = canAccess(MODULE, "edit").allowed;
  const canDelete = canAccess(MODULE, "delete").allowed;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, handleViewMode] = useViewMode();
  const [stats, setStats] = useState({
    open_tasks: 0, updated_tasks: 0,
    total: 0, pending: 0, in_progress: 0, completed: 0,
    action_required: 0, creator_pending: 0,
    overdue: 0, new_today: 0, reminder: 0, upcoming_due: 0,
  });

  const [activeTab, setActiveTab] = useState(() =>
    readSessionString(TASK_FILTER_SS.activeTab, "assigned_to_me"),
  );
  const [search, setSearch] = useState(() =>
    readSessionString(TASK_FILTER_SS.search, ""),
  );
  const [tempSearch, setTempSearch] = useState(() =>
    readSessionString(TASK_FILTER_SS.search, ""),
  );
  const [statusFilter, setStatusFilter] = useState(() =>
    readSessionString(TASK_FILTER_SS.status, "All"),
  );
  const [priorityFilter, setPriorityFilter] = useState(() =>
    readSessionString(TASK_FILTER_SS.priority, "All"),
  );
  const [categoryFilter, setCategoryFilter] = useState(() =>
    readSessionString(TASK_FILTER_SS.category, "All"),
  );
  const [userFilter, setUserFilter] = useState(() =>
    readSessionString(TASK_FILTER_SS.user, "All"),
  );
  const [quickFilter, setQuickFilter] = useState(() =>
    readQuickFilterSession(TASK_FILTER_SS.quick, "action_required"),
  );
  const [displayLimit, setDisplayLimit] = useState(DISPLAY_CHUNK);
  const [sortKey, setSortKey] = useState(() =>
    readSessionString(TASK_FILTER_SS.sortKey, "task_id"),
  );
  const [sortDir, setSortDir] = useState(() =>
    readSessionString(TASK_FILTER_SS.sortDir, "desc"),
  );
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const cardScrollRef = useRef(null);
  const tableContainerRef = useRef(null);

  const [cloneTask, setCloneTask] = useState(null);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selfModal, setSelfModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const getDefaultQuickFilterForTab = () => "action_required";

  useEffect(() => {
    writeSessionString(TASK_FILTER_SS.activeTab, activeTab);
    writeSessionString(TASK_FILTER_SS.search, search);
    writeSessionString(TASK_FILTER_SS.status, statusFilter);
    writeSessionString(TASK_FILTER_SS.priority, priorityFilter);
    writeSessionString(TASK_FILTER_SS.category, categoryFilter);
    writeSessionString(TASK_FILTER_SS.user, userFilter);
    writeSessionString(TASK_FILTER_SS.quick, quickFilter || "");
    writeSessionString(TASK_FILTER_SS.sortKey, sortKey);
    writeSessionString(TASK_FILTER_SS.sortDir, sortDir);
  }, [
    activeTab,
    search,
    statusFilter,
    priorityFilter,
    categoryFilter,
    userFilter,
    quickFilter,
    sortKey,
    sortDir,
  ]);

  useEffect(() => {
    let cancelled = false;

    userService.getViews()
      .then((userRes) => {
        if (cancelled) return;
        setUserOptions(extractList(userRes));
      })
      .catch(() => {
        if (!cancelled) setUserOptions([]);
      });

    categoryService.getViews({
      permission_module: "tasks",
      permission_action: "view",
      limit: 500,
    })
      .then((categoryRes) => {
        if (cancelled) return;
        setCategoryOptions(extractList(categoryRes));
      })
      .catch(() => {
        if (!cancelled) setCategoryOptions([]);
      });

    return () => { cancelled = true; };
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!currentUser?.id) {
      setTasks([]);
      setTotalItems(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = {
        page: 1,
        limit: FETCH_LIMIT,
        search: search || undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
        priority: priorityFilter !== "All" ? priorityFilter : undefined,
        category_id: categoryFilter !== "All" ? categoryFilter : undefined,
        assigned_by_id: userFilter !== "All" ? userFilter : undefined,
        sortBy: `t.${sortKey}`,
        order: sortDir,
        action_required_today: quickFilter === "action_required" ? true : undefined,
        view:
          activeTab === "assigned_to_me" ? "assigned_to" :
          activeTab === "assigned_by_me" ? "assigned_by" :
          activeTab === "create_by_me" ? "created" : undefined,
        created_by_id: activeTab === "create_by_me" ? currentUser?.id : undefined,
        created_by: activeTab === "create_by_me" ? currentUser?.id : undefined,
        task_type: activeTab === "self" ? "self" : undefined,
        include_closed: activeTab === "all" ? true : undefined,
        overdue: quickFilter === "overdue" || undefined,
        new_today: quickFilter === "new_today" || undefined,
        reminder: quickFilter === "reminder" || undefined,
        upcoming_due: quickFilter === "upcoming_due" || undefined,
        creator_pending: quickFilter === "creator_pending" || undefined,
        open_tasks: quickFilter === "open_tasks" || undefined,
        updated_tasks: quickFilter === "updated_tasks" || undefined,
        report: false,
      };

      const res = await taskService.getAll(params);
      const raw = res.data?.data?.items ?? res.data?.data ?? res.data ?? [];
      const safeTasks = Array.isArray(raw) ? raw : [];
      setTasks(safeTasks);
      setTotalItems(res.data?.data?.total ?? res.data?.total ?? safeTasks.length);
      if (res.data?.data?.stats) setStats(res.data.data.stats);
    } catch (err) {
      if (err?.response?.status === 401) return;
      toast.error(err.response?.data?.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, categoryFilter,
      sortKey, sortDir, activeTab, quickFilter, currentUser?.id, userFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    setDisplayLimit(DISPLAY_CHUNK);
    setSelected(null);
  }, [search, statusFilter, priorityFilter, categoryFilter, userFilter, activeTab, quickFilter, sortKey, sortDir]);

  const displayTasks = useMemo(() => {
    const scopedTasks = activeTab === "create_by_me"
      ? tasks.filter((t) => String(t.created_by_id ?? t.created_by) === String(currentUser?.id))
      : tasks;

    if (statusFilter === "completed") return scopedTasks;
    return quickFilter === "action_required"
      ? scopedTasks.filter((t) => t.status !== "completed")
      : scopedTasks;
  }, [tasks, statusFilter, quickFilter, activeTab, currentUser?.id]);

  const visibleTasks = useMemo(
    () => displayTasks.slice(0, displayLimit),
    [displayTasks, displayLimit],
  );
  /** Infinite scroll pages the loaded client slice (fetch cap). Footer must not claim more than loaded. */
  const displayCount = displayTasks.length;
  const serverTotal = Number(totalItems) || 0;
  const hasMore = visibleTasks.length < displayTasks.length;
  const hasFilter = statusFilter !== "All" || priorityFilter !== "All" || categoryFilter !== "All" || userFilter !== "All" || !!quickFilter;

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) setDisplayLimit((n) => n + DISPLAY_CHUNK);
  }, [loading, hasMore]);

  const activeStatKey = getActiveStatKey(quickFilter, statusFilter, activeTab);

  const activeFilterLabel = useMemo(() => {
    if (quickFilter) return QUICK_FILTER_LABELS[quickFilter];
    if (statusFilter && statusFilter !== "All") return QUICK_FILTER_LABELS[statusFilter];
    return null;
  }, [quickFilter, statusFilter]);

  const statCardCls = (key) =>
    activeStatKey === key
      ? "shadow-[0_8px_16px_-4px_rgba(0,0,0,0.15)] -translate-y-0.5"
      : "hover:shadow-sm hover:scale-[1.01]";

  const clearAllFilters = () => {
    setQuickFilter(null);
    setStatusFilter("All");
    setPriorityFilter("All");
    setCategoryFilter("All");
    setUserFilter("All");
  };

  const handleStatClick = (key) => {
    setQuickFilter(null);
    setStatusFilter("All");
    setPriorityFilter("All");
    setCategoryFilter("All");
    setUserFilter("All");
    if (key === "total") { setQuickFilter("total"); return; }
    if (key === "pending") { setStatusFilter("pending"); return; }
    if (key === "in_progress") { setStatusFilter("in_progress"); return; }
    if (key === "completed") { setStatusFilter("completed"); return; }
    setQuickFilter(key);
  };

  const handleReset = () => {
    setTempSearch("");
    setSearch("");
    setSortKey("task_id");
    setSortDir("desc");
    clearAllFilters();
    setActiveTab("assigned_to_me");
    setQuickFilter(getDefaultQuickFilterForTab("assigned_to_me"));
    setSelected(null);
    setDisplayLimit(DISPLAY_CHUNK);
    clearSessionKeys(TASK_FILTER_SS);
  };

  const handleFilterApply = (data = {}) => {
    if (data.searchSubmit) setSearch(String(tempSearch || "").trim());
    if (data.status !== undefined) {
      setStatusFilter(data.status || "All");
      setQuickFilter(null);
    }
    if (data.priority !== undefined) setPriorityFilter(data.priority || "All");
    if (data.category_id !== undefined) setCategoryFilter(data.category_id || "All");
    if (data.assigned_by_id !== undefined) setUserFilter(data.assigned_by_id || "All");
  };

  const clearActiveBannerFilter = () => {
    if (activeTab === "all") setActiveTab("assigned_to_me");
    setQuickFilter(null);
    setStatusFilter("All");
  };

  const selectedRecord = useMemo(
    () => displayTasks.find((t) => t.task_id === selected) || null,
    [displayTasks, selected],
  );

  const isSelectedOwner = useMemo(() => {
    if (!selectedRecord || !currentUser?.id) return false;
    return selectedRecord.task_type === "self"
      ? String(selectedRecord.created_by_id) === String(currentUser.id)
      : String(selectedRecord.assigned_by_id) === String(currentUser.id);
  }, [selectedRecord, currentUser?.id]);

  const openEditModal = useCallback((task) => {
    if (!task) return;
    if (task.task_type === "self") { setEditTask(task); setSelfModal(true); }
    else { setEditTask(task); setModalOpen(true); }
  }, []);

  const closeAssignModal = () => { setModalOpen(false); setEditTask(null); };
  const closeSelfModal = () => { setSelfModal(false); setEditTask(null); };

  const getSelectedRow = useCallback(
    () => displayTasks.find((t) => String(t.task_id) === String(selected)) || null,
    [displayTasks, selected],
  );

  const { tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpen || selfModal || !!cloneTask || !!deleteTask,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => {
      setEditTask(null);
      setModalOpen(true);
    }, []),
    openEdit: useCallback((row) => {
      if (!row) return;
      const isOwner = row.task_type === "self"
        ? String(row.created_by_id) === String(currentUser?.id)
        : String(row.assigned_by_id) === String(currentUser?.id);
      if (!isOwner) {
        toast.info("Only the task owner can edit");
        return;
      }
      openEditModal(row);
    }, [currentUser?.id, openEditModal]),
    openDelete: useCallback((row) => {
      if (!row) return;
      const isOwner = row.task_type === "self"
        ? String(row.created_by_id) === String(currentUser?.id)
        : String(row.assigned_by_id) === String(currentUser?.id);
      if (!isOwner) {
        toast.info("Only the task owner can delete");
        return;
      }
      setDeleteTask(row);
    }, [currentUser?.id]),
    canDeleteSelection: useCallback(() => !!selected && isSelectedOwner, [selected, isSelectedOwner]),
    canEditSelection: useCallback(() => !!selected && isSelectedOwner, [selected, isSelectedOwner]),
    editBlockedMessage: "Select a task you own to edit",
    deleteBlockedMessage: "Select a task you own to delete",
  });

  const navigateToTask = useCallback((task) => {
    if (!task?.task_id) return;
    router.push(buildTaskDetailUrl(task.task_id), { scroll: false });
  }, [router]);

  const handleClone = useCallback((task) => {
    if (!task) return;
    setCloneTask({ ...task, status: "pending", completed_at: null });
  }, []);

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      if (tableContainerRef.current?.requestFullscreen) {
        tableContainerRef.current.requestFullscreen();
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  usePersistedScroll(cardScrollRef, "tasksCardScrollTop", viewMode === "card");

  const tabItems = useMemo(
    () => TABS.map((tab) => ({ id: tab.key, label: tab.label, icon: tab.icon })),
    [],
  );

  const extraFilters = useMemo(
    () => [
      {
        label: "Status",
        key: "status",
        value: statusFilter,
        preserveOrder: true,
        options: [
          { label: "All Status", value: "All" },
          ...TASK_STATUSES.map((s) => ({
            label: TASK_STATUS_CONFIG[s]?.label ?? s,
            value: s,
          })),
        ],
      },
      {
        label: "Priority",
        key: "priority",
        value: priorityFilter,
        preserveOrder: true,
        options: [
          { label: "All Priority", value: "All" },
          ...PRIORITIES.map((p) => ({
            label: PRIORITY_CONFIG[p]?.label ?? p,
            value: p,
          })),
        ],
      },
      {
        label: "Category",
        key: "category_id",
        value: categoryFilter,
        searchable: true,
        placeholder: "Search categories…",
        options: [
          { label: "All Categories", value: "All" },
          ...categoryOptions
            .filter((c) => c && (c.id != null || c.category_id != null))
            .map((c) => ({
              label: c.name || c.category_name || String(c.id ?? c.category_id),
              value: String(c.id ?? c.category_id),
            })),
        ],
      },
      {
        label: "Assigned By",
        key: "assigned_by_id",
        value: userFilter,
        searchable: true,
        placeholder: "Search users…",
        options: [
          { label: "All Users", value: "All" },
          ...userOptions
            .map(mapTaskUserToOption)
            .filter((u) => u?.id != null && u?.name)
            .map((u) => ({
              label: u.name,
              value: String(u.id),
            })),
        ],
      },
    ],
    [statusFilter, priorityFilter, categoryFilter, userFilter, categoryOptions, userOptions],
  );

  const HEADERS = useMemo(
    () =>
      buildTaskListHeaders({
        activeTab,
        currentUserId: currentUser?.id,
        quickFilter,
        statusFilter,
        canEdit,
        canDelete,
        onNavigate: navigateToTask,
        onEdit: openEditModal,
        onDelete: (t) => setDeleteTask(t),
        onClone: handleClone,
      }),
    [
      activeTab,
      currentUser?.id,
      quickFilter,
      statusFilter,
      canEdit,
      canDelete,
      navigateToTask,
      openEditModal,
      handleClone,
    ],
  );

  const exportHeaders = useMemo(() => buildTaskExportHeaders(), []);

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Tasks",
    rows: displayTasks,
    headers: exportHeaders,
  });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div
        ref={tableContainerRef}
        className={`bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden transition-all duration-300 ${
          isFullScreen ? "fixed inset-0 z-[999] h-screen w-screen" : ""
        }`}
      >
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                active={activeTab}
                onChange={(id) => {
                  setActiveTab(id);
                  setStatusFilter("All");
                  setPriorityFilter("All");
                  setCategoryFilter("All");
                  setUserFilter("All");
                  setQuickFilter(getDefaultQuickFilterForTab(id));
                  setSelected(null);
                }}
                tabs={tabItems}
              />
            }
            actions={
              <>
                <button
                  type="button"
                  onClick={() => { setEditTask(null); setSelfModal(true); }}
                  className="h-9 shrink-0 px-3 rounded-none border border-violet-300 bg-white text-violet-700 hover:bg-violet-50 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider shadow-none"
                >
                  <User size={14} /> Self Task
                </button>
                <button
                  type="button"
                  onClick={() => { setEditTask(null); setModalOpen(true); }}
                  title="Assign Task (Ctrl+Alt+N / Ctrl+N in app)"
                  className="h-9 shrink-0 px-3 rounded-none border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider shadow-none"
                >
                  <Plus size={14} /> Assign Task
                </button>
                <ActionButton
                  module={MODULE}
                  action="view"
                  variant="outline"
                  label="View"
                  icon={Eye}
                  disabled={!selectedRecord}
                  onClick={() => navigateToTask(selectedRecord)}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-slate-700 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="edit"
                  variant="outline"
                  label="Edit"
                  icon={Edit3}
                  disabled={!selectedRecord || !isSelectedOwner}
                  record={selectedRecord}
                  onClick={() => openEditModal(selectedRecord)}
                  title="Edit (Ctrl+Alt+E / Ctrl+E in app, F2)"
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <button
                  type="button"
                  disabled={!selectedRecord}
                  onClick={() => handleClone(selectedRecord)}
                  className="h-9 shrink-0 px-3 rounded-none border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider shadow-none"
                >
                  <Copy size={14} /> Clone
                </button>
                <ActionButton
                  module={MODULE}
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!selectedRecord || !isSelectedOwner}
                  onClick={() => setDeleteTask(selectedRecord)}
                  title="Delete (Ctrl+Alt+D / Ctrl+D in app, Delete)"
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={fetchTasks}
                  disabled={loading}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none inline-flex items-center justify-center disabled:opacity-60"
                  aria-label="Refresh"
                >
                  <RefreshCcw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
                </button>
                <button
                  type="button"
                  onClick={toggleFullScreen}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-none inline-flex items-center justify-center"
                  title={isFullScreen ? "Exit Fullscreen" : "Full Screen Mode"}
                >
                  {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
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
          <DateRangeFilter
            showDate={false}
            applyExtrasOnChange
            extraFilters={extraFilters}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search by title, description…"
            searchLabel="Quick Search"
            onApply={handleFilterApply}
            onReset={handleReset}
          />
        </ListPageFilterStrip>

        <div className="shrink-0 px-3 py-2 border-b border-slate-200 bg-slate-50/80">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {STAT_CARDS.map(({ key, label, icon, bg, text, border, barColor }) => (
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

        {activeFilterLabel && (
          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border-b border-indigo-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Showing: {activeFilterLabel}
            </span>
            <button
              type="button"
              onClick={clearActiveBannerFilter}
              className="ml-auto text-[11px] font-bold uppercase text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
            >
              <X size={12} /> Clear
            </button>
          </div>
        )}

        {selected && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 shrink-0">
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

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          {viewMode === "card" ? (
            <div ref={cardScrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar bg-slate-50/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {loading && visibleTasks.length === 0 ? (
                  <div className="col-span-4 py-16 text-center text-slate-400">
                    <Loader2 size={28} className="mx-auto mb-2 animate-spin text-indigo-500 opacity-60" />
                    <p className="text-sm">Loading tasks…</p>
                  </div>
                ) : displayTasks.length === 0 ? (
                  <div className="col-span-4 py-16 text-center">
                    <EmptyState activeTab={activeTab} hasFilter={hasFilter} onReset={handleReset} />
                  </div>
                ) : (
                  visibleTasks.map((task) => (
                    <TaskCard
                      key={task.task_id}
                      task={task}
                      selected={String(selected) === String(task.task_id)}
                      onSelect={(t) => setSelected(t?.task_id ?? null)}
                      onEdit={openEditModal}
                      onDelete={(t) => setDeleteTask(t)}
                      onClone={handleClone}
                      rowMeta={getRowMeta(task, activeTab, currentUser?.id, quickFilter, statusFilter)}
                    />
                  ))
                )}
              </div>
              {!loading && hasMore && (
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
              data={visibleTasks}
              loading={loading}
              viewMode="table"
              showSelection
              idKey="task_id"
              getRowId={(row) => row.task_id}
              selectedId={selected}
              onSelect={setSelected}
              emptyIcon={Plus}
              emptyMessage="No tasks found"
              sortKey={sortKey}
              sortDir={sortDir}
              getRowClassName={getTaskDataTableRowClassName}
              onSort={(key) => {
                if (key === "_actions") return;
                setDisplayLimit(DISPLAY_CHUNK);
                if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                else { setSortKey(key); setSortDir("asc"); }
              }}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              totalItems={displayCount}
              allowCopy
              onRowDoubleClick={(row) => navigateToTask(row)}
              hotkeysDisabled={tableHotkeyProps.hotkeysDisabled}
            />
          )}
        </div>

        <div className="px-3 py-1.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
            {COLOR_LEGEND.map(({ label, barColor }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: barColor }} />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{label}</span>
              </div>
            ))}
          </div>
          <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
            Showing {visibleTasks.length} of {displayCount}
            {serverTotal > displayCount ? ` · ${serverTotal} total` : ""}
          </span>
        </div>
      </div>

      <TaskModal
        open={modalOpen} onClose={closeAssignModal} onSuccess={fetchTasks}
        editTask={editTask} taskType="assigned" currentUser={currentUser}
      />
      <TaskModal
        open={selfModal} onClose={closeSelfModal}
        onSuccess={() => { closeSelfModal(); fetchTasks(); }}
        editTask={editTask} taskType="self" currentUser={currentUser}
      />
      <TaskModal
        open={!!cloneTask} onClose={() => setCloneTask(null)}
        onSuccess={() => { setCloneTask(null); fetchTasks(); }}
        editTask={null} prefillTask={cloneTask}
        taskType={cloneTask?.task_type ?? "assigned"} currentUser={currentUser}
      />
      <DeleteModal
        item={deleteTask} onClose={() => setDeleteTask(null)}
        onSuccess={() => { setSelected(null); fetchTasks(); }}
        service={taskService}
        entityLabel="Task" idKey="task_id" nameKey="title"
        warningMessage="This action cannot be undone. All notes, attachments and activity logs will also be deleted."
      />
    </div>
  );
}
