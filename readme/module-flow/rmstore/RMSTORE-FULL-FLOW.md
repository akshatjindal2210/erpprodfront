# RM Store — Full Flow (A → Z)

One page for the whole RM Store: where material comes in, every step it passes, where it leaves, and which page / API / file / table does what.
Module detail pages: [rmstore.md](./rmstore.md) (index).

---

## 1. Big picture

```
ERP (IMS internal API: mrn_rm)
   │
   ▼
[1] MRN Portal ── generate + approve stickers ──► coils created (active, Unassigned)
   │
   ├─► [2] QC Check ── pass ──► issuable
   │                 └ fail ──► [7] RM Rejection
   ├─► [3] Store In ── put coil on a rack (optional, any time while in store)
   │
   ▼
[4] Issue Request (plan coils per job card, from ERP prdrunjc)
   │
   ▼
[5] Store Out (job card) ── authorize ──► coil OUT on shop floor
   │
   ▼
[6] In-process Request (on shop floor)
   ├ Consume   full → consumed (gone) · partial → balance waits in Store In Pending → received (active, Unassigned)
   ├ Return    → Store In Pending → received (active, Unassigned)
   ├ Reassign  → stays OUT, moves to another job card
   └ Reject    → store coils held now · shop-floor coils wait in Store In Pending (same IPR row) → received + held
                 → [7] RM Rejection → [5] Store Out (rm_rejection) → coil RETURNED (gone) → attach bill

[8] Stock Adjustment  Add = new coils (after approve) · Minus = write-off (consumed)
[9] RM Inventory / Inventory Audit / Coils / Logs = read-only views over the coil table
```

**Coil = the stock unit.** Every stock number in the app is computed from `rmstore_coil_table`.

---

## 2. The coil row (`rmstore_coil_table`)

| Column | Meaning | Set by |
|---|---|---|
| `coil_no_uid` | Sticker UID, e.g. `RM_26_4224_5_3_1` | MRN Portal / Stock Adjustment Add |
| `mrn_uid` | MRN line, e.g. `4224_5` (`{mrn_no}_{line}`) | MRN Portal / SA |
| `qty` | Current qty (reduced by partial consume) | create, IPR consume / return |
| `location_id`, `in_uid` | Rack + Store In entry. `NULL` = Unassigned | Store In; cleared on production return / rejection receive |
| `qc_uid` | QC check | QC Check |
| `out_uid` | Store Out entry that issued / returned it | Store Out authorize |
| `ipr_uid` | In-process request holding / consuming it | IPR |
| `rm_uid` | RM Rejection register (`qc_reject_uid`) | RM Rejection |
| `sa_id`, `sa_entry_type` | Stock Adjustment (`stock_in` = Add, `stock_out` = Minus) | Stock Adjustment |
| `status` | `active` · `out` · `rejected` · `returned` · `consumed` | every step below |

### Status lifecycle

| Status | Where the coil physically is | Required links |
|---|---|---|
| `active` | In store (rack if `location_id`, else Unassigned) | no `rm_uid`, no `out_uid` |
| `rejected` | In store, held — cannot be issued | `rm_uid` (register) **or** `ipr_uid` (approved reject IPR) **or** failed `qc_uid` |
| `out` | Shop floor | `out_uid` → approved Store Out. Keeps old `location_id` on purpose (history); rack views ignore it |
| `returned` | Gone — sent back to supplier | `rm_uid` + `out_uid` → approved `rm_rejection` Store Out |
| `consumed` | Gone — used at machine, or SA Minus write-off | `ipr_uid` (consume/reassign IPR) or `sa_entry_type = stock_out` |

---

## 3. Inventory numbers (single source of truth)

File: `backend/src/apps/rmstore/modules/inventory-report/models/inventoryReport.model.js` → `buildCoilRules()`.
All counts ignore `consumed` coils and un-approved SA Add coils.

| Bucket | Rule |
|---|---|
| **In Store** | not `out`/`consumed`, `out_uid` NULL, `location_id` set |
| **Unassigned** | same, `location_id` NULL |
| **Shop Floor** | `status = out` and `out_uid` set |
| **Total Stock** | In Store + Unassigned + Shop Floor |
| **Issuable** | In Store / Unassigned + QC passed + not rejected |
| **QC Pending** | active, no SA, QC not passed/failed (part of In Store / Unassigned) |
| **Pending Reject** | QC failed or `rejected`, still in store |

`returned` coils have `out_uid` set and status `returned` → they are outside every bucket (gone).

---

## 4. Step by step

Paths: FE page = `frontend/src/app/rmstore/dashboard/<page>/page.js`, FE module = `frontend/src/apps/rmstore/modules/<module>/`, FE service = `frontend/src/apps/rmstore/lib/services/<service>.js`, BE = `backend/src/apps/rmstore/modules/<module>/` (`routes` · `controllers` · `models`). API base = `POST /api/rmstore/<route>/…`.

### 0. Masters
| Page | Module / service | API | Table |
|---|---|---|---|
| `master/production` (Item RM master) | `master/production` · `production.js` | `/production` | `rmstore_master_production` (+ ERP `prdrunjc`, `item`) |
| `master/rm-spec` | `master/rm-spec` · `spec.js` | `/spec` | `rmstore_spec_master`, `rmstore_spec_detail` |
| `master/store-location` | `master/store-location` · `storeLocation.js` | `/store-locations` | shared `ims` location master |
| `master/rm-product` | `master/rm-product` · `rmProduct.js` | `/rm-products` | ERP `item` (read) |

### 1. MRN Portal — material comes in
- **Page:** `mrn-portal` (+ `master/mrn-entry`, `master/mrn-entries`) · service `mrn.js` · API `/mrn`
- **Data from:** ERP `mrn_rm` (and `mrn_rm_old`) via `fetchFromIMS` → saved as a snapshot in `rmstore_mrn` (vendor `acc_code`/`acc_name`, `item_dcode`/`item_code`, `heat_no`, `qty`, `bill_no`).
- **Logic:** `generate-stickers` → `insertBulkCoils` creates one coil per sticker (`active`, Unassigned). `approve-stickers` makes them usable. `reject` = MRN Portal rejection (register only, no coils). Cancel stickers = hard delete MRN coils (blocked once any coil is Store-In'd).
- **Writes:** `rmstore_mrn`, `rmstore_coil_table`.

### 2. QC Check — compulsory before issue
- **Page:** `qc-check` · `qcCheck.js` · API `/qc-checks` · BE `qc-check`
- **Data from:** coils of the MRN + spec master (`rmstore_spec_*`).
- **Logic:** `prepare` → `submit` → `approve`. Pass → `markCoilsQcPassed` (active, issuable). Fail → `markCoilsQcFailPending` (held) and the check appears in **RM Rejection → Pending (QC Fail)**.
- **Writes:** `rmstore_qc_check`, coil `qc_uid` / `status`.

### 3. Store In — put coil on a rack
- **Page:** `inventory-inward` (tabs **Store In** / **Unassigned**) · `inventoryInward.js` · API `/inventory-inwards`
- **Logic:** Store In entry assigns `location_id` + `in_uid` (`updateCoilsAfterInward`, `syncInwardRegisterCoils`). Delete → `clearCoilsForInward` (back to Unassigned).
- **Unassigned tab:** coils with no rack **plus** the Store In Pending queue = `GET /in-process-requests/pending-store-in` (consume balance, return, and rejection shop-floor coils). Receive button = `/in-process-requests/complete-store-in` (`ReceivePendingStoreInModal.js`). SOURCE badge: `IPR #id` / `PRODUCTION RETURN` / `STOCK ADJUSTMENT` / `MRN PORTAL`.
- **Writes:** `rmstore_inventory_inwards`, coil `location_id`, `in_uid`.

### 4. Issue Request — plan what goes to which job card
- **Page:** `issue-request` · `issueRequest.js` · API `/issue-requests`
- **Data from:** ERP `prdrunjc` (running job cards) + `rmstore_master_production` (FG ↔ RM mapping) + issuable coils (`/available-coils`).
- **Logic:** per job card picks coils (`rmstore_issue_request_job_card.coils`). **Does not change coils** — Store Out does. `lock-store-out` stops edits once Store Out starts.
- **Writes:** `rmstore_issue_request`, `rmstore_issue_request_job_card`.

### 5. Store Out — material leaves the store
- **Page:** `out-entry` · `outEntry.js` · API `/out-entries` · scan drawer `modules/shared/CoilScanEntryModal.js`
- **Pending tab:** job cards from approved Issue Requests + RM rejections ready for Store Out (`findPendingRejectionStoreOut`).
- **Logic:** scan coils → draft (`rmstore_out_entry_scanned_coil`) → authorize:
  - `job_card` → `updateCoilsAfterJobCardStoreOut` → coil `out`, `out_uid`.
  - `rm_rejection` → `updateCoilsAfterRejectionStoreOut` → coil `returned` (+ IPR stage `store_out_done`). Rejection must scan exactly the register's coils.
  - Delete → job card: `clearCoilsForStoreOut` (back to `active`, rack kept); rejection: `clearCoilsForRejectionStoreOut` (back to `rejected`).
- **Writes:** `rmstore_out_entry`, `rmstore_out_entry_scanned_coil`, coil `status` / `out_uid`.

### 6. In-process Request (IPR) — what happens on the shop floor
- **Page:** `in-process-request` (Register / Pending) · `inProcessRequest.js` · API `/in-process-requests` · BE `in-process-request`
- **Table:** `rmstore_in_process_request` — `type` (`consume` · `return` · `reassign` · `reject_coil` · `reject_lot`), `stage`, `coils` JSON (snapshot per coil: `coil_no_uid`, `qty`, `out_uid`, `pjobcardno`, `macname`, consume qty).
- **Stages:** `pending_store_in` → `store_in_done` (return/consume balance) · `consumed` · `pending_store_out` → `store_out_done` (reject).

| Type | On approve | Next |
|---|---|---|
| Consume full | `processConsumeCoils` → `consumed` | done |
| Consume partial | used qty logged, coil qty reduced, stays `out`; stage `pending_store_in` | Store In receive → `active`, Unassigned |
| Return | stage `pending_store_in` | receive → `active`, Unassigned (`processStoreInReturnCoils`) |
| Reassign | stays `out`, new job card in `reassign_jc` | — |
| Reject (coil / lot) | store coils → `rejected` + `ipr_uid` now. Shop-floor coils stay `out`; stage `pending_store_in` (**same row, no extra IPR**) | receive in Store In → held, `location_id` cleared; stage `pending_store_out` → RM Rejection Pending |

- **Unapprove / delete a rejection:** store coils → `active`; shop-floor coils (line has `out_uid`/JC) → back to `out` on their old Store Out, even if already received.
- **Display enrich (not stored):** FG item / machine / RM item come from Issue Request job cards (`findIssueRequestRegisterMetaByCoilUids` / `…ByPjobcardnos`) and ERP `prdrunjc` — first coil line that has a job card wins.
- **Search:** all rows are loaded; quick search filters on the client (row fields + every coil UID).

### 7. RM Rejection — send bad material back
- **Page:** `rm-rejection` (Pending / Register) · `rmRejection.js` · API `/rm-rejections` · BE `rm-rejection`
- **Table:** `rmstore_rejection` (`qc_reject_uid`, `ipr_uid`, `mrn_uids`, `coil_count`, `total_qty`, `bill_no`, `bill_dt`). Coils link back via coil `rm_uid`.
- **Pending tab** = QC fail checks + in-process rejections at `pending_store_out` + registers without a bill (`Store Out Pending` / `Awaiting Bill`).
- **Flow:** Generate Store Out (`/generate-store-out` from QC, `/generate-store-out-from-ipr`) → register created, coils linked (`rejected`, `rm_uid`) → **Store Out → Pending → scan + authorize** (coils `returned`) → **Complete** with bill → Register.
- **Bill (IMS style):** bills = ERP `invfnote`, `salecat = 2`. Only **Green** bills can be attached.
  - Super admin: all bills.
  - Normal user: bills whose fields equal the rejection's — one list in `rmRejection.controller.js`:
    ```js
    const BILL_MATCH_FIELDS = ["acc_code", "item_dcode"]; // add "qty" or remove a field here
    ```
    Used by the dropdown (`/bill-helper`, FE sends only `qc_reject_uid`), the Pending auto-match, and the save guard on `/complete-bill` + `/update-bill`.
  - Dropdown sub-line: `Supplier · Item · Qty · Bill date`.
- **Delete register:** soft delete; coils back to QC fail / IPR hold. Blocked after Store Out authorize or bill attach.

### 8. Stock Adjustment
- **Page:** `stock-adjustment` · `stockAdjustment.js` · API `/stock-adjustment`
- **Add:** on approve `insertStockAdjustmentAddCoils` (new coils, `sa_entry_type = stock_in`, no QC). Un-approved Add coils are excluded from inventory.
- **Minus:** `markCoilsStockAdjustmentOut` → coil `consumed`, `sa_entry_type = stock_out` (write-off). Revert → `active`.
- **Writes:** `rmstore_stock_adjustment`, coils. MRN qty budget checked against ERP `mrn_rm`.

### 9. Read-only views
| Page | API | Data |
|---|---|---|
| `inventory-report` (RM Inventory) | `/inventory-report/list` | coil table grouped by MRN — rules in §3 |
| `coils` | `/coils/list`, `/coils/helper`, `/coils/finder-report` | coil table + MRN + QC + logs |
| `inventory-audit` | `/inventory-audit/*` | scan per location vs coil table (shared `ims_audit_*`) |
| `logs` | `/logs` | `rmstore_coil_transaction` (every coil movement) + activity logs |

---

## 5. External data (ERP via `fetchFromIMS`)

| IMS view | Used for | Used in |
|---|---|---|
| `mrn_rm` / `mrn_rm_old` | MRN lines (vendor, item, heat, qty, bill) | `mrn`, `stock-adjustment` |
| `prdrunjc` | Running job cards (FG, machine) | `production`, `issue-request`, IPR display |
| `item` | Item master | `production`, `rm-product` |
| `invfnote` | Supplier bills for RM Rejection (`salecat 2`, Green) | `rm-rejection` |

---

## 6. Health check — 22 Oct 2026 (local DB, read-only)

| Check | Result |
|---|---|
| RM Inventory report = raw coil table (In Store 101,883 · Unassigned 0 · Shop Floor 3,836) | ✅ match |
| Every `out` coil → approved Store Out and in its scanned list | ✅ |
| Every `returned` coil → live register + approved rejection Store Out | ✅ |
| Every `rejected` coil → live register / approved reject IPR / failed QC | ✅ |
| Every `consumed` coil → consume IPR or SA Minus | ✅ (1 SA Minus coil, expected) |
| Coil → MRN / location / Store In / QC / rejection links | ✅ no orphans, no duplicate UIDs |
| Register `coil_count` = linked coils; one register per IPR | ✅ |
| Rejection Store Out authorized ⇒ coils `returned`; IPR stages match coil status | ✅ |
| One open Store Out draft per coil | ✅ |

**Known, not bugs**
- `out` coils keep their old `location_id` (design: history). Rack views count only `active` / `rejected`.
- 63 old IPRs (#1–64, before the `stage` column) have `stage = NULL`. Their stock is correct (61 fully consumed; #2 and #59 balance already back in store). Optional backfill: `consumed` / `store_in_done`.
- Old rejections may still have an `AUTO_FROM_REJECTION:<id>` Store In child row; new rejections use one row only. Legacy code paths are kept for those.
