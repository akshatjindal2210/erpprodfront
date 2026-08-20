# Inventory Audit

Physical count vs system boxes by location. Optional comparison adjustment moves boxes.

|               |                                                                                      |
|---------------|--------------------------------------------------------------------------------------|
| UI            | `/ims/dashboard/audit`                                                               |
| Permission    | `audit` (verify = super_admin)                                                       |
| FE            | `modules/audit/`                                                                     |
| BE            | `modules/audit/`                                                                     |
| API           | `POST /api/audit/` (`list|create|update|delete|submit-scan|comparison-adjustment|…`) |
| Table         | `ims_audit_master`, `ims_audit_locations` (scans in `scanned_boxes` JSONB)           |

**Files**

|               |                                        |
|---------------|----------------------------------------|
| FE            | `frontend/src/apps/ims/modules/audit/` |
| BE            | `backend/src/apps/ims/modules/audit/`  |

**CRUD**

|               |                                            |
|---------------|--------------------------------------------|
| Create        | authorize master + location assignments    |
| Read          | list / get / comparison-report             |
| Update        | scans JSON; locations may be HARD replaced |
| Delete        | **SOFT** master                            |

**Linking**

`comparison-adjustment` UPDATE `ims_box_table.location_id` (clear or assign). Does not delete boxes. `ims_audit_scans` is listed in dbTables but **not used**.

**Table impact**

| Action            | Writes                                     |
|-------------------|--------------------------------------------|
| Create / scan     | `ims_audit_master` + `ims_audit_locations` |
| Comparison adjust | box `location_id`                          |
| Delete            | soft master (locations may remain)         |
