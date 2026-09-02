# Boxes

Read-only box map. Created by Packing Entry / Stock Adjustment / QC completion.

|               |                                                                                                         |
|---------------|---------------------------------------------------------------------------------------------------------|
| UI            | `/ims/dashboard/box`                                                                                    |
| Permission    | `boxes`                                                                                                 |
| FE            | `modules/box/`                                                                                          |
| BE            | `modules/box/`                                                                                          |
| API           | `POST /api/boxes/` (`list|get|helper`). create/update/delete exist in controller but are **not routed** |
| Table         | `ims_box_table`                                                                                         |

**Files**

|               |                                                             |
|---------------|-------------------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/box/`, `lib/services/box.js` |
| BE            | `backend/src/apps/ims/modules/box/`                         |

**CRUD**

|               |                     |
|---------------|---------------------|
| Create        | none on this screen |
| Read          | list / get / finder |
| Update        | none                |
| Delete        | none                |

**Linking**

Reads `location_id`, `in_uid`, `out_uid`, `qc_hold_id`, `sa_id`, FN, dailyprod.

**Stock zone:** in store / packing / QC hold / dispatch. A stock-adjustment **add** box (`sa_entry_type = stock_in`) that later gets `out_uid` is **dispatch**, even if `out_uid === sa_id` (those ids can collide). See [v3.4.38.box-dispatch-sa-id.md](../../version-notes/v3.4.38.box-dispatch-sa-id.md).

**Table impact**

| Action        | Writes       |
|---------------|--------------|
| Read          | SELECT boxes |
