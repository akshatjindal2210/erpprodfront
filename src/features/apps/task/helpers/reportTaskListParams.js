/**
 * Report list API params — same shape as ReportPage fetchTasks and task detail sidebar (report=true).
 */

export function readReportFilterStateFromSession() {
  if (typeof window === "undefined") return null;
  return {
    activeTab: sessionStorage.getItem("report_filter_active_tab") || "assigned_to_me",
    search: sessionStorage.getItem("report_filter_search") || "",
    statusFilter: sessionStorage.getItem("report_filter_status") || "All",
    priorityFilter: sessionStorage.getItem("report_filter_priority") || "All",
    categoryFilter: sessionStorage.getItem("report_filter_category") || "All",
    quickFilter: sessionStorage.getItem("report_filter_quick") || "",
    sortKey: sessionStorage.getItem("report_filter_sort_key") || "task_id",
    sortDir: sessionStorage.getItem("report_filter_sort_dir") || "desc",
    selectedAssignedBy: sessionStorage.getItem("report_filter_assigned_by") || "",
    selectedDepartment: sessionStorage.getItem("report_filter_department") || "",
    selectedUser: sessionStorage.getItem("report_filter_user") || "",
  };
}

/**
 * @param {object} filterState — from React state or readReportFilterStateFromSession()
 * @param {object} currentUser — auth user (needs id for create_by_me)
 * @param {{ page?: number, limit?: number }} [pagination]
 */
export function buildReportTaskListApiParams(filterState, currentUser, pagination = {}) {
  if (!filterState) {
    return { report: true, ...pagination };
  }

  const {
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
  } = filterState;

  const uid = currentUser?.id;
  const qf = quickFilter || null;

  return {
    ...pagination,
    search: search || undefined,
    status: statusFilter !== "All" ? statusFilter : undefined,
    priority: priorityFilter !== "All" ? priorityFilter : undefined,
    category_id: categoryFilter !== "All" ? categoryFilter : undefined,
    sortBy: `t.${sortKey}`,
    order: sortDir,

    action_required_today: qf === "action_required" ? true : undefined,
    view:
      activeTab === "assigned_to_me"
        ? "assigned_to"
        : activeTab === "assigned_by_me"
          ? "assigned_by"
          : activeTab === "create_by_me"
            ? "created"
            : undefined,
    created_by_id: activeTab === "create_by_me" ? uid : undefined,
    created_by: activeTab === "create_by_me" ? uid : undefined,
    task_type: activeTab === "self" ? "self" : undefined,
    include_closed: activeTab === "all" ? true : undefined,

    overdue: qf === "overdue" || undefined,
    new_today: qf === "new_today" || undefined,
    reminder: qf === "reminder" || undefined,
    upcoming_due: qf === "upcoming_due" || undefined,
    creator_pending: qf === "creator_pending" || undefined,

    assigned_by_id: selectedAssignedBy || undefined,
    department_id: selectedDepartment || undefined,
    user_id: selectedUser || undefined,
    report: true,
  };
}

/** Match ReportPage displayTasks client filter on the fetched list. */
export function applyReportDisplayTaskFilter(tasks, filterState) {
  if (!filterState || !Array.isArray(tasks)) return tasks || [];
  const { statusFilter, quickFilter } = filterState;
  if (statusFilter === "completed") return tasks;
  if (quickFilter === "action_required") {
    return tasks.filter((t) => t.status !== "completed");
  }
  return tasks;
}
