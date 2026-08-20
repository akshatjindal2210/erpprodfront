# Activity Logs

`mst_activity_logs` where `app_type=ims`.

|               |                                            |
|---------------|--------------------------------------------|
| UI            | `/ims/dashboard/logs`                      |
| Permission    | `activity_logs`                            |
| FE            | `manage/log/Page.js`                       |
| BE            | core activity-logs                         |
| API           | `GET /api/core/activity-logs?app_type=ims` |
| Table         | `mst_activity_logs`                        |

**Files**

|               |                                            |
|---------------|--------------------------------------------|
| FE            | `frontend/src/apps/ims/manage/log/Page.js` |
| BE            | `backend/src/apps/core/activity-logs/`     |

**CRUD**

|               |                              |
|---------------|------------------------------|
| Create        | side effect of other modules |
| Read          | list                         |
| Update        | none                         |
| Delete        | none                         |

**Linking**

Survives box / document delete.

**Table impact**

| Action        | Writes      |
|---------------|-------------|
| This screen   | SELECT only |
