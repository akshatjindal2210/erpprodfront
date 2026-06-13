"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Loader2, LayoutGrid, List, X, Minimize2, Maximize2 } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import {
  taskService,
  categoryService,
  StatCard,
  SearchBar,
  Pagination,
  DeleteModal,
  useViewMode,
  usePersistedScroll,
  TABS,
  TABLE_COLS,
  STAT_CARDS,
  COLOR_LEGEND,
  QUICK_FILTER_LABELS,
  buildReportTaskListApiParams,
  applyReportDisplayTaskFilter,
  getRowMeta,
  getActiveStatKey,
  SortIcon,
  EmptyState,
  TaskCard,
  useReportFilters,
  TaskFilterButtons,
  TaskFilterPanel,
  BulkActionBar,
} from "@/features/apps/task/common";

import TaskModal    from "@/features/apps/task/components/tasks/TaskModal";
import TaskTableRow from "@/features/apps/task/components/tasks/TaskTableRow";

import ReportFilters from "@/features/apps/task/components/reports/ReportFilters";
import { ReassignModal } from "../tasks/SubPageExtra";

export default function ReportPage({ reportPage }) {
  const currentUser = useSelector((state) => state.auth.user);

  // ── Original state ────────────────────────────────────────────────────────
  const [tasks,       setTasks]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [totalItems,  setTotalItems]  = useState(0);
  const [categories,  setCategories]  = useState([]);
  const [viewMode,    handleViewMode] = useViewMode();
  const [stats,       setStats]       = useState({
    open_tasks: 0, updated_tasks: 0,
    total: 0, pending: 0, in_progress: 0, completed: 0,
    action_required: 0, creator_pending: 0,
    overdue: 0, new_today: 0, reminder: 0, upcoming_due: 0,
  });

  const [activeTab,      setActiveTab]      = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("report_filter_active_tab") || "assigned_to_me";
    }
    return "assigned_to_me";
  });
  const [search,         setSearch]         = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("report_filter_search") || "";
    }
    return "";
  });
  const [statusFilter,   setStatusFilter]   = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("report_filter_status") || "All";
    }
    return "All";
  });
  const [priorityFilter, setPriorityFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("report_filter_priority") || "All";
    }
    return "All";
  });
  const [categoryFilter, setCategoryFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("report_filter_category") || "All";
    }
    return "All";
  });
  const [quickFilter,    setQuickFilter]    = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("report_filter_quick") || "action_required";
    }
    return "action_required";
  });
  const [page,           setPage]           = useState(() => {
    if (typeof window !== "undefined") {
      return parseInt(sessionStorage.getItem("report_filter_page") || "1");
    }
    return 1;
  });
  const [pageSize,       setPageSize]       = useState(() => {
    if (typeof window !== "undefined") {
      return parseInt(sessionStorage.getItem("report_filter_page_size") || "10");
    }
    return 10;
  });
  const [sortKey,        setSortKey]        = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("report_filter_sort_key") || "task_id";
    }
    return "task_id";
  });
  const [sortDir,        setSortDir]        = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("report_filter_sort_dir") || "desc";
    }
    return "desc";
  });
  const [showFilters,    setShowFilters]    = useState(false);

  const [cloneTask,  setCloneTask]  = useState(null);
  const [selected,   setSelected]   = useState([]);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [selfModal,  setSelfModal]  = useState(false);
  const [editTask,   setEditTask]   = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);

  const {
    selectedAssignedBy,
    setSelectedAssignedBy,
    selectedDepartment,
    setSelectedDepartment,
    selectedUser,
    setSelectedUser,
    departmentsLists,
    filteredUsers,
    teamMemberOptions,
    assignedByOptions,
    departmentOptions,
    showDepartmentDropdown,
    showAssignedByDropdown,
    showTeamMemberDropdown,
    clearFilters,
  } = useReportFilters(currentUser);

  // Sync state to sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("report_filter_active_tab", activeTab);
      sessionStorage.setItem("report_filter_search", search);
      sessionStorage.setItem("report_filter_status", statusFilter);
      sessionStorage.setItem("report_filter_priority", priorityFilter);
      sessionStorage.setItem("report_filter_category", categoryFilter);
      sessionStorage.setItem("report_filter_quick", quickFilter || "");
      sessionStorage.setItem("report_filter_page", page.toString());
      sessionStorage.setItem("report_filter_page_size", pageSize.toString());
      sessionStorage.setItem("report_filter_sort_key", sortKey);
      sessionStorage.setItem("report_filter_sort_dir", sortDir);
    }
  }, [activeTab, search, statusFilter, priorityFilter, categoryFilter, quickFilter, page, pageSize, sortKey, sortDir]);

  // ── Load categories ───────────────────────────────────────────────────────
  useEffect(() => {
    categoryService.getAll({ limit: 200 })
      .then((res) => {
        const raw = res.data?.data?.items ?? res.data?.data ?? res.data ?? [];
        setCategories(Array.isArray(raw) ? raw : []);
      })
      .catch(() => {});
  }, []);

  // ── Fetch tasks ───────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    if (!currentUser?.id) {
      setTasks([]);
      setTotalItems(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const filterState = {
        activeTab,
        search,
        statusFilter,
        priorityFilter,
        categoryFilter,
        quickFilter,
        sortKey,
        sortDir,
        selectedAssignedBy,
        selectedDepartment,
        selectedUser,
      };
      const params = buildReportTaskListApiParams(filterState, currentUser, {
        page,
        limit: pageSize,
      });

      const res       = await taskService.getAll(params);
      const raw       = res.data?.data?.items ?? res.data?.data ?? res.data ?? [];
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
  }, [page, pageSize, search, statusFilter, priorityFilter, categoryFilter, sortKey, sortDir, activeTab, quickFilter, selectedAssignedBy, selectedDepartment, selectedUser, currentUser]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ── Display tasks ─────────────────────────────────────────────────────────
  const displayTasks = useMemo(() => {
    return applyReportDisplayTaskFilter(tasks, { statusFilter, quickFilter });
  }, [tasks, statusFilter, quickFilter]);

  // ── Derived UI ────────────────────────────────────────────────────────────
  const displayCount  = activeTab === "action_required" ? displayTasks.length : totalItems;
  const totalPages    = Math.max(1, Math.ceil(displayCount / pageSize));
  const hasFilter     = statusFilter !== "All" || priorityFilter !== "All" || categoryFilter !== "All" || !!quickFilter || !!selectedAssignedBy || !!selectedDepartment || !!selectedUser;
  const activeStatKey = getActiveStatKey(quickFilter, statusFilter, activeTab);

  const activeFilterLabel = useMemo(() => {
    if (quickFilter)                            return QUICK_FILTER_LABELS[quickFilter];
    if (statusFilter && statusFilter !== "All") return QUICK_FILTER_LABELS[statusFilter];
    return null;
  }, [quickFilter, statusFilter]);

  const statCardCls = (key) => activeStatKey === key ? "shadow-[0_8px_16px_-4px_rgba(0,0,0,0.15)] -translate-y-0.5" : "hover:shadow-sm hover:scale-[1.01]";

  // ── Filter helpers ────────────────────────────────────────────────────────
  const clearAllFilters = () => {
    setQuickFilter(null); setStatusFilter("All");
    setPriorityFilter("All"); setCategoryFilter("All");
  };

  const clearPanelFilters = () => {
    setStatusFilter("All");
    setPriorityFilter("All");
    setCategoryFilter("All");
    setSelectedAssignedBy("");
    setSelectedUser("");
    setPage(1);
  };

  const handleStatClick = (key) => {
    setPage(1);
    setQuickFilter(null);
    setStatusFilter("All");
    setPriorityFilter("All");
    setCategoryFilter("All");
    if (key === "total")       { setQuickFilter("total"); return; }
    if (key === "pending")     { setStatusFilter("pending");     return; }
    if (key === "in_progress") { setStatusFilter("in_progress"); return; }
    if (key === "completed")   { setStatusFilter("completed");   return; }
    setQuickFilter(key);
  };

  const handleReset = () => {
    setSearch(""); setSortKey("task_id"); setSortDir("desc"); setPage(1);
    clearAllFilters();
    setActiveTab("assigned_to_me");
    setQuickFilter(getDefaultQuickFilterForTab("assigned_to_me"));
    
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("report_filter_active_tab");
      sessionStorage.removeItem("report_filter_search");
      sessionStorage.removeItem("report_filter_status");
      sessionStorage.removeItem("report_filter_priority");
      sessionStorage.removeItem("report_filter_category");
      sessionStorage.removeItem("report_filter_quick");
      sessionStorage.removeItem("report_filter_page");
      sessionStorage.removeItem("report_filter_page_size");
      sessionStorage.removeItem("report_filter_sort_key");
      sessionStorage.removeItem("report_filter_sort_dir");
    }
  };

  const clearActiveBannerFilter = () => {
    if (activeTab === "all") setActiveTab("assigned_to_me");
    setQuickFilter(null);
    setStatusFilter("All");
    setPage(1);
  };

  // ── Sort ──────────────────────────────────────────────────────────────────
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  // ── Select / bulk ─────────────────────────────────────────────────────────
  const allSelected = displayTasks.length > 0 &&
    displayTasks.every((t) => selected.includes(t.task_id));

  const toggleAll = () => setSelected(
    allSelected
      ? selected.filter((id) => !displayTasks.find((t) => t.task_id === id))
      : [...new Set([...selected, ...displayTasks.map((t) => t.task_id)])]
  );

  const toggleOne = (id) => setSelected((s) =>
    s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
  );

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selected.map((id) => taskService.delete(id)));
      toast.success(`${selected.length} tasks deleted`);
      setSelected([]); fetchTasks();
    } catch {
      toast.error("Some deletions failed");
    }
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openEditModal    = (task) => {
    if (task.task_type === "self") { setEditTask(task); setSelfModal(true); }
    else                           { setEditTask(task); setModalOpen(true); }
  };
  const closeAssignModal = () => { setModalOpen(false); setEditTask(null); };
  const closeSelfModal   = () => { setSelfModal(false); setEditTask(null); };

  // State for modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedTaskForReassign, setSelectedTaskForReassign] = useState(null);
  const [loadingReassign, setLoadingReassign] = useState(false);
  const getDefaultQuickFilterForTab = () => "action_required";

  // Example submit handler
  const handleReassignSubmit = async ({ reassign_to }) => {
    if (!selectedTaskForReassign) return;

    setLoadingReassign(true);
    try {
      // Call API to reassign the task
      await taskService.reassignTask(selectedTaskForReassign.task_id, { old:selectedUser, new :reassign_to, });

      console.log(
        "Task reassigned successfully:",
        selectedTaskForReassign.task_id,
        "to user:",
        reassign_to
      );

      setReassignModalOpen(false);
      setSelectedTaskForReassign(null);

      // Optionally refresh table or show a toast
      toast.success("Task reassigned successfully");
      fetchTasks();
    } catch (error) {
      // console.error("Failed to reassign task:", error);
      toast.error("Failed to reassign task",error);
    } finally {
      setLoadingReassign(false);
    }
  };

  // When opening modal (for example in TaskTableRow onReassign)
  const handleOpenReassignModal = (task) => {
    setSelectedTaskForReassign(task);
    setReassignModalOpen(true);
  };

  
  // Table Full Screen Mode
  const tableContainerRef = useRef(null);
  const cardScrollRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      if (tableContainerRef.current?.requestFullscreen) {
        tableContainerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Listen for Esc key or closing fullscreen
  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  usePersistedScroll(cardScrollRef, "reportCardScrollTop", viewMode === "card");

  
  // ── Render ────────────────────────────────────────────────────────────────
  const onDepartmentChange = (id) => {
    setSelectedDepartment(id);
    setSelectedUser(""); // Clear user when department changes
    setPage(1);
  };

  return (
    <div className="p-4 md:p-6 bg-slate-100 min-h-screen text-slate-800">

      {/* ReportFilters component */}
      <ReportFilters
        currentUser={currentUser}
        departmentsLists={departmentOptions}
        filteredUsers={filteredUsers}
        teamMemberOptions={teamMemberOptions}
        assignedByOptions={assignedByOptions}
        selectedAssignedBy={selectedAssignedBy}
        selectedDepartment={selectedDepartment}
        selectedUser={selectedUser}
        showDepartmentDropdown={showDepartmentDropdown}
        showAssignedByDropdown={showAssignedByDropdown}
        showTeamMemberDropdown={showTeamMemberDropdown}
        onAssignedByChange={(id) => { setSelectedAssignedBy(id); setPage(1); }}
        onDepartmentChange={onDepartmentChange}
        onUserChange={(id) => { setSelectedUser(id); setPage(1); }}
        onClearAll={() => clearFilters(() => setPage(1))}
      />

      {/* Stat Cards — 6 per row */}
      <div className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {STAT_CARDS.map(({ key, label, icon, bg, text, border, barColor }) => (
            <div key={key} onClick={() => handleStatClick(key)}
              className={`cursor-pointer transition-all rounded-2xl ${statCardCls(key)}`}>
              <StatCard label={label} value={stats[key] ?? 0}
                icon={icon} iconBg={bg} iconText={text}
                borderColor={border} barColor={barColor}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Quick filter banner */}
      {activeFilterLabel && (
        <div className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
          <span className="text-xs font-semibold text-indigo-700">Showing: {activeFilterLabel}</span>
          <button onClick={clearActiveBannerFilter}
            className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1">
            <X size={12} /> Clear
          </button>
        </div>
      )}

      {/* Main Card */}

      <div 
        ref={tableContainerRef}
        className={`bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all duration-300 ${
          isFullScreen ? "fixed inset-0 z-[999] rounded-none h-screen w-screen" : "max-h-[calc(100vh-40px)] md:max-h-[calc(100vh-60px)]"
          // isFullScreen ? "fixed inset-0 z-[999] rounded-none h-screen w-screen" : "max-h-[calc(100vh-200px)] md:max-h-[calc(100vh-250px)]"
        }`}
      >

        <div className="flex flex-col h-full overflow-hidden">

          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 space-y-3 flex-shrink-0 bg-white z-[10]">
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-full overflow-x-auto flex-nowrap lg:flex-wrap">
              {TABS.map((tab) => (
                <button key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setPage(1);
                    setStatusFilter("All");
                    setPriorityFilter("All");
                    setCategoryFilter("All");
                    setQuickFilter(getDefaultQuickFilterForTab(tab.key));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              <div className="flex-1 min-w-0">
                <SearchBar value={search}
                  onChange={(val) => { setSearch(val); setPage(1); }}
                  placeholder="Search by title, description…"
                />
              </div>
              
              <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 sm:gap-3">
                <TaskFilterButtons
                  showFilters={showFilters}
                  onToggleFilters={() => setShowFilters((v) => !v)}
                  hasActiveFilter={hasFilter}
                  onRefresh={fetchTasks}
                  onReset={handleReset}
                />
                
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shrink-0 shadow-sm self-end sm:self-auto">
                  <button
                    onClick={() => handleViewMode("table")}
                    className={`px-3 py-2.5 transition-all ${viewMode === "table" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
                    title="Table view">
                      <List size={15} />
                  </button>
                  
                  <div className="w-px h-5 bg-slate-200" />
                  
                  <button
                    onClick={() => handleViewMode("card")}
                    className={`px-3 py-2.5 transition-all ${viewMode === "card" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
                    title="Card view">
                      <LayoutGrid size={15} />
                  </button>
                  
                  <div className="w-px h-5 bg-slate-200" />
                  
                  <button
                    onClick={toggleFullScreen}
                    className="px-3 py-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all"
                    title={isFullScreen ? "Exit Fullscreen" : "Full Screen Mode"}
                  >
                    {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {showFilters && (
              <TaskFilterPanel
                statusFilter={statusFilter}
                onStatusChange={(s) => { setStatusFilter(s); setQuickFilter(null); setPage(1); }}
                priorityFilter={priorityFilter}
                onPriorityChange={(p) => { setPriorityFilter(p); setPage(1); }}
                categoryFilter={categoryFilter}
                onCategoryChange={(c) => { setCategoryFilter(c); setPage(1); }}
                userFilter={selectedAssignedBy || "All"}
                onUserChange={(u) => { setSelectedAssignedBy(u === "All" ? "" : u); setPage(1); }}
                categories={categories}
                onReset={clearPanelFilters}
              />
            )}

            <BulkActionBar
              count={selected.length}
              onBulkDelete={handleBulkDelete}
              onClearSelection={() => setSelected([])}
            />
          </div>

          {/* Table View */}
          {viewMode === "table" ? (
            // <div className="flex-1 overflow-auto relative">
            <div className="flex-1 overflow-auto relative h-[600px] border border-slate-200 rounded-lg">
              <table className="w-full text-sm min-w-[1100px] border-separate border-spacing-0">
                <thead className="sticky top-0 z-[5] shadow-sm">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-1 p-0 sticky left-0 z-[5] bg-slate-50 border-b border-slate-200" />
                    <th className="px-4 py-3 w-10 sticky left-1 z-[5] bg-slate-50 border-b border-slate-200">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer" />
                    </th>
                    {TABLE_COLS.map(({ label, key }, i) => (
                      <th key={key} onClick={() => toggleSort(key)}
                        className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 transition-colors select-none whitespace-nowrap border-b border-slate-200 ${
                          i === 0
                            ? "sticky left-[42px] z-[5] bg-slate-50 border-r"
                            : "bg-slate-50"
                        }`}
                        >
                        {label}
                        <SortIcon sortKey={sortKey} columnKey={key} sortDir={sortDir} />
                      </th>
                    ))}
                    <th className="px-3 py-3 w-28 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky right-0 z-[5] bg-slate-50 border-l border-slate-200 border-b">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={TABLE_COLS.length + 3} className="py-16 text-center text-slate-400">
                      <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-40" />
                      <p className="text-sm">Loading tasks…</p>
                    </td></tr>
                  ) : displayTasks.length === 0 ? (
                    <tr><td colSpan={TABLE_COLS.length + 3} className="py-16 text-center">
                      <EmptyState activeTab={activeTab} hasFilter={hasFilter} onReset={handleReset} />
                    </td></tr>
                  ) : (
                    displayTasks.map((task, i) => (
                      <TaskTableRow
                        key={task.task_id} task={task}
                        index={(page - 1) * pageSize + i + 1}
                        isSelected={selected.includes(task.task_id)}
                        onToggle={toggleOne} onEdit={openEditModal}
                        onDelete={(t) => setDeleteTask(t)}
                        onClone={(t) => setCloneTask({ ...t, status: "pending", completed_at: null })}
                        rowMeta={getRowMeta(task, activeTab, currentUser?.id, quickFilter, statusFilter)}
                        columns={TABLE_COLS} showFullTitle
                        reportPage={selectedUser}
                        report={true}
                        onReassign={handleOpenReassignModal}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div ref={cardScrollRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar"> 
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {loading ? (
                  <div className="col-span-4 py-16 text-center text-slate-400">
                    <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-40" />
                    <p className="text-sm">Loading tasks…</p>
                  </div>
                ) : displayTasks.length === 0 ? (
                  <div className="col-span-4 py-16 text-center">
                    <EmptyState activeTab={activeTab} hasFilter={hasFilter} onReset={handleReset} />
                  </div>
                ) : (
                  displayTasks.map((task) => (
                    <TaskCard key={task.task_id} task={task}
                      onEdit={openEditModal}
                      onDelete={(t) => setDeleteTask(t)}
                      onClone={(t) => setCloneTask({ ...t, status: "pending", completed_at: null })}
                      rowMeta={getRowMeta(task, activeTab, currentUser?.id, quickFilter, statusFilter)}
                      report
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Pagination */}
          <Pagination page={page} totalPages={totalPages} pageSize={pageSize}
            totalItems={displayCount}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />

          {/* Color Legend */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {COLOR_LEGEND.map(({ label, barColor }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: barColor }} />
                  <span className="text-[11px] text-slate-500 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Modals */}
      <TaskModal open={modalOpen} onClose={closeAssignModal} onSuccess={fetchTasks}
        editTask={editTask} taskType="assigned" currentUser={currentUser} />
      <TaskModal open={selfModal} onClose={closeSelfModal}
        onSuccess={() => { closeSelfModal(); fetchTasks(); }}
        editTask={editTask} taskType="self" currentUser={currentUser} />
      <TaskModal open={!!cloneTask} onClose={() => setCloneTask(null)}
        onSuccess={() => { setCloneTask(null); fetchTasks(); }}
        editTask={null} prefillTask={cloneTask}
        taskType={cloneTask?.task_type ?? "assigned"} currentUser={currentUser} />
      <DeleteModal item={deleteTask} onClose={() => setDeleteTask(null)}
        onSuccess={fetchTasks} service={taskService}
        entityLabel="Task" idKey="task_id" nameKey="title"
        warningMessage="This action cannot be undone. All notes, attachments and activity logs will also be deleted." />
      <ReassignModal
        open={reassignModalOpen}
        onClose={() => {
          setReassignModalOpen(false);
          setSelectedTaskForReassign(null);
        }}
        users={filteredUsers}
        loading={loadingReassign}
        onSubmit={handleReassignSubmit}
      />
    </div>
  );
}

