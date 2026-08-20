# Dashboard

Admin Console home (`appKey=settings`). Read-only viewer.

|               |                                                                     |
|---------------|---------------------------------------------------------------------|
| UI            | `/settings/dashboard`                                               |
| FE            | `frontend/src/common/dashboard-builder/`                            |
| BE            | `backend/src/apps/dashboard/`                                       |
| API           | `POST /api/dashboard/dashboard/` (`widgets|status|user-dashboards`) |
| Table         | `mst_dashboard_configs`                                             |

**Files**

|               |                                                 |
|---------------|-------------------------------------------------|
| FE            | `frontend/src/app/settings/dashboard/page.js`   |
| BE            | `backend/src/apps/dashboard/modules/dashboard/` |

**CRUD**

|               |                                |
|---------------|--------------------------------|
| Create        | none on this page              |
| Read          | published / accessible configs |
| Update        | none                           |
| Delete        | none                           |

**Linking**

No user / permission writes.

**Table impact**

| Action        | Writes                         |
|---------------|--------------------------------|
| Read          | SELECT `mst_dashboard_configs` |
