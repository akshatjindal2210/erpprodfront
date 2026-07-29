export const DASHBOARD_WIDGET_QUERY_PLACEHOLDER =
  "SELECT ... FROM ... WHERE created_at BETWEEN {{fromDate}} AND {{toDate}} AND user_id = {{userId}} AND fin_year_id = {{fyuid}}";

/** Runtime placeholders users can insert into widget SQL (replaced on preview / live). */
export const DASHBOARD_QUERY_RUNTIME_FILTERS = [
  {
    token: "{{fromDate}}",
    label: "From Date",
    hint: "Dashboard start date",
  },
  {
    token: "{{toDate}}",
    label: "To Date",
    hint: "Dashboard end date",
  },
  {
    token: "{{fyuid}}",
    label: "FY UID",
    hint: "Selected financial year ID",
  },
  {
    token: "{{userId}}",
    label: "User ID",
    hint: "Super admin user filter",
    superAdminOnly: true,
  },
];

export function getDashboardQueryRuntimeFilters({ canFilterByUser = false } = {}) {
  return DASHBOARD_QUERY_RUNTIME_FILTERS.filter(
    (entry) => !entry.superAdminOnly || canFilterByUser,
  );
}

export function isConfiguredWidgetQuery(query) {
  const normalized = String(query || "").trim();
  if (!normalized) return false;
  if (normalized === DASHBOARD_WIDGET_QUERY_PLACEHOLDER) return false;
  if (/SELECT\s+\.\.\.\s+FROM/i.test(normalized)) return false;
  return true;
}
