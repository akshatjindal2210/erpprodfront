# Store In

Optional rack assign. Not required for QC or Issue. QC pass not required to rack.

|               |                                                                                                                                       |
|---------------|---------------------------------------------------------------------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/inventory-inward`                                                                                                 |
| Permission    | `rm_inventory_inwards`                                                                                                                |
| FE            | `modules/inventory-inward/`                                                                                                           |
| BE            | `modules/inventory-inward/`                                                                                                           |
| API           | `POST /api/rmstore/inventory-inwards/` (`list|create|update|approve|delete|…`). IPR receive: `/in-process-requests/complete-store-in` |
| Table         | `rmstore_inventory_inwards`                                                                                                           |

**Files**

|               |                                                                                                                      |
|---------------|----------------------------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/inventory-inward/` (`Page.js`, `InwardModal.js`, `ReceivePendingStoreInModal.js`) |
| BE            | `backend/src/apps/rmstore/modules/inventory-inward/`                                                                 |

**CRUD**

|                  |                                                            |
|------------------|------------------------------------------------------------|
| Create           | auto `approved=true`; sets coil `location_id` / `in_uid`   |
| Read             | list / pending / packing-area                              |
| Update / approve | re-link coils                                              |
| Delete           | **SOFT** header + **unlink** coils (`clearCoilsForInward`) |

**Linking**

Delete does **not** delete coils. Clears `location_id` + `in_uid`. Status stays `active`.

**Table impact**

| Action          | Writes                                                   |
|-----------------|----------------------------------------------------------|
| Create / Update | `rmstore_inventory_inwards` + UPDATE coils rack pointers |
| Delete          | soft inward; coils unlinked (not deleted)                |
