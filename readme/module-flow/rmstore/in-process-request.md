# In-process Request

After issue: consume, store-in return, rejection, reassign, transfer. Same permission `rm_issue_request`.

|               |                                                                                                    |
|---------------|----------------------------------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/in-process-request`                                                            |
| Permission    | `rm_issue_request`                                                                                 |
| FE            | `modules/in-process-request/`                                                                      |
| BE            | `modules/in-process-request/`                                                                      |
| API           | `POST /api/rmstore/in-process-requests/` (`list|create|update|approve|complete-store-in|delete|…`) |
| Table         | `rmstore_in_process_request`                                                                       |
| Version notes | [v4.4.5.md](../../version-notes/v4.4.5.md)                                                         |

**Files**

|               |                                                                                                                         |
|---------------|-------------------------------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/in-process-request/` (`InProcessRequestModal.js`, consume / store-in / status forms) |
| BE            | `backend/src/apps/rmstore/modules/in-process-request/` (routes `MODULE = rm_issue_request`)                             |
| Schema boot   | `backend/.../tables/in-process-request/in_process_request.table.js`                                                     |

**CRUD**

|                 |                                                                          |
|-----------------|--------------------------------------------------------------------------|
| Create / Update | `coils` JSONB (slim); `reassign_jc` on header for reassign               |
| Read            | list / pending store-in / store-out / pending shop-floor                 |
| Delete          | **SOFT**. Approved delete reverts consume / store-in / rejection helpers |

---

## Canonical `type` (v4.4.5)

| `type` | UI |
|--------|-----|
| `consume` | Full Consume, or **Return** (leftover → Store In) |
| `return` | Standalone Store In |
| `reassign` | Balance stays on shop floor (target JC in `reassign_jc`) |
| `reject_coil` / `reject_lot` | In-process rejection |

Update Coil Status **Return** card still saves `type=consume` + balance → `pending_store_in`. FE badge shows **Return**.

---

## Update Coil Status — Return qty

| Mode | Field | Result |
|------|--------|--------|
| Full Consume | — | Entire coil consumed |
| **Return** | **Return qty** = amount to Store In | `remaining = return qty` → Store In Pending |
| Reassign | Consumed qty on current JC | Balance on target JC (shop floor) |

Do not treat Return field as consumed qty (that made full qty look like Full Consume).

---

## Coil reassign JC chain (list + Finder)

Approved reassign IPRs for a shop-floor coil are loaded in batch (`loadReassignHistoryByCoilUids`). Slim coils store `original_qty` + `remaining_qty` only — consumed is derived as `original − remaining`.

| Surface | Display |
|---------|---------|
| Coils table | `JC-A (qty), JC-B (qty), JC-C (qty)` + machines |
| Finder This coil | Latest JC + machine |
| Finder History | Earlier JCs, list desc, count **N…1** (oldest = 1) |

Machines from IR job-card master. **Do not** rewrite `out_entry.pjobcardno` on list load (heal helper removed).

---

## Boot backfill — after deploy, how to remove

Source file (do not change unless following this checklist):  
`backend/.../tables/in-process-request/in_process_request.table.js` → `createRmStoreInProcessRequestTable`.

| Piece | Default | After successful deploy |
|-------|---------|-------------------------|
| **`RUN_IPR_BACKFILL`** | `false` | **Keep false.** One-time only: set `true` → restart once (legacy cols still present) → set `false` → redeploy |
| **`recoverIprTypeLight()`** | Runs every boot | Idempotent. When Register types look correct for a few boots, **comment out** `await recoverIprTypeLight()` in `createRmStoreInProcessRequestTable` |
| **`backfillReassignJcLight()`** | No-op | **Never re-enable** (would copy source JC into `reassign_jc`) |
| **`backfillIprLegacyHeavy()`** | No-op unless flag true | After legacy cols dropped, always no-op; keep flag false |
| **`dropColumnsIfExist(LEGACY_…)`** | Keep | Safe / idempotent |

**Checklist**

1. Deploy with `RUN_IPR_BACKFILL = false`.
2. Spot-check Register Type badges (consume / return / reassign / reject_*).
3. Confirm legacy columns gone (or dropped on boot).
4. Optional cleanup: comment out `await recoverIprTypeLight()` so boot skips type UPDATEs.
5. Do not turn `RUN_IPR_BACKFILL` back on in production.

Also noted in [v4.4.5.md](../../version-notes/v4.4.5.md) §1.

---

## Linking

`consume` approve → coil `status=consumed`, `ipr_uid`. Leftover may queue Store In. `return` / leftover receive → `complete-store-in`. `rejection` → pending Store Out. `reassign` → shop-floor balance on target JC.

**Table impact**

| Action        | Writes                                                   |
|---------------|----------------------------------------------------------|
| Approve       | `rmstore_in_process_request` + coil `status` / `ipr_uid` |
| Delete        | soft IPR + status revert helpers                         |
