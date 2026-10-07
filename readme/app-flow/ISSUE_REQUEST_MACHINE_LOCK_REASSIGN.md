# Issue Request — machine lock after IPR reassign

**Release:** v4.4.7 follow-up (7 Oct 2026)  
**Deploy:** backend only · no DB migration · **restart API** after deploy

---

## Problem

With `ISSUE_REQUEST_MACHINE_JOB_CARD_LOCK = true`, picking a job card on Issue Request calls `POST /api/rmstore/issue-request/machine-job-card-check`.

After **Consume + Reassign** (approved IPR, balance still `status = out`):

- IPR **Pending** shows balance on **target** JC + machine (e.g. JC-14148 · NF-2-11B).
- Lock still counted the **store-out source** JC + machine (e.g. JC-14129 · H-11-M10).
- User could not issue a new JC on the source machine even though shop floor responsibility had moved.

---

## Fix (what changed)

Shop-floor lock uses **effective** job card + machine — same idea as coil display / IPR Pending:

| Step | Source |
|------|--------|
| Balance JC | Last approved reassign hop (IPR `coils` + `reassign_jc`) |
| Machine | Issue Request job card → else ERP `prdrunjc` → else `reassign_jc.macname` |
| No fallback | If balance JC ≠ store-out JC, do **not** fall back to store-out machine |

**Unchanged rules**

- One machine = one shop-floor job card at a time.
- Open Issue Request without Store Out → `findMachineJobCardLockConflicts` (unchanged).
- Consume / Store In receive clears the machine (unchanged).
- FIFO, coil reserve, save/approve Issue Request (unchanged).

---

## Key files

| Layer | Path |
|-------|------|
| Effective JC/mac | `backend/.../coil/models/coil.model.js` — `resolveEffectiveShopFloorLockAssignment`, `loadReassignHistoryByCoilUids` (+ ERP mac) |
| Lock queries | `backend/.../issue-request/models/issueRequest.model.js` — `findMachineShopFloorJobCardConflicts`, `findMachineShopFloorDifferentWireConflicts` |
| API | `issueRequest.controller.js` — `checkMachineJobCardAssignment` |
| Config | `lib/config/app.config.js` — `ISSUE_REQUEST_MACHINE_JOB_CARD_LOCK` |
| FE check | `issue-request/IssueRequestModal.js` — `machineJobCardCheck` on JC pick |

---

## Deploy checklist

1. Deploy **backend** build that includes the two model files above.
2. **Restart** Node/API (hot reload may not pick up all changes).
3. **Frontend** — no change required for this fix; redeploy optional.
4. **Database** — no script; existing IPR `reassign_jc` JSON rows only.
5. **IMS / ERP** — `prdrunjc` must be reachable for target JC machine when JC is not on Issue Request yet.

### Smoke test

1. Approve IPR: partial consume + reassign balance to another JC/machine; coil still on shop floor (Pending).
2. Issue Request: pick a **new** JC on the **source** machine → `machine-job-card-check` → `allowed: true`.
3. Same machine with a coil still physically on it (no reassign) → still `allowed: false`.
4. Pick new JC on **target** machine while balance pending there → still blocked until Consume/Store In.

---

## Related

- [JOB_CARD_AND_MACHINE.md](./JOB_CARD_AND_MACHINE.md)
- [v4.4.7.md](../version-notes/v4.4.7.md) — §10
