# Packing Standard

Qty / boxes / unit / category / sticker type per item. Used at sticker generate.

|               |                                                                        |
|---------------|------------------------------------------------------------------------|
| UI            | `/ims/dashboard/packing-standard`                                      |
| Permission    | `packing_standard`                                                     |
| FE            | `modules/packing-standard/`                                            |
| BE            | `modules/packing-standard/`                                            |
| API           | `POST /api/packing-standard/` (`list|get|create|update|delete|helper`) |
| Table         | `ims_packing_standard` (link `ims_category`, `ims_sticker_type`)       |

**Files**

|               |                                                                                  |
|---------------|----------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/packing-standard/` (`Page.js`, `PackingModal.js`) |
| BE            | `backend/src/apps/ims/modules/packing-standard/`                                 |

**CRUD**

|               |                                   |
|---------------|-----------------------------------|
| Create        | pending unless approved on create |
| Read          | list / helper                     |
| Update        | edit + authorize                  |
| Delete        | **SOFT** `is_deleted`             |

**Linking**

Does not cascade to boxes. `ims_dailyprod.packing_standard_id` → `ON DELETE SET NULL`.

**Table impact**

| Action          | Writes                    |
|-----------------|---------------------------|
| Create / Update | `ims_packing_standard`    |
| Delete          | soft row only; boxes stay |
