/**
 * Session-scoped list filters (Tasks vs Report — separate keys).
 * Survive in-app navigation (detail → back); clear on Reset or browser/app close.
 */

function canUseSession() {
  return typeof window !== "undefined";
}

export function readSessionString(key, fallback = "") {
  if (!canUseSession()) return fallback;
  try {
    const v = sessionStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function writeSessionString(key, value) {
  if (!canUseSession()) return;
  try {
    sessionStorage.setItem(key, value == null ? "" : String(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSessionKeys(keys) {
  if (!canUseSession()) return;
  try {
    (Array.isArray(keys) ? keys : Object.values(keys)).forEach((k) => {
      sessionStorage.removeItem(k);
    });
  } catch {
    /* ignore */
  }
}

/** Tasks list page — independent from Report */
export const TASK_FILTER_SS = {
  activeTab: "task_filter_active_tab",
  search: "task_filter_search",
  status: "task_filter_status",
  priority: "task_filter_priority",
  category: "task_filter_category",
  user: "task_filter_assigned_by",
  department: "task_filter_department",
  designation: "task_filter_designation",
  assignedTo: "task_filter_assigned_to",
  quick: "task_filter_quick",
  sortKey: "task_filter_sort_key",
  sortDir: "task_filter_sort_dir",
};

/** Task Report list page */
export const REPORT_FILTER_SS = {
  activeTab: "report_filter_active_tab",
  search: "report_filter_search",
  status: "report_filter_status",
  priority: "report_filter_priority",
  category: "report_filter_category",
  quick: "report_filter_quick",
  sortKey: "report_filter_sort_key",
  sortDir: "report_filter_sort_dir",
  page: "report_filter_page",
  pageSize: "report_filter_page_size",
  assignedBy: "report_filter_assigned_by",
  department: "report_filter_department",
  designation: "report_filter_designation",
  user: "report_filter_user",
};

/** quickFilter: missing key → default; stored "" → null */
export function readQuickFilterSession(key, defaultValue = "action_required") {
  if (!canUseSession()) return defaultValue;
  try {
    const v = sessionStorage.getItem(key);
    if (v == null) return defaultValue;
    if (v === "") return null;
    return v;
  } catch {
    return defaultValue;
  }
}
