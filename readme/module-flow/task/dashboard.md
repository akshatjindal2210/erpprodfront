# Dashboard

Task home (charts, reminders, recent). Hidden from plain users when `HIDE_DASHBOARD_FROM_USERS` is true.

|               |                                                                         |
|---------------|-------------------------------------------------------------------------|
| UI            | `/task/dashboard`                                                       |
| Permission    | none (role filter in `appConfig.js`)                                    |
| FE            | `manage/dashboard/`                                                     |
| BE            | none (uses core stats + activity)                                       |
| API           | `GET /api/core/auth/stats`, `GET /api/core/activity-logs?app_type=task` |
| Table         | reads `mst_users`, `mst_activity_logs`                                  |

**Files**

|               |                                                                              |
|---------------|------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/task/manage/dashboard/Page.js`                            |
| BE            | `backend/src/apps/core/identity/users/` (`getUserStats`), core activity-logs |

**CRUD**

|               |            |
|---------------|------------|
| Create        | none       |
| Read          | list / get |
| Update        | none       |
| Delete        | none       |

**Linking**

Read-only. No Task writes.

**Table impact**

| Action        | Writes      |
|---------------|-------------|
| Read          | SELECT only |
