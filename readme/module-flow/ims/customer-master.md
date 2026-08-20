# Customer Master

ERP ledgers used on packing stickers and forwarding notes.

|               |                                                 |
|---------------|-------------------------------------------------|
| UI            | `/ims/dashboard/master/customer-master`         |
| Permission    | `customer_master`                               |
| FE            | `modules/master/CustomerMaster.js`              |
| BE            | `modules/master/`                               |
| API           | `POST /api/master/ledgers/` (`list|get|helper`) |
| Table         | ERP remote                                      |

**Files**

|               |                                                          |
|---------------|----------------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/master/CustomerMaster.js` |
| BE            | `backend/src/apps/ims/modules/master/`                   |

**CRUD**

|               |                     |
|---------------|---------------------|
| Create        | none                |
| Read          | list / get / helper |
| Update        | none                |
| Delete        | none                |

**Linking**

No local customer table. Override customer writes `ims_box_table.override_cust`.

**Table impact**

| Action        | Writes          |
|---------------|-----------------|
| Read          | ERP SELECT only |
