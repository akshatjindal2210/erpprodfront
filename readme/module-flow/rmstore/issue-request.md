# Issue Request

Job-card RM issue. QC passed required. Store In not required. Same permission as In-process Request.

|               |                                                                                            |
|---------------|--------------------------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/issue-request`                                                         |
| Permission    | `rm_issue_request`                                                                         |
| FE            | `modules/issue-request/`                                                                   |
| BE            | `modules/issue-request/`                                                                   |
| API           | `POST /api/rmstore/issue-requests/` (`list|create|update|approve|delete|lock-store-out|…`) |
| Table         | `rmstore_issue_request`, `rmstore_issue_request_job_card`                                  |

**Files**

|               |                                                                                              |
|---------------|----------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/issue-request/`, `lib/services/issueRequest.js`           |
| BE            | `backend/src/apps/rmstore/modules/issue-request/` + `utils/stock/issueRequestCoilReserve.js` |

**CRUD**

|                 |                                                                                       |
|-----------------|---------------------------------------------------------------------------------------|
| Create / Update | header + JC `coils` JSONB (logical reserve; coil `status` unchanged)                  |
| Read            | list / available-coils / job-card-summary                                             |
| Delete          | **SOFT** header + **SOFT** job cards; reserve released. Blocked if `out_entry_locked` |

**Linking**

JC `issue_uid` FK CASCADE on hard parent delete (UI uses soft). Coil stays `active` until Store Out approve sets `status=out`. Lock/unlock Store Out = super admin.

**Table impact**

| Action          | Writes                                                     |
|-----------------|------------------------------------------------------------|
| Create / Update | `rmstore_issue_request` + `rmstore_issue_request_job_card` |
| Delete          | soft both; coils not status-changed                        |
