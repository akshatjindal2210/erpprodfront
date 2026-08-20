# Store Location Master

Racks. Store In sets `ims_box_table.location_id`. Helper = authorized only.

|               |                                                                 |
|---------------|-----------------------------------------------------------------|
| UI            | `/ims/dashboard/master/location-master`                         |
| Permission    | `location_master`                                               |
| FE            | `modules/location/`                                             |
| BE            | `modules/location/`                                             |
| API           | `POST /api/locations/` (`list|get|create|update|delete|helper`) |
| Table         | `ims_location_master`                                           |

**Files**

|               |                                                                            |
|---------------|----------------------------------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/location/` (`Page.js`, QR / finder drawers) |
| BE            | `backend/src/apps/ims/modules/location/`                                   |

**CRUD**

|                 |                       |
|-----------------|-----------------------|
| Create / Update | pending → authorize   |
| Read            | list / helper         |
| Delete          | **SOFT** `is_deleted` |

**Linking**

Soft delete does **not** clear boxes' `location_id`.

**Table impact**

| Action                   | Writes                                      |
|--------------------------|---------------------------------------------|
| Create / Update / Delete | `ims_location_master` only; boxes unchanged |
