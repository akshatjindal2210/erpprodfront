# Internal API — call map (full)

**Paths**
| URL | Env |
|-------------------------------------------------------|-------------------------------------------|
| `POST http://192.168.1.100:3200/data/imsdata`         | `ERP_IMS_API_URL` / `HRMS_ERP_API_URL`    |
| `POST http://192.168.1.100:3200/data/hikconnect`      | `HRMS_HIKCONNECT_API_URL`                 |
| `POST http://192.168.1.100:3200/send/wa`              | `WA_API_URL`                              |

Body: `{ "requestedData", "filter?" }` · Client: `ims/lib/services/ims.service.js`

---

## Quick list — `requestedData` → kaha use

**Core (Users)**
- `userlist`, `checkpass`, `changepass` — `users/user.controller.js` (user list, login, password change)

**IMS**
- `item` — master, group masters (BOP/Production), packing customers, monthly packing limit
- `cust`, `custcode` — master, packing entry customers, audit box snapshot
- `fyid` — master (financial year)
- `pack` — master, daily prod list, box, sticker print, stock adjustment, backfill
- `invmnote` — Gate Entry, Invoice Receiving (customer name)
- `invfnote` — Gate Entry, Forwarding Note
- `schdule` — Schedule Planning, Forwarding Note items, monthly packing limit
- `schedule_save` — Schedule Planning (plan save)
- `erpfg` — `erpFgStock.js` (FG stock)
- `stockadjust` — ERP Stock Report
- `invreceiving` — sirf backfill `backfills/importErpInvoiceReceivingToGate.js` (IR screen ab Gate Entry pe local)

**RM Store**
- `mrn_rm` — MRN, sticker / ensure MRN
- `mrn_rm_old` — SA Old, sticker MRN resolve
- `item` `{type:rm}`, `prdprimitem`, `prdrunjc` — `rmstore/modules/production/utils/erpItems.js` (running JC master / FG overlay)
- `invfnote` — RM Rejection bills (acc_name + item match)

**Production — Maintain Job Card (ERP sync + reads)**
- **`mjcnew`** — add / update / delete Job Card on ERP — **single file:** `backend/src/apps/production/modules/job-card/jobCardErp.js` (`ERP_REQUESTED_DATA`, `mjcnewFilter`); calls via `core/lib/services/erpSync.js` → `ims.service.js`
- **`fyid`** — FY resolve on New JC — same `jobCardErp.js` (`resolveFyidForJobCard`); list also `master/master.controller.js`
- **`prdrunjc`** — read-only max jobcardno with `mjcnew` in `nextJobcardno`; running JC list still `rmstore/.../erpItems.js`

**Engineering (ERP sync)**
- **`mstproc`** — Process Master CRUD — `engineering/modules/process-master/controllers/processMaster.controller.js`; seed pull `migrations/v5.2.0/seedErpMasters.js`
- **`mstmac`** — Machine Master CRUD — `engineering/modules/machine-master/controllers/machineMaster.controller.js`; seed pull same migration

**Dashboard**
- `erp_mssql`, `hrms_mssql` — raw SQL query
- `dashboard_tables`, `hrms_dashboard_tables` — table list

**HRMS**
- `hrmsempmaster` — employee master (`hrms/lib/erpApi.js`)
- hikconnect: `add`, `blacklist`, `list`, `sync`, `image` — device / attendance

**Task**
- `/send/wa`: `swa` (free), `swpa` (paid) — WhatsApp notify

---

## `imsdata` — direct calls

| App           | Where (file) | `requestedData` | Filter |
|---------------|--------------|-----------------|--------|
| Core          | `users/user.controller.js` | `userlist` | — |
| Core          | same | `checkpass` | `{ user, password }` |
| Core          | same | `changepass` | `{ user, usercode, oldpassword, password }` |
| IMS           | `master/master.controller.js` | `item` | — or `{ type:"fg" }` |
| IMS           | same | `cust` | — |
| IMS           | same | `custcode` | — |
| IMS           | same | `fyid` | — or `{ fyid: 1 }` |
| IMS           | same | `pack` | default 7 days, or `dailyprod.docdt…` |
| IMS           | same | `pack` | FY+doc via `fetchPackRowsForFinancialYearDoc` |
| IMS           | `createGroupMasterControllers.js` | `item` | — or `{ type:"fg" }` |
| Purchase      | master → group **BOP** | `item` | same helper |
| Production    | master → group **Production** | `item` | same helper |
| IMS           | `packing-entry/dailyProdList.js` | `pack` | 7-day default or date SQL |
| IMS           | `packing-entry/packingEntryCustomers.js` | `custcode`,`item` | — |
| IMS           | `packing-entry/backfillDailyprodStickerSnapshot.js` | `pack` | date filter |
| IMS           | `box/box.controller.js` | `pack` | FY filter or — |
| IMS           | `box/boxListItemMeta.js` | `pack` | FY/doc filter |
| IMS           | `box/stickerPrintMeta.js` | `pack` | — or FY+doc |
| IMS           | `stock-adjustment/*Packing*.js` + list | `pack` | FY+doc or date filter |
| IMS           | `gate-entry/gateEntry.controller.js` | `invmnote` | `billdt…` or — |
| IMS           | same | `invfnote` | same or — |
| IMS           | `invoice-receiving/invoiceReceiving.controller.js` | `invmnote` | `billdt…` or — (customer name only) |
| IMS           | `forwarding-note/*` | `invfnote` | — |
| IMS           | `forwarding-note/forwardingNoteItemsWrite.js` | `schdule` | — |
| IMS           | `schedule-planning/schedulePlanService.js` | `schdule` | — or `m.fyid…` |
| IMS           | same | `schedule_save` | object |
| IMS           | `monthlyPackingLimit.js` | `item`,`schdule` | — |
| IMS           | `erpFgStock.js` | `erpfg` | dcode or — |
| IMS           | `erp-stock-report/…` | `stockadjust` | `{ docno, docdt, qty }` |
| IMS           | `backfills/importErpInvoiceReceivingToGate.js` | `invreceiving` | `{ type: "register" }` (IR screen ab local on Gate Entry) |
| RM            | `mrn/mrn.controller.js` | `mrn_rm` | — / `m.mrndt…` / `m.mrnno…` |
| RM            | SA Old | `mrn_rm_old` | FY `m.mrndt…` |
| RM            | sticker / ensure MRN | `mrn_rm` | — |
| RM            | `rmstore/modules/production/utils/erpItems.js` | `item` `{type:rm}`, `prdprimitem`, `prdrunjc` | — or item `{ type:"rm" }` |
| RM            | `rm-rejection/…` | `invfnote` | bill helper + pending match |
| Production    | `production/modules/job-card/jobCardErp.js` | **`mjcnew`** | `{ type:"add"\|"update"\|"delete", … }` — see examples |
| Production    | same | **`fyid`** | — (list) for `resolveFyidForJobCard` |
| Production    | same | **`mjcnew`**, **`prdrunjc`** | — (list only) for `nextJobcardno` max |
| Engineering   | `process-master/processMaster.controller.js` | **`mstproc`** | `{ type:"add"\|"update"\|"delete", proccode, procname }` |
| Engineering   | `machine-master/machineMaster.controller.js` | **`mstmac`** | add/update/delete machine fields |
| Engineering   | `migrations/v5.2.0/seedErpMasters.js` | **`mstproc`**, **`mstmac`** | — (pull into empty eng_* tables) |
| IMS           | `audit/auditBoxSnapshot.js` | `custcode` | — |
| Dash          | queryExecutor / hybrid | `erp_mssql` / `hrms_mssql` | SQL |
| Dash          | dashboard.controller | `dashboard_tables` / `hrms_dashboard_tables` | — |
| HRMS          | `hrms/lib/erpApi.js` | `hrmsempmaster` | emp filter |

## `getImsMapsSafe()` → `item` + `cust`

IMS (many screens), RM store-location/erpItems, Purchase/Production shortage.

## hikconnect

`add` / `blacklist` / `list` / `sync` / `image` — `hrms/lib/erpApi.js`

## `/send/wa`

`swa` / `swpa` — Task notify gateway

---

## Examples (all apps — full)

### Masters / auth

```json
{ "requestedData": "item" }
{ "requestedData": "item", "filter": { "type": "fg" } }
{ "requestedData": "item", "filter": { "type": "rm" } }
{ "requestedData": "cust" }
{ "requestedData": "custcode" }
{ "requestedData": "userlist" }
{ "requestedData": "fyid" }
{ "requestedData": "fyid", "filter": { "fyid": 1 } }
{ "requestedData": "checkpass", "filter": { "user": "ea", "password": "eh1" } }
{ "requestedData": "changepass", "filter": { "username": "EA", "usercode": 95, "password": "eh1" } }
```

App code changepass: `{ "user", "usercode", "oldpassword", "password" }`.

### Pack

```json
{ "requestedData": "pack" }
```
No filter → default **7 days**.

```json
{
  "requestedData": "pack",
  "filter": "dailyprod.docdt >= '2Apr2026' and dailyprod.docdt <= '6Apr2026'"
}
```

```json
{
  "requestedData": "pack",
  "filter": "dailyprod.docdt >= '1Apr2025' and dailyprod.docdt <= '31Mar2026' and dailyprod.docno = 30637"
}
```

### Gate / bills / invoice

```json

{
  "requestedData": "invreceiving",
  "filter": {
    "type": "register",
    "data":"billdt >= '2Apr2026' and billdt <= '6Aug2026'" 
  }
}

{ "requestedData": "invmnote" }
{ "requestedData": "invmnote", "filter": "billdt >= '2Apr2026' and billdt <= '6Aug2026'" }
{ "requestedData": "invfnote" }
{ "requestedData": "invfnote", "filter": "billdt >= '2Apr2026' and billdt <= '6Aug2026'" }
{ "requestedData": "invreceiving", "filter": { "type": "" } }
{ "requestedData": "invreceiving", "filter": { "type": "register" } }
{
  "requestedData": "invreceiving",
  "filter": {
    "type": "register",
    "data": "billdt >= '2Apr2026' and billdt <= '6Aug2026'"
  }
}
{
  "requestedData": "invreceiving",
  "filter": {
    "type": "update",
    "billno": "HPF/26-27/2305",
    "billdt": "2026-09-20",
    "acc_name": "ACME PVT LTD",
    "file_name": "invoice.pdf",
    "file_path": "uploads/ims/invoice-receiving/1727000000000_invoice.pdf",
    "uploaded_by": "EA",
    "uploaded_at": "2026-09-22T06:30:00.000Z",
    "approved": true
  }
}
```

### Schedule / FG / stock adjust

```json
{ "requestedData": "schdule" }
{
  "requestedData": "schdule",
  "filter": "m.fyid = 12 and m.schmonth = 9 and m.docdt >= '2026-09-01' and m.docdt <= '2026-09-30'"
}
{
  "requestedData": "schedule_save",
  "filter": {
    "fin_year_id": 12,
    "schno": "SCH1",
    "itemdcode": 17831,
    "target_date": "22Sep2026",
    "qty": 100,
    "status": "schedule",
    "remarks": ""
  }
}
{ "requestedData": "erpfg" }
{ "requestedData": "erpfg", "filter": 17831 }
{
  "requestedData": "stockadjust",
  "filter": { "docno": 17841, "docdt": "2025-10-11", "qty": 1970 }
}
```

### RM Store

```json
{ "requestedData": "mrn_rm" }
{ "requestedData": "mrn_rm", "filter": "m.mrndt >= '1Apr2025' and m.mrndt <= '31Mar2026'" }
{ "requestedData": "mrn_rm", "filter": "m.mrnno = 2129" }
{ "requestedData": "mrn_rm_old" }
{ "requestedData": "mrn_rm_old", "filter": "m.mrndt >= '1Apr2025' and m.mrndt <= '31Mar2026'" }
{ "requestedData": "prdprimitem" }
{ "requestedData": "prdrunjc" }
{ "requestedData": "item", "filter": { "type": "rm" } }
{ "requestedData": "invfnote" }
```

### Purchase / Production (masters)

```json
{ "requestedData": "item" }
{ "requestedData": "item", "filter": { "type": "fg" } }
{ "requestedData": "cust" }
```
App keeps group **BOP** (Purchase) / **Production** only. Shortage uses maps (`item`+`cust`).

### Maintain Job Card — `mjcnew` (ERP sync)

Filter keys are **lowercase**. Payload builder: `jobCardErp.js` → `mjcnewFilter`.  
Trigger: `jobCard.controller.js` after DB save/delete (`erpSynced` in JSON response).

**add** — first save with process plan (create or update when plan was empty):

```json
{
  "requestedData": "mjcnew",
  "filter": {
    "type": "add",
    "jobcardno": 14211,
    "jcseriescode": 30,
    "pjobcardno": "JC-14211",
    "jobcarddt": "2026-04-02T00:00:00.000Z",
    "fyid": 12,
    "planqty": 500,
    "itemdcode": 17831,
    "maccode": 101,
    "acc_code": 2479
  }
}
```

**update** — `planqty` change only (create re-save or Register update):

```json
{
  "requestedData": "mjcnew",
  "filter": {
    "type": "update",
    "jobcardno": 14211,
    "fyid": 12,
    "jcseriescode": 30,
    "planqty": 600
  }
}
```

**delete** — before app DB hard delete (when `jobcardno` + `fyid` + `itemdcode` on card; stub-only skip ERP). Not app `docno`:

```json
{
  "requestedData": "mjcnew",
  "filter": {
    "type": "delete",
    "jobcardno": 14211,
    "itemdcode": 17831,
    "fyid": 12,
    "jcseriescode": 30
  }
}
```

Read-only (no `type` in filter):

```json
{ "requestedData": "fyid" }
{ "requestedData": "mjcnew" }
{ "requestedData": "prdrunjc" }
```

Constants (change only in `jobCardErp.js`): `jcseriescode` **30**, default `acc_code` **2479**.

### App REST — Maintain Job Card (not imsdata)

Express mount: **`POST /api/production/job-card/<action>`**  
Routes file: `backend/src/apps/production/modules/job-card/routes/jobCard.route.js`  
Handlers: `.../controllers/jobCard.controller.js`  
Frontend paths: `frontend/src/apps/production/lib/config/endpoints.js` · client `modules/job-card/jobCard.js`

| POST action | Handler | Permission |
|-------------|---------|------------|
| `/register`, `/register-helper` | `getJobCardRegister` | view / helper |
| `/pending`, `/pending-shortage` | pending lists | view |
| `/get`, `/get-helper` | `getJobCardById` | view / helper |
| `/prime-process`, `/estimate-production` | prime / estimate | view |
| `/suggest-erp-no` | `getSuggestedErpJobcardno` | Super Admin |
| `/create` | `createJobCard` | add |
| `/update`, `/update-helper`, `/approve` | `updateJobCardById` | edit / authorize |
| `/delete` | `deleteJobCardById` | delete |

### Engineering — `mstproc` / `mstmac`

```json
{ "requestedData": "mstproc" }
{ "requestedData": "mstproc", "filter": { "type": "add", "proccode": 10, "procname": "MILLING" } }
{ "requestedData": "mstproc", "filter": { "type": "update", "proccode": 10, "procname": "MILLING" } }
{ "requestedData": "mstproc", "filter": { "type": "delete", "proccode": 10, "procname": "MILLING" } }
{ "requestedData": "mstmac" }
{ "requestedData": "mstmac", "filter": { "type": "add", "maccode": 1, "macname": "CNC-1", "macno": "CNC-1", "macproccode": 10, "cavity": null, "maccycletime": 60 } }
```

### HRMS — imsdata

```json
{ "requestedData": "hrmsempmaster" }
```

### HRMS — hikconnect (`…/data/hikconnect`)

```json
{ "requestedData": "add", "filter": { "UserInfo": {} } }
{ "requestedData": "blacklist", "filter": { "UserInfo": {} } }
{ "requestedData": "list", "filter": { "UserInfoSearchCond": {} } }
{ "requestedData": "sync", "filter": { "AcsEventCond": {} } }
{ "requestedData": "image", "filter": "http://host/path/photo.jpg" }
```

### Dashboard

```json
{ "requestedData": "dashboard_tables" }
{ "requestedData": "hrms_dashboard_tables" }
{ "requestedData": "erp_mssql", "filter": "SELECT * from item where itgrpcode = 15" }
{ "requestedData": "hrms_mssql", "filter": "SELECT TOP 10 * FROM SomeHrmsTable" }
```

### Task — `…/send/wa`

```json
{
  "requestedData": "swa",
  "filter": {
    "recipient": "91XXXXXXXXXX",
    "trigger": "task_assigned",
    "send_via": "free",
    "subject": "",
    "body": "",
    "message": "",
    "task_id": "1"
  }
}
{
  "requestedData": "swpa",
  "filter": {
    "recipient": "91XXXXXXXXXX",
    "trigger": "daily_reminder",
    "send_via": "paid",
    "subject": "",
    "body": "",
    "message": "",
    "task_id": "1"
  }
}
```
