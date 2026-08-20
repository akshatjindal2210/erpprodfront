# Store Out

Scan to shop floor (`job_card`) or supplier return (`rm_rejection`). FIFO by MRN.

|               |                                                                          |
|---------------|--------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/out-entry`                                           |
| Permission    | `rm_out_entry`                                                           |
| FE            | `modules/out-entry/`, `modules/shared/CoilScanEntryModal.js`             |
| BE            | `modules/out-entry/`                                                     |
| API           | `POST /api/rmstore/out-entries/` (`list|create|update|approve|delete|…`) |
| Table         | `rmstore_out_entry`, `rmstore_out_entry_scanned_coil`                    |

**Files**

|               |                                                                                |
|---------------|--------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/out-entry/`, shared `CoilScanEntryModal.js` |
| BE            | `backend/src/apps/rmstore/modules/out-entry/`                                  |

**CRUD**

|                 |                                                                                  |
|-----------------|----------------------------------------------------------------------------------|
| Create / Update | header + scanned coils                                                           |
| Read            | list / pending / job-card-plan                                                   |
| Delete          | **SOFT** header + **HARD** wipe `rmstore_out_entry_scanned_coil` + status revert |

**Linking**

Job-card approve → `status=out`, `out_uid`. Rejection approve → `status=returned`, clear rack, set `rm_uid`. Delete job-card out → restore `active`, clear `out_uid`. Delete rejection out → `status=rejected`, clear `out_uid`.

**Table impact**

| Action        | Writes                                                       |
|---------------|--------------------------------------------------------------|
| Approve       | `rmstore_out_entry` + scanned rows + coil status / `out_uid` |
| Delete        | soft out; HARD delete scans; revert coils                    |
