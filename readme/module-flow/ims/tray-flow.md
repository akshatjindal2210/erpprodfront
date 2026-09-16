# Tray flow

Link is stored only on `ims_tray_master.box_uid`. The box table has no tray column. Linking does not update the box row.

One sticker = one tray. `box_uid` NULL = vacant.

| | |
|--|--|
| Manage Tray UI | `/ims/dashboard/manage-tray` |
| Permission | `manage_tray` |
| Quick launch | **MGT** |
| API | `POST /api/manage-tray/` |
| Tray table | `ims_tray_master` |
| Box table | `ims_box_table` (read only for the link) |

```
Packing Entry (tray stickers)
  → Manage Tray (set tray.box_uid)
  → Store In (tray scan; blocked until all stickers are linked)
  → Store Out (tray scan; box.out_uid → CUSTOMER END)
  → Receive (box_uid = NULL → VACANT)
```

```sql
box_uid INTEGER REFERENCES ims_box_table(box_uid) ON DELETE SET NULL
```

## Pool (live join, not a snapshot)

| Box state | Code | Screen |
|-----------|------|--------|
| tray.box_uid null | vacant | VACANT |
| linked, no location, not sent out | in_use | PACKING AREA |
| location_id set | storage | STORE IN |
| out_uid set | with_customer | CUSTOMER END |

After Receive, `box_uid` is NULL. The tray chip disappears on old Store In and Store Out screens because there is no snapshot column.

## Example — FG1

1. **Tray Master** — create a batch, then approve. FG1 is active and vacant.
2. **Packing Entry** — category TRAY. Sticker type stays BOX. Stickers go to `ims_box_table`. No tray link yet.
3. **Manage Tray → Pending** — the packing shows because the category is tray, stickers are in hand, and at least one sticker is not linked.
4. **Start** — select a row and click New, or open New → Pending and search. Scan the sticker, then the tray. Each link is `UPDATE ims_tray_master SET box_uid`. The box row stays the same.
5. **Save draft** — some links only. Status is DRAFT.
6. **Submit when every sticker is linked** — status is REGISTERED. Store In stays blocked until then.
7. **Store In** — a linked sticker cannot be scanned alone. Scan the tray QR. All stickers on that tray are stored. Once a location is set, the pool is STORE IN.
8. **Store Out** — same rule. Scan the tray QR, then send out. `out_uid` set → CUSTOMER END.
9. **Receive** — only a tray that was sent to a customer. Enter a remark. `box_uid` becomes NULL. Tray is VACANT again. Packing area and Store In cannot be received.
10. **Reassign** — move a sticker to another tray. The old tray becomes vacant. The new tray gets `box_uid`.

Report: Summary (Total, Vacant, Store In, Packing Area, customer name + count) → By Tray shows that group's list. Customer name comes from the forwarding note, otherwise from the packing customer.

## Status labels

| Label | Meaning |
|-------|---------|
| PENDING | No links |
| DRAFT | Some links (`link_count` < `box_count`) |
| REGISTERED | All in-hand tray stickers linked |

## Screen messages

| When | Message |
|------|---------|
| Sticker scanned, but it is on a tray (Store Out) | Scan tray {code}. Send out all stickers on this tray. |
| Sticker scanned, but it is on a tray (Store In) | Scan tray {code}. Store every sticker on this tray. |
| Tray stickers do not match this store out | Stickers on tray {code} are not part of this store out. |
| Tray stickers already added in Store In | Stickers from tray {code} are already added. |
| Receive a tray that is not at the customer | Only a tray sent to a customer can be received. This tray is in packing area / store in. |
| Delete or deactivate a tray that is in use | Cannot delete. Tray {code} is already in use. |
| Store In before all stickers are linked | Link all stickers to trays in Manage Tray before Store In. |

## Writes (tray only)

| Action | SQL |
|--------|-----|
| Save / submit links | `UPDATE ims_tray_master SET box_uid = …` |
| Clear packing links | `UPDATE tray SET box_uid = NULL` for stickers on that packing |
| Receive | `UPDATE tray SET box_uid = NULL WHERE id = …` |
| Reassign | Clear the old tray, then set `box_uid` on the new tray |

Scan reads the tray with a join. It does not update the box row.

```sql
LEFT JOIN ims_tray_master t ON t.box_uid = b.box_uid
```

## Module — what changed, and why

| Module | What | Why |
|--------|------|-----|
| Tray Master | `box_uid` column. Delete and deactivate blocked if the tray is in use | Link lives on the tray |
| Manage Tray | link, receive, reassign, report | Link stickers, take trays back, report |
| Box | tray join for scan. Box table is not written | Scan can see which tray a sticker is on |
| Store In | tray gate and tray scan | A linked sticker cannot be stored alone |
| Store Out | tray gate and tray scan | Dispatch also uses the tray QR |

Not changed: Stock Adjustment, QC Hold, Audit, Box CRUD, Forwarding Note form.

## Files

| Work | File |
|------|------|
| Manage Tray page | `frontend/src/apps/ims/modules/manage-tray/Page.js` |
| Modals | `ManageTrayStartModal.js`, `ManageTrayLinkModal.js`, `ManageTrayReceiveModal.js`, `ManageTrayReassignModal.js` |
| Pool SQL | `backend/src/apps/ims/modules/tray/lib/trayOccupancySql.js` |
| Link, receive, report | `backend/src/apps/ims/modules/manage-tray/models/manageTray.model.js` |
| Register snapshot | `backend/src/apps/ims/lib/config/tables/tray/tray_manage.table.js` |
| Receive = customer tray only | `backend/src/apps/ims/modules/manage-tray/controllers/manageTray.controller.js` |
| Store In gate | `backend/src/apps/ims/modules/inventory-inward/controllers/inventoryInward.controller.js` |
| Store Out gate | `backend/src/apps/ims/modules/out-entry/utils/fulfillment/outEntryFulfillment.js` |
| Delete / inactive guard | `backend/src/apps/ims/modules/tray/models/trayMaster.model.js` |

## Rules that stay locked

- Edit is off on Pending. Start from New, or New → Pending card.
- Submit writes one row in `ims_tray_manage` (`id` and `data` JSON). It is approved as soon as it is created. `data.links` keeps that day's sticker and tray pairs. The flow is the same as Store In: Pending, then Submit. The table is not a copy of Store In.
- Store In follows the register. An active row in `ims_tray_manage` can be stored in. Delete sets `is_deleted`, clears the tray links, and the packing is disabled in Store In again until it is submitted from Manage Tray.
- After Store In or dispatch, the packing stays Registered. Receive does not move it back to In Progress.
- Edit and Delete stay off once any sticker is stored or sent out.
- New is always visible. If no row is selected, cards are Receive, Reassign, and Pending.
- A tray in use (`box_uid` set) cannot be deleted or deactivated. A vacant tray can.
- Receive only when the tray is at CUSTOMER END.
- One sticker, one tray. The same sticker or tray cannot be linked twice on a packing.
- Submit needs the full set (for example 60/60).
- Only new tray-category packings create Manage Tray work. Old packings are not backfilled.
