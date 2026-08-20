# Stock Adjustment

Add / minus boxes without packing entry. Applies on approve.

|               |                                                                        |
|---------------|------------------------------------------------------------------------|
| UI            | `/ims/dashboard/stock-adjustment`                                      |
| Permission    | `stock_adjustment`                                                     |
| FE            | `modules/stock-adjustment/`                                            |
| BE            | `modules/stock-adjustment/`                                            |
| API           | `POST /api/stock-adjustment/` (`list|get|create|update|delete|helper`) |
| Table         | `ims_stock_adjustment`, `ims_box_table`                                |

**Files**

|               |                                                   |
|---------------|---------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/stock-adjustment/` |
| BE            | `backend/src/apps/ims/modules/stock-adjustment/`  |

**CRUD**

|                 |                                                                                    |
|-----------------|------------------------------------------------------------------------------------|
| Create / Update | draft; approve/unapprove applies                                                   |
| Read            | list / packing-meta / in-hand                                                      |
| Delete          | **SOFT** adjustment. Revert: add → **HARD delete** SA boxes; minus → restore boxes |

**Linking**

Add INSERT `sa_entry_type=stock_in`. Minus marks `stock_out`. Delete reverts then soft-deletes header.

**Table impact**

| Action        | Writes                  |
|---------------|-------------------------|
| Approve add   | SA row + INSERT boxes   |
| Approve minus | SA row + mark boxes out |
| Delete        | revert boxes + soft SA  |
