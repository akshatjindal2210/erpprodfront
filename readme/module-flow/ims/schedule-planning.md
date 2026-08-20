# Schedule Planning

Dispatch plan by FY / schno / item. FN can use `schno`.

|               |                                                                            |
|---------------|----------------------------------------------------------------------------|
| UI            | `/ims/dashboard/schedule-planning`                                         |
| Permission    | `schedule_planning`                                                        |
| FE            | `modules/schedule-planning/`                                               |
| BE            | `modules/schedule-planning/`                                               |
| API           | `POST /api/schedule-planning/` (`list|save|reject|complete|hold|delete|…`) |
| Table         | `ims_schedule_plan`, `ims_schedule_plan_transaction`                       |

**Files**

|               |                                                    |
|---------------|----------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/schedule-planning/` |
| BE            | `backend/src/apps/ims/modules/schedule-planning/`  |

**CRUD**

|                 |                                                                          |
|-----------------|--------------------------------------------------------------------------|
| Create / Update | upsert plan + INSERT transaction                                         |
| Read            | list / customer-month (needs FN view)                                    |
| Delete          | **HARD** `DELETE FROM ims_schedule_plan` + transactions. No `is_deleted` |

**Linking**

Delete does **not** touch FN or boxes. `schno` on FN is not an FK cascade.

**Table impact**

| Action        | Writes                                                |
|---------------|-------------------------------------------------------|
| Save          | `ims_schedule_plan` + `ims_schedule_plan_transaction` |
| Delete        | HARD plan + HARD txns                                 |
