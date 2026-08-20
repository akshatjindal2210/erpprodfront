# Activity Logs

Cross-module audit (`mst_activity_logs`, `app_type=rmstore`).

|               |                                                |
|---------------|------------------------------------------------|
| UI            | `/rmstore/dashboard/logs/activity`             |
| Permission    | `rm_activity_logs`                             |
| FE            | `modules/logs/ActivityLogPage.js`              |
| BE            | core activity-logs                             |
| API           | `GET /api/core/activity-logs?app_type=rmstore` |
| Table         | `mst_activity_logs`                            |

**Files**

|               |                                                                                              |
|---------------|----------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/logs/ActivityLogPage.js`                                  |
| BE            | `backend/src/apps/core/activity-logs/` (writers: `lib/utils/activity/logRmstoreActivity.js`) |

**CRUD**

|               |                              |
|---------------|------------------------------|
| Create        | side effect of other modules |
| Read          | list                         |
| Update        | none                         |
| Delete        | none                         |

**Linking**

Survives coil / document soft or hard delete.

**Table impact**

| Action        | Writes      |
|---------------|-------------|
| This screen   | SELECT only |
