# Change / Override Customer

Approval flow to change customer on stickers (`override_cust`).

|               |                                                                     |
|---------------|---------------------------------------------------------------------|
| UI            | `/ims/dashboard/stickers/override-customer`                         |
| Permission    | `change_override_customer`                                          |
| FE            | `modules/stickers/StickerOverrideCustomerPage.js`                   |
| BE            | `modules/box/` override-customer utils                              |
| API           | `POST /api/boxes/sticker/override/` (`list|request|update|approve`) |
| Table         | `ims_box_override_request`                                          |

**Files**

|               |                                                                                                    |
|---------------|----------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/stickers/StickerOverrideCustomerPage.js`, `StickerOverrideModal.js` |
| BE            | `backend/src/apps/ims/modules/box/utils/override-customer/`                                        |

**CRUD**

|               |                                       |
|---------------|---------------------------------------|
| Create        | request                               |
| Read          | list                                  |
| Update        | pending request; approve writes boxes |
| Delete        | no delete API                         |

**Linking**

Approve UPDATEs `ims_box_table.override_cust`. Does not create / delete boxes.

**Table impact**

| Action           | Writes                                          |
|------------------|-------------------------------------------------|
| Request / update | `ims_box_override_request`                      |
| Approve          | request status + boxes `override_cust` + tx log |
