# RM Store — Database Tables

Registry: `backend/src/config/db/dbTables.js` → `RMSTORE_TABLES`  
Init: `backend/src/apps/rmstore/lib/config/db/initDB.js`  
DDL: `backend/src/apps/rmstore/lib/config/tables/`

**11 live tables** (prefix `rmstore_`). Schema is CREATE-only — drop old `rmstore_*` tables manually before restart if migrating.

Shared (not RM-only): `mst_activity_logs` with `app_type = 'rmstore'` for Activity Log UI.

---

## Overview

| # | Table | Cols | Purpose |
|---|-------|------|---------|
| 1 | `rmstore_master_location` | 18 | Rack/row locations (`RM-{rack}{row}`) |
| 2 | `rmstore_master_production` | 15 | FG item ↔ RM item mapping |
| 3 | `rmstore_master_spec` | 24 | QC spec lines per item |
| 4 | `rmstore_mrn` | 24 | MRN batch (ERP receipt + sticker meta) |
| 5 | `rmstore_coil_table` | 30 | Coil stickers / stock lifecycle |
| 6 | `rmstore_inventory_inwards` | 16 | Store-In headers |
| 7 | `rmstore_qc_check` | 22 | Per-coil QC (specs in `items` JSONB) |
| 8 | `rmstore_qc_rejection` | 16 | QC rejection batches |
| 9 | `rmstore_issue_request` | 20 | Production issue (`coils` JSONB) |
| 10 | `rmstore_out_entry` | 17 | Store-Out headers |
| 11 | `rmstore_coil_transaction` | 9 | Coil movement + sticker download log |

---

## 1. `rmstore_master_location`

**Purpose:** Store rack/row locations; coils get `location_id` on Store-In.

| Column | Type |
|--------|------|
| location_id | SERIAL PK |
| location_no | VARCHAR(100) |
| rack_no | VARCHAR(50) |
| row_no | VARCHAR(50) |
| location_description | TEXT |
| total_capacity | INTEGER |
| item_dcode | INTEGER |
| item_code | VARCHAR(100) |
| item_desc | TEXT |
| approved / approved_by / approved_at | BOOLEAN / TEXT / TIMESTAMP |
| is_deleted / deleted_by / deleted_at | BOOLEAN / TEXT / TIMESTAMP |
| created_by / created_at | TEXT / TIMESTAMP |
| updated_by / updated_at | TEXT / TIMESTAMP |

**Used in**
- BE: `modules/store-location/`; JOIN in `coil.model.js`, `inventory-report`
- FE: `master/store-location/`, Location Finder; Store-In modal location pick

---

## 2. `rmstore_master_production`

**Purpose:** Links finished-goods item to raw-material item for Issue Request.

| Column | Type |
|--------|------|
| production_id | SERIAL PK |
| item_dcode / item_code | INTEGER / VARCHAR(100) |
| rm_item_dcode / rm_item_code / rm_item_desc | INTEGER / VARCHAR / TEXT |
| approved / approved_by / approved_at | BOOLEAN / TEXT / TIMESTAMP |
| is_deleted / deleted_by / deleted_at | BOOLEAN / TEXT / TIMESTAMP |
| created_by / created_at | TEXT / TIMESTAMP |
| updated_by / updated_at | TEXT / TIMESTAMP |

**Used in**
- BE: `modules/production/`; read by `issue-request`
- FE: `master/production/`; Issue Request modal

---

## 3. `rmstore_master_spec`

**Purpose:** One row per QC parameter line for an item (`item_dcode` + `sno`).

| Column | Type |
|--------|------|
| spec_id | SERIAL PK |
| item_dcode / item_code / item_desc | INTEGER / VARCHAR / TEXT |
| sno | INTEGER |
| type / spec_name / remarks / print_val | VARCHAR / VARCHAR / TEXT / TEXT |
| spec_type | VARCHAR(50) |
| min_value / max_value | NUMERIC |
| correct_option / incorrect_option | TEXT |
| document_required | BOOLEAN |
| approved / approved_by / approved_at | BOOLEAN / TEXT / TIMESTAMP |
| is_deleted / deleted_by / deleted_at | BOOLEAN / TEXT / TIMESTAMP |
| created_by / created_at | TEXT / TIMESTAMP |
| updated_by / updated_at | TEXT / TIMESTAMP |

**Used in**
- BE: `modules/spec/`; loaded by QC Check inspect
- FE: `master/rm-spec/`; QC Check modal checklist

---

## 4. `rmstore_mrn`

**Purpose:** Local copy of ERP MRN line; created/updated on sticker generate. Docs (TC/RMTC) live here once.

| Column | Type |
|--------|------|
| uid | VARCHAR(100) PK |
| mrn_no / serial_no | INTEGER |
| mrn_dt / bill_no / bill_dt | TIMESTAMP / VARCHAR / TIMESTAMP |
| acc_code / acc_name | INTEGER / TEXT |
| item_dcode / item_code / item_desc | INTEGER / VARCHAR / TEXT |
| it_recp_qty / it_lot_no / it_unit | NUMERIC / VARCHAR / VARCHAR |
| fyid | INTEGER |
| sticker_mode | VARCHAR(24) |
| sticker_generated | BOOLEAN |
| internal_create_user / internal_create_date | VARCHAR / TIMESTAMPTZ |
| system_generate_user / system_generate_date | VARCHAR / TIMESTAMPTZ |
| tc_file_path / tc_file_name | TEXT / VARCHAR |
| rmtc_file_path / rmtc_file_name | TEXT / VARCHAR |

**Used in**
- BE: `modules/mrn/` (portal, sticker, print); JOIN inventory report
- FE: `mrn-portal/` (MrnStickerModal, etc.)

---

## 5. `rmstore_coil_table`

**Purpose:** Individual coil stickers — core stock entity through QC, Store-In, Store-Out.

| Column | Type |
|--------|------|
| coil_uid | SERIAL PK |
| coil_no_uid | VARCHAR(120) UNIQUE (active) |
| mrn_uid | VARCHAR → `rmstore_mrn.uid` |
| mrn_no / serial_no / heat_no | INTEGER / INTEGER / VARCHAR |
| item_dcode / item_code / item_desc | INTEGER / VARCHAR / TEXT |
| acc_code / acc_name | INTEGER / TEXT |
| qty / coil_index / total_coils | NUMERIC / INTEGER / INTEGER |
| remarks | TEXT |
| location_id | INTEGER → location |
| in_uid | INTEGER (Store-In header) |
| qc_reject_uid | INTEGER (rejection header) |
| qc_check_uid / qc_check_status | INTEGER / VARCHAR |
| out_uid | INTEGER (Store-Out header) |
| status | VARCHAR(24) default `active` |
| download_count | INTEGER |
| is_deleted / deleted_by / deleted_at | BOOLEAN / TEXT / TIMESTAMP |
| created_by / created_at | TEXT / TIMESTAMP |
| updated_by / updated_at | TEXT / TIMESTAMP |

**Used in**
- BE: `modules/coil/`; MRN sticker/print; inventory-inward; qc-check; qc-rejection; out-entry; issue-request (read); inventory-report; journey filters; coil logs
- FE: `coil/`; MRN portal; Store In/Out; QC; Issue Request; Inventory Report; shared scan modals

---

## 6. `rmstore_inventory_inwards`

**Purpose:** Store-In batch header; coils get `in_uid` + `location_id`.

| Column | Type |
|--------|------|
| in_uid | SERIAL PK |
| mrn_refs / heat_nos / item_codes / qtys | TEXT |
| total_qty / coil_count | NUMERIC / INTEGER |
| remarks | TEXT |
| approved / approved_by / approved_at | BOOLEAN / TEXT / TIMESTAMP |
| is_deleted / deleted_by / deleted_at | BOOLEAN / TEXT / TIMESTAMP |
| created_by / created_at | TEXT / TIMESTAMP |
| updated_by / updated_at | TEXT / TIMESTAMP |

**Used in**
- BE: `modules/inventory-inward/` (+ coil updates + coil TX)
- FE: `inventory-inward/`

---

## 7. `rmstore_qc_check`

**Purpose:** QC inspection per coil. Spec answers/docs in `items` JSONB (no child table).

| Column | Type |
|--------|------|
| qc_check_uid | SERIAL PK |
| coil_no_uid | VARCHAR(120) |
| mrn_uid / mrn_no / heat_no | VARCHAR / INTEGER / VARCHAR |
| item_dcode / item_code / item_desc | INTEGER / VARCHAR / TEXT |
| qty | NUMERIC |
| status | VARCHAR(24) — `pending` / `draft` / `awaiting_approval` / `passed` / `failed` |
| failure_reason / remarks | TEXT |
| items | JSONB `[]` — checklist lines + doc paths |
| inspected_by / inspected_at | TEXT / TIMESTAMP |
| approved | BOOLEAN DEFAULT false — **true after Authorize; Register shows only these** |
| approved_by / approved_at | TEXT / TIMESTAMP |
| qc_reject_uid | INTEGER (link to rejection when failed) |
| is_deleted / deleted_by / deleted_at | BOOLEAN / TEXT / TIMESTAMP |
| created_by / created_at | TEXT / TIMESTAMP |
| updated_by / updated_at | TEXT / TIMESTAMP |

**Used in**
- BE: `modules/qc-check/`; soft-delete from MRN cancel; may create QC rejection; updates coils + TX
- FE: `qc-check/` (QcCheckModal)

---

## 8. `rmstore_qc_rejection`

**Purpose:** Batch of QC-failed coils leaving store/coil area.

| Column | Type |
|--------|------|
| qc_reject_uid | SERIAL PK |
| mrn_refs / heat_nos / item_codes / qtys | TEXT |
| total_qty / coil_count | NUMERIC / INTEGER |
| reason / remarks | TEXT |
| approved / approved_by / approved_at | BOOLEAN / TEXT / TIMESTAMP |
| is_deleted / deleted_by / deleted_at | BOOLEAN / TEXT / TIMESTAMP |
| created_by / created_at | TEXT / TIMESTAMP |
| updated_by / updated_at | TEXT / TIMESTAMP |

**Used in**
- BE: `modules/qc-rejection/`; also written from QC Check on fail
- FE: `qc-rejection/`

---

## 9. `rmstore_issue_request`

**Purpose:** Production issue request; selected coils stored in `coils` JSONB.

| Column | Type |
|--------|------|
| issue_uid | SERIAL PK |
| production_id | INTEGER |
| item_dcode / item_code / item_desc | INTEGER / VARCHAR / TEXT |
| rm_item_dcode / rm_item_code / rm_item_desc | INTEGER / VARCHAR / TEXT |
| requested_qty / total_qty / coil_count | NUMERIC / NUMERIC / INTEGER |
| coils | JSONB `[]` |
| remarks | TEXT |
| approved / approved_by / approved_at | BOOLEAN / TEXT / TIMESTAMP |
| is_deleted / deleted_by / deleted_at | BOOLEAN / TEXT / TIMESTAMP |
| created_by / created_at | TEXT / TIMESTAMP |
| updated_by / updated_at | TEXT / TIMESTAMP |

**Used in**
- BE: `modules/issue-request/`
- FE: `issue-request/`

---

## 10. `rmstore_out_entry`

**Purpose:** Store-Out batch header; coils get `out_uid`, leave location.

| Column | Type |
|--------|------|
| out_uid | SERIAL PK |
| mrn_refs / heat_nos / item_codes / qtys | TEXT |
| total_qty / coil_count | NUMERIC / INTEGER |
| location_refs | TEXT |
| remarks | TEXT |
| approved / approved_by / approved_at | BOOLEAN / TEXT / TIMESTAMP |
| is_deleted / deleted_by / deleted_at | BOOLEAN / TEXT / TIMESTAMP |
| created_by / created_at | TEXT / TIMESTAMP |
| updated_by / updated_at | TEXT / TIMESTAMP |

**Used in**
- BE: `modules/out-entry/`
- FE: `out-entry/`

---

## 11. `rmstore_coil_transaction`

**Purpose:** Single audit table for inventory moves **and** sticker downloads (`transaction_type = sticker_download`). Payload in `details` JSONB.

| Column | Type |
|--------|------|
| id | SERIAL PK |
| transaction_type | VARCHAR(48) |
| source_module | VARCHAR(48) |
| source_id | VARCHAR(64) |
| mrn_no | VARCHAR(50) |
| user_id | INTEGER → `mst_users` |
| user_name | VARCHAR(100) |
| details | JSONB |
| created_at | TIMESTAMP |

**Writers:** `logCoilTransaction.js` — inward, QC, rejection, out-entry; sticker downloads via `coilDownloadLog.model.js`  
**Readers:** `manage/log/` — Coil Transaction Log + Coil Download Log APIs  
**FE:** `logs/CoilTransactionLogPage.js`, `CoilDownloadLogPage.js`

---

## Shared: `mst_activity_logs` (RM usage)

Not an `rmstore_*` table. RM writes with `app_type = 'rmstore'` via `logRmstoreActivity` / middleware.

| Column | Notes |
|--------|--------|
| entity_id | VARCHAR(120) — numeric id **or** string REF (e.g. MRN uid `3701_2`) |
| log_data | JSONB — may include `ref` |

**FE:** `logs/ActivityLogPage.js` (`app_type: "rmstore"`)

---

## Typical flow (tables touched)

```
ERP MRN → rmstore_mrn + rmstore_coil_table (+ coil_transaction sticker_download)
       → rmstore_qc_check (+ master_spec)
       → rmstore_inventory_inwards (+ coil location / master_location)
       → rmstore_issue_request (+ master_production)  [optional]
       → rmstore_out_entry
Fail QC → rmstore_qc_rejection
All moves → rmstore_coil_transaction
UI actions → mst_activity_logs
```
