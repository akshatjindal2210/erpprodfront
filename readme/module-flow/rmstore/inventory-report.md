# RM Inventory

Report from `rmstore_coil_table` only.

|               |                                           |
|---------------|-------------------------------------------|
| UI            | `/rmstore/dashboard/inventory-report`     |
| Permission    | `rm_inventory_report`                     |
| FE            | `modules/inventory-report/`               |
| BE            | `modules/inventory-report/`               |
| API           | `POST /api/rmstore/inventory-report/list` |
| Table         | `rmstore_coil_table` (read)               |

**Files**

|               |                                                       |
|---------------|-------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/inventory-report/` |
| BE            | `backend/src/apps/rmstore/modules/inventory-report/`  |

**CRUD**

|               |           |
|---------------|-----------|
| Create        | none      |
| Read          | list only |
| Update        | none      |
| Delete        | none      |

**Linking**

Total Stock = In Store + Unassigned + Shop Floor. Issuable = warehouse + QC passed, not rejected / consumed / shop floor.

**Table impact**

| Action        | Writes       |
|---------------|--------------|
| Read          | SELECT coils |
