# Admin Console

Identity, modules, training, app config. Gate `app_core`. UI `/settings/`.

|               |                                                                          |
|---------------|--------------------------------------------------------------------------|
| FE            | `frontend/src/apps/settings/`                                            |
| BE            | `backend/src/apps/core/`                                                 |
| API           | `/api/core/` (dashboard `/api/dashboard/`, IMS config `/api/app-config`) |

| Screen                    | File                                           |
|---------------------------|------------------------------------------------|
| Dashboard                 | [dashboard.md](./dashboard.md)                 |
| Dashboard Builder         | [dashboard-builder.md](./dashboard-builder.md) |
| User Management           | [users.md](./users.md)                         |
| Departments               | [departments.md](./departments.md)             |
| Designations              | [designations.md](./designations.md)           |
| System Module             | [modules.md](./modules.md)                     |
| Training & SOPs           | [training.md](./training.md)                   |
| Notifications             | [notifications.md](./notifications.md)         |
| Application Configuration | [app-configuration.md](./app-configuration.md) |

| Entity                   | Delete                                                       |
|--------------------------|--------------------------------------------------------------|
| User                     | **SOFT** (`is_deleted`); permissions / app access **remain** |
| Department / Designation | **HARD**; users keep orphan ids                              |
| Module                   | no delete — toggle `is_active`                               |
| Training / SOP           | **SOFT**                                                     |
| Dashboard config         | **SOFT** `meta.active=false`                                 |
| App config key           | no delete                                                    |
