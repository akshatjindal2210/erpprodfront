# Sticker Download Logs

Box sticker print / download history.

|               |                                             |
|---------------|---------------------------------------------|
| UI            | `/ims/dashboard/stickers/management`        |
| Permission    | `sticker_download_logs`                     |
| FE            | `modules/stickers/StickerManagementPage.js` |
| BE            | `modules/box/` download log model           |
| API           | `POST /api/boxes/sticker/management-list`   |
| Table         | `ims_box_download_log`                      |

**Files**

|               |                                                                       |
|---------------|-----------------------------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/stickers/StickerManagementPage.js`     |
| BE            | `backend/src/apps/ims/modules/box/models/stickerDownloadLog.model.js` |

**CRUD**

|               |                                                        |
|---------------|--------------------------------------------------------|
| Create        | download track (from packing-entry print)              |
| Read          | management list                                        |
| Update        | none                                                   |
| Delete        | no delete API; orphans CASCADE if box **HARD** deleted |

**Linking**

`box_uid` ON DELETE CASCADE. Increments `ims_box_table.download_count`.

**Table impact**

| Action        | Writes                               |
|---------------|--------------------------------------|
| Download      | INSERT log + UPDATE `download_count` |
| This screen   | SELECT                               |
