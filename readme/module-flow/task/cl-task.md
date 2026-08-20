# CL Task

Assignee work queue — submit / update fills. Open masters can create an instance on submit.

|               |                                                                     |
|---------------|---------------------------------------------------------------------|
| UI            | `/task/dashboard/cl-tasks`                                          |
| Permission    | `cl_task`                                                           |
| FE            | `modules/cl-task/my-tasks/`                                         |
| BE            | `modules/cl-task/`                                                  |
| API           | `POST /api/task/cl-tasks/` (`my|submit|submission-update|instance`) |
| Table         | `task_cl_tasks`                                                     |

**Files**

|               |                                                                                                |
|---------------|------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/task/modules/cl-task/my-tasks/` (`MyClTaskPage.js`, `ClTaskSubmitModal.js`) |
| BE            | `backend/src/apps/task/modules/cl-task/` (same as master)                                      |

**CRUD**

|               |                                                          |
|---------------|----------------------------------------------------------|
| Create        | no master create; open submit may INSERT `task_cl_tasks` |
| Read          | tabs due/open/frequently/history; own unless privileged  |
| Update        | submit / history edit                                    |
| Delete        | none here (instance delete = CL Verification)            |

**Linking**

Writes instance row only. Master stays. Verification / red ticket happen on other screens.

**Table impact**

| Action        | Writes                                                                          |
|---------------|---------------------------------------------------------------------------------|
| Submit        | `task_cl_tasks` insert or update `form_responses` / status; `mst_activity_logs` |
| Delete        | none                                                                            |
