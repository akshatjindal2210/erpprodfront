# Notifications

Super-admin templates, instant send, delivery logs. Templates in Task `task_app_config` JSON.

|               |                                                                                                                 |
|---------------|-----------------------------------------------------------------------------------------------------------------|
| UI            | `/settings/notifications`                                                                                       |
| FE            | `settings/notifications/`                                                                                       |
| BE            | `task/manage/notifications/` + core inbox / push                                                                |
| API           | `POST /api/task/notifications/` (`channels|templates|logs|send`); runtime `/api/core/inbox/`, `/api/core/push/` |
| Table         | `task_app_config`, `mst_inbox`, `mst_push_subscriptions`, `mst_push_delivery_log`, `mst_activity_logs`          |

**Files**

|               |                                                                                        |
|---------------|----------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/settings/notifications/` (`Page.js`, `SendMessageTab.js`)           |
| BE            | `backend/src/apps/task/manage/notifications/` + `backend/src/apps/core/notifications/` |

**CRUD**

|               |                                               |
|---------------|-----------------------------------------------|
| Create        | send → inbox / push / activity (append-only)  |
| Read          | templates / logs                              |
| Update        | UPSERT template JSON (no template DELETE API) |
| Delete        | template delete not supported                 |

**Linking**

Template edit does not change user permissions. User HARD delete CASCADE inbox; SET NULL push `user_id`. Soft-deleted users can remain in historical logs.

**Table impact**

| Action          | Writes                                                |
|-----------------|-------------------------------------------------------|
| Update template | UPSERT `task_app_config` key `notification_templates` |
| Send            | INSERT inbox / push delivery / activity as applicable |
