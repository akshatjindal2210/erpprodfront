# Store Out

Scan boxes out vs FN (or QC / inventory-out types). Approve sets `out_uid`.

|               |                                                                     |
|---------------|---------------------------------------------------------------------|
| UI            | `/ims/dashboard/out-entry`                                          |
| Permission    | `out_entry`                                                         |
| FE            | `modules/out-entry/`                                                |
| BE            | `modules/out-entry/`                                                |
| API           | `POST /api/out-entries/` (`list|create|update|delete|verify-box|…`) |
| Table         | `ims_out_entry`, `ims_out_entry_scanned_box`                        |

**Files**

|               |                                                                            |
|---------------|----------------------------------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/out-entry/` (`Page.js`, `OutEntryModal.js`) |
| BE            | `backend/src/apps/ims/modules/out-entry/`                                  |

**CRUD**

|                 |                                                                                                       |
|-----------------|-------------------------------------------------------------------------------------------------------|
| Create / Update | draft scans in `ims_out_entry_scanned_box`                                                            |
| Read            | list / linked / available boxes                                                                       |
| Delete          | **SOFT** out_entry; draft scans **HARD** deleted; `resetBoxesForOutEntry` (`out_uid=NULL`); unlock FN |

**Linking**

Approve links `out_uid` (stock out). Location usually kept until other flows clear. Scanned_box CASCADE on hard parent delete.

**Table impact**

| Action        | Writes                                                 |
|---------------|--------------------------------------------------------|
| Approve       | `ims_out_entry` + UPDATE boxes `out_uid` + lock FN     |
| Delete        | soft out + unlink boxes + HARD clear scans + unlock FN |
