# ERP Stock Report

Read-only comparison of **IMS in-hand DB stock** vs **ERP FG stock** (`erpfg` API).

|               |                                                                       |
|---------------|-----------------------------------------------------------------------|
| UI            | `/ims/dashboard/erp-stock-report`                                     |
| Permission    | `erp_stock_report`                                                    |
| FE            | `modules/erp-stock-report/`                                           |
| BE            | `modules/erp-stock-report/`                                           |
| API           | `POST /api/erp-stock-report/list`                                     |
| Table         | ERP + read `ims_box_table` / `ims_dailyprod` / `ims_stock_adjustment` |

**Files**

|               |                                                   |
|---------------|---------------------------------------------------|
| FE            | `frontend/src/apps/ims/modules/erp-stock-report/` |
| BE            | `backend/src/apps/ims/modules/erp-stock-report/`  |

**CRUD**

|               |      |
|---------------|------|
| Create        | none |
| Read          | list |
| Update        | none |
| Delete        | none |

**Linking**

No writes.

**Table impact**

| Action        | Writes      |
|---------------|-------------|
| Read          | SELECT only |

---

## Purpose

Show one flat table row per **packing + doc date + job card + item**, with:

- **DB stock** — summed in-hand qty from `ims_box_table`
- **ERP stock** — qty from ERP FG API (packing + item level)
- **Balance** — DB − ERP
- **Customer** — display only; comma-separated names when multiple customers share the same line

Stock is **not** split by customer. Different customers on the same packing/date/job/item appear on **one row** with combined DB stock.

---

## Backend flow

```
POST /api/erp-stock-report/list
  → erpStockReport.controller.js
  → erpStockComparisonList.js  (findErpStockComparisonReport)
       ├─ sqlErpStockDbRows()        — one SQL row per in-hand box
       ├─ fetchAllErpFgStock()       — ERP FG API
       ├─ mergeDbAndErpRows()        — inline dedupe + ERP attach
       ├─ enrichRowsWithItemMaster() — item code/desc lookup
       └─ resolveCustomerNames()     — numeric acc codes → ledger names
```

### Key backend files

| File | Role |
|------|------|
| `controllers/erpStockReport.controller.js` | Parses body (`page`, `limit`, `sortBy`, `order`, `refresh`, `refreshErp`) |
| `utils/sql/erpStockDbSql.js` | SQL: one row per in-hand box |
| `utils/list/erpStockComparisonList.js` | Merge, dedupe, cache, pagination |
| `box/utils/inventory/boxInventorySql.js` | Shared helpers: `sqlDailyprodLateralForBox`, `sqlBoxCustomerNameReport`, `sqlBoxInHand` |
| `lib/utils/erp-api/stock/erpFgStock.js` | ERP FG fetch + map by item/packing |

---

## Row identity

A report row is keyed by **four fields** (customer is excluded):

```
packing_number + doc_dt + job_card_no + item_dcode
```

Implemented as `rowKey()` in `erpStockComparisonList.js`.

| Same key | Result |
|----------|--------|
| Same packing, date, job card, item — different customers | **One row**, DB stock summed, customer names joined |
| Different packing (e.g. 37828 vs 37826) | **Separate rows** |

---

## Inline approach (simplest design)

Deduping is done **in JavaScript**, not in SQL `GROUP BY`.

### Step 1 — SQL: one row per box

`sqlErpStockDbRows()` returns **one row per in-hand box**:

- Join `ims_stock_adjustment` when `sa_id` is set
- Use `sqlDailyprodLateralForBox` when `sa_id` is null — picks **one** dailyprod row per box (avoids row multiplication and wrong stock totals)
- Filter: in-hand, qty > 0, valid item dcode
- Per box: packing, item, date, job card, customer name, qty as `db_stock`

**Do not** use a plain `LEFT JOIN ims_dailyprod ON packing = doc_no` — one packing can have many dailyprod rows and will inflate `SUM(qty)`.

### Step 2 — JS: inline merge in `mergeDbAndErpRows()`

When looping DB box rows into a `Map`:

```javascript
const key = rowKey({ packing, itemDcode, docDt, jobCard });

const existing = merged.get(key);
if (existing) {
  existing.db_stock += dbStock;
  existing.customer_name = joinCustomerNames(existing.customer_name, db.customer_name);
} else {
  merged.set(key, { ...row });
}
```

`joinCustomerNames()` deduplicates and sorts comma-separated customer labels.

### Step 3 — ERP stock attach

ERP FG has **no customer dimension** — qty is at **packing + item** level.

For each ERP packing+item qty:

1. Find DB rows with matching packing + item
2. Assign ERP qty to the **best match** (doc date + job card score, then highest DB stock)
3. Prevents double-counting ERP qty in footer totals

### Step 4 — Customer name cleanup

`resolveCustomerNames()` runs after merge. If a token is still a numeric acc code, it is resolved via the preloaded **ledger map**.

Customer name priority in SQL (`sqlBoxCustomerNameReport`):

1. `ims_stock_adjustment.acc_name`
2. `ims_dailyprod.acc_name`
3. `ims_box_table.override_cust`

---

## Response row shape

| Field | Source |
|-------|--------|
| `packing_number` | Box / SA / dailyprod |
| `doc_dt` | SA or dailyprod |
| `job_card_no` | SA or dailyprod |
| `item_dcode` | SA or dailyprod |
| `item_code` | SA or dailyprod; enriched from item master if missing |
| `item_desc` | SA or dailyprod; enriched from item master if missing |
| `customer_name` | Comma-separated names (display only) |
| `db_stock` | Summed in-hand box qty |
| `erp_stock` | ERP FG API |
| `stock_diff` | `db_stock - erp_stock` |
| `mismatch` | `null` \| `"red"` (DB > ERP) \| `"yellow"` (ERP > DB) |

---

## Caching

| Cache | Default TTL | Env override | Cleared by |
|-------|-------------|--------------|------------|
| DB box rows | 60s | `ERP_STOCK_DB_CACHE_MS` | `refresh=true` |
| Full report | 120s | `ERP_STOCK_REPORT_CACHE_MS` | `refresh` or `refreshErp` |
| ERP FG API | separate | — | `refreshErp=true` |

Use **Refresh** on the UI (or pass `refresh: true` in the API body) after backend changes.

---

## Frontend

Flat `DataTable` — no customer grouping.

| Filter | Field |
|--------|-------|
| Item | `item_dcodes` |
| Packing entry | `packing_numbers` |
| Mismatch | `""` \| `"any"` \| `"red"` \| `"yellow"` |

Export includes the **Customer** column (`customer_name`).

Session cache key: `v7` in `erpStockReportClient.js`.

---

## Example

Two customers on the same packing/date/job/item:

| Packing | Date | Job card | Item | Customer | DB | ERP | Balance |
|---------|------|----------|------|----------|-----|-----|---------|
| 37826 | 2026-07-15 | JC-13866 | MSCSKP630Y | SITA SINGH & SONS..., MARKET | 21,280 | 10,520 | +10,760 |

One row — not two.

---

## Diagram

```
ims_box_table (many boxes)
        │
        ▼  sqlErpStockDbRows()
   one row per box
        │
        ▼  mergeDbAndErpRows()  ← inline dedupe by rowKey
   one row per packing+date+job+item
        │
        ▼  attach ERP FG qty (packing+item)
        │
        ▼  item master + ledger name resolve
        │
        ▼  paginated JSON
```
