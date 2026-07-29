export const DASHBOARD_DB_SOURCE_OPTIONS = [
  { value: "ims_postgresql", label: "PostgreSQL" },
  { value: "erp_mssql", label: "SQL Server (ERP)" },
  { value: "hrms_mssql", label: "SQL Server (HRMS)" },
  { value: "hybrid", label: "Hybrid" },
];

const EXTERNAL_MSSQL_SOURCES = new Set(["erp_mssql", "hrms_mssql"]);

export function isExternalMssqlDbSource(source = "") {
  return EXTERNAL_MSSQL_SOURCES.has(String(source || "").trim().toLowerCase());
}

export function isHybridDbSource(source = "") {
  return String(source || "").trim().toLowerCase() === "hybrid";
}

export function resolveHybridExternalDbSource(widget = {}) {
  const fromConfig = String(widget?.chart_config?.hybrid_external_source || "").trim().toLowerCase();
  if (isExternalMssqlDbSource(fromConfig)) return fromConfig;
  const legacySource = String(widget?.chart_config?.data_source || widget?.dataSource || "").trim().toLowerCase();
  if (isExternalMssqlDbSource(legacySource)) return legacySource;
  return "erp_mssql";
}

export function isWidgetHybridMode(widget = {}) {
  return isHybridDbSource(widget?.dataSource) || widget?.chart_config?.is_hybrid === true || String(widget?.rawType || "").toLowerCase() === "hybrid";
}

export function externalMssqlRequestedData(source = "erp_mssql") {
  return String(source || "erp_mssql").trim().toLowerCase();
}

export const EXTERNAL_MSSQL_QUERY_PLACEHOLDER = "SELECT col1, col2 FROM your_table WHERE your_column >= {{fromDate}} AND your_column <= {{toDate}} AND fyuid = {{fyuid}}";
