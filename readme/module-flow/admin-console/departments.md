# Departments

Org department master (`name` unique). Users store `department_id` without DB FK.

|               |                                                                             |
|---------------|-----------------------------------------------------------------------------|
| UI            | `/settings/departments`                                                     |
| Permission    | `departments`                                                               |
| FE            | `settings/identity/departments/`                                            |
| BE            | `core/identity/departments/`                                                |
| API           | `POST /api/core/auth/departments/` (`list|get|create|update|delete|helper`) |
| Table         | `mst_departments`                                                           |

**Files**

|               |                                                                                      |
|---------------|--------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/settings/identity/departments/` (`Page.js`, `DepartmentModal.js`) |
| BE            | `backend/src/apps/core/identity/departments/`                                        |

**CRUD**

|               |                                        |
|---------------|----------------------------------------|
| Create        | INSERT name                            |
| Read          | list / get / helper                    |
| Update        | name                                   |
| Delete        | **HARD** `DELETE FROM mst_departments` |

**Linking**

No cascade. Users keep stale `department_id`. Permissions / app access unchanged.

**Table impact**

| Action          | Writes                               |
|-----------------|--------------------------------------|
| Create / Update | `mst_departments`                    |
| Delete          | HARD dept row; `mst_users` untouched |
