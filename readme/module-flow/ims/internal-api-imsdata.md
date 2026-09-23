# Internal API — call map (full)

**Paths**
| URL | Env |
|-------------------------------------------------------|-------------------------------------------|
| `POST http://192.168.1.100:3200/data/imsdata`         | `ERP_IMS_API_URL` / `HRMS_ERP_API_URL`    |
| `POST http://192.168.1.100:3200/data/hikconnect`      | `HRMS_HIKCONNECT_API_URL`                 |
| `POST http://192.168.1.100:3200/send/wa`              | `WA_API_URL`                              |

Body: `{ "requestedData", "filter?" }` · Client: `ims/lib/services/ims.service.js`

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
| IMS           | `forwarding-note/*` | `invfnote` | — |
| IMS           | `forwarding-note/forwardingNoteItemsWrite.js` | `schdule` | — |
| IMS           | `schedule-planning/schedulePlanService.js` | `schdule` | — or `m.fyid…` |
| IMS           | same | `schedule_save` | object |
| IMS           | `monthlyPackingLimit.js` | `item`,`schdule` | — |
| IMS           | `erpFgStock.js` | `erpfg` | dcode or — |
| IMS           | `erp-stock-report/…` | `stockadjust` | `{ docno, docdt, qty }` |
| IMS           | Invoice Receiving pending / register / update | `invreceiving` | `{ type: "" }` / `{ type: "register" }` / `{ type: "update", … }` (update not wired yet) |
| RM            | `mrn/mrn.controller.js` | `mrn_rm` | — / `m.mrndt…` / `m.mrnno…` |
| RM            | SA Old | `mrn_rm_old` | FY `m.mrndt…` |
| RM            | sticker / ensure MRN | `mrn_rm` | — |
| RM            | `production/erpItems.js` | `item` `{type:rm}`, `prdprimitem`, `prdrunjc` | |
| RM            | `rm-rejection/…` | `invfnote` | — |
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

### Purchase / Production

```json
{ "requestedData": "item" }
{ "requestedData": "item", "filter": { "type": "fg" } }
{ "requestedData": "cust" }
```
App keeps group **BOP** (Purchase) / **Production** only. Shortage uses maps (`item`+`cust`).

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
