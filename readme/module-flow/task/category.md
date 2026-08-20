# Category

Task categories (unique name).

|               |                                                                       |
|---------------|-----------------------------------------------------------------------|
| UI            | `/task/dashboard/category`                                            |
| Permission    | `category`                                                            |
| FE            | `modules/category/`                                                   |
| BE            | `modules/category/`                                                   |
| API           | `POST /api/task/categories/` (`list|get|create|update|delete|helper`) |
| Table         | `task_categories`                                                     |

**Files**

|               |                                                                                  |
|---------------|----------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/task/modules/category/Page.js`, `lib/services/categoryApi.js` |
| BE            | `backend/src/apps/task/modules/category/` — route, controller, model             |

**CRUD**

|               |                                        |
|---------------|----------------------------------------|
| Create        | INSERT name                            |
| Read          | search, dates, page                    |
| Update        | name (edit-days gate)                  |
| Delete        | **HARD** `DELETE FROM task_categories` |

**Linking**

`task_tasks.category_id` → `ON DELETE SET NULL`. Recurring `category_id` has no FK. Delete is not blocked by existing tasks — tasks stay, category unlinked.

**Table impact**

| Action          | Writes                                                    |
|-----------------|-----------------------------------------------------------|
| Create / Update | `task_categories`                                         |
| Delete          | `task_categories` hard; `task_tasks.category_id` SET NULL |
