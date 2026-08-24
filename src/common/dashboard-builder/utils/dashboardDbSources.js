export const DASHBOARD_DB_SOURCE_OPTIONS = [
  { value: "ims_postgresql", label: "PostgreSQL" },
  { value: "erp_mssql", label: "SQL Server (ERP)" },
  { value: "hrms_mssql", label: "SQL Server (HRMS)" },
  { value: "hybrid", label: "Hybrid" },
  { value: "url_json", label: "URL" },
];

/** Options for Hybrid Step 1 — EXTERNAL DATABASE (not the top-level Database dropdown). */
export const HYBRID_EXTERNAL_DB_OPTIONS = [
  { value: "erp_mssql", label: "SQL Server (ERP)" },
  { value: "hrms_mssql", label: "SQL Server (HRMS)" },
  { value: "url_json", label: "URL" },
];

const EXTERNAL_MSSQL_SOURCES = new Set(["erp_mssql", "hrms_mssql"]);

export function isExternalMssqlDbSource(source = "") {
  return EXTERNAL_MSSQL_SOURCES.has(String(source || "").trim().toLowerCase());
}

export function isHybridDbSource(source = "") {
  return String(source || "").trim().toLowerCase() === "hybrid";
}

export function isUrlJsonDbSource(source = "") {
  return String(source || "").trim().toLowerCase() === "url_json";
}

/** Hybrid Step 1 external source = URL (feeds {{temp_erp_data}}, not standalone URL mode). */
export function isHybridUrlExternalSource(source = "") {
  return isUrlJsonDbSource(source);
}

export function resolveHybridExternalDbSource(widget = {}) {
  const fromConfig = String(widget?.chart_config?.hybrid_external_source || "").trim().toLowerCase();
  if (isExternalMssqlDbSource(fromConfig) || isHybridUrlExternalSource(fromConfig)) return fromConfig;
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

/** Payload for hybrid-preview API — MSSQL Step 1 or URL Step 1. */
export function buildHybridPreviewRequest(widget = {}, { pgQuery, filters = {}, stageOnly = false } = {}) {
  const externalSource = resolveHybridExternalDbSource(widget);
  const base = {
    db_source: externalSource,
    filters,
    stage_only: stageOnly === true,
    ...(pgQuery ? { pg_query: pgQuery } : {}),
  };
  if (isHybridUrlExternalSource(externalSource)) {
    return {
      ...base,
      url: String(widget?.chart_config?.hybrid_url || "").trim(),
      url_method: widget?.chart_config?.hybrid_url_method || "GET",
      url_body: widget?.chart_config?.hybrid_url_body || "",
    };
  }
  return {
    ...base,
    mssql_query: widget?.chart_config?.hybrid_mssql_query || "",
  };
}
