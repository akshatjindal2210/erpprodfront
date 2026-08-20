# MRN Portal

ERP MRN → generate coil stickers into stock. Sticker mode (`coil` / `batch`) stored on MRN at generate.

|               |                                                                           |
|---------------|---------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/mrn-portal`                                           |
| Permission    | `rm_mrn_portal`                                                           |
| FE            | `modules/mrn-portal/`                                                     |
| BE            | `modules/mrn/`                                                            |
| API           | `POST /api/rmstore/mrn/` (`list|generate|delete|detail|coils|… stickers`) |
| Table         | `rmstore_mrn`, `rmstore_coil_table`                                       |

**Files**

|               |                                                                                                          |
|---------------|----------------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/mrn-portal/` (`Page.js`, `MrnStickerModal.js`), `lib/services/mrn.js` |
| BE            | `backend/src/apps/rmstore/modules/mrn/` — `mrn.routes.js`, sticker / print controllers, `mrn.model.js`   |

**CRUD**

|               |                                                                                                       |
|---------------|-------------------------------------------------------------------------------------------------------|
| Create        | MRN row + generate stickers → INSERT coils (`status=active`). Draft = `sticker_draft` JSONB, no coils |
| Read          | ERP list / lookup / coils / detail                                                                    |
| Update        | draft / docs / print                                                                                  |
| Delete        | cancel stickers = **HARD** MRN + portal coils + QC. Partial generate rollback = **SOFT** coils/QC     |

**Linking**

Cancel **blocked** if Store In coils (`location_id` set, `sa_id` null) or SA coils (`sa_id` set). Else cascade **HARD** delete portal coils + QC. SA coils kept. Generate needs authorized spec.

**Table impact**

| Action        | Writes                                                              |
|---------------|---------------------------------------------------------------------|
| Generate      | `rmstore_mrn` + INSERT `rmstore_coil_table`                         |
| Cancel        | HARD `rmstore_mrn` + portal coils + `rmstore_qc_check` by `mrn_uid` |
