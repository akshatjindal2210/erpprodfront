# CL Task Master

Checklist templates (open / frequently). Activate spawns instances.

|               |                                                                  |
|---------------|------------------------------------------------------------------|
| UI            | `/task/dashboard/cl-task`                                        |
| Permission    | `cl_task_master`                                                 |
| FE            | `modules/cl-task/admin/`                                         |
| BE            | `modules/cl-task/`                                               |
| API           | `POST /api/task/cl-tasks/` (`list|create|update|delete|approve`) |
| Table         | `task_cl_tasks_master` → `task_cl_tasks`                         |

**Files**

|               |                                                                                                         |
|---------------|---------------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/task/modules/cl-task/admin/` + `shared/`, `lib/services/clTaskApi.js`                |
| BE            | `backend/src/apps/task/modules/cl-task/` — `clTask.route.js`, `clTask.controller.js`, `clTask.model.js` |

**CRUD**

|               |                                                                                        |
|---------------|----------------------------------------------------------------------------------------|
| Create        | INSERT master (`approved=true`) + spawn first instance(s)                              |
| Read          | org filters, type, active, view_days                                                   |
| Update        | master + sync pending instances; removed assignees' pending instances **hard**-deleted |
| Delete        | **HARD** `DELETE FROM task_cl_tasks_master` (activity log kept)                        |

**Linking**

Master delete CASCADE all `task_cl_tasks`. Then CASCADE `task_report_reviews.cl_instance_id`. SET NULL `task_red_tickets.cl_instance_id`.

**Table impact**

| Action        | Writes                                                          |
|---------------|-----------------------------------------------------------------|
| Create        | `task_cl_tasks_master`, `task_cl_tasks`, `mst_activity_logs`    |
| Update        | master + pending instances                                      |
| Delete        | master hard + CASCADE instances / reviews; red tickets SET NULL |
