# Coils

Read-only inventory list + finder PDF. Coil is the stock unit.

|               |                                                                                |
|---------------|--------------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/coils`                                                     |
| Permission    | `rm_coils`                                                                     |
| FE            | `modules/coil/`                                                                |
| BE            | `modules/coil/`                                                                |
| API           | `POST /api/rmstore/coils/` (`list|get|helper|finder-report`)                   |
| Table         | `rmstore_coil_table`                                                           |

**Files**

|               |                                                                   |
|---------------|-------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/coil/`, `lib/services/coil.js` |
| BE            | `backend/src/apps/rmstore/modules/coil/`                          |

**CRUD**

|               |                              |
|---------------|------------------------------|
| Create        | none (MRN / SA / IPR)        |
| Read          | date range or journey search |
| Update        | none                         |
| Delete        | none                         |

**Linking**

Pointers: `mrn_uid`, `location_id`, `in_uid`, `qc_uid`, `rm_uid`, `out_uid`, `sa_id`, `ipr_uid`. Status: `active` / `out` / `consumed` / `rejected` / `returned`.

**Table impact**

| Action        | Writes                                              |
|---------------|-----------------------------------------------------|
| Read          | SELECT coils (+ joins MRN, location, QC, rejection) |
