# MRN Portal

ERP MRN → generate coil stickers into stock. Sticker mode (`coil` / `batch`) stored on MRN at generate.

|               |                                                                           |
|---------------|---------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/mrn-portal`                                           |
| Permission    | `rm_mrn_portal`                                                           |
| FE            | `modules/mrn-portal/`                                                     |
| BE            | `modules/mrn/`                                                            |
| API           | `POST /api/rmstore/mrn/` (`list|generate|delete|detail|coils|… stickers`) |
| Table         | `rmstore_mrn`, `rmstore_coil_table`                                       |

**Files**

|               |                                                                                                          |
|---------------|----------------------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/mrn-portal/` (`Page.js`, `MrnStickerModal.js`), `lib/services/mrn.js` |
| BE            | `backend/src/apps/rmstore/modules/mrn/` — `mrn.routes.js`, sticker / print controllers, `mrn.model.js`   |

**CRUD**

|               |                                                                                                       |
|---------------|-------------------------------------------------------------------------------------------------------|
| Create        | MRN row + generate stickers → INSERT coils (`status=active`). Draft = `sticker_draft` JSONB, no coils |
| Read          | ERP list / lookup / coils / detail                                                                    |
| Update        | draft / docs / print                                                                                  |
| Delete        | cancel stickers = **HARD** MRN + portal coils + QC. Partial generate rollback = **SOFT** coils/QC     |

**Linking**

Cancel **blocked** if Store In coils (`location_id` set, `sa_id` null) or SA coils (`sa_id` set). Else cascade **HARD** delete portal coils + QC. SA coils kept. Generate needs authorized spec.

**Table impact**

| Action        | Writes                                                              |
|---------------|---------------------------------------------------------------------|
| Generate      | `rmstore_mrn` + INSERT `rmstore_coil_table`                         |
| Cancel        | HARD `rmstore_mrn` + portal coils + `rmstore_qc_check` by `mrn_uid` |

## Sticker entry — default coil count from lot (`it_lot_no`)

When opening **MRN Sticker** (`MrnStickerModal`) or **Reject before stickers** (`MrnRejectDrawer`) on a fresh MRN (no generated coils, no saved sticker draft), the UI may pre-fill **No. of Coils** from ERP lot / coil number text (`it_lot_no`, or camelCase `itLotNo`).

| Condition | Default coil count |
|-----------|-------------------|
| `it_lot_no` is empty or contains any non-digit character (e.g. `17I264416495`) | `1` |
| `it_lot_no` is digits only after trim (e.g. `4`, `0004`) | That integer, clamped to **1–9999** (`0` → `1`) |
| Stickers already generated / `coils[]` present | Actual coil row count (regex not used) |
| Saved `sticker_draft.coil_count` | Draft value (regex not used) |

After the default is applied, quantity per coil follows existing rules (`qty_auto_calc` → weighted split; otherwise equal split or blank editable lines). Users can change **No. of Coils** manually.

Implementation is inline in `MrnStickerModal.js` (`applyFreshInputs`) and `MrnRejectDrawer.js` (`initialCoilCount`). List-row fallback hydration (`hydrateFromSourceRow`) spreads the list row so `it_lot_no` is available when detail API returns 404.

**Convention:** ERP sends a pure numeric `it_lot_no` when it represents the number of coils for that MRN line. A long numeric string that is not a coil count would be misread (rare; tighten regex only if that data appears).

**Reject drawer:** Coil-count default runs only while stickers are not generated; reject after generate remains blocked.
