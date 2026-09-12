# Create a New App from the Template

This is the walkthrough for turning the **copy-kit** into a live product app.

The kit is **not** a real app. It is not in the 9-dot launcher, not in Admin Console, not mounted at `/api`, and has no Next.js URL. Users never see it. Copy it, rename it, then connect the files below.

| Kit location | Copy to |
|--------------|---------|
| `backend/src/apps/template/` | `backend/src/apps/<appkey>/` |
| `frontend/src/apps/template/` | `frontend/src/apps/<appkey>/` |
| `frontend/src/apps/template/next-routes/` | `frontend/src/app/<appkey>/` |

Worked example in this doc: **`crm`** (label **CRM**). Replace with your name.

---

## 0. What you already get (do not rebuild these)

The Records sample is a complete master CRUD. After you connect the app, login and permissions work through the existing portal.

**Login / access (shared platform)**

- Users log in once at `/login` (same cookie JWT as IMS / HRMS).
- Layout wraps pages in `PwaInstallGate` → `AppGuard` → `PermissionGuard`.
- Backend routes use `authenticate` + `accessControl("<module>", "view" \| "add" \| "edit" \| "delete" \| "authorize")`.

**Frontend Records page**

- List: `DataTable`, toolbar, status filter, search, export, row select, hotkeys.
- Form: `Drawer` with required name, optional notes, approve / keep pending.
- Client validation, SOP acknowledgment, `DeleteModal`, toast errors.

**Backend Records API** (`POST /api/<appkey>/records/...`)

- `list` / `get` / `create` / `update` / `delete` / `helper`
- Name required, max 120 chars, duplicate-name check
- Approval workflow + edit-day window
- Soft delete + activity log (`app_type` comes from `activityLogger` on the mount)

Do **not** import `@/apps/ims` (or another product app) into the copy.

---

## 1. Pick names

| Item | Rule | Example |
|------|------|---------|
| App key | one lowercase token, **no hyphens** | `crm` |
| Display name | human label | `CRM` |
| URL | `/<appkey>/dashboard` | `/crm/dashboard` |
| API | `/api/<appkey>/...` | `/api/crm/records/list` |
| Table prefix | `<appkey>_` | `crm_record` |
| Module slug | `snake_case` | `crm_record` or `template_record` renamed |
| Gate | `app_<appkey>` | `app_crm` |

---

## 2. Copy the three folders

From the repo root (PowerShell):

```powershell
Copy-Item -Recurse backend\src\apps\template backend\src\apps\crm
Copy-Item -Recurse frontend\src\apps\template frontend\src\apps\crm
Copy-Item -Recurse frontend\src\apps\crm\next-routes frontend\src\app\crm
Remove-Item -Recurse frontend\src\apps\crm\next-routes
```

Leave `backend/src/apps/template` and `frontend/src/apps/template` in place for the next app.

---

## 3. Rename inside the copy

In **only** the new folders (`backend/src/apps/crm`, `frontend/src/apps/crm`, `frontend/src/app/crm`), find-replace **in this order**:

1. `template_record` → `crm_record` (module slug + table name)
2. `template` → `crm` (paths, API prefix, `APP_KEY`, `@/apps/crm`)
3. `Template` → `CRM` (titles, empty dashboard title)
4. `TEMPLATE` → `CRM` (nav/export names like `CRM_NAV_REGISTRY`, `CRM_DASHBOARD`)

Spot-check these tokens after replace:

- `APP_KEY = "crm"`
- Endpoints start with `/crm/records/...`
- Routes start with `/crm/dashboard`
- Table constant is `crm_record`
- `accessControl("crm_record", ...)`
- ActionButton `module="crm_record"`
- Layout import still points at `@/apps/crm/lib/layout/AppLayout` (filename has no `Template`, do not rename it)
- In `app/crm/dashboard/layout.js`, the title suffix key must stay `template:` (Next.js), e.g. `template: "%s | CRM"` — if replace turned it into `crm:`, change it back

Do **not** run a global replace on the whole repo — only the three copied folders. A repo-wide `template` replace would break Task notification templates and Next.js `metadata.template`.

---

## 4. Connect backend (required)

### 4.1 Mount the API

`backend/src/index.js`

```js
import crmRoutes from "./apps/crm/routes/index.js";

app.use("/api/crm", activityLogger("crm"), crmRoutes);
```

Do not skip `activityLogger("crm")` — that sets `app_type` on activity logs.

### 4.2 Register tables

`backend/src/config/db/dbTables.js`

- `TABLE_PREFIX.crm = "crm_"`
- `DB_TABLES.crm = ["crm_record"]`
- `export const CRM_TABLES = toKeyMap(DB_TABLES.crm, TABLE_PREFIX.crm);`

### 4.3 Create tables on boot

`backend/src/config/db/initDB.js`

After step 3, the copied file exports `initCrmDB` (`initTemplateDB` renamed by `Template` → `CRM`).

```js
import { initCrmDB } from "../../apps/crm/lib/config/db/initDB.js";

await initCrmDB();
```

### 4.4 Portal modules (permissions seed)

`backend/src/config/portal/portalModules.js` **and** `frontend/src/config/portalModules.data.js` — keep them identical.

```js
// APP_GATES
crm: "app_crm",

// APP_META
crm: { label: "CRM", permissions: true },

// PORTAL_APP_KEYS
["core", "ims", "rmstore", "task", "hrms", "crm"]

// MODULES
crm: [
  { name: "crm_record", label: "Records" },
],

// SEED_MODULES (backend only)
{ name: "crm_record", label: "Records", sort_order: 52, app_type: "crm" },
```

Adding `crm` to `PORTAL_APP_KEYS` creates the Users **CRM** tab. You still must add a `crmModules` bucket in `moduleAppRegistry.js` + `UserModal` (section 5.3), or that tab is empty and you cannot grant Records permissions.

### 4.5 List/filter field allowlist

Paste from `backend/src/apps/template/lib/config/crudModule.snippet.js` into `backend/src/apps/core/lib/config/crud/crudModules.js` (after rename it lives under `apps/crm/...`):

```js
crm_record: {
  idField: "record_id",
  listFields: [],
  filterFields: ["record_id", "name", "approved", "from_date", "to_date"],
  searchFields: ["name", "notes"],
},
```

### 4.6 Dashboard widgets (optional)

`backend/src/apps/dashboard/modules/dashboard/controllers/dashboard.controller.js`

- Add `"crm"` to `ALLOWED_APP_KEYS`
- `APP_TABLE_PREFIX.crm = ["crm_"]`
- Extend the table-stem regex with `crm_` if widgets query this app’s tables

---

## 5. Connect frontend (required)

### 5.1 Route constants barrel

`frontend/src/config/routes.js`

```js
import { ROUTES as CRM_ROUTES } from "@/apps/crm/lib/utils/routes";

export const ROUTES = {
  // ...
  ...CRM_ROUTES,
};
```

### 5.2 Launcher + shell id

`frontend/src/config/appsRegistry.js`

```js
APP_SHELL: { /* existing */, CRM: "crm" },

{
  id: "crm",
  name: "CRM",
  subtitle: "Your subtitle",
  href: ROUTES.CRM_DASHBOARD, // after TEMPLATE → CRM replace
  shell: APP_SHELL.CRM,
  icon: /* any lucide icon */,
  accent: "from-sky-500 to-sky-700",
  inLauncher: true,
},
```

`getShellAppFromPathname` — add `isCrmShellPath` / `isCrmShell` (copy the HRMS helpers) and a branch that returns `{ id: "crm", name: "CRM", href: ROUTES.CRM_DASHBOARD }`.

### 5.3 Sidebar, chrome, guards

`frontend/src/config/shellNav.js`

```js
import { CRM_NAV_REGISTRY } from "@/apps/crm/lib/config/navRegistry";

// in resolveShellNavRegistry:
if (shell === APP_SHELL.CRM) return CRM_NAV_REGISTRY;

// in resolveShellBrand:
if (shell === APP_SHELL.CRM) return "CRM";

// in ALL_SHELL_NAV_REGISTRIES:
CRM_NAV_REGISTRY,
```

Copy the HRMS blocks for `/hrms/` and change them to `/crm/`. **Do not skip this table** — copy/rename alone does not wire the shell.

| File | What to add |
|------|-------------|
| `Navbar.js` | Breadcrumb + search items for `/crm/` |
| `QuickAccessBar.js` | `isCrmPath` → `CRM_NAV_REGISTRY` |
| `PermissionGuard.js` | Collect / resolve `CRM_NAV_REGISTRY`; allow `/crm/dashboard` as open dashboard |
| `RootLayout.js` | Full-bleed home: `pathname === "/crm/dashboard"` |
| `moduleAppRegistry.js` | `crmModules` in `partitionModulesForUserForm` + a `getModulesForAppKey` case |
| `UserModal.js` / `UserPermissionsPanel.js` | Destructure `crmModules` and pass it into the panel |

### 5.4 Login cookie on `/crm/...`

`frontend/src/middleware.js`

1. Add `"/crm"` to `PROTECTED_PREFIXES`
2. Add `"/crm/:path*"` to `config.matcher`

Without this, unauthenticated users can hit the HTML before `AppGuard` runs.

### 5.5 Quick Access strip (optional but usual)

`frontend/src/config/quickAccess.js`

```js
import { ROUTES as CRM_ROUTES } from "@/apps/crm/lib/utils/routes";

const CRM = [
  { id: "home", label: "Dashboard", icon: <Zap size={13} />, path: CRM_ROUTES.CRM_DASHBOARD },
  { id: "records", label: "Records", icon: <ClipboardList size={13} />, path: CRM_ROUTES.CRM_RECORDS, module: "crm_record" },
];

const BY_APP = { /* existing */, crm: CRM };
```

### 5.6 Dashboard builder (optional)

- `frontend/src/common/dashboard-builder/utils/appNavPages.js` — flatten `CRM_NAV_REGISTRY`, add `crm` to the path-prefix list, `mainRoutes.crm = "/crm/dashboard"`
- `DashboardBuilder.js` — `{ value: "crm", label: "CRM Dashboard" }`

### 5.7 Activity log links (optional)

`frontend/src/platform/utils/core/activityLogDisplay.js` — label + href for `crm_record`, and `if (app === "crm")` in `moduleRouteMap`.

---

## 6. Go live

1. Restart **backend** (creates `crm_record`, upserts `mst_modules`).
2. Restart **frontend**.
3. Log in as **super_admin**.
4. 9-dot launcher → **CRM** → `/crm/dashboard`.
5. Sidebar → **Records**.
6. Exercise CRUD: New → save pending → Edit → Approve → Delete.
7. Admin Console → Users: confirm a **CRM** tab and the Records module.
8. As a normal user: enable app access + `can_view` / `can_add` / etc. Confirm `AppGuard` sends users without access back to Home.

---

## 7. Smoke test

- [ ] Template kit still **not** in the launcher (only your new app)
- [ ] `/crm/dashboard` opens with CRM sidebar
- [ ] Unauthenticated `/crm/records` redirects to login
- [ ] `POST /api/crm/records/list` succeeds when logged in
- [ ] Create rejects empty name; duplicate name returns 409
- [ ] Approve requires authorize permission (super_admin always can)
- [ ] Delete is soft (`is_deleted`); row disappears from the list
- [ ] User without `app_access.crm` cannot open the app

---

## 8. If you ran the backend while Template was briefly wired

That older wiring is removed. If a leftover table or module exists:

```sql
-- optional cleanup
DROP TABLE IF EXISTS template_record;
DELETE FROM mst_modules WHERE name = 'template_record' AND app_type = 'template';
```

---

## Related

| Doc | Use |
|-----|-----|
| [ADD-NEW-APP-STEPS.md](./ADD-NEW-APP-STEPS.md) | Full registry checklist (all optional extras) |
| [CREATE-NEW-MODULE.md](./CREATE-NEW-MODULE.md) | Add a second module inside the new app |
| Kit `CONNECT.js` | Short token + file list next to the backend kit |
