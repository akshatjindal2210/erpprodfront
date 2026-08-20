# Packing Entry

Daily production → generate box stickers (`ims_box_table`) + freeze `ims_dailyprod`.

|               |                                                                                 |
|---------------|---------------------------------------------------------------------------------|
| UI            | `/ims/dashboard/master/packing-entry`                                           |
| Permission    | `packing_entry`                                                                 |
| FE            | `modules/master/DailyProduction.js`, `modules/stickers/StickerCreationModel.js` |
| BE            | `modules/master/` (daily-prod) + `modules/box/` (stickers)                      |
| API           | `POST /api/master/daily-prod/`, `POST /api/boxes/sticker/`                      |
| Table         | `ims_dailyprod`, `ims_box_table`                                                |

**Files**

|               |                                                                                                       |
|---------------|-------------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/master/DailyProduction.js`, `modules/stickers/StickerCreationModel.js` |
| BE            | `backend/src/apps/ims/modules/master/` + `modules/box/` sticker controllers                           |

**CRUD**

|               |                                                                                                                         |
|---------------|-------------------------------------------------------------------------------------------------------------------------|
| Create        | generate = INSERT boxes + upsert `ims_dailyprod`                                                                        |
| Read          | daily-prod list / pack-by-fy                                                                                            |
| Update        | download / print (not box fields)                                                                                       |
| Delete        | cancel stickers = **HARD DELETE** production boxes (`sa_id` stock_in kept). Code does **not** block if already Store In |

**Linking**

`ims_box_download_log.box_uid` → `ON DELETE CASCADE`. Download bumps `download_count`.

**Table impact**

| Action        | Writes                                                                    |
|---------------|---------------------------------------------------------------------------|
| Generate      | INSERT `ims_box_table`, UPDATE `ims_dailyprod`, log `ims_transaction_box` |
| Cancel        | HARD delete production boxes; maybe reset `sticker_generated`             |
| Download      | INSERT `ims_box_download_log`                                             |
