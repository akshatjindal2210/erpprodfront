# How to Add a New Module (IMS)

Follow this file whenever you add, hide, or show a module in IMS.

**Example in this guide:** Gate Entry  
When you build your own module, replace the example names with yours:

| Example name     | Replace with your…                          |
|------------------|---------------------------------------------|
| `gate_entry`     | module slug (permissions) — always same     |
| `gate-entry`     | folder name and URL                         |
| `Gate Entry`     | label shown in sidebar / Settings           |
| `gateEntry`      | JS file / function names                    |
| `ims_gate_entry` | DB table name (`ims_` + your slug)          |
| `/gate-entries`  | API path                                    |

Same steps work for RM Store / Task — use that app’s folders and `app_type` instead of `ims`.

---

## A. Create a new module

### Backend

1. Create the module folder  
   `backend/src/apps/ims/modules/gate-entry/`  
   - `routes/gateEntry.route.js`  
   - `controllers/gateEntry.controller.js`  
   - `models/gateEntry.model.js`

2. Create the DB table scripts  
   `backend/src/apps/ims/lib/config/tables/gate-entry/`  
   - `gate_entry.table.js`  
   - `gate_entry_scanned_box.table.js` (only if you need a child table)

3. Register the table names  
   Open `backend/src/config/db/dbTables.js`  
   Add under `DB_TABLES.ims`:  
   `"ims_gate_entry"`, `"ims_gate_entry_scanned_box"`

4. Create tables on server start  
   Open `backend/src/apps/ims/lib/config/db/initDB.js`  
   Import the create functions and call them inside `initImsDB()`:
   - `await createGateEntryTable()`
   - `await createGateEntryScannedBoxTable()`

5. Mount the API  
   Open `backend/src/apps/ims/routes/index.js`  
   ```js
   import gateEntryRoutes from "../modules/gate-entry/routes/gateEntry.route.js";
   router.use("/gate-entries", gateEntryRoutes);
   ```

6. Register the module for permissions  
   Open `backend/src/config/portal/portalModules.js`  
   - In `MODULES.ims` add:  
     `{ name: "gate_entry", label: "Gate Entry" }`  
   - In `SEED_MODULES` add:  
     `{ name: "gate_entry", label: "Gate Entry", sort_order: 40, app_type: "ims" }`

### Frontend

7. Create the UI folder  
   `frontend/src/apps/ims/modules/gate-entry/`  
   - `Page.js` (list page)  
   - `GateEntryModal.js` (add / edit modal or drawer)

8. Create the Next.js page  
   `frontend/src/app/ims/dashboard/gate-entry/page.js`  
   Only import and return the module `Page` — no extra logic.

9. Add the route constant  
   Open `frontend/src/apps/ims/lib/utils/routes.js`  
   Add: `GATE_ENTRY: \`${IMS}/gate-entry\``

10. Add API endpoints  
    Open `frontend/src/apps/ims/lib/config/endpoints.js`  
    Add `GATE_ENTRIES` paths that match the backend (list, save, delete, etc.).

11. Create the service  
    `frontend/src/apps/ims/lib/services/gateEntry.js`  
    Call the endpoints from here.

12. Add the sidebar link  
    Open `frontend/src/apps/ims/lib/config/navRegistry.js`  
    Add the nav item with `module: "gate_entry"` and the icon import.

13. Add the module to the portal list  
    Open `frontend/src/config/portalModules.data.js`  
    Add: `{ name: "gate_entry", label: "Gate Entry" }`

### Finish

14. Restart the backend.  
15. In Settings, give the user permission for `gate_entry`.  
16. Refresh the frontend and check the sidebar.

---

## B. Hide a module (comment out)

Do **not** delete the module folders. Only comment the wiring.

### Backend

1. `routes/index.js` — comment the import and `router.use("/gate-entries", …)`  
2. `initDB.js` — comment the table imports and `await create…()` calls  
3. `dbTables.js` — comment `"ims_gate_entry"` (and child table if any)  
4. `portalModules.js` — comment the row in `MODULES` and in `SEED_MODULES`

### Frontend

5. `navRegistry.js` — comment the Gate Entry nav item (and unused icon)  
6. `portalModules.data.js` — comment the `gate_entry` row

Then restart the backend and refresh the frontend.

---

## C. Show a module again (uncomment)

Uncomment the same places as in section B, in this order:

1. `dbTables.js`  
2. `initDB.js`  
3. `routes/index.js`  
4. `portalModules.js` (`MODULES` + `SEED_MODULES`)  
5. `navRegistry.js`  
6. `portalModules.data.js`

Then:

1. Restart the backend  
2. Check permissions in Settings  
3. Refresh the frontend
