# Application Configuration

Per-app settings (Admin / IMS / RM Store / Task / shortcuts). Super admin. Values stored in shared `ims_app_config` (even core / rmstore keys).

|               |                                                                      |
|---------------|----------------------------------------------------------------------|
| UI            | `/settings/app-configuration`                                        |
| FE            | `settings/configuration/`                                            |
| BE            | IMS `manage/app-config/` + core `configuration/` model               |
| API           | `POST /api/app-config/list`, `PUT /api/app-config`                   |
| Table         | `ims_app_config` (Task also has `task_app_config` for notifications) |

**Files**

|               |                                                                                                                  |
|---------------|------------------------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/settings/configuration/components/` (`AppConfigurationPage.js`, per-app forms)                |
| BE            | `backend/src/apps/ims/manage/app-config/`, model `backend/src/apps/core/configuration/models/appConfig.model.js` |

**CRUD**

|               |                                               |
|---------------|-----------------------------------------------|
| Create        | UPSERT on first save                          |
| Read          | list (+ seed defaults)                        |
| Update        | hard overwrite `config_value` by `config_key` |
| Delete        | no delete endpoint                            |

**Linking**

No user / permission tables. Runtime flags via cache invalidation.

**Table impact**

| Action        | Writes                                     |
|---------------|--------------------------------------------|
| List          | SELECT `ims_app_config`                    |
| Update        | INSERT ON CONFLICT UPDATE `ims_app_config` |
