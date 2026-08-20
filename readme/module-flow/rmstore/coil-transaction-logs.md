# Coil Transaction Logs

Append-only stock-move ledger (not sticker downloads).

|               |                                                 |
|---------------|-------------------------------------------------|
| UI            | `/rmstore/dashboard/logs/coil-transactions`     |
| Permission    | `rm_coil_transaction_logs`                      |
| FE            | `modules/logs/CoilTransactionLogPage.js`        |
| BE            | `manage/log/`                                   |
| API           | `POST /api/rmstore/logs/coil-transactions/list` |
| Table         | `rmstore_coil_transaction`                      |

**Files**

|               |                                                                    |
|---------------|--------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/logs/CoilTransactionLogPage.js` |
| BE            | `backend/src/apps/rmstore/manage/log/`                             |

**CRUD**

|               |                           |
|---------------|---------------------------|
| Create        | INSERT from other modules |
| Read          | list                      |
| Update        | none                      |
| Delete        | none                      |

**Linking**

Types include sticker_create/delete, inward_link/unlink, store_out, qc_*, stock_adjustment_*, consume.

**Table impact**

| Action        | Writes      |
|---------------|-------------|
| This screen   | SELECT only |
