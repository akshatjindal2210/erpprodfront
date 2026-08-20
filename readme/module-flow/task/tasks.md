# Tasks

Assign, chat, forward, complete / approve. Optional recurring template created with the task.

|               |                                                                         |
|---------------|-------------------------------------------------------------------------|
| UI            | `/task/dashboard/tasks`                                                 |
| Permission    | `tasks`                                                                 |
| FE            | `modules/tasks/`                                                        |
| BE            | `modules/tasks/`                                                        |
| API           | `/api/task/tasks` (GET list/get; POST create/self/actions; PUT; DELETE) |
| Table         | `task_tasks`, `task_assignments`, `task_chat`, `task_self_notes`        |

**Files**

|               |                                                                                                                               |
|---------------|-------------------------------------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/task/modules/tasks/` (`Page.js`, `TaskModal.js`, `RecurringTaskModal.js`), `lib/services/taskApi.js`       |
| BE            | `backend/src/apps/task/modules/tasks/` — `task.route.js`, `task.controller.js`, chat / self-note controllers, `task.model.js` |

**CRUD**

|               |                                                                                         |
|---------------|-----------------------------------------------------------------------------------------|
| Create        | INSERT task + L1 assignment + seed chat. `is_recurring` also inserts `task_recurring_*` |
| Read          | filters: status, category, view, overdue, org, `report=true`                            |
| Update        | fields, L1/sub assignees, attachments                                                   |
| Delete        | **HARD** `DELETE FROM task_tasks`. Owner / assigner / super_admin only                  |

**Linking**

On task **HARD** delete: CASCADE `task_assignments`, `task_chat`, `task_self_notes`, `task_report_reviews.task_id`. SET NULL `task_red_tickets.task_id`. Recurring template is **not** deleted. Chat/self-note files unlinked from disk. `mst_activity_logs` kept.

**Table impact**

| Action        | Writes                                                                                             |
|---------------|----------------------------------------------------------------------------------------------------|
| Create        | `task_tasks`, `task_assignments`, `task_chat`, `mst_activity_logs` (+ optional `task_recurring_*`) |
| Update        | `task_tasks`, maybe assignments / chat, `mst_activity_logs`                                        |
| Delete        | `task_tasks` hard + CASCADE children; red ticket `task_id` SET NULL                                |
