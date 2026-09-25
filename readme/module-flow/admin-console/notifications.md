# Notifications

Super-admin templates, instant send, delivery logs. Task templates in Task `task_app_config` JSON. **Module templates** in `mst_notification_templates` (activity-driven).

|               |                                                                                                                 |
|---------------|-----------------------------------------------------------------------------------------------------------------|
| UI            | `/settings/notifications`                                                                                       |
| FE            | `settings/notifications/`                                                                                       |
| BE            | `task/manage/notifications/` + core inbox / push + **`templates/moduleNotify.service.js`**                      |
| API           | `POST /api/task/notifications/` (`channels|templates|logs|send`); core notification-templates; runtime `/api/core/inbox/`, `/api/core/push/` |
| Table         | `task_app_config`, `mst_notification_templates`, `mst_notification_logs`, `mst_inbox`, `mst_push_subscriptions`, `mst_push_delivery_log`, `mst_activity_logs` |

**Module notifications (flow):** [module-notifications.md](./module-notifications.md)

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
