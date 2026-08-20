# Location Master

Racks (`RM-{rack}{row}` → `location_no`). Store In helper = authorized only.

|               |                                                                               |
|---------------|-------------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/master/store-location`                                    |
| Permission    | `rm_store_location_master`                                                    |
| FE            | `modules/master/store-location/`                                              |
| BE            | `modules/store-location/`                                                     |
| API           | `POST /api/rmstore/store-locations/` (`list|get|create|update|delete|helper`) |
| Table         | `rmstore_master_location`                                                     |

**Files**

|               |                                                                                                               |
|---------------|---------------------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/master/store-location/` + `modules/store-location/LocationFinderDrawer.js` |
| BE            | `backend/src/apps/rmstore/modules/store-location/`                                                            |

**CRUD**

|                 |                            |
|-----------------|----------------------------|
| Create / Update | pending → authorize        |
| Read            | list / helper (approved)   |
| Delete          | **SOFT** `is_deleted=true` |

**Linking**

Coils keep stale `location_id` (not nulled on location delete).

**Table impact**

| Action                   | Writes                                              |
|--------------------------|-----------------------------------------------------|
| Create / Update / Delete | `rmstore_master_location` only; coil rows unchanged |
