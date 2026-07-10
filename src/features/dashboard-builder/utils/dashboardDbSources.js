export const DASHBOARD_DB_SOURCE_OPTIONS = [
  { value: "ims_postgresql", label: "PostgreSQL" },
  { value: "erp_mssql", label: "SQL Server (ERP)" },
  { value: "hrms_mssql", label: "SQL Server (HRMS)" },
];

const EXTERNAL_MSSQL_SOURCES = new Set(["erp_mssql", "hrms_mssql"]);

export function isExternalMssqlDbSource(source = "") {
  return EXTERNAL_MSSQL_SOURCES.has(String(source || "").trim().toLowerCase());
}

export function externalMssqlRequestedData(source = "erp_mssql") {
  return String(source || "erp_mssql").trim().toLowerCase();
}

export const EXTERNAL_MSSQL_QUERY_PLACEHOLDER =
  "SELECT col1, col2 FROM your_table WHERE your_column >= {{fromDate}} AND your_column <= {{toDate}} AND fyuid = {{fyuid}}";
