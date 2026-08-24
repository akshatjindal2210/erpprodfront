# Dashboard Builder

Super-admin widgets / layout. Widgets live in `dashboard_json` (no `mst_widgets` table). Detail: `frontend/readme/app-flow/DASHBOARD-BUILDER.md` (runtime SQL filters: super admin = all users unless picked; normal user = logged-in `{{userId}}`).

|               |                                                                                                 |
|---------------|-------------------------------------------------------------------------------------------------|
| UI            | `/settings/dashboard-builder`                                                                   |
| FE            | `frontend/src/common/dashboard-builder/`                                                        |
| BE            | `backend/src/apps/dashboard/`                                                                   |
| API           | `POST /api/dashboard/widgets/`, `/configs/` (save-draft|publish|unpublish|delete|clone-users|…) |
| Table         | `mst_dashboard_configs`                                                                         |

**Files**

|               |                                                                                     |
|---------------|-------------------------------------------------------------------------------------|
| FE            | `frontend/src/app/settings/dashboard-builder/page.js` + `common/dashboard-builder/` |
| BE            | `backend/src/apps/dashboard/` — dashboard controller / `dashboardConfig.model.js`   |

**CRUD**

|                 |                                                                         |
|-----------------|-------------------------------------------------------------------------|
| Create / Update | upsert `dashboard_json` (draft / publish / rename / clone)              |
| Read            | list configs / preview                                                  |
| Delete widget   | **HARD** remove from JSON array                                         |
| Delete config   | **SOFT** `meta.active=false`. `dashboard_key=default` cannot be deleted |

**Linking**

No FK to users. Audience IDs live in JSON (`targetUserIds`, `defaultForUserIds`). Soft-deleted users can remain in those arrays. Clone can clear defaults on other configs.

**Table impact**

| Action         | Writes                                                  |
|----------------|---------------------------------------------------------|
| Save / publish | INSERT or UPDATE `mst_dashboard_configs.dashboard_json` |
| Delete widget  | UPDATE JSON                                             |
| Delete config  | UPDATE `meta.active=false`                              |
