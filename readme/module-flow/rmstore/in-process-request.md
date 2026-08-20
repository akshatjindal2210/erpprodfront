# In-process Request

After issue: consume, store-in return, rejection, transfer. Same permission `rm_issue_request`.

|               |                                                                                                    |
|---------------|----------------------------------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/in-process-request`                                                            |
| Permission    | `rm_issue_request`                                                                                 |
| FE            | `modules/in-process-request/`                                                                      |
| BE            | `modules/in-process-request/`                                                                      |
| API           | `POST /api/rmstore/in-process-requests/` (`list|create|update|approve|complete-store-in|delete|…`) |
| Table         | `rmstore_in_process_request`                                                                       |

**Files**

|               |                                                                                                                         |
|---------------|-------------------------------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/in-process-request/` (`InProcessRequestModal.js`, consume / store-in / status forms) |
| BE            | `backend/src/apps/rmstore/modules/in-process-request/` (routes `MODULE = rm_issue_request`)                             |

**CRUD**

|                 |                                                                          |
|-----------------|--------------------------------------------------------------------------|
| Create / Update | `coils` / `proposed_coils` JSONB                                         |
| Read            | list / pending store-in / store-out                                      |
| Delete          | **SOFT**. Approved delete reverts consume / store-in / rejection helpers |

**Linking**

`consume` approve → `status=consumed`, `ipr_uid`. Leftover may queue Store In. `store_in` → `complete-store-in` (may `sa_entry_type=production_return`). `rejection` → pending Store Out (needs `in_process_rejection`).

**Table impact**

| Action        | Writes                                                   |
|---------------|----------------------------------------------------------|
| Approve       | `rmstore_in_process_request` + coil `status` / `ipr_uid` |
| Delete        | soft IPR + status revert helpers                         |
