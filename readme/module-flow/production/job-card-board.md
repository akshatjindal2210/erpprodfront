# Job Card Board (v5.1.0)

Production → **Maintain Job Card** → **Job Card Board**

One page with two views: **Board** (machines) and **Calendar** (day × shift). Only **authorized** job cards with a saved process plan are shown.

### Data flow (same as shop floor)

1. **Engineering → Machine Master** — create machines  
2. **Engineering → Process / Prime** — attach machines to processes  
3. **Production → Maintain Job Card** — create JC + process plan → **Authorize**  
4. **Job Card Board** — Board columns = machines; Calendar = `pldt` × `schedule_shift` (1–3)

### Board

- Columns: **Unassigned** + one per Machine Master (first-stage primary machine).
- Drag between machines → updates first-stage `machine_ids` (`machine_move` soft op — keeps authorization).
- **Start / Pause / Close** → status `Running` / `Hold` / `Complete` (soft op — keeps authorization).
- Card click → **ViewDrawer** on the same page (no redirect).

### Calendar

- Ranges: **Week** / **Month** / **2 Months**.
- Lanes: Shift 1 · Shift 2 · Shift 3.
- Drag card → updates `pldt` + `schedule_shift` (soft op).
- Proc / Mach on the card = **first stage only** (matches process plan Stage 1).

## Permissions

Same module as Maintain Job Card: **`production_job_card`**

| Permission | Behaviour |
|------------|-----------|
| **View** | Menu, Board / Calendar, filters, View drawer |
| **Add** | Add Job Card → Maintain Job Card (Pending Shortage) |
| **Edit** | Drag schedule / machine; Start / Pause / Close |

No new permission module.

## Route

`/production/dashboard/job-card/board`

## Files

| Path | Role |
|------|------|
| `frontend/.../job-card-board/Page.js` | Board + Calendar UI, DnD, filters, actions |
| `frontend/.../job-card-board/board.js` | Fetch / status / schedule / machine update helpers |
| `frontend/.../job-card-board/ViewDrawer.js` | In-place view (process plan + Est. time) |
| `frontend/.../app/production/dashboard/job-card/board/page.js` | Next.js page |
| `backend/.../job-card/job_card.table.js` | `schedule_shift` (1–3) |
| `backend/.../job-card/controllers/jobCard.controller.js` | Soft ops for status / schedule / machine move |

## Notes

- `approved` = gate for the board; `status` = shop floor state — kept separate.
- No separate board API — uses `/job-card/register`, machine helper, `/job-card/get` + `/job-card/update`.
- Card order within a machine column is UI-only (not persisted).
- Testing `mock.js` removed; helpers live in `board.js`.
