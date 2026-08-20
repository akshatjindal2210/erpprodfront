# Store In

Scan location + boxes onto rack. Auto-authorized on create.

|               |                                                                           |
|---------------|---------------------------------------------------------------------------|
| UI            | `/ims/dashboard/inventory-inward`                                         |
| Permission    | `inventory_inwards`                                                       |
| FE            | `modules/inventory-inward/`                                               |
| BE            | `modules/inventory-inward/`                                               |
| API           | `POST /api/inventory-inwards/` (`list|create|update|delete|batch-scan|…`) |
| Table         | `ims_inventory_inwards`                                                   |

**Files**

|               |                                                                                 |
|---------------|---------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/inventory-inward/` (`Page.js`, `InwardModal.js`) |
| BE            | `backend/src/apps/ims/modules/inventory-inward/`                                |

**CRUD**

|               |                                                        |
|---------------|--------------------------------------------------------|
| Create        | `approved=true`; set box `location_id` / `in_uid`      |
| Read          | list / packing-area                                    |
| Update        | re-link boxes                                          |
| Delete        | **SOFT** header + unlink boxes (`resetBoxesForInward`) |

**Linking**

Delete does **not** delete boxes. Clears `in_uid` + `location_id`.

**Table impact**

| Action          | Writes                                          |
|-----------------|-------------------------------------------------|
| Create / Update | `ims_inventory_inwards` + UPDATE boxes + tx log |
| Delete          | soft inward; boxes unlinked                     |
