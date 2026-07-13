# Forwarding Note Flow

This document explains how **Forwarding Notes** work end to end: how users create them, where quantity comes from, how stock is reserved, how FIFO is applied, and why reserved quantity does not show up on the next request.

---

## 1. What is a Forwarding Note?

A Forwarding Note (FN) is a **dispatch plan**. It records:

- Customer, PO, and transporter details
- Which **items** to ship and in what **quantities**
- Which **packings** (Doc No.) stock is taken from

**Important:** Saving an FN does **not** physically move stock. It **reserves** that quantity so another FN cannot claim the same boxes until the reservation is released.

---

## 2. How users create a Forwarding Note

The Forwarding Note page has two tabs. There is a single **New** button; behaviour depends on the active tab and the user’s permissions.

```
ForwardingPage.js
  ├─ Today's Dispatch Plan  →  select schedule row  →  New  →  FN from schedule (schno)
  └─ Forwarding Note        →  New
        ├─ with Direct Forwarding Note special permission  →  blank add modal
        └─ without special permission                      →  toast: use Dispatch Plan
```

| Who | Today's Dispatch Plan → New | Forwarding Note tab → New |
|-----|-----------------------------|---------------------------|
| Module **Add** only | Create from selected schedule (`schno`) | Button shows; toast asks user to use the schedule tab |
| **Add** + **Direct Forwarding Note** special permission | Same schedule-based create | Opens a blank add modal (no schedule required) |
| Super Admin | Allowed | Direct create always allowed |

Special permission key: `special_permissions.ims.direct_forwarding_note`  
Admin path: Identity → Users → Edit → IMS Special Permissions → **Direct Forwarding Note**

After the form opens (from either path), the item / qty flow is the same:

| Step | User action | System behaviour |
|------|-------------|------------------|
| 1 | Selects a customer | Loads the customer’s last category |
| 2 | Selects a category (OEM, etc.) | Filters items by that category |
| 3 | Selects an item | Loads available boxes and ERP stock |
| 4 | Enters dispatch quantity | Auto-selects boxes using FIFO |
| 5 | Saves / authorizes | Backend validates and writes to the database |
| 6 | (Later) Out Entry | On scan complete, reservation is released and stock leaves inventory |

Backend rule: create **without** `schno` requires Direct Forwarding Note permission (otherwise `403`). Create **with** `schno` needs only module Add.

---

## 3. Architecture (high level)

```
┌─────────────────────────────────────────────────────────────────┐
│  ForwardingPage.js  →  List / Add / Edit / Approve              │
│         ↓                                                       │
│  ForwardingModal.js  →  Form + Items + Dispatch Qty             │
│         ↓                                                       │
│  API (forwardingNoteService)  →  Backend Controller             │
│         ↓                                                       │
│  DB: ims_forwarding_note_master + ims_forwarding_note_item_wise │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Where does quantity come from? (Physical stock)

**Source:** `ims_box_table` — boxes that are currently **in hand** and **sellable**.

Backend function: `findAvailableBoxes(item_dcode)`  
File: `backend/src/apps/ims/models/forwardingNote.model.js`

A box is included when:

- It is not deleted (`is_deleted = false`)
- It is **in hand** (at a location or in the packing area)
- It is not on **QC Hold** (QC hold stock follows separate rules)
- Its item matches the selected item (`item_dcode`)
- The item is linked through Daily Production (`ims_dailyprod`) or Stock Adjustment

**APIs used by the frontend:**

| API | Purpose |
|-----|---------|
| `POST /forwarding-note/available-items` | Dropdown — items with remaining stock |
| `POST /forwarding-note/available-boxes` | Box list for the selected item (after subtracting reservations) |
| `POST /forwarding-note/erp-stock` | ERP FG stock (reference / comparison) |

Frontend service: `frontend/src/features/apps/ims/services/forwardingNote.js`

---

## 5. How is stock reserved?

### Reservation is a virtual lock (no separate table)

When an FN is **saved**, the system writes one row per packing / item into `ims_forwarding_note_item_wise`:

| Column | Meaning |
|--------|---------|
| `packing_number` | Packing (Doc No.) |
| `box` | Count of **full / open** boxes |
| `box_qty` | Total quantity in those full boxes |
| `loose_box` | Count of **loose** boxes |
| `loose_box_qty` | Total quantity in those loose boxes |
| `total_qty` | `box_qty + loose_box_qty` |

Reservation is counted when:

- The FN is not deleted
- Out Entry for that FN is **not** scan-complete

Query: `findForwardedQtyByItemAndPacking()`  
File: `backend/src/apps/ims/models/forwardingNote.model.js`

```sql
-- Simplified logic:
-- Sum quantity from all other FNs (per item + per packing)
-- EXCEPT: the FN being edited (exclude_fuid)
-- EXCEPT: FNs whose out entry is already complete
```

### What happens on save?

File: `backend/src/apps/ims/utils/forwarding-note/forwardingNoteItemsWrite.js`

1. User-selected boxes are grouped **by packing**
2. Open vs loose counts are computed per packing
3. **Validation:** demand ≤ available (physical stock minus other FN reservations)
4. An **advisory lock** is taken per item (avoids race conditions)
5. Rows are inserted into `ims_forwarding_note_item_wise`

Both Pending and Approved FNs count toward reservation. Reservation starts on **save**, not only on approve.

---

## 6. How is available quantity calculated?

File: `backend/src/apps/ims/utils/forwarding-note/forwardingAvailableStock.js`

```
Available = Physical Boxes − Reserved Qty from other FNs
```

Function chain:

```
findAvailableBoxes()                 → physical boxes from DB
findForwardedQtyByItemAndPacking()   → reservations from other FNs
buildForwardingAvailableBoxes()      → combine both
reduceBoxesByForwardedQty()          → skip reserved qty in FIFO order
```

### How reserved quantity is skipped (`applyQtySkipToBoxes`)

Example — Packing 101 has three full boxes (100, 100, 100).  
Another FN already reserved 150 open qty.

```
Box 1 (100) → fully skipped (100 used by reservation)
Box 2 (100) → 50 skipped, 50 remaining → available
Box 3 (100) → fully available
```

**Open reservation is skipped only from full boxes.**  
**Loose reservation is skipped only from loose boxes.**  

That split prevents incorrect partial-box allocation (for example treating a 300 full box as available when only loose qty was reserved).

---

## 7. Why that quantity does not appear next time

After the first FN is saved:

1. Quantity is stored in `ims_forwarding_note_item_wise`
2. The next FN (or a new line) calls `findForwardedQtyByItemAndPacking`, which treats that quantity as **reserved**
3. `reduceBoxesByForwardedQty` **skips** that quantity from physical boxes
4. If everything is reserved, the item may disappear from the dropdown (`getAvailableItemsForForwarding`)
5. If some stock remains, the UI shows a lower available quantity

### When is reservation released?

| Event | Result |
|-------|--------|
| FN **deleted** | Reservation is released immediately |
| Out Entry **scan complete** | FN is excluded from the reservation sum; stock is physically out |
| FN **edited** (same note) | Own reservation is excluded via `exclude_fuid` |

---

## 8. How FIFO is maintained

FIFO means **older packing first, then newer packing** — oldest stock is dispatched first.

### Sort order (same on frontend and backend)

Frontend: `ForwardingModal.js` → `sortBoxesForFifo()`  
Backend: `forwardingAvailableStock.js` → `sortBoxesForForwardingFifo()`

```
1. packing_number ↑  (lower number = older packing first)
2. Full box first, loose box second
3. box_uid ↑         (within the same packing, older box first)
```

### When dispatch quantity is entered

File: `frontend/src/core/utils/utilHelper.js` → `calculateFifoBoxes()`

```
User enters 250 qty
→ Boxes are picked in FIFO order
→ Full boxes are always taken whole (partial box break is not allowed)
→ Example: 100 + 100 + 100 = 300 allocated (250 requested, 300 allocated — full box rule)
```

**Loose Priority toggle:** Within the same packing, loose boxes are picked first, then full boxes. Packing number order does not change.

---

## 9. Open box vs loose box

Backend: `backend/src/apps/ims/utils/box/boxLooseKind.js`  
Frontend mirror: `frontend/src/core/utils/utilHelper.js` → `isForwardingLooseBox()`

| Type | How it is identified (priority order) |
|------|----------------------------------------|
| **Loose box** | 1. `is_loose = true` on `ims_box_table` (set when the sticker is generated) |
| | 2. Sticker snapshot: box index in UID **>** `full_boxes_count` on `ims_dailyprod` (only when the snapshot is set — `null` skips; legacy packings stay safe) |
| | 3. Quantity **≠** packing standard qty (`qty_per_box` from dailyprod, or inferred from full boxes) |
| **Open / Full box** | None of the above — typically qty equals standard and box index ≤ `full_boxes_count` |

**Why the sticker snapshot matters:** A lone **loose** sticker can have the same qty as the packing standard (for example 206 = 206). Older logic compared qty to standard only, so the FN breakdown could show **OPEN BOX** while Sticker Control showed **LOOSE**. The snapshot check fixes the label without changing FIFO.

Reservation is tracked separately:

- `box_qty` = quantity from open / full boxes
- `loose_box_qty` = quantity from loose boxes

Validation checks each independently — open demand against open stock, loose demand against loose stock.

The **available-boxes** API also returns `qty_per_box`, `full_boxes_count`, and `loose_box_qty` from `ims_dailyprod` (joined per packing) so the frontend can classify boxes correctly.

**Backfill safety:** Startup `backfillBoxIsLooseFromPackingMode` only **upgrades** `is_loose` to `true` when qty ≠ inferred standard. It no longer downgrades `is_loose` from `true` to `false` (which could wrongly turn a loose sticker into a full box).

---

## 10. Save validation

Backend: `assertForwardingItemsWithinRemaining()`

Checks:

1. Per packing: open demand ≤ available open
2. Per packing: loose demand ≤ available loose
3. Total dispatch ≤ total remaining stock
4. Transaction + advisory lock — two users cannot claim the same stock at the same time

If another FN already reserved the stock, the API returns an error such as:

```
"Packing X: open qty Y exceeds available Z (already reserved on another forwarding note)."
```

The frontend uses the same available-boxes API, so the UI and save path follow **the same rules**.

---

## 11. Approve, lock, and Out Entry

### Approve (authorize)

- Permission: `forwarding_note_master` → authorize
- Reservation is re-validated before approve
- The FN must be **approved** before Out Entry

### Out Entry lock

- The FN may be locked when Out Entry starts (`out_entry_locked`)
- After lock, the FN cannot be edited or deleted — only the bill number can be updated

### Out Entry complete

- When all required boxes are scanned (`scan_complete = true`)
- That FN is excluded from the reservation query
- Physical boxes have left inventory

File: `backend/src/apps/ims/utils/out-entry/outEntryFulfillment.js`

---

## 12. End-to-end example

```
Stock in DB:
  Packing 100: Box-A(100), Box-B(100), Box-C(50 loose)
  Packing 101: Box-D(100)

User creates FN-1:
  Item X, Dispatch 150
  → FIFO: Box-A(100) + Box-B(100) = 200 selected (full box rule)
  → Save → item_wise row: packing 100, box=2, box_qty=200

User creates FN-2 (same item):
  → findForwardedQtyByItemAndPacking: 200 reserved on packing 100
  → reduceBoxesByForwardedQty: Box-A, Box-B skipped
  → Available: Box-C(50 loose) + Box-D(100) = 150
  → User sees only this remaining stock

FN-1 Out Entry complete:
  → FN-1 removed from reservation count
  → Box-A, Box-B physically out — no longer available
```

---

## 13. File reference

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/app/ims/dashboard/forwarding-note/page.js` | Route entry |
| `frontend/src/features/apps/ims/components/forwarding-note/ForwardingPage.js` | List page, tabs, New / Edit actions, direct-create gate |
| `frontend/src/features/apps/ims/components/forwarding-note/TodayDispatchPlanTab.js` | Schedule-based create path |
| `frontend/src/features/apps/ims/components/forwarding-note/ForwardingModal.js` | Add / Edit / Approve form, FIFO selection, save |
| `frontend/src/features/apps/ims/services/forwardingNote.js` | API calls |
| `frontend/src/features/apps/ims/utils/imsSpecialPermissions.js` | `canCreateDirectForwardingNote` |
| `frontend/src/core/utils/utilHelper.js` | `calculateFifoBoxes`, `isForwardingLooseBox` |
| `frontend/src/features/admin/identity/users/UserModal.js` | Direct Forwarding Note checkbox |

### Backend — routes and controller

| File | Purpose |
|------|---------|
| `backend/src/apps/ims/routes/forwardingNote.route.js` | All API endpoints |
| `backend/src/apps/ims/controllers/forwardingNote.controller.js` | Create, update, available boxes, ERP stock, print; direct-create permission check |

### Backend — core logic

| File | Purpose |
|------|---------|
| `backend/src/apps/ims/utils/imsSpecialPermissions.js` | `hasDirectForwardingNotePermission` |
| `backend/src/apps/ims/utils/forwarding-note/forwardingAvailableStock.js` | FIFO sort, reservation skip, available stock build |
| `backend/src/apps/ims/utils/forwarding-note/forwardingNoteItemsWrite.js` | Save items, validation, advisory lock |
| `backend/src/apps/ims/models/forwardingNote.model.js` | DB queries — physical boxes, reservation sum, CRUD |
| `backend/src/apps/ims/models/forwardingNoteItem.model.js` | Item-wise row insert / delete |
| `backend/src/apps/ims/utils/box/boxLooseKind.js` | Open vs loose box classification |
| `backend/src/apps/ims/utils/forwarding-note/forwardingPackingCategory.js` | Category filter on packings |
| `backend/src/apps/ims/utils/out-entry/outEntryFulfillment.js` | Out entry scan vs FN requirement |

### Database tables

| Table | Purpose |
|-------|---------|
| `ims_forwarding_note_master` | FN header — customer, PO, transporter, approved, lock, schedule (`schno`) |
| `ims_forwarding_note_item_wise` | Line items — packing, box count, qty (reservation source) |
| `ims_box_table` | Physical stock |
| `ims_dailyprod` | Packing → item link |
| `ims_out_entry` | Dispatch scan — reservation released on complete |

Table definitions:  
`backend/src/apps/ims/config/tables/forwarding_note_master.table.js`  
`backend/src/apps/ims/config/tables/forwarding_note_item_wise.table.js`

---

## 14. API endpoints (quick reference)

| Method | Path | Use |
|--------|------|-----|
| POST | `/forwarding-note/create` | Create new FN (direct create requires special permission when `schno` is absent) |
| POST | `/forwarding-note/update` | Edit / approve |
| POST | `/forwarding-note/delete` | Delete (out entry must not be locked) |
| POST | `/forwarding-note/available-boxes` | Available boxes for item |
| POST | `/forwarding-note/available-items` | Dropdown items |
| POST | `/forwarding-note/erp-stock` | ERP FG reference |
| POST | `/forwarding-note/list` | List page data |
| POST | `/forwarding-note/get` | Single FN detail |

---

## 15. Rules to remember

1. **Save = reserve** — quantity is blocked on save; do not wait for approve
2. **Default create path is schedule-based** — Today's Dispatch Plan → select row → New
3. **Direct create is gated** — Forwarding Note tab blank add needs **Direct Forwarding Note** (enforced on UI and API)
4. **FIFO is consistent** — frontend and backend use the same sort order
5. **Full box rule** — partial box break is not allowed; allocated qty may exceed requested qty
6. **Open and loose stay separate** — reservations must not be mixed across kinds
7. **On edit, use `exclude_fuid`** — the note’s own reservation returns to the available pool
8. **Out Entry complete** — reservation is released and stock is out
9. **Concurrent save** — advisory lock on the same item prevents double booking
