# QC Hold Material

Hold / release saleable boxes (`qc_hold_id`). Optional completion stickers.

|               |                                                                                         |
|---------------|-----------------------------------------------------------------------------------------|
| UI            | `/ims/dashboard/qc-hold-material`                                                       |
| Permission    | `qc_hold_material`                                                                      |
| FE            | `modules/qc-hold-material/`                                                             |
| BE            | `modules/qc-hold-material/`                                                             |
| API           | `POST /api/qc-hold-material/` (`list|create|submit|approve-submission|update|delete|activity-log|…`) |
| Table         | `ims_qc_hold_material`                                                                  |

**Activity history**

|               |                                                                 |
|---------------|-----------------------------------------------------------------|
| UI            | List → **History** → `QcHoldActivityDrawer`                     |
| API           | `POST /api/qc-hold-material/activity-log` `{ hold_id }`         |
| Note          | Separate from shared `GET /api/core/activity-logs`              |
| Version note  | [v4.1.0.md](../../version-notes/v4.1.0.md)                      |

**Files**

|               |                                                   |
|---------------|---------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/qc-hold-material/` |
| BE            | `backend/src/apps/ims/modules/qc-hold-material/`  |

**CRUD**

|                                    |                                                                                |
|------------------------------------|--------------------------------------------------------------------------------|
| Create / Update / submit / approve | hold row + box `qc_hold_id` sync                                               |
| Read                               | list / get / active-holds                                                      |
| Delete                             | **SOFT** hold; pending completion boxes soft-deleted; `releaseQcHoldFromBoxes` |

**Linking**

`ims_box_table.qc_hold_id` → `ON DELETE SET NULL`. Hold sets / delete clears hold on boxes.

**Table impact**

| Action           | Writes                                                                           |
|------------------|----------------------------------------------------------------------------------|
| Create / approve | `ims_qc_hold_material` + UPDATE boxes `qc_hold_id` (+ optional completion boxes) |
| Delete           | soft hold + clear `qc_hold_id` + soft pending completions                        |
