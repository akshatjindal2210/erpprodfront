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

## Location Details column

Backend (`inventoryReport.model.js`) builds `location_details` as a comma-separated summary of **all** coils for the grouped row (not issuable-only):

| Segment | Meaning |
|---------|---------|
| `{rack label} (n)` | Coils in store on a rack (`IN_STORE`) |
| `UA (n)` | Unassigned warehouse coils (shown only if count > 0) |
| `SF (n)` | Shop floor coils (shown only if count > 0) |
| `QC (n)` | Pending QC (informational subset; shown only if count > 0) |

Frontend (`Page.js`): hovering the **Location Details** cell shows a tooltip of **total stock** coil UIDs (`total_stock_coil_uids`), aligned with the column representing full stock placement rather than issuable-only UIDs.

**Table impact**

| Action        | Writes       |
|---------------|--------------|
| Read          | SELECT coils |
