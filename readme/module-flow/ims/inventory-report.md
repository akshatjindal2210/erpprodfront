# Inventory Report

Stock buckets from `ims_box_table` only.

|               |                                   |
|---------------|-----------------------------------|
| UI            | `/ims/dashboard/inventory-report` |
| Permission    | `inventory_report`                |
| FE            | `modules/inventory-report/`       |
| BE            | `modules/inventory-report/`       |
| API           | `POST /api/inventory-report/list` |
| Table         | `ims_box_table` (read)            |

**Files**

|               |                                                   |
|---------------|---------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/inventory-report/` |
| BE            | `backend/src/apps/ims/modules/inventory-report/`  |

**CRUD**

|               |      |
|---------------|------|
| Create        | none |
| Read          | list |
| Update        | none |
| Delete        | none |

**Linking**

Joins dailyprod / SA / location. No writes.

**Table impact**

| Action        | Writes       |
|---------------|--------------|
| Read          | SELECT boxes |
