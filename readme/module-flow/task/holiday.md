# Holiday

Calendar holidays (incl. CSV / Excel bulk upload).

|               |                                                                          |
|---------------|--------------------------------------------------------------------------|
| UI            | `/task/dashboard/holidays`                                               |
| Permission    | `holiday`                                                                |
| FE            | `modules/holidays/`                                                      |
| BE            | `modules/holidays/`                                                      |
| API           | `POST /api/task/holidays/` (`list|get|create|update|delete|bulk-upload`) |
| Table         | `task_holiday`                                                           |

**Files**

|               |                                                                                                  |
|---------------|--------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/task/modules/holidays/Page.js`, `BulkUpload.js`, `lib/services/holidayApi.js` |
| BE            | `backend/src/apps/task/modules/holidays/` — route, controller, model                             |

**CRUD**

|               |                                     |
|---------------|-------------------------------------|
| Create        | INSERT `(name, date)`; unique name  |
| Read          | search, dates, page                 |
| Update        | name / date (edit-days gate)        |
| Delete        | **HARD** `DELETE FROM task_holiday` |

**Linking**

No FK from other Task tables. Bulk upload: `INSERT … ON CONFLICT (name) DO NOTHING`.

**Table impact**

| Action          | Writes                                |
|-----------------|---------------------------------------|
| Create / Update | `task_holiday`                        |
| Bulk            | `task_holiday` insert-skip duplicates |
| Delete          | `task_holiday` hard only              |
