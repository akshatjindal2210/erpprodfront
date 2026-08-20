# Item RM Master

FG item → RM item mapping (`rm_items` JSONB). Required for Issue Request.

|               |                                                                             |
|---------------|-----------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/master/production`                                      |
| Permission    | `rm_production_master`                                                      |
| FE            | `modules/master/production/`                                                |
| BE            | `modules/production/`                                                       |
| API           | `POST /api/rmstore/production/` (`list|get|create|update|delete` + helpers) |
| Table         | `rmstore_master_production`                                                 |

**Files**

|               |                                                                                          |
|---------------|------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/master/production/` (`Page.js`, `ProductionModal.js`) |
| BE            | `backend/src/apps/rmstore/modules/production/` — routes, controller, model               |

**CRUD**

|               |                            |
|---------------|----------------------------|
| Create        | pending row                |
| Read          | list / get / helpers       |
| Update        | authorize / edit mapping   |
| Delete        | **SOFT** `is_deleted=true` |

**Linking**

No FK to coils. Delete is not blocked by Issue Request. JC may still hold snapshot `production_id`.

**Table impact**

| Action          | Writes                                  |
|-----------------|-----------------------------------------|
| Create / Update | `rmstore_master_production`             |
| Delete          | soft-hide mapping only; coils unchanged |
