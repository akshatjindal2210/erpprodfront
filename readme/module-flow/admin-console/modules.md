# System Module

Module catalogue and permission flags (view / add / edit / authorize / delete). No delete API — deactivate with `is_active`.

|               |                                                                                                  |
|---------------|--------------------------------------------------------------------------------------------------|
| UI            | `/settings/modules`                                                                              |
| Permission    | `modules`                                                                                        |
| FE            | `settings/identity/modules/`                                                                     |
| BE            | `core/identity/modules/`                                                                         |
| API           | `POST /api/core/auth/modules/` (`list|get|create|update|toggle-status|helper`). **No** `/delete` |
| Table         | `mst_modules`                                                                                    |

**Files**

|               |                                                       |
|---------------|-------------------------------------------------------|
| FE            | `frontend/src/apps/settings/identity/modules/Page.js` |
| BE            | `backend/src/apps/core/identity/modules/`             |

**CRUD**

|                 |                                                     |
|-----------------|-----------------------------------------------------|
| Create          | INSERT (`is_active=true`)                           |
| Read            | list / get / helper                                 |
| Update / toggle | fields or flip `is_active`; clears permission cache |
| Delete          | not implemented                                     |

**Linking**

Deactivate keeps `mst_user_permissions`, training, SOPs. Access control rejects inactive modules. Hypothetical HARD delete module would CASCADE permissions, `mst_training_videos`, `mst_module_sops`.

**Table impact**

| Action                   | Writes                                  |
|--------------------------|-----------------------------------------|
| Create / Update / toggle | `mst_modules` (+ cache clear on toggle) |
| Delete                   | N/A                                     |
