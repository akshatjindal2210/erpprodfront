# Dashboard

Read-only Dashboard Builder (`appKey=rmstore`).

|               |                                          |
|---------------|------------------------------------------|
| UI            | `/rmstore/dashboard`                     |
| FE            | `modules/dashboard/Page.js`              |
| BE            | shared dashboard app (not under rmstore) |
| API           | `POST /api/dashboard/`                   |
| Table         | `mst_dashboard_configs`                  |

**Files**

|               |                                                       |
|---------------|-------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/dashboard/Page.js` |
| BE            | `backend/src/apps/dashboard/`                         |

**CRUD**

|               |                                 |
|---------------|---------------------------------|
| Create        | none (builder is Admin Console) |
| Read          | published widgets               |
| Update        | none                            |
| Delete        | none                            |

**Linking**

No coil writes.

**Table impact**

| Action        | Writes                  |
|---------------|-------------------------|
| Read          | SELECT dashboard config |
