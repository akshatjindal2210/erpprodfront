# Hybrid Query (TEMP Tables)

Professional reference for the **Hybrid** data source in Dashboard Builder: merge **external SQL Server (ERP / HRMS)** with **internal PostgreSQL** using a session-scoped temporary table `temp_erp_data`.

---

## 1. Overview

| Item | Detail |
|------|--------|
| Where | Widget Builder → Page Access → **Database: Hybrid** |
| First DB | External MSSQL via IMS API (`erp_mssql` / `hrms_mssql`) |
| Second DB | Internal PostgreSQL (local tables + merge SQL) |
| Staging | PostgreSQL `CREATE TEMP TABLE temp_erp_data … ON COMMIT DROP` |
| Isolation | Per request / session — concurrent users never share TEMP data |
| Cleanup | Automatic on `COMMIT` or `ROLLBACK` |

---

## 2. End-to-end flow

```text
1. Builder Step 1 — Preview External
   → Fetch from ERP/MSSQL
   → Return column names + sample rows to the UI
   → Do NOT create or insert into a TEMP table

2. Builder Step 2 — Run Merge / Publish / Live dashboard
   → Fetch full ERP/MSSQL result again
   → Open one PostgreSQL transaction (single connection):
        CREATE TEMP TABLE temp_erp_data (…) ON COMMIT DROP
        INSERT all ERP rows
        Run merge SQL ({{temp_erp_data}} → temp_erp_data)
   → COMMIT → TEMP table is dropped automatically
   → Return full merge result to the UI
```

| Step | Fetch ERP? | Write to TEMP / DB? |
|------|------------|---------------------|
| **Step 1** | Yes | **No** — UI preview only (columns + sample) |
| **Step 2** | Yes (full set again) | **Yes** — create, insert, merge, then drop |

---

## 3. Why Step 1 does not store data in TEMP / DB

PostgreSQL **temporary tables exist only for the lifetime of one database connection (session)**.

1. Step 1 is a single HTTP request. After the response, the pool connection is released.
2. When that connection ends, any TEMP table on it is destroyed (PostgreSQL rule).
3. Step 2 is a **new** HTTP request and usually a **different** connection — the Step 1 TEMP would not be visible.

If the server kept a connection open from Step 1 until the user clicked Step 2:

- Connection pool slots would stay blocked  
- Concurrent users would slow or stall the app  
- Timeouts or crashes would leave messy cleanup  

**Design choice:**

- **Step 1** — validate / preview only (“Is the ERP query correct? What columns exist?”)  
- **Step 2** — in one short transaction: create TEMP → insert → JOIN/UNION → drop  

A permanent staging table in Step 1 is possible but brings name collisions, orphaned tables, and cleanup risk. Session TEMP within a single merge request is simpler and safer.

---

## 4. Backend files

| File | Responsibility |
|------|----------------|
| `backend/src/apps/dashboard/utils/hybridQueryEngine.js` | Core engine: MSSQL fetch → `stageData()` (CREATE TEMP + INSERT) → merge SELECT → auto-drop |
| `backend/src/config/db.js` | `withTransaction()` — one client for the full TEMP lifecycle |
| `backend/src/apps/dashboard/utils/queryExecutor.js` | Live / published widgets: if `is_hybrid` → `HybridQueryEngine` |
| `backend/src/apps/dashboard/controllers/dashboard.controller.js` | `hybridPreviewHandler` (Step 1 / 2 API); dashboard load runs hybrid per widget |
| `backend/src/apps/dashboard/routes/index.js` | `POST /widgets/hybrid-preview` |
| `backend/src/apps/dashboard/utils/externalMssqlQuery.js` | IMS/MSSQL payload and runtime filter tokens |
| `backend/src/apps/dashboard/utils/sqlGenerator.js` | SELECT-only validation for merge SQL |
| `backend/src/apps/dashboard/utils/dashboardJsonSchema.js` | Persist / load hybrid fields in dashboard JSON |

**TEMP is created only in:** `hybridQueryEngine.js` → `HybridQueryEngine.stageData()`

---

## 5. Frontend files

| File | Responsibility |
|------|----------------|
| `frontend/src/features/dashboard-builder/components/PropertyPanel.js` | Hybrid UI: Step 1 ERP query, Step 2 PG merge + Run |
| `frontend/src/features/dashboard-builder/components/DashboardBuilder.js` | Preview / publish; must persist `chart_config` hybrid fields |
| `frontend/src/features/dashboard-builder/services/dashboardApi.js` | `hybridPreviewWidget()` → `/widgets/hybrid-preview` |
| `frontend/src/features/dashboard-builder/utils/dashboardDbSources.js` | Hybrid / ERP / HRMS source helpers |

---

## 6. Persisted widget fields

| Field | Purpose |
|-------|---------|
| `chart_config.is_hybrid` | Route execution through the hybrid engine |
| `chart_config.hybrid_mssql_query` | First DB (MSSQL) SQL |
| `chart_config.hybrid_external_source` | `erp_mssql` or `hrms_mssql` |
| `query` | PostgreSQL merge SQL using `{{temp_erp_data}}` |
| `dataSource` | `"hybrid"` |

---

## 7. Example SQL

**MSSQL (Step 1):**

```sql
SELECT OrderId, Amount FROM ErpOrders
WHERE DocDt >= {{fromDate}} AND DocDt <= {{toDate}}
```

**PostgreSQL (Step 2):**

```sql
SELECT t.*, p.name
FROM {{temp_erp_data}} t
LEFT JOIN local_products p ON p.id = t."OrderId"
```

At runtime, `{{temp_erp_data}}` is replaced with the session table name `temp_erp_data` after the TEMP table exists on that connection.

---

## 8. Operational notes

- **Concurrency:** Every request uses its own session TEMP; the shared name `temp_erp_data` does not collide across users.  
- **Data volume:** The full ERP result is staged and returned (no artificial row truncate). PostgreSQL statement timeout for hybrid work is 120 seconds.  
- **Publish:** Saves configuration only. Each live view re-runs: MSSQL → TEMP → merge → drop.
