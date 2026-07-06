# Forwarding Note Flow

**Forwarding Note** page flow end-to-end kaise kaam karta hai — qty kahan se aati hai, reserve kaise hoti hai, FIFO kaise maintain hota hai, aur agli baar woh qty kyu nahi dikhegi.

---

## 1. Forwarding Note?

Forwarding Note (FN) ek **dispatch plan**:

- Customer + PO + transporter details
- Kaun se **items** kitni **qty** mein bhejne hain
- Kaun se **packings** (Doc No.) se stock uthana hai

**Important:** FN save hote hi qty **physically move nahi hoti**, lekin system us qty ko **reserve** kar leta hai — taaki doosri FN usi stock ko na le sake.

---

## 2. Page par user flow (step-by-step)

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

| Step  | User kya karta hai                      | System kya karta hai                                                        |
|-------|-----------------------------------------|-----------------------------------------------------------------------------|
| 1     | Customer select karta hai               | Customer ki last category load hoti hai                                     |
| 2     | Category select karta hai (OEM / etc.)  | Items filter hote hain us category ke hisaab se                             |
| 3     | Item select karta hai                   | Available boxes + ERP stock fetch hota hai                                  |
| 4     | Dispatch Qty enter karta hai            | FIFO se boxes auto-select hote hain                                         |
| 5     | Save / Authorize karta hai              | Backend validate karke DB mein save karta hai                               |
| 6     | (Baad mein) Out Entry                   | Scan complete hone par reserve hat jati hai, stock bahar chala jata hai     |

---

## 3. Qty kahan se aati hai? (Physical Stock)

**Source:** `ims_box_table` — jo boxes abhi **in-hand** aur **sellable** hain.

Backend function: `findAvailableBoxes(item_dcode)`  
File: `backend/src/apps/ims/models/forwardingNote.model.js`

Yeh boxes tab count hote hain jab:

- Box delete nahi hai (`is_deleted = false`)
- Box **in-hand** hai (location par hai ya packing area mein)
- Box **QC Hold** par nahi hai (QC hold wale alag rule se aate hain)
- Box ka item = selected item (`item_dcode`)
- Daily Production (`ims_dailyprod`) ya Stock Adjustment se item link hota hai

**API jo frontend call karta hai:**

| API                                     | Kaam                                                    |
|-----------------------------------------|---------------------------------------------------------|
| `POST /forwarding-note/available-items` | Dropdown ke liye — jin items par stock bachi hai        |
| `POST /forwarding-note/available-boxes` | Selected item ke liye box list (reserve minus ke baad)  |
| `POST /forwarding-note/erp-stock`       | ERP FG stock (reference / comparison ke liye)           |

Frontend file: `frontend/src/features/apps/ims/services/forwardingNote.js`

---

## 4. Reserve kaise hoti hai?

### Reserve = Virtual lock (alag table nahi)

Jab aap FN **save** karte ho, har item ke liye rows `ims_forwarding_note_item_wise` mein jaati hain:

| Column            | Matlab                        |
|-------------------|-------------------------------|
| `packing_number`  | Kaun si packing (Doc No.)     |
| `box`             | Kitne **full/open** boxes     |
| `box_qty`         | Un full boxes ki total qty    |
| `loose_box`       | Kitne **loose** boxes         |
| `loose_box_qty`   | Un loose boxes ki total qty   |
| `total_qty`       | `box_qty + loose_box_qty`     |

**Reserve tabhi count hoti hai jab:**

- FN delete nahi hai
- Us FN ka Out Entry **scan complete** nahi hua

Query: `findForwardedQtyByItemAndPacking()`  
File: `backend/src/apps/ims/models/forwardingNote.model.js`

```sql
-- Simple samajh:
-- Doosri sab FN ki qty sum karo (per item + per packing)
-- EXCEPT: jis FN ko edit kar rahe ho (exclude_fuid)
-- EXCEPT: jinka out entry complete ho chuka hai
```

### Save par kya hota hai?

File: `backend/src/apps/ims/utils/forwarding-note/forwardingNoteItemsWrite.js`

1. User ke selected boxes ko **packing-wise group** kiya jata hai
2. Har packing ke liye open vs loose alag count hota hai
3. **Validation:** kya demand ≤ available (physical minus doosri FN reserve)?
4. **Advisory lock** lagta hai har item par (race condition avoid)
5. Rows insert hoti hain `ims_forwarding_note_item_wise` mein

**Note:** Pending aur Approved dono FN reserve count karti hain — save hote hi reserve lag jati hai, sirf approve par nahi.

---

## 5. Available qty kaise calculate hoti hai?

File: `backend/src/apps/ims/utils/forwarding-note/forwardingAvailableStock.js`

```
Available = Physical Boxes  −  Doosri FN ki Reserved Qty
```

Function chain:

```
findAvailableBoxes()           → physical boxes DB se
findForwardedQtyByItemAndPacking() → doosri FN ki reserve
buildForwardingAvailableBoxes()    → dono combine
reduceBoxesByForwardedQty()        → reserve ko FIFO order mein skip karo
```

### Reserve skip kaise hoti hai? (`applyQtySkipToBoxes`)

Example — Packing 101 par 3 full boxes (100, 100, 100) hain.  
Doosri FN ne 150 qty reserve ki hai (open).

```
Box 1 (100) → pura skip (100 reserve use)
Box 2 (100) → 50 skip, 50 bacha → available
Box 3 (100) → pura available
```

**Open reserve sirf full boxes se skip hoti hai.**  
**Loose reserve sirf loose boxes se skip hoti hai.**  
Isse galat partial box (jaise 300 wala full box jab sirf loose reserve ho) avoid hota hai.

---

## 6. Agli baar woh qty kyu nahi aayegi?

Jab aap pehli FN save karte ho:

1. `ims_forwarding_note_item_wise` mein qty save ho jati hai
2. Agli FN (ya nayi row) ke liye `findForwardedQtyByItemAndPacking` us qty ko **reserve** maan leta hai
3. `reduceBoxesByForwardedQty` woh qty physical boxes se **skip** kar deta hai
4. Agar poori qty reserve ho gayi → item dropdown se bhi gayab ho sakta hai (`getAvailableItemsForForwarding`)
5. Agar kuch bachi → kam qty dikhegi available boxes mein

### Reserve kab hat ti hai?

| Event                       | Result                                          |
|-----------------------------|-------------------------------------------------|
| FN **delete**               | Reserve turant hat jati hai                     |
| Out Entry **scan complete** | Reserve count se bahar — stock physically out   |
| FN **edit** (apni hi note)  | Apni reserve exclude hoti hai (`exclude_fuid`)  |

---

## 7. FIFO kaise maintain hota hai?

FIFO = **Pehle purani packing, phir nayi packing** — purane stock pehle dispatch.

### Sort order (Frontend + Backend same)

File (frontend): `ForwardingModal.js` → `sortBoxesForFifo()`  
File (backend): `forwardingAvailableStock.js` → `sortBoxesForForwardingFifo()`

```
1. packing_number ↑  (chhota number = purani packing pehle)
2. Full box pehle, Loose box baad mein
3. box_uid ↑         (same packing mein purana box pehle)
```

### Dispatch qty enter karne par

File: `frontend/src/core/utils/utilHelper.js` → `calculateFifoBoxes()`

```
User ne 250 qty enter ki
→ FIFO order mein boxes pick hote hain
→ HAMESHA PURA BOX leta hai (partial box break nahi hota)
→ Example: 100+100+100 = 300 allocate (250 maanga tha, 300 milega — full box rule)
```

**Loose Priority toggle:** Same packing ke andar pehle loose boxes pick honge, phir full — lekin packing number order same rahega.

---

## 8. Open Box vs Loose Box

File: `backend/src/apps/ims/utils/box/boxLooseKind.js`

| Type                | Pehchan                                     |
|---------------------|---------------------------------------------|
| **Open / Full box** | Qty = packing standard qty (e.g. 100)       |
| **Loose box**       | `is_loose = true` YA qty standard se alag   |

Reserve bhi alag track hoti hai:

- `box_qty` = open/full boxes ki qty
- `loose_box_qty` = loose boxes ki qty

Isliye validation alag-alag check karti hai — open reserve open se, loose reserve loose se match kare.

---

## 9. Save validation (issue na aaye isliye)

Backend: `assertForwardingItemsWithinRemaining()`

Check karta hai:

1. Har packing par open demand ≤ available open
2. Har packing par loose demand ≤ available loose
3. Total dispatch ≤ total remaining stock
4. Transaction + advisory lock — do log ek saath same stock na lein

Agar koi aur FN ne pehle hi reserve kar li → error:

```
"Packing X: open qty Y exceeds available Z (already reserved on another forwarding note)."
```

Frontend bhi same available boxes API use karta hai, isliye UI aur save **same logic** follow karte hain.

---

## 10. Approve, Lock, Out Entry

### Approve (Authorize)

- Permission: `forwarding_note_master` → authorize
- Approve se pehle dubara reserve validate hoti hai
- Out Entry ke liye FN **approved** honi chahiye

### Out Entry Lock

- Out Entry start hone par FN lock ho sakti hai (`out_entry_locked`)
- Lock ke baad FN edit/delete nahi — sirf bill no update

### Out Entry Complete

- Jab saare required boxes scan ho jayein (`scan_complete = true`)
- Reserve query mein woh FN count nahi hoti
- Physical boxes inventory se out ho chuke hote hain

File: `backend/src/apps/ims/utils/out-entry/outEntryFulfillment.js`

---

## 11. Poora flow — ek example

```
Stock in DB:
  Packing 100: Box-A(100), Box-B(100), Box-C(50 loose)
  Packing 101: Box-D(100)

User FN-1 banata hai:
  Item X, Dispatch 150
  → FIFO: Box-A(100) + Box-B(100) = 200 select (full box rule)
  → Save → item_wise row: packing 100, box=2, box_qty=200

User FN-2 banata hai (same item):
  → findForwardedQtyByItemAndPacking: packing 100 par 200 reserve
  → reduceBoxesByForwardedQty: Box-A, Box-B skip
  → Available: Box-C(50 loose) + Box-D(100) = 150
  → User ko sirf yeh dikhega

FN-1 Out Entry complete:
  → Reserve count se FN-1 hat jati hai
  → Lekin Box-A, Box-B physically out — dubara available nahi
```

---

## 12. File reference — kis file mein kya hai

### Frontend

| File                                                                            | Kaam                                          |
|---------------------------------------------------------------------------------|-----------------------------------------------|
| `frontend/src/app/ims/dashboard/forwarding-note/page.js`                        | Route entry                                   |
| `frontend/src/features/apps/ims/components/forwarding-note/ForwardingPage.js`   | List page, tabs, actions                      |
| `frontend/src/features/apps/ims/components/forwarding-note/ForwardingModal.js`  | Add/Edit/Approve form, FIFO selection, save   |
| `frontend/src/features/apps/ims/services/forwardingNote.js`                     | API calls                                     |
| `frontend/src/core/utils/utilHelper.js`                                         | `calculateFifoBoxes`, `isForwardingLooseBox`  |

### Backend — Routes & Controller

| File                                                            | Kaam                                              |
|-----------------------------------------------------------------|---------------------------------------------------|
| `backend/src/apps/ims/routes/forwardingNote.route.js`           | Saare API endpoints                               |
| `backend/src/apps/ims/controllers/forwardingNote.controller.js` | Create, update, available boxes, ERP stock, print |

### Backend — Core Logic (sabse important)

| File                                                                      | Kaam                                            |
|---------------------------------------------------------------------------|-------------------------------------------------|
| `backend/src/apps/ims/utils/forwarding-note/forwardingAvailableStock.js`  | FIFO sort, reserve skip, available stock build  |
| `backend/src/apps/ims/utils/forwarding-note/forwardingNoteItemsWrite.js`  | Save items, validation, advisory lock           |
| `backend/src/apps/ims/models/forwardingNote.model.js`                     | DB queries — physical boxes, reserve sum, CRUD  |
| `backend/src/apps/ims/models/forwardingNoteItem.model.js`                 | Item-wise rows insert/delete                    |
| `backend/src/apps/ims/utils/box/boxLooseKind.js`                          | Open vs loose box classification                |
| `backend/src/apps/ims/utils/forwarding-note/forwardingPackingCategory.js` | Category filter on packings                     |
| `backend/src/apps/ims/utils/out-entry/outEntryFulfillment.js`             | Out entry scan vs FN requirement                |

### Database Tables

| Table                           | Kaam                                                            |
|---------------------------------|-----------------------------------------------------------------|
| `ims_forwarding_note_master`    | FN header — customer, PO, transporter, approved, lock           |
| `ims_forwarding_note_item_wise` | Line items — packing, box count, qty (reserve yahi se aati hai) |
| `ims_box_table`                 | Physical stock                                                  |
| `ims_dailyprod`                 | Packing → item link                                             |
| `ims_out_entry`                 | Dispatch scan — complete hone par reserve release               |

Table definitions:  
`backend/src/apps/ims/config/tables/forwarding_note_master.table.js`  
`backend/src/apps/ims/config/tables/forwarding_note_item_wise.table.js`

---

## 13. API endpoints (quick list)

| Method  | Path                                | Use                                       |
|---------|-------------------------------------|-------------------------------------------|
| POST    | `/forwarding-note/create`           | Nayi FN                                   |
| POST    | `/forwarding-note/update`           | Edit / Approve                            |
| POST    | `/forwarding-note/delete`           | Delete (out entry lock nahi hona chahiye) |
| POST    | `/forwarding-note/available-boxes`  | Item ke available boxes                   |
| POST    | `/forwarding-note/available-items`  | Dropdown items                            |
| POST    | `/forwarding-note/erp-stock`        | ERP FG reference                          |
| POST    | `/forwarding-note/list`             | List page data                            |
| POST    | `/forwarding-note/get`              | Single FN detail                          |

---

## 14. Important rules (issue avoid karne ke liye)

---
1. **Save = Reserve** — approve ka wait mat karo; save hote hi qty block
2. **FIFO same** — frontend aur backend dono same sort order use karte hain
3. **Full box rule** — partial box break nahi; qty thodi zyada allocate ho sakti hai
4. **Open / Loose alag** — reserve bhi alag track; mix mat karo
5. **Edit par exclude_fuid** — apni note ki reserve available mein wapas aati hai
6. **Out entry complete** — reserve hat ti hai, stock bhi out
7. **Concurrent save** — advisory lock same item par double booking rokta hai

---

**Last updated: 04 July 2026**
