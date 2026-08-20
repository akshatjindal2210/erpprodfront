# Training & SOPs

Training videos and per-module SOP text (`module_id` + `permission_type`).

|               |                                                                                                                               |
|---------------|-------------------------------------------------------------------------------------------------------------------------------|
| UI            | `/settings/training`                                                                                                          |
| Permission    | `training_videos`                                                                                                             |
| FE            | `settings/training/`                                                                                                          |
| BE            | `core/training/videos/` + `core/training/sops/`                                                                               |
| API           | `POST /api/core/training/` (`list|get|create|update|approve|delete`); `POST /api/core/sop/` (`list|get|create|update|delete`) |
| Table         | `mst_training_videos`, `mst_module_sops`                                                                                      |

**Files**

|               |                                                                                    |
|---------------|------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/settings/training/` (`Page.js`, `VideoModal.js`, `SopModal.js`) |
| BE            | `backend/src/apps/core/training/videos/`, `training/sops/`                         |

**CRUD**

|               |                                        |
|---------------|----------------------------------------|
| Create        | INSERT video or SOP                    |
| Read          | list / get / helper                    |
| Update        | fields; video approve = authorize      |
| Delete        | **SOFT** `is_deleted` on video and SOP |

**Linking**

Both FK → `mst_modules` `ON DELETE CASCADE`. Soft-delete does not change users / permissions. Module deactivate leaves training rows.

**Table impact**

| Action                    | Writes                                     |
|---------------------------|--------------------------------------------|
| Create / Update / approve | `mst_training_videos` or `mst_module_sops` |
| Delete                    | soft flags only                            |
