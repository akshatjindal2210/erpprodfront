# Hard delete

`DELETE FROM` removes the row. Soft delete only sets `is_deleted = true`. Purchase and Production have no hard delete.

## Row is removed

| Table | File | When |
|-------|------|------|
| `ims_tray_master` | `backend/src/apps/ims/modules/tray/models/trayMaster.model.js` | Tray delete. A tray in use is blocked. Batch `ims_tray_batch` stays soft. |
| `ims_box_table` | `backend/src/apps/ims/modules/box/models/box.model.js` | Packing sticker cancel, Stock Adjustment add undo, orphan SA sticker clean. |
| `ims_dailyprod` | `backend/src/apps/ims/modules/box/models/box.model.js` | Sticker cancel. Generate creates the row again. |
| `ims_schedule_plan` | `backend/src/apps/ims/modules/schedule-planning/utils/db/schedulePlanDb.js` | Schedule plan delete. |
| `ims_schedule_plan_transaction` | `backend/src/apps/ims/modules/schedule-planning/utils/db/schedulePlanTransactionDb.js` | That plan's transaction rows. |
| `rmstore_mrn` | `backend/src/apps/rmstore/modules/mrn/models/mrn.model.js` | Generated MRN cancel. |
| `rmstore_coil_table` | `backend/src/apps/rmstore/modules/coil/models/coil.model.js` | Coils of that MRN. Blocked if a coil is already Store In or Stock Adjustment. |
| `rmstore_qc_check` | `backend/src/apps/rmstore/modules/qc-check/models/qcCheck.model.js` | QC rows of that MRN. |
| `rmstore_spec_detail` | `backend/src/apps/rmstore/modules/spec/models/specMaster.model.js` | Spec item delete. Lines first. |
| `rmstore_spec_master` | `backend/src/apps/rmstore/modules/spec/models/specMaster.model.js` | Spec item delete. Header after lines. |
| `hrms_attendance` | `backend/src/apps/hrms/modules/attendance/controllers/attendance.controller.js` | Attendance delete. |
| `task_tasks` | `backend/src/apps/task/modules/tasks/models/task.model.js` | Task delete. |
| `task_assignments` | `backend/src/apps/task/modules/tasks/models/task.model.js` | Assignment remove. |
| `task_chat` | `backend/src/apps/task/modules/tasks/models/task.model.js` | Chat message delete. |
| `task_self_notes` | `backend/src/apps/task/modules/tasks/models/task.model.js` | Self note delete. |
| `task_recurring_tasks` | `backend/src/apps/task/modules/recurring-task/models/recurringTask.model.js` and `task.model.js` | Recurring template delete. |
| `task_recurring_task_assignments` | `backend/src/apps/task/modules/recurring-task/models/recurringTask.model.js` | Recurring assignment remove. |
| `task_categories` | `backend/src/apps/task/modules/category/models/category.model.js` | Category delete. |
| `task_holiday` | `backend/src/apps/task/modules/holidays/models/holiday.model.js` | Holiday delete. |
| `task_cl_tasks_master` | `backend/src/apps/task/modules/cl-task/models/clTask.model.js` | Checklist master delete. |
| `task_cl_tasks` | `backend/src/apps/task/modules/cl-task/models/clTask.model.js` | Checklist instance delete, and extra pending instances. |
| `task_red_tickets` | `backend/src/apps/task/modules/red-ticket/models/redTicket.model.js` | Red ticket delete. |
| `mst_departments` | `backend/src/apps/core/identity/departments/models/department.model.js` | Department delete. |
| `mst_designations` | `backend/src/apps/core/identity/designations/models/designation.model.js` | Designation delete. |

## Parent stays. Child rows are removed.

The parent record is soft deleted, or the child list is cleared and written again.

| Table | File | When |
|-------|------|------|
| `ims_out_entry_scanned_box` | `backend/src/apps/ims/modules/out-entry/models/outEntry.model.js` | Draft save or clear. Header `ims_out_entry` is soft. |
| `rmstore_out_entry_scanned_coil` | `backend/src/apps/rmstore/modules/out-entry/models/outEntry.model.js` | Same, for coil draft scans. Header is soft. |
| `ims_audit_locations` | `backend/src/apps/ims/modules/audit/models/audit.model.js` | Location list replace. Header `ims_audit_master` is soft. |
| `rmstore_spec_detail` | `backend/src/apps/rmstore/modules/spec/models/specMaster.model.js` | Spec edit. Old lines are removed, then new lines are inserted. |
| `task_mis_score_ledger` | `backend/src/apps/task/modules/reports/models/misScore.model.js` | Score for that source is rewritten. |
| `mst_push_subscriptions` | `backend/src/apps/core/notifications/push/pushSubscription.model.js` | Push unsubscribe. |
