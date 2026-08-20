# Recurring Task

Templates that cron-spawn `task_tasks`. Direct create API is disabled — create from Tasks with `is_recurring`.

|               |                                                                                       |
|---------------|---------------------------------------------------------------------------------------|
| UI            | `/task/dashboard/recurring-task`                                                      |
| FE            | `modules/recurring-task/`                                                             |
| BE            | `modules/recurring-task/`                                                             |
| API           | `/api/task/recurring-tasks/` (list/stats/get/update/delete). POST create **disabled** |
| Table         | `task_recurring_tasks`, `task_recurring_task_assignments`, `task_recurring_task_chat` |

**Files**

|               |                                                                                                       |
|---------------|-------------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/task/modules/recurring-task/`, `lib/services/recurringTaskApi.js`                  |
| BE            | `backend/src/apps/task/modules/recurring-task/` + cron `backend/src/jobs/task/recurringTasks.cron.js` |

**CRUD**

|               |                                                                 |
|---------------|-----------------------------------------------------------------|
| Create        | via Tasks `POST /tasks` or `/tasks/self` when `is_recurring`    |
| Read          | search, dates, active, own-user unless admin                    |
| Update        | template + assignment sync (removed assignees **hard**-deleted) |
| Delete        | **HARD** `DELETE FROM task_recurring_tasks`                     |

**Linking**

CASCADE assignments + chat. Already-spawned `task_tasks` are **not** deleted.

**Table impact**

| Action              | Writes                                            |
|---------------------|---------------------------------------------------|
| Create (from Tasks) | `task_recurring_tasks` + assignments + chat       |
| Update              | template + assignment/chat rows                   |
| Delete              | template hard + CASCADE children; live tasks stay |
