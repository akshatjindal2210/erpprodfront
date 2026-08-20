# Box Transaction Logs

Append-only box movement history.

|               |                                        |
|---------------|----------------------------------------|
| UI            | `/ims/dashboard/logs/box-transactions` |
| Permission    | `box_transaction_logs`                 |
| FE            | `manage/log/BoxTransactionLogPage.js`  |
| BE            | `manage/log/`                          |
| API           | `POST /api/box-transaction-logs/list`  |
| Table         | `ims_transaction_box`                  |

**Files**

|               |                                                                                                     |
|---------------|-----------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/ims/manage/log/BoxTransactionLogPage.js`                                         |
| BE            | `backend/src/apps/ims/manage/log/` (writers: `modules/box/utils/transactions/logBoxTransaction.js`) |

**CRUD**

|               |                                                            |
|---------------|------------------------------------------------------------|
| Create        | INSERT from Store In/Out, packing, SA, QC, override, audit |
| Read          | list                                                       |
| Update        | none                                                       |
| Delete        | none                                                       |

**Linking**

Historical. No cascade from this screen.

**Table impact**

| Action        | Writes      |
|---------------|-------------|
| This screen   | SELECT only |
