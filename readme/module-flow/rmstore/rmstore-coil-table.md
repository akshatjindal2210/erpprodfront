# `rmstore_coil_table` — field reference

RM Store coil stock row. Schema: `backend/src/apps/rmstore/lib/config/tables/coil/coil_table.table.js`.  
List / Finder show extra columns from **joins** (MRN, location, job card, QC, IPR).

Related UI: [coils.md](./coils.md).

---

## Columns (direct from table)

| Column            | Type / role | What it tells you |
|-------------------|-------------|-------------------|
| `coil_uid`        | SERIAL PK | Internal id; list sort key |
| `coil_no_uid`     | VARCHAR(120), unique (active) | Sticker / QR **Coil UID** |
| `mrn_uid`         | FK → MRN | Which **MRN** this coil belongs to (item, heat, vendor come from MRN join) |
| `qty`             | NUMERIC | Current qty on this coil (can drop after partial IPR consume) |
| `location_id`     | FK → location master | **Rack location**; `NULL` = not stored on a rack |
| `in_uid`          | INTEGER | **Store In** entry when coil was put on rack |
| `out_uid`         | INTEGER | **Store Out** when issued to shop floor |
| `rm_uid`          | INTEGER | **RM Rejection** register link |
| `qc_uid`          | INTEGER | QC check link on coil |
| `ipr_uid`         | INTEGER | **In-Process Request** (consume, reassign, store-in balance, etc.) |
| `sa_id`           | INTEGER | **Stock adjustment** document id |
| `sa_entry_type`   | VARCHAR(50) | SA line type: `stock_in`, `stock_out`, `production_return`, … |
| `status`          | VARCHAR(24), default `active` | Lifecycle — see below |
| `download_count`  | INTEGER | Coil sticker download count |
| `is_deleted`, `deleted_by`, `deleted_at` | soft delete | Row hidden from live lists |
| `created_by`, `created_at`, `updated_by`, `updated_at` | audit | Who/when; date-range list filters use `created_at` |

---

## `status` values (UI “zone”)

App derives **Area / Zone** in UI via `getCoilStockZone()` (`coilTableVisuals.js`), using `status` plus pointers:

| `status`    | Typical pointers | Meaning |
|-------------|------------------|---------|
| `active`    | `location_id` NULL or set | **Unassigned** (coil area) or **Stored** (has rack) |
| `out`       | `out_uid` set | **Shop floor** (issued) |
| `consumed`  | often `ipr_uid` and/or `sa_id` + `sa_entry_type = stock_out` | **Consumed** — wire used (IPR) or written off (SA minus) |
| `rejected`  | `rm_uid` / QC fail paths | Rejection / hold flows |
| `returned`  | — | Returned out |

**Consumed**

- **IPR full consume:** `status = 'consumed'`, `ipr_uid` set; `out_uid` / `location_id` usually cleared.
- **SA minus:** `status = 'consumed'`, `sa_id` set, `sa_entry_type = 'stock_out'`, usually no `out_uid`.

Helpers: `isIssuedToShopFloor()` = `status === 'out'` and `out_uid` present.  
`isSaMinusWriteOff()` = `sa_entry_type === 'stock_out'` without shop-floor issue.

---

## Decision tree (table only)

```
is_deleted = true          → not in live stock lists

status = consumed          → Consumed (see ipr_uid vs sa_id)

status = out + out_uid     → Shop floor

status = active
  location_id set          → Stored
  location_id NULL         → Unassigned / coil area (+ QC/rejection rules)

rm_uid / qc_uid / ipr_uid  → link to rejection, QC, in-process docs
```

---

## Not on this table (comes from joins)

| UI field | Source |
|----------|--------|
| Heat no, item code/desc, vendor, MRN no/date, bill | `mrn` |
| Location no, rack, row | `location_master` |
| Job card, machine, FG item | `out_entry` + `issue_request_job_card` (and IPR reassign lateral) |
| QC pass/fail label | QC join / `qc_check_status` SQL |
| Rejection labels | Rejection join |
| Coil Finder FG splits | Backend enrich on finder load |

---

## Coils list — Journey filter (API)

When `filters.journey` is set, **date range is ignored** (full DB search).  
Implementation: `backend/src/apps/rmstore/lib/utils/logJourneyFilter.js` → `appendCoilJourneyCondition`.

| Search text matches | Fields |
|---------------------|--------|
| Exact + prefix | `coil_no_uid`, `coil_uid`, `mrn_uid` |
| Exact | `mrn_no`, `heat_no`, `item_code` |
| Contains (`%text%`) | `pjobcardno`, `macname` (from job-card join) |

Apply on UI: type Journey → **Search** or Enter in Journey field (same pattern as IMS Boxes).

---

## Coil Finder — FG item

FG in header is shown when coil is in production context (issue / consume / reassign).  
Finder API: `enrichFinderCoilFg()` clears FG for store/unassigned coils; shop floor uses job card + `enrichCoilFgForReassign`.

---

## Code pointers

| Topic | Location |
|-------|----------|
| Table DDL | `backend/.../tables/coil/coil_table.table.js` |
| List query + joins | `backend/.../coil/models/coil.model.js` |
| Journey SQL | `backend/.../lib/utils/logJourneyFilter.js` |
| Zone filter (client) | `frontend/.../coil/coilTableVisuals.js`, `coil/Page.js` |
| Finder consumed card | `frontend/.../coil/CoilFinderPlacementSection.js` |
