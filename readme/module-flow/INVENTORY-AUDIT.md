# Inventory Audit (IMS + RM Store)

Shared physical inventory audit for **finished goods (boxes)** in IMS and **raw material (coils)** in RM Store. Both apps use the **same PostgreSQL tables**; behaviour differs only by `app_type` and snapshot source (box vs coil).

| App      | UI route                         | Permission              | Stock unit |
|----------|----------------------------------|-------------------------|------------|
| IMS      | `/ims/dashboard/audit`           | `audit`                 | Box UID    |
| RM Store | `/rmstore/dashboard/inventory-audit` | `rm_inventory_audit` | Coil UID   |

**Related (IMS-only quick ref):** [ims/audit.md](./ims/audit.md)

---

## Database (unified)

| Table | Purpose |
|-------|---------|
| `ims_audit_master` | Audit header: dates, status, approval, soft delete, **`app_type`** (`ims` \| `rmstore`) |
| `ims_audit_locations` | Per-location assignment, status, score, expected/scanned JSON |

**Columns on locations (important):**

| Column | Stored JSON shape |
|--------|-------------------|
| `expected_boxes` | IMS: box snapshot fields (`box_no_uid`, …). RM: coil snapshot fields (`coil_no_uid`, MRN, heat, …) |
| `scanned_boxes` | Scan list: `{ coil_no_uid \| box_no_uid, scanned_at, scanned_by }` |
| `score_pct`, `score_at` | Frozen score when location is **closed** (`completed` / `mismatch`) |
| `result_rejected` | Admin rejected audit result for that location |

**Legacy RM tables:** dropped in `backend/src/config/db/legacyTableDrops.js` via `runLegacyTableDrops()` from `initDB()` on backend boot.

**DDL / migrations:** `backend/src/apps/ims/lib/config/tables/audit/audit.table.js`  
**Table registry:** `backend/src/config/db/dbTables.js`  
**Shared backend:** `backend/src/apps/core/lib/inventory-audit/auditList.js` (list SQL, `app_type`, location validation), `auditAccess.js` (record visibility)

### API JSON aliases (RM Store only)

List/detail queries expose location JSON with RM-friendly names:

- DB `expected_boxes` → API `expected_coils`
- DB `scanned_boxes` → API `scanned_coils`

Backend code that reads `findAudit().locations` must use helpers:

- `auditLocationExpectedUnits(loc)` / `auditLocationScannedUnits(loc)`  
  (`backend/src/apps/rmstore/modules/inventory-audit/utils/snapshot/auditCoilSnapshot.js`)

IMS API uses `expected_boxes` / `scanned_boxes` in JSON (same as column names).

---

## Lifecycle (both apps)

1. **Create** audit master + location assignments (user → location ids).
2. **Approve** audit (workers can scan only when approved and in date range).
3. **Start location** — freeze live in-hand stock into `expected_boxes` JSON.
4. **Submit scans** — merge UIDs into `scanned_boxes`; location → `draft` when scans exist.
5. **Complete / mismatch** — location closes; **score saved** to DB.
6. Optional **comparison adjustment** — align `ims_box_table` or `rmstore_coil_table` `location_id` with audit result; score recalculated.
7. Master status: `pending` → `in_progress` → `submitted` / `verified` (all locations closed; verified when all match).

**RM coil ↔ MRN join:** `rmstore_mrn.uid = rmstore_coil_table.mrn_uid` (not `mrn.mrn_uid`).

---

## Score logic

### 1. Compare expected vs scanned (per location)

Build two sets of normalized UIDs (uppercase trim):

| Metric | Definition |
|--------|------------|
| `expected_count` | Count of expected units |
| `scanned_count` | Count of scanned units |
| **missing** | In expected, not in scanned |
| **extra** | In scanned, not in expected |
| **matched** (for UI lists) | UIDs in **both** sets |

Backend comparison objects:

- IMS: `compareLocationBoxSets` — `backend/src/apps/ims/modules/audit/utils/snapshot/auditBoxSnapshot.js`
- RM: `compareLocationCoilSets` — `backend/src/apps/rmstore/modules/inventory-audit/utils/snapshot/auditCoilSnapshot.js`

For scoring, backend derives:

```text
matched_count = expected_count − missing.length
              (= number of expected units that were scanned correctly)
```

### 2. Score percentage

```text
net      = max(0, matched_count − extra_count)
score %  = round((net / expected_count) × 100, 2 decimals)
```

**Edge case:** if `expected_count === 0`:

- if `net > 0` → **0%**
- else → **100%**

**Intuition:**

- Each **missing** expected unit lowers `matched_count` (via missing list).
- Each **extra** scan reduces `net` again: `net = matched − extra`, so wrong/extra scans hurt twice.

### Examples

| Expected | Correct scans (matched) | Extra scans | net | Score |
|----------|-------------------------|-------------|-----|-------|
| 80 | 80 | 0 | 80 | **100%** |
| 80 | 40 | 0 | 40 | **50%** |
| 80 | 40 | 10 | 30 | **37.5%** |
| 10 | 10 | 2 | 8 | **80%** |

Comparison report header counts:

- **EXPECTED** — `expected_count` / system snapshot size  
- **SCANNED** — `scanned_count`  
- **MATCHED** — matched UID count (intersection)  
- **MISSING** / **EXTRA** — list lengths  
- **SCORE** — formula above (from summary matched + extra, not “scanned” alone)

### 3. When score is persisted

Written to `ims_audit_locations.score_pct` and `score_at`:

| Trigger | Backend function |
|---------|------------------|
| Location closes after scan progress | `evaluateAuditLocationProgress` → `recordLocationScoreFromComparison` |
| Admin complete location | `completeAuditLocation` |
| Comparison adjustment applied | `applyAuditComparisonAdjustment` |

Until location is closed, list may show **Pending** or a **live** score from frontend comparison; `score_at` stays null.

**Scores API:** `POST /api/.../scores` → `getAuditLocationScores` (only rows with `score_at IS NOT NULL`; aggregates per user).

---

## Code map

### Backend — formula & persistence (duplicate IMS / RM files, same math)

| Function | File (IMS) | File (RM) |
|----------|------------|-----------|
| `computeLocationScorePct` | `backend/src/apps/ims/modules/audit/models/audit.model.js` | `backend/src/apps/rmstore/modules/inventory-audit/models/audit.model.js` |
| `scoreBreakdownFromComparison` | same | same |
| `saveLocationScorePct` | same | same |
| `getAuditLocationScores` | same | same |
| `getAuditComparisonReport` | same | same |

### Backend — routes

| App | Base path | Routes file |
|-----|-----------|-------------|
| IMS | `/api/audit/` | `backend/src/apps/ims/modules/audit/routes/audit.routes.js` |
| RM | `/api/rmstore/inventory-audit/` (see RM endpoints config) | `backend/src/apps/rmstore/modules/inventory-audit/routes/audit.routes.js` |

### Frontend — display & batch score

| Purpose | IMS | RM Store |
|---------|-----|----------|
| Compare + score helpers | `frontend/src/apps/ims/modules/audit/auditScanHelpers.js` | `frontend/src/apps/rmstore/modules/inventory-audit/auditScanHelpers.js` |
| Comparison modal score | `AuditComparisonModal.js` | `AuditComparisonModal.js` |
| List columns / batch score | `auditColumns.js`, `auditListHelpers.js` | same names under `inventory-audit/` |
| Export | `auditComparisonExport.js` | `auditComparisonExport.js` |

Key frontend functions:

- `getLocationBoxComparison` / coil equivalent — missing, extra, matched arrays  
- `computeLocationScoreFromCounts(expected, matched, extra)` — same formula as backend  
- `computeAuditBatchScore(audit)` — one combined % across closed/scored **active** locations on master list  

---

## Permissions & activity

| App | Module slug | Entity in activity log |
|-----|-------------|-------------------------|
| IMS | `audit` | `audit` |
| RM | `rm_inventory_audit` | `rm_inventory_audit` |

Verify audit: **super_admin** only (both apps).

---

## Deploy checklist

1. Run backend init / migrations so `ims_audit_master.app_type` exists; existing rows default to `ims`.
2. Smoke-test IMS list (only `app_type = ims`) and RM list (only `rmstore`).
3. RM: start location (no MRN SQL error), submit scans, comparison report shows non-zero **SCANNED** / **MATCHED**.
4. Close location and confirm `score_pct` / `score_at` on `ims_audit_locations`.

---

## Stock tables (unchanged)

Audit does **not** merge stock masters:

- IMS adjustments touch `ims_box_table.location_id`
- RM adjustments touch `rmstore_coil_table.location_id`

Locations for both apps: `ims_location_master` (`type` = `ims` or `rmstore`).
