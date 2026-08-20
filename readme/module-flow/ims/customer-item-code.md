# Customer Item Code

Party rate / customer–item map (`custcode` + cust + item).

|               |                                                                   |
|---------------|-------------------------------------------------------------------|
| UI            | `/ims/dashboard/master/customer-item-code`                        |
| Permission    | `customer_item_code`                                              |
| FE            | `modules/master/PartyRateMaster.js`                               |
| BE            | `modules/master/`                                                 |
| API           | `POST /api/master/party-rates/` (`list|helper|resolve-cust-code`) |
| Table         | ERP remote                                                        |

**Files**

|               |                                                           |
|---------------|-----------------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/master/PartyRateMaster.js` |
| BE            | `backend/src/apps/ims/modules/master/`                    |

**CRUD**

|               |                         |
|---------------|-------------------------|
| Create        | none local              |
| Read          | list / helper / resolve |
| Update        | none                    |
| Delete        | none                    |

**Linking**

No local linking table.

**Table impact**

| Action        | Writes          |
|---------------|-----------------|
| Read          | ERP SELECT only |
