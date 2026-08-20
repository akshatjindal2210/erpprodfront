# Red Ticket

Penalty tickets (manual or from CL verification). Syncs negative MIS for `person_id`.

|               |                                                                 |
|---------------|-----------------------------------------------------------------|
| UI            | `/task/dashboard/red-ticket`                                    |
| Permission    | `red_ticket`                                                    |
| FE            | `modules/red-ticket/`                                           |
| BE            | `modules/red-ticket/`                                           |
| API           | `POST /api/task/red-tickets/` (`list|get|create|update|delete`) |
| Table         | `task_red_tickets`, `task_mis_score_ledger`                     |

**Files**

|               |                                                                                     |
|---------------|-------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/task/modules/red-ticket/Page.js`, `lib/services/redTicketApi.js` |
| BE            | `backend/src/apps/task/modules/red-ticket/`                                         |

**CRUD**

|               |                                                                   |
|---------------|-------------------------------------------------------------------|
| Create        | INSERT ticket; sync MIS if `score_penalty>0` and person           |
| Read          | org / date filters                                                |
| Update        | fields + re-sync MIS (edit-days gate)                             |
| Delete        | **HARD** ticket after `MisScore.deleteBySource('red_ticket', id)` |

**Linking**

`cl_instance_id` / `task_id` → SET NULL if parent deleted. Ticket delete does **not** delete CL/task. Only matching ledger rows are removed.

**Table impact**

| Action          | Writes                                                |
|-----------------|-------------------------------------------------------|
| Create / Update | `task_red_tickets` + `task_mis_score_ledger`          |
| Delete          | `task_red_tickets` hard + ledger rows for that source |
