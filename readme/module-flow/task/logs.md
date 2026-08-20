# Logs

Task activity browser (`app_type=task`). Navbar can show to all; `NAVBAR_PAGES` restricts to super admin.

|               |                                      |
|---------------|--------------------------------------|
| UI            | `/task/dashboard/logs`               |
| Permission    | `logs`                               |
| FE            | `manage/logs/`                       |
| BE            | core activity-logs (not `/api/task`) |
| API           | `GET /api/core/activity-logs`        |
| Table         | `mst_activity_logs`                  |

**Files**

|               |                                              |
|---------------|----------------------------------------------|
| FE            | `frontend/src/apps/task/manage/logs/Page.js` |
| BE            | `backend/src/apps/core/activity-logs/`       |

**CRUD**

|               |                                                |
|---------------|------------------------------------------------|
| Create        | side effect of other modules (not this screen) |
| Read          | search, dates, page, `all_users`               |
| Update        | none                                           |
| Delete        | none                                           |

**Linking**

Logs survive entity hard-delete. `user_id` SET NULL if user row is hard-deleted.

**Table impact**

| Action        | Writes      |
|---------------|-------------|
| This screen   | SELECT only |
