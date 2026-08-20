# Dashboard

Read-only Dashboard Builder (`appKey=ims`).

|               |                                          |
|---------------|------------------------------------------|
| UI            | `/ims/dashboard`                         |
| Permission    | none (app gate only)                     |
| FE            | `frontend/src/common/dashboard-builder/` |
| BE            | `backend/src/apps/dashboard/`            |
| API           | `POST /api/dashboard/`                   |
| Table         | `mst_dashboard_configs`                  |

**Files**

|               |                                                                     |
|---------------|---------------------------------------------------------------------|
| FE            | `frontend/src/app/ims/dashboard/page.js` + shared dashboard-builder |
| BE            | `backend/src/apps/dashboard/`                                       |

**CRUD**

|               |                                 |
|---------------|---------------------------------|
| Create        | none (builder is Admin Console) |
| Read          | published widgets               |
| Update        | none                            |
| Delete        | none                            |

**Linking**

No box writes.

**Table impact**

| Action        | Writes        |
|---------------|---------------|
| Read          | SELECT config |
