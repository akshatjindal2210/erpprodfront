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

## Print layout (`issueRequestPrintDocument.js`)

A4 HTML print for approved issue requests:

- **Header:** Company block, S. No., Date only (Shift, Created By / At removed from print).
- **Table:** One sub-row per reserved coil; job-card columns span the first coil row only. **Count** is the number of coils on that job card (not string length). **RM Item** column is wider; count column is narrower.
- **Footer:** **Req. Qty** (requested or summed issue qty), **Approved By** / **At**; optional remarks block.
- **Totals row:** Sum of **Coil Qty** and **Total Qty** columns across job cards.
