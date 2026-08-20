# Sticker Download Logs

`transaction_type=sticker_download` on the same coil transaction table (no separate download table).

|               |                                                 |
|---------------|-------------------------------------------------|
| UI            | `/rmstore/dashboard/logs/sticker-downloads`     |
| Permission    | `rm_coil_download_logs`                         |
| FE            | `modules/logs/CoilDownloadLogPage.js`           |
| BE            | `manage/log/` + coil download model             |
| API           | `POST /api/rmstore/logs/sticker-downloads/list` |
| Table         | `rmstore_coil_transaction`                      |

**Files**

|               |                                                                         |
|---------------|-------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/logs/CoilDownloadLogPage.js`         |
| BE            | `backend/src/apps/rmstore/modules/coil/models/coilDownloadLog.model.js` |

**CRUD**

|               |                                                         |
|---------------|---------------------------------------------------------|
| Create        | print/download side effect (+ `download_count` on coil) |
| Read          | list                                                    |
| Update        | none                                                    |
| Delete        | none                                                    |

**Linking**

Read filter only. Coil hard-delete (MRN cancel) removes those coils; historical tx rows may remain.

**Table impact**

| Action        | Writes      |
|---------------|-------------|
| This screen   | SELECT only |
