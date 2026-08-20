# CL Verification

Approve / reject fills. Reject may create red ticket + MIS penalty. Can delete instances.

|               |                                                                                        |
|---------------|----------------------------------------------------------------------------------------|
| UI            | `/task/dashboard/cl-task/verification`                                                 |
| Permission    | `cl_task_verification` (verify needs `can_add`)                                        |
| FE            | `modules/cl-task/verification/`                                                        |
| BE            | `modules/cl-task/`                                                                     |
| API           | `POST /api/task/cl-tasks/` (`verification|verify|verification-update|instance-delete`) |
| Table         | `task_cl_tasks`, `task_red_tickets`, `task_mis_score_ledger`                           |

**Files**

|               |                                                        |
|---------------|--------------------------------------------------------|
| FE            | `frontend/src/apps/task/modules/cl-task/verification/` |
| BE            | `backend/src/apps/task/modules/cl-task/`               |

**CRUD**

|               |                                                               |
|---------------|---------------------------------------------------------------|
| Create        | reject + `create_red_ticket` → INSERT red ticket + MIS ledger |
| Read          | status/org filters; scoped to verifier unless privileged      |
| Update        | approve / reject / later score-remark (`verification-update`) |
| Delete        | **HARD** `DELETE FROM task_cl_tasks WHERE instance_id`        |

**Linking**

Instance hard-delete CASCADE reviews. SET NULL `task_red_tickets.cl_instance_id`. Tickets themselves stay.

**Table impact**

| Action          | Writes                                                             |
|-----------------|--------------------------------------------------------------------|
| Verify          | `task_cl_tasks`; maybe `task_red_tickets`, `task_mis_score_ledger` |
| Delete instance | `task_cl_tasks` hard + CASCADE reviews; red ticket SET NULL        |
