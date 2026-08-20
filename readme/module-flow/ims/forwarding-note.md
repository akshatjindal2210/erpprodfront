# Forwarding Note

Dispatch plan. Save **reserves** box qty (does not move stock). Store Out consumes reservation.

|               |                                                                    |
|---------------|--------------------------------------------------------------------|
| UI            | `/ims/dashboard/forwarding-note`                                   |
| Permission    | `forwarding_note_master`                                           |
| FE            | `modules/forwarding-note/`                                         |
| BE            | `modules/forwarding-note/`                                         |
| API           | `POST /api/forwarding-notes/` (`list|create|update|delete|lock|…`) |
| Table         | `ims_forwarding_note_master`, `ims_forwarding_note_item_wise`      |

**Files**

|               |                                                  |
|---------------|--------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/forwarding-note/` |
| BE            | `backend/src/apps/ims/modules/forwarding-note/`  |

**CRUD**

|                 |                                                        |
|-----------------|--------------------------------------------------------|
| Create / Update | master + item rows (logical qty reserve)               |
| Read            | list / available-boxes / erp-stock                     |
| Delete          | **SOFT** master + items. Blocked if `out_entry_locked` |

**Linking**

Items `fuid` CASCADE on hard parent delete (UI uses soft). Soft delete frees reserved qty. Boxes unchanged. Direct create (no `schno`) needs `special_permissions.ims.direct_forwarding_note`.

**Table impact**

| Action          | Writes                                                         |
|-----------------|----------------------------------------------------------------|
| Create / Update | `ims_forwarding_note_master` + `ims_forwarding_note_item_wise` |
| Delete          | soft both; boxes not updated                                   |

Detail: `frontend/readme/app-flow/FORWARDING-NOTE-FLOW.md`
