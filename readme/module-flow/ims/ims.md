# IMS

Finished-goods warehouse. Box is the stock unit. IMS routes mount at `/api` (not `/api/ims`).

|               |                                                             |
|---------------|-------------------------------------------------------------|
| UI            | `/ims/dashboard/`                                           |
| API           | `POST /api/` (e.g. `/api/boxes/`, `/api/forwarding-notes/`) |
| Gate          | `app_ims`                                                   |
| FE            | `frontend/src/apps/ims/`                                    |
| BE            | `backend/src/apps/ims/`                                     |

```
Daily Prod (stickers) → Boxes → Store In → Forwarding Note (reserve) → Store Out
```

| Screen                     | File                                                   |
|----------------------------|--------------------------------------------------------|
| Dashboard                  | [dashboard.md](./dashboard.md)                         |
| Product Master             | [product-master.md](./product-master.md)               |
| Customer Master            | [customer-master.md](./customer-master.md)             |
| Customer Item Code         | [customer-item-code.md](./customer-item-code.md)       |
| Packing Standard           | [packing-standard.md](./packing-standard.md)           |
| Store Location Master      | [location-master.md](./location-master.md)             |
| Packing Entry              | [packing-entry.md](./packing-entry.md)                 |
| Boxes                      | [boxes.md](./boxes.md)                                 |
| Store In                   | [store-in.md](./store-in.md)                           |
| QC Hold Material           | [qc-hold-material.md](./qc-hold-material.md)           |
| Schedule Planning          | [schedule-planning.md](./schedule-planning.md)         |
| Forwarding Note            | [forwarding-note.md](./forwarding-note.md)             |
| Store Out                  | [store-out.md](./store-out.md)                         |
| Change / Override Customer | [override-customer.md](./override-customer.md)         |
| Stock Adjustment           | [stock-adjustment.md](./stock-adjustment.md)           |
| Inventory Audit            | [audit.md](./audit.md)                                 |
| Inventory Report           | [inventory-report.md](./inventory-report.md)           |
| ERP Stock Report           | [erp-stock-report.md](./erp-stock-report.md)           |
| Activity Logs              | [activity-logs.md](./activity-logs.md)                 |
| Box Transaction Logs       | [box-transaction-logs.md](./box-transaction-logs.md)   |
| Sticker Download Logs      | [sticker-download-logs.md](./sticker-download-logs.md) |

| Module                        | Delete                                       |
|-------------------------------|----------------------------------------------|
| packing-standard / location   | **SOFT**                                     |
| Packing Entry cancel stickers | **HARD** production boxes                    |
| Store In                      | **SOFT** header + unlink boxes               |
| QC Hold                       | **SOFT** + clear `qc_hold_id`                |
| Schedule Planning             | **HARD** plan + txns                         |
| Forwarding Note               | **SOFT** (blocked if out locked)             |
| Store Out                     | **SOFT** header + **HARD** wipe scans        |
| Stock Adjustment              | **SOFT** (+ HARD delete add-boxes on revert) |
| Audit                         | **SOFT** master                              |
