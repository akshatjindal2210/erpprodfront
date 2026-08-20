# RM Spec Master

QC checklist lines per RM item. Stickers blocked without authorized specs (`MRN_STICKER_REQUIRE_SPEC`).

|               |                                                                           |
|---------------|---------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/master/rm-spec`                                       |
| Permission    | `rm_spec_master`                                                          |
| FE            | `modules/master/rm-spec/`                                                 |
| BE            | `modules/spec/`                                                           |
| API           | `POST /api/rmstore/spec/` (`list|get|create|update|delete|header-helper`) |
| Tables        | `rmstore_spec_master` + `rmstore_spec_detail`                         |

**Files**

|               |                                                                                 |
|---------------|---------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/master/rm-spec/` (`Page.js`, `SpecModal.js`) |
| BE            | `backend/src/apps/rmstore/modules/spec/`                                        |

**CRUD**

|                 |                                          |
|-----------------|------------------------------------------|
| Create / Update | lines grouped by `item_dcode`; authorize |
| Read            | list / get                               |
| Delete          | **HARD** master + all detail lines for `item_dcode` |

**Linking**

Existing QC `items` JSONB is a snapshot — not cascade-updated. Coils unchanged.

**Table impact**

| Action          | Writes                               |
|-----------------|--------------------------------------|
| Create / Update | `rmstore_spec_master` + `rmstore_spec_detail` |
| Delete          | **HARD** delete `rmstore_spec_master` + `rmstore_spec_detail`; past QC checks stay |
