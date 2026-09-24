# Job Card & Machine — RM Store (to the point)

## IPR (In Process Request) — normal use

**No Job Card dropdown.** Scan coil → `pjobcardno` / `macname` already on coil (from Issue Request → Store Out).

| What | File |
|------|------|
| Scan, shop-floor check, map coil lines | `InProcessRequestModal.js` — `resolveScannedCoil`, `mapCoilRow`, submit ~1500 |
| Coil helper load | `lib/services/coil.js` — `lookupCoilByUid` |
| Shop floor rule | `lib/utils/saMinusInventory.js` — `isIssuedToShopFloor` |
| List columns | `Page.js` — `pjobcardno`, `macname` |
| List machine enrich (BE) | `backend/.../enrichIprMachineLabels.js` |

Flow: **Issue Out sets coil → IPR reads coil.**

---

## Job Card select → Machine (ERP)

**Primary UI: Issue Request**, not IPR.

| What | File |
|------|------|
| JC pick → machine from ERP row | `issue-request/IssueRequestModal.js` — `handleJcChange` |
| One machine = one JC on same request | `lib/config/app.config.js` — `ISSUE_REQUEST_MACHINE_JOB_CARD_LOCK` |
| ERP job card API (FE) | `lib/services/production.js` — `getPrdRunJcViews`, `getPrdRunJcViewById` |
| ERP data (BE) | `backend/.../production/utils/erpItems.js` — `loadMappedPrdRunJc` (IMS `prdrunjc`, field `macname`) |
| Save issue + JC lines (BE) | `backend/.../issue-request/controllers/issueRequest.controller.js` |

Store Out stamps coil → IPR uses that stamp.

---

## IPR only — Reassign (JC + machine pick)

Logic exists; **UI off** (`reassignEnabled={false}`, Reassign block commented in `UpdateCoilStatusForm.js`).

| What | File |
|------|------|
| `fetchJobCards` / `getJobCardById` | `InProcessRequestModal.js` |
| JC change → set machine + wire options | `applyReassignFromJobCard`, `loadReassignWireOptions` |
| Form (commented) | `UpdateCoilStatusForm.js` |
| Save validation (BE) | `inProcessRequest.controller.js` — `assertConsumeReassignRules` |

---

## One-line map

```
IMS prdrunjc.macname → IssueRequestModal (select JC) → Store Out on coil → IPR scan (no JC select)
```
