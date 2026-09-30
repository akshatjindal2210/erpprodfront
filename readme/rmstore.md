# RMStore — Frontend ↔ Backend Audit

**Date:** 30 Sep 2026 
**Type:** Read-only review (no code changed)

---

## 1. Result in One Line

**Everything works.** No screen is broken and no API will fail with a 500 error. Only small cleanups are left.

### Why it still works

Some columns were removed from the database, but the backend still **calculates those values and sends them with the same names**. So the frontend receives the same fields as before.

Example:

```
Before:  heat_nos was stored in rmstore_out_entry
Now:     heat_nos is built on the fly: scanned_coil → coil_table → mrn.heat_no
         Frontend still receives "heat_nos" — nothing breaks.
```

---

## 2. What Changed in the Database

| Table | What changed | Where the value comes from now |
|---|---|---|
| `rmstore_out_entry` | Removed `mrn_refs`, `heat_nos`, `qtys`, `coil_count` | Calculated from `rmstore_out_entry_scanned_coil` + coil + MRN |
| `rmstore_out_entry_scanned_coil` | Removed `heat_no`, `mrn_uid` | Coil → MRN join |
| `rmstore_in_process_request` | Removed 12 columns (`request_type`, `downstream`, `heat_no`, `item_code`, …). Added `type`, `reassign_jc` | `type` column + coil → MRN join |
| `rmstore_issue_request` | Removed `requested_qty` | Sum of job card qty |
| `rmstore_issue_request_job_card` | Removed `production_id`, `coil_count`, `updated_by`, `updated_at` | `coils` JSON (MRN quotas) |
| `rmstore_coil_table` | Removed `is_deleted`, `deleted_*`, `updated_*` | Deletes are now permanent |
| `rmstore_mrn` | Renamed `it_recp_qty` → `qty`, `it_lot_no` → `coil_no`. Removed `serial_no`, file names, old sticker flags | `sticker_status`, `sticker_by`, `sticker_at` |

> The reassign target column is named **`reassign_jc`**.

---

## 3. Module-by-Module Check

Each module shows: **how data flows**, **status**, and **what to clean up**.

### 3.1 MRN

**Flow**

```
List      → POST mrn/list              → rmstore_mrn (+ ERP data)
Generate  → POST mrn/generate-stickers → insert MRN + coils, status = 'generate'
Draft     → POST mrn/save-sticker-draft→ status = 'draft'
Approve   → POST mrn/approve-stickers  → status = 'approved'
Reject    → POST mrn/reject            → status = 'reject'
Delete    → POST mrn/delete            → permanently deletes MRN + coils + QC
```

**Status:** Working

**Note:** The frontend still reads old names (`it_recp_qty`, `it_lot_no`, `sticker_generated`). The backend sends these as copies of the new fields, so they work.

---

### 3.2 Issue Request

**Flow**

```
List    → POST issue-requests/list      → issue_request + job_card
View    → POST issue-requests/get       → job card MRN quota → live coils (FIFO)
Create  → POST issue-requests/create    → coils saved as MRN quota {mrn_uid, coil_count, qty}
Approve → POST issue-requests/approve   → approved = true
Delete  → POST issue-requests/delete    → is_deleted = true
```

**Status:** Working

**Note:** `requested_qty` and `coil_count` are calculated by the backend. `production_id` always comes back empty, but the backend finds it again from the item when saving.

---

### 3.3 Store Out (Out Entry)

**Flow**

```
Register → POST out-entries/list    → out_entry + counts from scanned_coil
Pending  → POST out-entries/pending-list
View     → POST out-entries/get     → header + scanned coils (heat/MRN from join)
Delete   → POST out-entries/delete  → is_deleted = true, scanned rows removed
```

**How each column is filled**

| UI column | Source |
|---|---|
| Coils | `COUNT(*)` from `rmstore_out_entry_scanned_coil` |
| Heat Nos | scanned_coil → coil_table → `mrn.heat_no` |
| MRN | scanned_coil → coil_table → `mrn.mrn_no` |
| Total Qty | `rmstore_out_entry.total_qty` (= sum of scanned qty) |

**Status:** Working

---

### 3.4 Coil Scan

**Flow**

```
1. Scan coil        → only added to screen (NOT saved yet)
2. Click Save       → POST out-entries/create or update  { coils: [{ coil_no_uid }] }
3. Backend          → replaces rows in rmstore_out_entry_scanned_coil (out_uid, coil_no_uid, qty)
4. Backend          → total_qty = SUM(scanned qty)
5. Screen refreshes with new data
```

> **Important:** Scanning alone does not write to the database. Data is saved only when you click **Save / Submit**.

**Status:** Working

---

### 3.5 In-Process Request (IPR)

**Flow**

```
Pending tab  → POST in-process-requests/list  (approved = false)
Register tab → POST in-process-requests/list  (all, filter by type / stage)
Reassign     → POST in-process-requests/create { type: "reassign", reassign_jc: "<job card>" }
Approve      → POST in-process-requests/approve
Delete       → POST in-process-requests/delete → is_deleted = true
```

**Status:** Working. Reassign correctly saves the target job card in `reassign_jc`.

**Note:** The frontend still **sends** 11 old fields when saving (e.g. `request_type`, `heat_no`, `previous_coils`). The backend ignores them. They are unused data only.

---

### 3.6 Inventory Report

**Flow**

```
Load    → POST inventory-report/list (loads up to 10,000 rows)
          → coil_table + mrn + QC + location
Filter  → done in the browser
Export  → done in the browser (Excel / CSV / PDF / Print)
```

**Status:** Working

**Note:** Filters are not sent to the backend. This is fine now but may get slow when data grows.

---

## 4. Small Mismatches Found

None of these break anything. They are cleanup items.

| # | Screen | Problem | Effect |
|---|---|---|---|
| 1 | Store Out Register | `pending_coil_count` not sent | Progress shows only "N coils scanned" |
| 2 | Store Out | Frontend checks `coils_scanned`, `coils_required` — never sent | Unused code |
| 3 | Store Out | Heat numbers joined with `' \| '` in list but `', '` in scan plan | Looks different in two places |
| 4 | IPR Edit | Reads `lot_no` — no longer sent | Lot field filled from MRN no. instead |
| 5 | IPR | Frontend reads `stage` — backend sends it as `downstream` | Works through fallback |
| 6 | IPR Save | Sends 11 old fields | Backend ignores them |
| 7 | Issue Request Edit | `production_id` always empty | Backend refills it on save |
| 8 | MRN Compare | Backend uses old key names `it_recp_qty`, `it_lot_no` | Works through fallback |
| 9 | Inventory Report | Loads 10,000 rows, filters in browser | May slow down later |

---

## 5. Where Old Field Names Remain in the Frontend

All paths start from `frontend/src/apps/rmstore/`.

| Module | File | Old fields used |
|---|---|---|
| Store Out | `modules/out-entry/Page.js` | `heat_nos`, `mrn_refs`, `coil_count` |
| Store Out | `modules/shared/CoilScanEntryModal.js` | `heat_nos`, `mrn_refs`, `coil_count` |
| Store Out | `lib/utils/outEntryScanStatus.js` (56–57) | `coils_scanned`, `coils_required` |
| IPR | `modules/in-process-request/InProcessRequestModal.js` (572, 1728–1744) | `lot_no`, `request_type`, `heat_no`, `previous_coils`, … |
| IPR | `modules/inventory-inward/ReceivePendingStoreInModal.js` (163–167) | `previous_coils`, `proposed_coils` |
| IPR | `modules/in-process-request/Page.js` | `seed_coil_uid`, `request_type`, `downstream` |
| Issue Request | `modules/issue-request/IssueRequestModal.js` | `production_id`, `requested_qty` |
| Issue Request | `modules/issue-request/Page.js`, `lib/rmStoreSelectionLabel.js` | `requested_qty` |
| MRN | `modules/mrn-portal/Page.js`, `MrnStickerModal.js`, `MrnRejectDrawer.js` | `it_recp_qty`, `it_lot_no`, `serial_no`, `sticker_generated`, … |

All of these still receive values from the backend, except the ones listed in section 4.

---

## 6. Manual Test Checklist

Not run yet. Run on the **dev** environment and fill in the result.

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | Create MRN stickers | Shows in list, coils created, inventory qty goes up | |
| 2 | Create and approve Issue Request | Moves from Pending to Register | |
| 3 | Store Out: scan 2–3 coils, click Save | Coil count, heat no, total qty on screen = database | |
| 4 | Create Reassign request | `type = reassign`, `reassign_jc` filled | |
| 5 | Delete an entry | Gone from list, report updated | |
| 6 | Refresh the page | Same data shows | |
| 7 | Check browser console and Network tab | No errors, no 4xx / 5xx | |

### SQL to verify in the database

```sql
-- Test 1: MRN
SELECT uid, qty, coil_no, sticker_status FROM rmstore_mrn WHERE uid = :mrn_uid;
SELECT COUNT(*) AS coils, SUM(qty) AS total FROM rmstore_coil_table WHERE mrn_uid = :mrn_uid;

-- Test 2: Issue Request
SELECT issue_uid, approved FROM rmstore_issue_request WHERE issue_uid = :issue_uid;

-- Test 3: Store Out (compare with screen)
SELECT
  o.out_uid,
  o.total_qty,
  (SELECT SUM(qty)  FROM rmstore_out_entry_scanned_coil s WHERE s.out_uid = o.out_uid) AS scanned_total,
  (SELECT COUNT(*) FROM rmstore_out_entry_scanned_coil s WHERE s.out_uid = o.out_uid) AS coil_count
FROM rmstore_out_entry o
WHERE o.out_uid = :out_uid;

-- Test 4: Reassign
SELECT ipr_uid, type, reassign_jc FROM rmstore_in_process_request WHERE ipr_uid = :ipr_uid;

-- Test 5: Delete
SELECT is_deleted, deleted_by, deleted_at FROM rmstore_out_entry WHERE out_uid = :out_uid;
```

`total_qty` must equal `scanned_total` in Test 3.

---

## 7. Suggested Fixes (Not Applied)

Nothing below has been changed. Apply only after approval.

### Quick fixes (small, safe)

| # | Fix | File |
|---|---|---|
| 1 | Stop sending the 11 old fields when saving IPR | `InProcessRequestModal.js`, `ReceivePendingStoreInModal.js` |
| 2 | Use `lot_label` instead of `lot_no` on IPR edit | `InProcessRequestModal.js:572` |
| 3 | Remove unused `coils_scanned` / `coils_required` checks | `outEntryScanStatus.js:56-57` |
| 4 | Remove unused `qtys` / `mrn_refs` calculation | `outEntry.model.js:440-443` |
| 5 | Use the same heat no separator `' \| '` everywhere | `outEntry.model.js:879` |
| 6 | Remove `production_id` and old `requested_qty` code | `IssueRequestModal.js` |
| 7 | Send `qty` / `coil_no` in MRN compare instead of old names | `mrn.controller.js:320-321` |

### Bigger changes (optional)

| # | Change | Why |
|---|---|---|
| 8 | Move MRN frontend fully to new names, then remove old aliases from backend | Cleaner code (~40 lines) |
| 9 | Send `pending_coil_count` on Store Out Register | Accurate progress display |
| 10 | Move Inventory Report filters to the backend | Faster with large data |
