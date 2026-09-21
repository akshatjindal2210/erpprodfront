# Store Out

Scan to shop floor (`job_card`) or supplier return (`rm_rejection`). FIFO by MRN.

|               |                                                                          |
|---------------|--------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/out-entry`                                           |
| Permission    | `rm_out_entry`                                                           |
| FE            | `modules/out-entry/`, `modules/shared/CoilScanEntryModal.js`             |
| BE            | `modules/out-entry/`                                                     |
| API           | `POST /api/rmstore/out-entries/` (`list|create|update|approve|delete|…`) |
| Table         | `rmstore_out_entry`, `rmstore_out_entry_scanned_coil`                    |

**Files**

|               |                                                                                |
|---------------|--------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/out-entry/`, shared `CoilScanEntryModal.js` |
| BE            | `backend/src/apps/rmstore/modules/out-entry/`                                  |

**CRUD**

|                 |                                                                                  |
|-----------------|----------------------------------------------------------------------------------|
| Create / Update | header + scanned coils                                                           |
| Read            | list / pending / job-card-plan                                                   |
| Delete          | **SOFT** header + **HARD** wipe `rmstore_out_entry_scanned_coil` + status revert |

**Linking**

Job-card approve → `status=out`, `out_uid`. Rejection approve → `status=returned`, clear rack, set `rm_uid`. Delete job-card out → restore `active`, clear `out_uid`. Delete rejection out → `status=rejected`, clear `out_uid`.

**Table impact**

| Action        | Writes                                                       |
|---------------|--------------------------------------------------------------|
| Approve       | `rmstore_out_entry` + scanned rows + coil status / `out_uid` |
| Delete        | soft out; HARD delete scans; revert coils                    |

## List UX and permissions (IMS-aligned)

**Register tab (Store Out entries):**

- Single click selects the row only (needed when `allowCopy` is on).
- Double-click does **not** open the modal (same as IMS Out Entry).
- Add / Edit / Authorize / View actions check `rm_out_entry` add / edit / authorize / view via `useCanAccess`; denied actions return **silently** (no extra permission toasts).

**Pending tab:**

- Single click selects the row.
- Double-click opens the appropriate flow when permitted: start scan from pending (add), continue draft (edit), or view completed scans (view). Missing permission → no modal, no toast.
- Incomplete scan double-click shows an info toast to use **Draft**.

**Modal:** `CoilScanEntryModal` supports `viewOnly` for read-only completed entries. Save / approve paths re-check add / edit / authorize before `persist()`.

**DataTable:** Row-level `onDoubleClick` on `<tr>` so double-click works reliably alongside cell copy/selection (`frontend/src/ui/primitives/DataTable.js`).
