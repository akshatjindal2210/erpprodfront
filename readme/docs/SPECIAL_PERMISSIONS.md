# Special Permissions — Full Reference

This document explains every **special permission** used in the ERP app (IMS, RM Store, Task). These are **not** the same as normal module permissions (`view` / `add` / `edit` / `delete` / `authorize`).

---

## 1. What are special permissions?

| Concept                 | Meaning |
|-------------------------|---------|
| **Module permissions**  | Who can open a screen and do CRUD / authorize on that module (set per module in User → Permissions). |
| **Special permissions** | Extra flags / settings stored on the user as JSON (`special_permissions`). They gate **sensitive or exceptional** actions that should not be given to every user who only has module edit. |

### Where they are stored

- DB field on the user: `special_permissions` (JSON / JSONB).
- Shape (current):

```json
{
  "ims": {
    "inventory_out": false,
    "inventory_approve": false,
    "direct_forwarding_note": false,
    "manage_forwarding_bill": false
  },
  "task": {
    "verification_user_id": null
  },
  "rmstore": {
    "type_spec_values": false,
    "issue_rm_mapped": false,
    "in_process_rejection": false
  }
}
```

### Where they are configured (UI)

**Settings → Identity → Users → Edit user**

- IMS section → “Special Permissions”
- Task section → “CL Verification Person”
- RM Store section → “RM Store Special Permissions”

### Super admin rule

For almost every flag:

- **`super_admin`** is treated as **always allowed** (no need to tick the checkbox).
- Exception noted below: RM Store `issue_rm_mapped` (backend treats super admin differently — see RM Store section).

### Code helpers (source of truth for checks)

| App       | Frontend | Backend |
|-----------|----------|---------|
| IMS       | `frontend/src/apps/ims/lib/utils/imsSpecialPermissions.js` | `backend/src/apps/ims/lib/utils/imsSpecialPermissions.js` |
| RM Store  | `frontend/src/apps/rmstore/lib/utils/rmstoreSpecialPermissions.js` | `backend/src/apps/rmstore/lib/utils/rmstoreSpecialPermissions.js` |
| Task      | `frontend/src/apps/task/lib/utils/taskSpecialPermissions.js` | (read via user profile / CL task flows) |

---

## 2. IMS special permissions

### 2.1 `ims.inventory_out` — Inventory Out

|  | |
|--|--|
| **UI label**    | Inventory Out |
| **JSON key**    | `special_permissions.ims.inventory_out` |
| **Who gets it** | Users who may create / work on **inventory-out** store-out entries (not only forwarding-note outs). |
| **Super admin** | Always allowed |

#### Why it exists

Store Out supports more than one entry type (e.g. forwarding-note dispatch vs inventory out). Inventory out is a **higher-risk / exceptional** path: it moves stock outside the normal FN → Out → Gate flow. Giving every Out-entry editor this power would be unsafe, so it is a separate special permission.

#### What it allows

- Frontend: choosing **Inventory Out** mode in Out Entry (`OutEntryModal`).
- Backend: creating / editing inventory-out related actions gated by `hasInventoryOutPermission`.

#### What it does **not** replace

- Still need normal **Out Entry** module permissions (`add` / `edit` as applicable).
- Approving inventory out is a **separate** flag: `inventory_approve`.

#### Typical roles

Warehouse / stock controllers who handle non-FN inventory adjustments or outs, under supervision.

---

### 2.2 `ims.inventory_approve` — Inventory Approve

|  | |
|--|--|
| **UI label**    | Inventory Approve |
| **JSON key**    | `special_permissions.ims.inventory_approve` |
| **Who gets it** | Users who may **authorize / approve** inventory-out entries. |
| **Super admin** | Always allowed |

#### Why it exists

Separation of duties: one person may create inventory outs; another (or a smaller set) may approve them. Prevents a single operator from creating and self-approving sensitive stock movements without oversight.

#### What it allows

- Approve / authorize inventory-out records (UI + `hasInventoryOutApprovePermission` on backend).
- Related “can authorize” flags returned in out-entry APIs for inventory-out flows.

#### Typical roles

Plant / warehouse supervisors, inventory managers.

---

### 2.3 `ims.direct_forwarding_note` — Direct Forwarding Note

|  | |
|--|--|
| **UI label**    | Direct Forwarding Note |
| **JSON key**    | `special_permissions.ims.direct_forwarding_note` |
| **Who gets it** | Users who may create a Forwarding Note **without** tying it to Today’s Dispatch Plan / schedule (`schno`). |
| **Super admin** | Always allowed |

#### Why it exists

Normal FN create is driven from **Today’s Dispatch Plan** (schedule → balance → FG stock). That keeps dispatch aligned with planning.

Sometimes ops need a **blank / direct FN** (customer + items without schedule). That bypasses planning controls, so it is locked behind this special permission.

#### What it allows

- Forwarding Master **New** opens a blank FN modal (direct create).
- Backend create: if there is no `schno` on the note / items, `hasDirectForwardingNotePermission` is required.

#### What still works without this permission

- Users with module **add** can still create FNs via **Today’s Dispatch Plan → New** (schedule-based). They just cannot create a schedule-less FN.

#### Typical roles

Dispatch leads / planners who handle exceptions (urgent orders, corrections).

---

### 2.4 `ims.manage_forwarding_bill` —  

|  | |
|--|--|
| **UI label**    | Manage Forwarding Bill |
| **UI detail**   | Attach a bill on Forwarding Note Item-wise. Updating a saved bill also needs Edit on Forwarding Note. |
| **JSON key**    | `special_permissions.ims.manage_forwarding_bill` |
| **Who gets it** | Users who may **attach** bill numbers on Forwarding Note **Item-wise** lines. |
| **Super admin** | Always allowed (attach + update) |

#### Why it exists

Bill numbers from invfnote are commercial documents. Only trusted users attach bills. Changing a saved bill also needs module **Edit**.

#### What it allows (UI)

On **Forwarding Note → Item-wise**:

| User has | Can attach (no saved bill) | Can update saved bill |
|----------|----------------------------|------------------------|
| Special permission | Yes | No |
| Special + Edit | Yes | Yes |
| Edit only | No | No |

- Choose a bill from the matching bill dropdown only.
- Save attaches; Update needs edit.

Users without this permission see no bill-assign controls.

#### What it allows (API)

- `POST /forwarding-notes/assign-item-bill` — special permission to attach; special + `can_edit` to change a saved `bill_no`.

#### Prerequisites (functional)

1. User has this special permission (or is super admin).
2. Item-wise row selected.
3. To **update** a saved bill: also has Edit on `forwarding_note_master`.
4. Selected bill must be a valid, assignable (green) invfnote bill for that line.

#### Typical roles

Dispatch / billing clerks who attach matching invfnote bill numbers to packing lines.

---

## 3. RM Store special permissions

### 3.1 `rmstore.type_spec_values` — Free-text spec fields

|  | |
|--|--|
| **UI label**    | Type condition, grade & size color fields are free-text with suggestions |
| **JSON key**    | `special_permissions.rmstore.type_spec_values` |
| **Who gets it** | Users who may **type** condition / grade / size-color (not only pick from dropdown). |
| **Super admin** | Always allowed |

#### Why it exists

RM Spec master normally restricts values to controlled lists so MRP / issue / stock stay consistent. Occasional new grades or sizes need free entry with suggestions. Unrestricted typing for everyone would pollute master data.

#### What it allows

- In Spec modal (`SpecModal`): header / line fields become free-text (+ suggestions) when `canTypeSpecValues` is true.
- Backend: `hasTypeSpecValuesPermission` for related writes.

#### Typical roles

RM master-data owners, QA / stores leads who introduce new spec combinations.

---

### 3.2 `rmstore.issue_rm_mapped` — Issue Request: select mapped RM (SP1)

| | |
|--|--|
| **UI label** | (Issue RM mapped — SP1) |
| **JSON key** | `special_permissions.rmstore.issue_rm_mapped` |
| **Who gets it** | Users who may pick **any mapped RM** for a job-card item on Issue Request. |
| **Super admin** | Frontend mode = `all` (every RM wire). Backend `hasIssueRmMappedPermission` returns **false** for super admin (super admin uses the “all” path separately). |

#### Why it exists

Issue Request RM selection has three safety levels:

| Mode | Who | Behavior |
|------|-----|----------|
| `first` | Normal user | Auto first mapped RM; dropdown disabled. |
| `mapped` | This permission (SP1) | Can choose among RMs **mapped** to the job-card item. |
| `all` | Super admin | Can select more broadly (every RM wire). |

Without SP1, operators cannot pick the wrong alternate RM by mistake. With SP1, experienced stores staff can choose among mapped alternatives.

#### What it allows

- Frontend: `issueRmSelectionMode(user) === "mapped"`.
- Backend issue-request controller respects `hasIssueRmMappedPermission`.

#### Typical roles

RM issue clerks who need alternate mapped coil / RM selection without full super-admin power.

---

### 3.3 `rmstore.in_process_rejection` — In-process rejection submit

| | |
|--|--|
| **UI label** | (In-process rejection) |
| **JSON key** | `special_permissions.rmstore.in_process_rejection` |
| **Who gets it** | Users who may **submit** in-process rejection requests. |
| **Super admin** | Always allowed |

#### Why it exists

In-process rejection affects production / QC / stock accountability. Not every IPR user should open a rejection flow. Submit is gated here; **approving** rejection still needs normal module authorize (separate from this flag).

#### What it allows

- Frontend: rejection option / add mode in `InProcessRequestModal` when `canSubmitInProcessRejection`.
- Backend: create / certain updates for rejection flow require `hasInProcessRejectionPermission`.

#### What it does **not** do

- Does not by itself allow **approving** rejections — that remains module authorize.

#### Typical roles

QA / production supervisors who raise rejections on the floor.

---

## 4. Task special permissions

### 4.1 `task.verification_user_id` — CL Verification Person

| | |
|--|--|
| **UI label** | CL Verification Person |
| **JSON key** | `special_permissions.task.verification_user_id` |
| **Type** | User id (number), not a boolean |
| **Who gets it** | Stored **on the assignee’s profile** as their **default verifier**. |

#### Why it exists

CL (checklist) tasks often require a verification person. Instead of picking a verifier every time, each user can have a **default verifier** on their profile. When assigning CL tasks to that person, the modal can auto-fill verification user.

#### Rules / constraints

- Verifier cannot be the same as the assignee (self-verify blocked in UI).
- Empty / invalid id → no default.

#### Helper

- `getTaskDefaultVerifierId(user)` in `taskSpecialPermissions.js`.

#### Typical setup

Assign employee → set their usual supervisor / CL verifier in User Management.

---

## 5. Quick comparison matrix

| Key | App | Type | Super admin | Main purpose |
|-----|-----|------|-------------|--------------|
| `ims.inventory_out` | IMS | bool | Yes | Create inventory-out store outs |
| `ims.inventory_approve` | IMS | bool | Yes | Approve inventory outs |
| `ims.direct_forwarding_note` | IMS | bool | Yes | Create FN without schedule |
| `ims.manage_forwarding_bill` | IMS | bool | Yes | Attach FN item bills (update also needs Edit) |
| `rmstore.type_spec_values` | RM Store | bool | Yes | Free-type spec master fields |
| `rmstore.issue_rm_mapped` | RM Store | bool | N/A (uses `all` mode) | Pick any mapped RM on issue |
| `rmstore.in_process_rejection` | RM Store | bool | Yes | Submit in-process rejection |
| `task.verification_user_id` | Task | user id | N/A | Default CL verifier on profile |

---

## 6. How to grant (ops checklist)

1. Open **Users** → select user → Edit.
2. Open the correct app section (IMS / RM Store / Task).
3. Tick the special permission (or set CL verifier).
4. Save user.
5. User should **re-login** (or refresh session) so `special_permissions` on the auth payload updates.
6. Confirm with a real screen action (e.g. FN Item-wise bill bar, Out Entry inventory mode).

---

## 7. Adding a new special permission (dev checklist)

When you add a new flag:

1. **JSON key** under `ims` / `rmstore` / `task` (keep names stable).
2. Default `false` / `null` in `UserModal.js` (initial form, hydrate, save payload).
3. Checkbox / control in the matching special-permissions UI section.
4. Helper in frontend `*SpecialPermissions.js` (super_admin bypass if appropriate).
5. Helper in backend `*SpecialPermissions.js` + enforce on the API (never UI-only).
6. Document it in **this file** (why, what, who, locks, related module perms).

---

## 8. Related but not “special permissions”

These are often confused with special permissions:

| Feature | Where | Notes |
|---------|--------|-------|
| Module CRUD / authorize | User → module matrix | Base access to screens |
| `can_edit_days` | Module permission days | Time window to edit old records |
| Gate entry approve lock on bills | Gate + FN bill assign | Business lock after gate approve, not a user flag |
| Device scan settings (laser / phone QR) | Browser local storage | Per-device UX, not a user permission |

---
