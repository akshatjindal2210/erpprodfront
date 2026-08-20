# Designations

Org designation master. Same pattern as departments.

|               |                                                                              |
|---------------|------------------------------------------------------------------------------|
| UI            | `/settings/designations`                                                     |
| Permission    | `designations`                                                               |
| FE            | `settings/identity/designations/`                                            |
| BE            | `core/identity/designations/`                                                |
| API           | `POST /api/core/auth/designations/` (`list|get|create|update|delete|helper`) |
| Table         | `mst_designations`                                                           |

**Files**

|               |                                                                                        |
|---------------|----------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/settings/identity/designations/` (`Page.js`, `DesignationModal.js`) |
| BE            | `backend/src/apps/core/identity/designations/`                                         |

**CRUD**

|               |                                         |
|---------------|-----------------------------------------|
| Create        | INSERT name                             |
| Read          | list / get / helper                     |
| Update        | name                                    |
| Delete        | **HARD** `DELETE FROM mst_designations` |

**Linking**

Users keep orphaned `designation_id`. No permission / app-access change.

**Table impact**

| Action          | Writes                                      |
|-----------------|---------------------------------------------|
| Create / Update | `mst_designations`                          |
| Delete          | HARD designation row; `mst_users` untouched |
