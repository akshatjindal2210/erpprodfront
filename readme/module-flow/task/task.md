# Task

Task / CL / red-ticket app. Deletes are **HARD** (no `is_deleted` on Task tables).

|               |                           |
|---------------|---------------------------|
| UI            | `/task/dashboard/`        |
| API           | `/api/task/`              |
| Gate          | `app_task`                |
| FE            | `frontend/src/apps/task/` |
| BE            | `backend/src/apps/task/`  |

| Screen          | File                                       |
|-----------------|--------------------------------------------|
| Dashboard       | [dashboard.md](./dashboard.md)             |
| Tasks           | [tasks.md](./tasks.md)                     |
| Reports         | [reports.md](./reports.md)                 |
| Recurring Task  | [recurring-task.md](./recurring-task.md)   |
| CL Task Master  | [cl-task-master.md](./cl-task-master.md)   |
| CL Task         | [cl-task.md](./cl-task.md)                 |
| CL Verification | [cl-verification.md](./cl-verification.md) |
| CL Task Report  | [cl-task-report.md](./cl-task-report.md)   |
| Red Ticket      | [red-ticket.md](./red-ticket.md)           |
| Category        | [category.md](./category.md)               |
| Holiday         | [holiday.md](./holiday.md)                 |
| Logs            | [logs.md](./logs.md)                       |

| Parent deleted         | Linking                                                                                 |
|------------------------|-----------------------------------------------------------------------------------------|
| `task_tasks`           | CASCADE assignments / chat / self_notes / report_reviews(task_id); SET NULL red.task_id |
| `task_recurring_tasks` | CASCADE assignments + chat; spawned tasks stay                                          |
| `task_cl_tasks_master` | CASCADE instances → CASCADE reviews; SET NULL red.cl_instance_id                        |
| `task_categories`      | SET NULL `task_tasks.category_id`                                                       |
| `task_holiday`         | no dependents                                                                           |
| `task_red_tickets`     | app deletes matching `task_mis_score_ledger`                                            |
