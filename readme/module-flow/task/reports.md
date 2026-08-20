# Reports

Assigned-task report (same Tasks model with `report=true`). CL scoreboard is **CL Task Report**.

|               |                                                                  |
|---------------|------------------------------------------------------------------|
| UI            | `/task/dashboard/reports`                                        |
| Permission    | `task_report` (`canAccessTaskReport` / `TASK_REPORT_MENU_ROLES`) |
| FE            | `modules/reports/`                                               |
| BE            | same as Tasks                                                    |
| API           | `GET /api/task/tasks?report=true`                                |
| Table         | `task_tasks` (+ children)                                        |

**Files**

|               |                                                                            |
|---------------|----------------------------------------------------------------------------|
| FE            | `frontend/src/apps/task/modules/reports/ReportPage.js`, `ReportFilters.js` |
| BE            | `backend/src/apps/task/modules/tasks/`                                     |

**CRUD**

|               |                                          |
|---------------|------------------------------------------|
| Create        | none (no report row)                     |
| Read          | task list filtered for report            |
| Update        | reuses Tasks PUT                         |
| Delete        | **HARD** via Tasks DELETE (same cascade) |

**Linking**

Same as Tasks. This screen is not `POST /api/task/reports/` (that is CL Task Report).

**Table impact**

| Action          | Writes              |
|-----------------|---------------------|
| Read            | `task_tasks` SELECT |
| Update / Delete | same as Tasks       |
