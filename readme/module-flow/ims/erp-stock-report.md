# ERP Stock Report

ERP FG stock vs IMS (read-only).

|               |                                                                       |
|---------------|-----------------------------------------------------------------------|
| UI            | `/ims/dashboard/erp-stock-report`                                     |
| Permission    | `erp_stock_report`                                                    |
| FE            | `modules/erp-stock-report/`                                           |
| BE            | `modules/erp-stock-report/`                                           |
| API           | `POST /api/erp-stock-report/list`                                     |
| Table         | ERP + read `ims_box_table` / `ims_dailyprod` / `ims_stock_adjustment` |

**Files**

|               |                                                   |
|---------------|---------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/erp-stock-report/` |
| BE            | `backend/src/apps/ims/modules/erp-stock-report/`  |

**CRUD**

|               |      |
|---------------|------|
| Create        | none |
| Read          | list |
| Update        | none |
| Delete        | none |

**Linking**

No writes.

**Table impact**

| Action        | Writes      |
|---------------|-------------|
| Read          | SELECT only |
