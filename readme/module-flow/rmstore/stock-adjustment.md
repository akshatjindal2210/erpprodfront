# Stock Adjustment

Add / minus coils without MRN Portal generate. Add skips QC (`sa_id`, `sa_entry_type=stock_in`).

|               |                                                                                    |
|---------------|------------------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/stock-adjustment`                                              |
| Permission    | `rm_stock_adjustment`                                                              |
| FE            | `modules/stock-adjustment/`                                                        |
| BE            | `modules/stock-adjustment/`                                                        |
| API           | `POST /api/rmstore/stock-adjustment/` (`list|get|create|update|delete|stickers|…`) |
| Table         | `rmstore_stock_adjustment`                                                         |

**Files**

|               |                                                                                              |
|---------------|----------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/stock-adjustment/`                                        |
| BE            | `backend/src/apps/rmstore/modules/stock-adjustment/` + `utils/apply/stockAdjustmentApply.js` |

**CRUD**

|                 |                                                          |
|-----------------|----------------------------------------------------------|
| Create / Update | draft then approve applies                               |
| Read            | list / active-coils                                      |
| Delete          | **SOFT** header. Approved delete first **reverts** stock |

**Linking**

Add approve → INSERT coils (`stock_in`, `active`); may ensure `rmstore_mrn`. Minus approve → `status=consumed`, `stock_out` (write-off, not shop floor). Revert add → **SOFT**-delete SA coils. Revert minus → restore `active`. SA coils **block** MRN cancel.

**Table impact**

| Action        | Writes                                    |
|---------------|-------------------------------------------|
| Approve add   | `rmstore_stock_adjustment` + INSERT coils |
| Approve minus | SA row + coil `status=consumed`           |
| Delete        | soft SA + revert coils                    |
