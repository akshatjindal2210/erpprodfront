# Product Master

ERP FG items (`fetchFromIMS("item")`). Needed before packing stickers.

|               |                                               |
|---------------|-----------------------------------------------|
| UI            | `/ims/dashboard/master/product-master`        |
| Permission    | `product_master`                              |
| FE            | `modules/master/ProductMaster.js`             |
| BE            | `modules/master/`                             |
| API           | `POST /api/master/items/` (`list|get|helper`) |
| Table         | ERP remote (no local IMS table)               |

**Files**

|               |                                                                                   |
|---------------|-----------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/master/ProductMaster.js`, `lib/services/master.js` |
| BE            | `backend/src/apps/ims/modules/master/` + `lib/services/ims.service.js`            |

**CRUD**

|               |                     |
|---------------|---------------------|
| Create        | none                |
| Read          | list / get / helper |
| Update        | none                |
| Delete        | none                |

**Linking**

No local rows. Stickers / packing standard key off ERP item codes.

**Table impact**

| Action        | Writes          |
|---------------|-----------------|
| Read          | ERP SELECT only |
