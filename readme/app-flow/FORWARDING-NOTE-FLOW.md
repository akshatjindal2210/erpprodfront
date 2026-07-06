# Forwarding Note Flow

End-to-end documentation for the **Forwarding Note** page: where quantity comes from, how stock is reserved, how FIFO is maintained, and why reserved quantity will not appear on the next request.

---

## 1. What is a Forwarding Note?

A Forwarding Note (FN) is a **dispatch plan** that defines:

- Customer, PO, and transporter details
- Which **items** to ship and in what **quantities**
- Which **packings** (Doc No.) to pick stock from

**Important:** Saving an FN does **not** physically move quantity, but the system **reserves** that quantity so another FN cannot claim the same stock.

---

## 2. User flow on the page (step-by-step)

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

| Step | User action | System behavior |
|------|-------------|-----------------|
| 1 | Selects a customer | Loads the customer's last category |
| 2 | Selects a category (OEM, etc.) | Filters items by that category |
| 3 | Selects an item | Fetches available boxes and ERP stock |
| 4 | Enters dispatch quantity | Auto-selects boxes using FIFO |
| 5 | Saves / authorizes | Backend validates and persists to the database |
| 6 | (Later) Out Entry | On scan complete, reservation is released and stock leaves inventory |

---

## 3. Where does quantity come from? (Physical stock)

**Source:** `ims_box_table` — boxes that are currently **in-hand** and **sellable**.

Backend function: `findAvailableBoxes(item_dcode)`  
File: `backend/src/apps/ims/models/forwardingNote.model.js`

Boxes are counted when:

- The box is not deleted (`is_deleted = false`)
- The box is **in-hand** (at a location or in the packing area)
- The box is not on **QC Hold** (QC hold boxes follow separate rules)
- The box item matches the selected item (`item_dcode`)
- The item is linked via Daily Production (`ims_dailyprod`) or Stock Adjustment

**APIs called by the frontend:**

| API | Purpose |
|-----|---------|
| `POST /forwarding-note/available-items` | Dropdown — items with remaining stock |
| `POST /forwarding-note/available-boxes` | Box list for the selected item (after subtracting reservations) |
| `POST /forwarding-note/erp-stock` | ERP FG stock (reference / comparison) |

Frontend file: `frontend/src/features/apps/ims/services/forwardingNote.js`

---

## 4. How is stock reserved?

### Reservation = virtual lock (no separate table)

When you **save** an FN, rows are written to `ims_forwarding_note_item_wise` per item:

| Column | Meaning |
|--------|---------|
| `packing_number` | Which packing (Doc No.) |
| `box` | Count of **full/open** boxes |
| `box_qty` | Total quantity in those full boxes |
| `loose_box` | Count of **loose** boxes |
| `loose_box_qty` | Total quantity in those loose boxes |
| `total_qty` | `box_qty + loose_box_qty` |

**Reservation is counted when:**

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
3. **Validation:** demand ≤ available (physical minus other FN reservations)?
4. An **advisory lock** is applied per item (prevents race conditions)
5. Rows are inserted into `ims_forwarding_note_item_wise`

**Note:** Both Pending and Approved FNs count toward reservation — reservation applies on save, not only on approve.

---

## 5. How is available quantity calculated?

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

### How is reserved quantity skipped? (`applyQtySkipToBoxes`)

Example — Packing 101 has 3 full boxes (100, 100, 100).  
Another FN reserved 150 qty (open).

```
Box 1 (100) → fully skipped (100 used by reservation)
Box 2 (100) → 50 skipped, 50 remaining → available
Box 3 (100) → fully available
```

**Open reservation is skipped only from full boxes.**  
**Loose reservation is skipped only from loose boxes.**  
This avoids incorrect partial-box allocation (e.g. a 300 full box when only loose qty was reserved).

---

## 6. Why will that quantity not appear next time?

When you save the first FN:

1. Quantity is stored in `ims_forwarding_note_item_wise`
2. For the next FN (or new row), `findForwardedQtyByItemAndPacking` treats that quantity as **reserved**
3. `reduceBoxesByForwardedQty` **skips** that quantity from physical boxes
4. If all quantity is reserved → the item may disappear from the dropdown (`getAvailableItemsForForwarding`)
5. If some remains → a lower available quantity is shown

### When is reservation released?

| Event | Result |
|-------|--------|
| FN **deleted** | Reservation is released immediately |
| Out Entry **scan complete** | Excluded from reservation count; stock is physically out |
| FN **edited** (same note) | Own reservation is excluded (`exclude_fuid`) |

---

## 7. How is FIFO maintained?

FIFO = **older packing first, then newer packing** — oldest stock is dispatched first.

### Sort order (same on frontend and backend)

Frontend file: `ForwardingModal.js` → `sortBoxesForFifo()`  
Backend file: `forwardingAvailableStock.js` → `sortBoxesForForwardingFifo()`

```
1. packing_number ↑  (lower number = older packing first)
2. Full box first, loose box second
3. box_uid ↑         (within same packing, older box first)
```

### When dispatch quantity is entered

File: `frontend/src/core/utils/utilHelper.js` → `calculateFifoBoxes()`

```
User enters 250 qty
→ Boxes are picked in FIFO order
→ ALWAYS takes full boxes (partial box break is not allowed)
→ Example: 100+100+100 = 300 allocated (250 requested, 300 allocated — full box rule)
```

**Loose Priority toggle:** Within the same packing, loose boxes are picked first, then full — packing number order is unchanged.

---

## 8. Open box vs loose box

File: `backend/src/apps/ims/utils/box/boxLooseKind.js`

| Type | Identification |
|------|----------------|
| **Open / Full box** | Quantity equals packing standard qty (e.g. 100) |
| **Loose box** | `is_loose = true` OR quantity differs from standard |

Reservation is tracked separately:

- `box_qty` = quantity from open/full boxes
- `loose_box_qty` = quantity from loose boxes

Validation checks each independently — open reservation must match open stock; loose reservation must match loose stock.

---

## 9. Save validation (to prevent issues)

Backend: `assertForwardingItemsWithinRemaining()`

Checks:

1. Per packing: open demand ≤ available open
2. Per packing: loose demand ≤ available loose
3. Total dispatch ≤ total remaining stock
4. Transaction + advisory lock — prevents two users from claiming the same stock concurrently

If another FN already reserved the stock → error:

```
"Packing X: open qty Y exceeds available Z (already reserved on another forwarding note)."
```

The frontend uses the same available-boxes API, so UI and save follow **the same logic**.

---

## 10. Approve, lock, and Out Entry

### Approve (authorize)

- Permission: `forwarding_note_master` → authorize
- Reservation is re-validated before approve
- FN must be **approved** before Out Entry

### Out Entry lock

- FN may be locked when Out Entry starts (`out_entry_locked`)
- After lock, FN cannot be edited or deleted — only bill number can be updated

### Out Entry complete

- When all required boxes are scanned (`scan_complete = true`)
- That FN is excluded from the reservation query
- Physical boxes have left inventory

File: `backend/src/apps/ims/utils/out-entry/outEntryFulfillment.js`

---

## 11. Full flow — example

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
  → User sees only this

FN-1 Out Entry complete:
  → FN-1 removed from reservation count
  → Box-A, Box-B physically out — no longer available
```

---

## 12. File reference

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/app/ims/dashboard/forwarding-note/page.js` | Route entry |
| `frontend/src/features/apps/ims/components/forwarding-note/ForwardingPage.js` | List page, tabs, actions |
| `frontend/src/features/apps/ims/components/forwarding-note/ForwardingModal.js` | Add/Edit/Approve form, FIFO selection, save |
| `frontend/src/features/apps/ims/services/forwardingNote.js` | API calls |
| `frontend/src/core/utils/utilHelper.js` | `calculateFifoBoxes`, `isForwardingLooseBox` |

### Backend — routes and controller

| File | Purpose |
|------|---------|
| `backend/src/apps/ims/routes/forwardingNote.route.js` | All API endpoints |
| `backend/src/apps/ims/controllers/forwardingNote.controller.js` | Create, update, available boxes, ERP stock, print |

### Backend — core logic

| File | Purpose |
|------|---------|
| `backend/src/apps/ims/utils/forwarding-note/forwardingAvailableStock.js` | FIFO sort, reservation skip, available stock build |
| `backend/src/apps/ims/utils/forwarding-note/forwardingNoteItemsWrite.js` | Save items, validation, advisory lock |
| `backend/src/apps/ims/models/forwardingNote.model.js` | DB queries — physical boxes, reservation sum, CRUD |
| `backend/src/apps/ims/models/forwardingNoteItem.model.js` | Item-wise row insert/delete |
| `backend/src/apps/ims/utils/box/boxLooseKind.js` | Open vs loose box classification |
| `backend/src/apps/ims/utils/forwarding-note/forwardingPackingCategory.js` | Category filter on packings |
| `backend/src/apps/ims/utils/out-entry/outEntryFulfillment.js` | Out entry scan vs FN requirement |

### Database tables

| Table | Purpose |
|-------|---------|
| `ims_forwarding_note_master` | FN header — customer, PO, transporter, approved, lock |
| `ims_forwarding_note_item_wise` | Line items — packing, box count, qty (reservation source) |
| `ims_box_table` | Physical stock |
| `ims_dailyprod` | Packing → item link |
| `ims_out_entry` | Dispatch scan — reservation released on complete |

Table definitions:  
`backend/src/apps/ims/config/tables/forwarding_note_master.table.js`  
`backend/src/apps/ims/config/tables/forwarding_note_item_wise.table.js`

---

## 13. API endpoints (quick reference)

| Method | Path | Use |
|--------|------|-----|
| POST | `/forwarding-note/create` | Create new FN |
| POST | `/forwarding-note/update` | Edit / approve |
| POST | `/forwarding-note/delete` | Delete (out entry must not be locked) |
| POST | `/forwarding-note/available-boxes` | Available boxes for item |
| POST | `/forwarding-note/available-items` | Dropdown items |
| POST | `/forwarding-note/erp-stock` | ERP FG reference |
| POST | `/forwarding-note/list` | List page data |
| POST | `/forwarding-note/get` | Single FN detail |

---

## 14. Important rules (to avoid issues)

1. **Save = reserve** — do not wait for approve; quantity is blocked on save
2. **FIFO is consistent** — frontend and backend use the same sort order
3. **Full box rule** — partial box break is not allowed; allocated qty may exceed requested qty
4. **Open / loose are separate** — reservations are tracked separately; do not mix
5. **On edit, exclude_fuid** — own note's reservation returns to available pool
6. **Out entry complete** — reservation is released and stock is out
7. **Concurrent save** — advisory lock on the same item prevents double booking

---

**Last updated: 04 July 2026**
