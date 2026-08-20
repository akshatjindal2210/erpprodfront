# QC Check

Compulsory before Issue. Coils may be Unassigned. MRN Portal sticker coils only (not SA add / production-return).

|               |                                                                                         |
|---------------|-----------------------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/qc-check`                                                           |
| Permission    | `rm_qc_check`                                                                           |
| FE            | `modules/qc-check/`                                                                     |
| BE            | `modules/qc-check/`                                                                     |
| API           | `POST /api/rmstore/qc-checks/` (`list|get|prepare|submit|approve|reopen|delete|helper`) |
| Table         | `rmstore_qc_check`                                                                      |

**Files**

|               |                                                                                                                               |
|---------------|-------------------------------------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/qc-check/` (`Page.js`, `QcCheckModal.js`, `QcScanGateModal.js`), `lib/services/qcCheck.js` |
| BE            | `backend/src/apps/rmstore/modules/qc-check/` + `lib/utils/coilQcEligibility.js`                                               |

**CRUD**

|               |                                                                                                                                          |
|---------------|------------------------------------------------------------------------------------------------------------------------------------------|
| Create        | pending (virtual) → prepare → submit                                                                                                     |
| Read          | list / get                                                                                                                               |
| Update        | authorize; reopen                                                                                                                        |
| Delete        | UI **SOFT** (`is_deleted`) + clear `coil.qc_uid`. Blocked if failed and `qc_reject_uid` set. MRN cancel **HARD**-deletes QC by `mrn_uid` |

**Linking**

Pass → set `qc_uid`, issuable. Fail (authorized) → racked coils `status=rejected`; unassigned stay `active` → RM Rejection. Reopen fail may soft-delete rejection. SA Add treated as QC passed without QC row.

**Table impact**

| Action           | Writes                                                           |
|------------------|------------------------------------------------------------------|
| Submit / approve | `rmstore_qc_check` + UPDATE `rmstore_coil_table.qc_uid` / status |
| Delete / reopen  | soft QC + clear `qc_uid`                                         |
