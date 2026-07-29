# Creating a New App (ERP Portal)

This note is the checklist for adding a **new product app** inside the existing Next.js frontend (not a separate package). Follow the same **shell shape** as IMS / Task / RM Store.

---

## Design reference vs product data (critical)

IMS (or Task) is only a **design + wiring reference**:

| Reuse from existing apps | Do **not** reuse |
|--------------------------|------------------|
| Side nav + top chrome layout | IMS APIs, services, endpoints |
| List / table / card / drawer look | IMS masters, boxes, FN, stock rows |
| Thin `app/.../page.js` route files | IMS Redux/domain helpers |
| Portal launcher + permissions pattern | Shared DB tables meant only for IMS |
| Global UI: `@/ui`, `@/platform`, `@/common` | Imports from `@/apps/ims/...` |

Each new app (`rmstore`, etc.) is a **new implementation**:

- Own routes under `/<appkey>/...`
- Own modules, fields, and master data (built from scratch)
- Own backend under `backend/src/apps/<appkey>/` and `/api/<appkey>/...`
- Own portal `app_type` / modules / `app_access`

**RM Store (`rmstore`):** use IMS only for UI shell and route-file style. No IMS inventory data should appear in RM Store screens or APIs.

Prefer neutral list-shell aliases from `@/ui/common/list/listPageShellClasses`:

- `LIST_PAGE_SHELL`, `TABLE_CELL_TEXT`, `TABLE_CELL_DATE`, …
- Legacy `IMS_*` names are historical; new apps should not imply IMS ownership.

---

## Naming rules (important)

| Thing | Style | Examples |
|-------|--------|----------|
| App key / `app_type` / launcher `id` | **one lowercase token** (like `ims`, `task`) | `rmstore`, `hr`, `crm` |
| URL prefix | Same as app key | `/rmstore/...`, `/ims/...` |
| Folder under `apps/` and `app/` | Same as app key | `apps/rmstore`, `app/rmstore` |
| Display name | Human label only | `"RM Store"`, `"IMS"` |
| Module slugs | `snake_case` | `rm_item_master`, `boxes` |
| Avoid | Hyphens in app keys | ~~`rm-store`~~ → use `rmstore` |

Portal tabs, user `app_access`, and `SEED_MODULES.app_type` all use the **app key**.

---

## Architecture (where code lives)

```text
frontend/src/
├── app/<appkey>/dashboard/...     # Next.js routes only (thin page.js re-exports)
├── apps/<appkey>/
│   ├── lib/                       # config, layout, routes, endpoints, services, shared UI
│   ├── modules/                   # day-to-day feature pages
│   └── manage/                    # optional: logs / admin screens for this app
├── platform/                      # shared shell: Sidebar, Navbar, RootLayout, guards, API
├── common/                        # PWA, portal launcher, dashboard-builder
├── ui/                            # DataTable, Drawer, list toolbar, forms
└── config/                        # appsRegistry, routes barrel, portalModules
```

| Need | Import from |
|------|-------------|
| API client, auth, permissions, layout shell | `@/platform/...` |
| Login, PWA, portal launcher, dashboard builder | `@/common/...` |
| DataTable, Drawer, DateFilter, list toolbar | `@/ui/...` |
| This app only | `@/apps/<appkey>/...` |

---

## End-to-end checklist

Copy this list when starting a new app (`<appkey>` = e.g. `rmstore`).

### 1. App product folder

Create:

```text
apps/<appkey>/
  lib/
    config/navRegistry.js      # side nav (+ optional subItems groups)
    config/endpoints.js        # /api/<appkey>/...
    utils/routes.js            # ROUTES constants under /<appkey>/dashboard/...
    layout/<App>AppLayout.js   # PwaInstallGate → AppGuard → RootLayout → PermissionGuard
    services/                  # API (or local CRUD until backend exists)
    ui/                        # optional shared list/drawer helpers for this app
  modules/
    dashboard/Page.js
    <feature>/Page.js (+ Modal/Drawer as needed)
  manage/                      # optional
```

**Layout pattern** (same as IMS / RM Store):

```js
<PwaInstallGate>
  <AppGuard appId="<appkey>">
    <RootLayoutComponent shell={APP_SHELL.YOUR_APP}>
      <PermissionGuard>{children}</PermissionGuard>
    </RootLayoutComponent>
  </AppGuard>
</PwaInstallGate>
```

Task uses `RouteGuard` instead of `PermissionGuard` for role maps — only copy that if you need Task-style role gates.

### 2. Next.js URL routes (thin re-exports)

```text
app/<appkey>/dashboard/layout.js     → export AppLayout
app/<appkey>/dashboard/page.js       → dashboard module
app/<appkey>/dashboard/<feature>/page.js → feature Page
```

Example:

```js
export { default } from "@/apps/<appkey>/modules/dashboard/Page";
```

Keep route files thin — no business logic.

### 3. Wire portal / launcher / shell (required files)

| File | What to add |
|------|-------------|
| `frontend/src/apps/<appkey>/lib/utils/routes.js` | All paths under `/<appkey>/dashboard/...` |
| `frontend/src/config/routes.js` | `import` + spread `...YOUR_ROUTES` into `ROUTES` |
| `frontend/src/config/appsRegistry.js` | `APP_SHELL.YOUR_APP`, launcher entry in `APPS`, `isXxxShellPath` / `isXxxShell`, branch in `getShellAppFromPathname` |
| `frontend/src/config/portalModules.data.js` | `APP_GATES`, `APP_META`, `MODULES.<appkey>`, `PORTAL_APP_KEYS` |
| `backend/src/config/portal/portalModules.js` | **Keep in sync** with frontend: gates, meta, modules, `SEED_MODULES` with `app_type: "<appkey>"` |
| `frontend/src/config/moduleAppRegistry.js` | `partitionModulesForUserForm` bucket + `getModulesForAppKey` |
| `frontend/src/platform/layouts/RootLayout.js` | Detect shell → pass `navRegistry`, brand label; include registry in access `findModule`; usually `hideQuickLinks` like Task |
| `frontend/src/platform/layouts/Navbar.js` | Breadcrumb + search items for `/<appkey>/` paths |
| `frontend/src/platform/components/guards/PermissionGuard.js` | Collect / resolve `YOUR_NAV_REGISTRY`; allow `/<appkey>/dashboard` as open dashboard |
| `frontend/src/apps/settings/identity/users/UserModal.js` | `resolveAppAccessEnabled("<appkey>")` in sync map; pass new module list into permissions panel |
| `frontend/src/apps/settings/identity/users/UserPermissionsPanel.js` | Accept modules prop + pass into `getModulesForAppKey` |
| `frontend/src/common/dashboard-builder/utils/appNavPages.js` | Flatten nav for `<appkey>`; path prefix; main dashboard route |
| `frontend/src/common/dashboard-builder/components/DashboardBuilder.js` | App option in target-app dropdown (if dashboards used) |

Optional later:

| File | When |
|------|------|
| `frontend/src/apps/<appkey>/lib/config/quickLinks.js` | If you want IMS-style Quick Access Bar |
| Settings app-config tabs / panels | Per-app config screens |
| `backend/src/apps/<appkey>/` + mount in `backend/src/index.js` | Real APIs |
| `backend/src/config/db/dbTables.js` | Table prefix for this app (e.g. `rmstore_`) |
| Push icon under `frontend/public/push-icons/` | PWA branding |

### 4. Permissions / seed

1. Add modules under `MODULES.<appkey>` (frontend + backend).
2. Append matching rows to backend `SEED_MODULES` (`app_type: "<appkey>"`).
3. Re-run module seed / sync so `mst_modules` picks them up.
4. In Admin Console → Users: enable app toggle + module permissions (Super Admin always sees the app).

Without seed sync, Super Admin can still open the app; normal users will not get modules until DB is updated.

### 5. Build the first screens (UI pattern)

Reuse **global** list chrome — do **not** invent a new table/drawer system, and do **not** call another app’s APIs:

- Shell: `LIST_PAGE_SHELL` (`@/ui/common/list/listPageShellClasses`)
- Toolbar: `ListPageToolbar` / `ListPageToolbarLayout`
- Filters: `ListPageFilterStrip` + `DateRangeFilter`
- Table / cards: `DataTable` (+ `cardConfig`)
- Form: `Drawer` + shared form fields (`SearchableSelect`, `FormLabel`, …)
- Actions: `ActionButton` with **this app’s** `module` + `action`
- Delete: `DeleteModal`

Wire columns and forms to **this app’s** services only. Temporary local stubs are fine until the app’s own backend exists.

Nav: groups in `navRegistry` with `subItems`. Breadcrumb / search follow the selected route.

### 6. Smoke test

- [ ] 9-dot launcher shows the app (correct label + icon)
- [ ] `/<appkey>/dashboard` opens with side nav
- [ ] Sidebar items navigate; breadcrumb updates
- [ ] Masters group expands `subItems`
- [ ] List page: table + card toggle, New opens drawer, Edit/Delete work
- [ ] User permissions panel shows a tab for the app (label from `APP_META`)
- [ ] Non–Super Admin without `app_access` is redirected home by `AppGuard`
- [ ] PermissionGuard does **not** bounce you back to IMS when opening this app

---

## Minimal file set (skeleton only)

If you only need shell + empty dashboard:

```text
apps/<appkey>/lib/utils/routes.js
apps/<appkey>/lib/config/navRegistry.js
apps/<appkey>/lib/layout/<App>AppLayout.js
apps/<appkey>/modules/dashboard/Page.js
app/<appkey>/dashboard/layout.js
app/<appkey>/dashboard/page.js

config/routes.js
config/appsRegistry.js
config/portalModules.data.js
config/moduleAppRegistry.js
backend/.../portalModules.js

platform/layouts/RootLayout.js
platform/layouts/Navbar.js
platform/components/guards/PermissionGuard.js
settings/.../UserModal.js
settings/.../UserPermissionsPanel.js
common/dashboard-builder/utils/appNavPages.js   # if using dashboard builder
```

Then add `modules/<feature>/` + `app/.../page.js` re-exports one feature at a time.

---

## Worked example: RM Store (`rmstore`)

| Piece | Value |
|-------|--------|
| App key | `rmstore` |
| Label | `RM Store` |
| URL | `/rmstore/dashboard` |
| Product code | `frontend/src/apps/rmstore/` |
| Routes | `frontend/src/app/rmstore/dashboard/` |
| Shell | `APP_SHELL.RM_STORE` → `"rmstore"` |
| Gate | `app_rmstore` |
| Data | **Own** masters / transactions / APIs — not IMS |
| Design borrow | Layout, DataTable, Drawer, thin route files only |
| Dashboard | `DashboardBuilder` with `appKey="rmstore"` — default welcome until a config is published |

Temporary master list/drawer configs under `apps/rmstore` are **stubs for UI shape**. Replace fields and wire `/api/rmstore` when RM Store specs and backend exist. Never import `@/apps/ims`.

**Dashboard logic:** add the app key to backend `ALLOWED_APP_KEYS` / `APP_TABLE_PREFIX` in `dashboard.controller.js`, wire `/<appkey>/dashboard` in `QuickAccessBar`, and use the same `DashboardBuilder readOnly` page as IMS/Task. Without a published dashboard, users see `DashboardHome` (logo + “Welcome to …”).

---

## Do / don’t

**Do**

- Keep app keys aligned with `ims` / `task` (no hyphens).
- Keep frontend `portalModules.data.js` and backend `portalModules.js` in sync.
- Put shared UI in `@/ui` / `@/platform` / `@/common`.
- Build each app’s domain (routes, masters, APIs) from scratch.
- Use thin `app/` route files.

**Don’t**

- Show or fetch IMS data inside another app.
- Import `@/apps/ims/...` (or another product app) into the new app.
- Create a separate Next.js package for one portal app.
- Put business pages only under `app/` (logic belongs in `apps/<appkey>/modules`).
- Forget `PermissionGuard` / Navbar / RootLayout wiring.
- Use hyphenated portal keys (`rm-store`) — use `rmstore`.

---

## Suggested build order

1. `routes.js` + `navRegistry.js` + `AppLayout` + dashboard page  
2. Wire `appsRegistry` + `portalModules` (FE + BE) + `routes` barrel  
3. Wire `RootLayout` + `Navbar` + `PermissionGuard` + user permissions  
4. One list + drawer module with **this app’s** empty/stub service (proves design)  
5. Real modules + **this app’s** backend APIs  
6. Seed modules + assign access → smoke test  

When in doubt: copy **Task/IMS shell wiring** and **global `@/ui` list chrome** — never copy IMS domain data or services.

