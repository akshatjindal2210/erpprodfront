# RM Store

Coil is the stock unit. QC is compulsory for Issue. Store In (rack) is not.

|               |                              |
|---------------|------------------------------|
| UI            | `/rmstore/dashboard/`        |
| API           | `POST /api/rmstore/`         |
| Gate          | `app_rmstore`                |
| FE            | `frontend/src/apps/rmstore/` |
| BE            | `backend/src/apps/rmstore/`  |

```
ERP mrn_rm → MRN Portal (stickers) → Unassigned
  QC (compulsory) → pass → Issue → Store Out
                 → fail → RM Rejection → Store Out (return)
  Store In (optional rack)
```

| Screen                | File                                                   |
|-----------------------|--------------------------------------------------------|
| Dashboard             | [dashboard.md](./dashboard.md)                         |
| Item RM Master        | [production.md](./production.md)                       |
| RM Spec Master        | [rm-spec.md](./rm-spec.md)                             |
| Location Master       | [store-location.md](./store-location.md)               |
| MRN Portal            | [mrn-portal.md](./mrn-portal.md)                       |
| Coils                 | [coils.md](./coils.md)                                 |
| Store In              | [store-in.md](./store-in.md)                           |
| QC Check              | [qc-check.md](./qc-check.md)                           |
| RM Rejection          | [rm-rejection.md](./rm-rejection.md)                   |
| Issue Request         | [issue-request.md](./issue-request.md)                 |
| In-process Request    | [in-process-request.md](./in-process-request.md)       |
| Store Out             | [store-out.md](./store-out.md)                         |
| Stock Adjustment      | [stock-adjustment.md](./stock-adjustment.md)           |
| RM Inventory          | [inventory-report.md](./inventory-report.md)           |
| Activity Logs         | [activity-logs.md](./activity-logs.md)                 |
| Coil Transaction Logs | [coil-transaction-logs.md](./coil-transaction-logs.md) |
| Sticker Download Logs | [sticker-download-logs.md](./sticker-download-logs.md) |

| Module                                | Delete                                        |
|---------------------------------------|-----------------------------------------------|
| production / store-location           | **SOFT** `is_deleted`                         |
| rm-spec                               | **HARD** `rmstore_spec_master` + `rmstore_spec_detail` |
| MRN cancel stickers                   | **HARD** MRN + portal coils + QC              |
| Store In                              | **SOFT** header + unlink coil rack            |
| QC Check (UI)                         | **SOFT** + clear `qc_uid`                     |
| RM Rejection / Issue / IPR            | **SOFT** (+ revert pointers / reserve)        |
| Store Out                             | **SOFT** header + **HARD** wipe scanned coils |
| Stock Adjustment                      | **SOFT** (+ revert applied coils)             |
