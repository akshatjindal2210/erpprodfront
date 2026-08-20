# User Management

Users, app access, module permissions, special permissions.

|               |                                                                                                                     |
|---------------|---------------------------------------------------------------------------------------------------------------------|
| UI            | `/settings/users`                                                                                                   |
| Permission    | `users`                                                                                                             |
| FE            | `settings/identity/users/`                                                                                          |
| BE            | `core/identity/users/` + `permissions/`                                                                             |
| API           | `POST /api/core/auth/users/` (`list|get|create|update|delete|helper`); `/permissions/` (`list|set|set-bulk|remove`) |
| Table         | `mst_users`, `mst_user_permissions`, `mst_user_app_access`                                                          |

**Files**

|               |                                                                                                     |
|---------------|-----------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/settings/identity/users/` (`Page.js`, `UserModal.js`, `UserPermissionsPanel.js`) |
| BE            | `backend/src/apps/core/identity/users/` + `identity/permissions/`                                   |

**CRUD**

|               |                                                        |
|---------------|--------------------------------------------------------|
| Create        | INSERT user; optional upsert permissions + app access  |
| Read          | list / get / IMS directory helper                      |
| Update        | user fields + replace permissions / app access         |
| Delete        | **SOFT** `is_deleted=true`, `deleted_at`, `deleted_by` |

**Linking**

Soft-delete does **not** cascade. `mst_user_permissions` and `mst_user_app_access` stay live. `department_id` / `designation_id` are loose INTEGERs (no FK). Hypothetical HARD delete user would CASCADE permissions, app access, inbox; SET NULL activity / push `user_id`.

**Table impact**

| Action            | Writes                                                          |
|-------------------|-----------------------------------------------------------------|
| Create            | `mst_users` + optional permissions + app access                 |
| Update            | `mst_users` + upsert/soft-remove permissions; UPSERT app access |
| Delete            | `mst_users` soft only                                           |
| Permission remove | **SOFT** `mst_user_permissions.is_deleted`                      |
