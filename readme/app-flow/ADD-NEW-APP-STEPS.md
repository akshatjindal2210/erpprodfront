# Add a New App — Complete Steps

Professional checklist for adding a new product app to ERP (examples: `hrms`, `rmstore`).  
Replace `<appkey>` with one lowercase token (`hrms`, `rmstore`). Keep frontend and backend portal registries in sync.

**Do not** create a separate package. Use the monorepo:

- Backend: `backend/src/apps/<appkey>/`
- Frontend: `frontend/src/apps/<appkey>/` + thin routes under `frontend/src/app/<appkey>/`

**References**

| App             | Role                                                                |
|-----------------|---------------------------------------------------------------------|
| `rmstore`       | Full template (dashboard, quick access, app config, uploads, logs)  |
| `hrms`          | Minimal product template (modules + API + shell)                    |
| `ims` / `task`  | Shell and UI patterns only — do not import their domain code        |

---

## 0. Naming

| Item                                  | Rule                | Example                         |
|---------------------------------------|---------------------|---------------------------------|
| App key / `app_type` / launcher `id`  | One lowercase token | `hrms`                          |
| URL                                   | `/<appkey>/…`       | `/hrms/dashboard`               |
| API                                   | `/api/<appkey>/…`   | `/api/hrms/attendance-log/list` |
| Table prefix                          | `<appkey>_`         | `hrms_attendance_log`           |
| Module permission slug                | `snake_case`        | `hrms_attendance`               |
| Gate constant                         | `app_<appkey>`      | `app_hrms`                      |
| Display label                         | Human-readable      | `HRMS`                          |

---

## 1. Backend — app skeleton

Create under `backend/src/apps/<appkey>/`:

```text
apps/<appkey>/
  routes/index.js
  modules/<feature>/
    routes/<feature>.route.js
    controllers/<feature>.controller.js
    models/<feature>.model.js          # as needed
  lib/config/
    db/initDB.js
    tables/<feature>/<table>.table.js
    views/                             # optional
    app.config.js                      # optional (Settings → App Configuration)
  lib/middleware/
    auth.js                            # optional re-export of core auth
    upload.js                          # optional
```

Each feature route must use:

```js
authenticate, accessControl("<module_slug>", "view" | "add" | "edit" | "delete" | "authorize")
```

---

## 2. Backend — database tables

**File:** `backend/src/config/db/dbTables.js`

1. Add `TABLE_PREFIX.<appkey> = "<appkey>_"`
2. Add `DB_TABLES.<appkey> = ["<appkey>_…", …]`
3. Export `XXX_TABLES = toKeyMap(DB_TABLES.<appkey>, TABLE_PREFIX.<appkey>)`

**File:** `backend/src/apps/<appkey>/lib/config/db/initDB.js`

- Export `initXxxDB()` and call all `create*Table()` helpers.

**File:** `backend/src/config/db/initDB.js`

- Import and `await initXxxDB()` in boot order.

Restart the backend so tables are created.

---

## 3. Backend — mount API

**File:** `backend/src/index.js`

```js
import <appkey>Routes from "./apps/<appkey>/routes/index.js";

app.use("/api/<appkey>", activityLogger("<appkey>"), <appkey>Routes);
```

`activityLogger("<appkey>")` sets `app_type` on activity logs. Do not skip it.

---

## 4. Backend — portal modules and permissions seed

**File:** `backend/src/config/portal/portalModules.js`

Add all of the following:

1. `APP_GATES.<appkey> = "app_<appkey>"`
2. `APP_META.<appkey> = { label: "…", permissions: true }`
3. `"<appkey>"` in `PORTAL_APP_KEYS`
4. `MODULES.<appkey> = [{ name, label }, …]`
5. Matching rows in `SEED_MODULES` with `app_type: "<appkey>"`, `sort_order`, `name`, `label`

On server start, seed upserts into `mst_modules`.  
App access is stored in `mst_user_app_access` (`app_key` = `<appkey>`).

---

## 5. Backend — optional

| Need | Action |
|------|--------|
| External API | Add keys in `backend/src/config/app/config.js` and `.env` |
| Uploads | App upload middleware under shared `UPLOAD_PATH`; files served at `/uploads` |
| Schema patches | Add migration under `backend/src/migrations/` and register it |
| Dashboard SQL widgets | Register app in dashboard controller `ALLOWED_APP_KEYS` + `APP_TABLE_PREFIX` |
| Cron / jobs | Add under `backend/src/jobs/` and register in `backend/app.js` |
| App Configuration | `lib/config/app.config.js` + Settings UI panels (frontend) |

No per-app `package.json`. Use `backend/package.json` only.

---

## 6. Frontend — product code

Create under `frontend/src/apps/<appkey>/`:

```text
apps/<appkey>/
  lib/utils/routes.js
  lib/config/navRegistry.js
  lib/config/endpoints.js
  lib/services/*.js
  lib/layout/<App>AppLayout.js
  modules/dashboard/Page.js
  modules/<feature>/Page.js
```

**Layout pattern**

```js
<PwaInstallGate>
  <AppGuard appId="<appkey>">
    <RootLayoutComponent shell={APP_SHELL.YOUR_APP}>
      <PermissionGuard>{children}</PermissionGuard>
    </RootLayoutComponent>
  </AppGuard>
</PwaInstallGate>
```

Endpoints are relative to `/api` (api client already prefixes the base URL).

Example: `/hrms/attendance-log/list` → `POST /api/hrms/attendance-log/list`.

---

## 7. Frontend — Next.js thin routes

```text
app/<appkey>/dashboard/layout.js
app/<appkey>/dashboard/page.js
app/<appkey>/dashboard/<feature>/page.js
```

Route files only re-export module pages. No business logic.

```js
export { default } from "@/apps/<appkey>/modules/<feature>/Page";
```

---

## 8. Frontend — required registries

| File | Add |
|------|-----|
| `frontend/src/config/routes.js` | Import and spread `…YOUR_ROUTES` |
| `frontend/src/config/appsRegistry.js` | `APP_SHELL`, launcher `APPS[]` entry, `isXxxShellPath` / `isXxxShell`, branch in `getShellAppFromPathname` |
| `frontend/src/config/portalModules.data.js` | Same `APP_GATES`, `APP_META`, `MODULES`, `PORTAL_APP_KEYS` as backend |
| `frontend/src/config/moduleAppRegistry.js` | `partitionModulesForUserForm` bucket + `getModulesForAppKey` case |
| `frontend/src/config/shellNav.js` | Import nav registry; wire `resolveShellNavRegistry` / brand; add to `ALL_SHELL_NAV_REGISTRIES` |

---

## 9. Frontend — auth middleware (easy to miss)

**File:** `frontend/src/middleware.js`

1. Add `/<appkey>` to `PROTECTED_PREFIXES`
2. Add `/<appkey>` to `config.matcher`

Without this, unauthenticated users can reach pages (client guards only).

---

## 10. Frontend — shell, guards, chrome

| File | Add |
|------|-----|
| App layout | `AppGuard appId="<appkey>"` |
| `PermissionGuard.js` | Resolve your nav registry; allow `/<appkey>/dashboard` as home |
| `RootLayout.js` | Full-bleed dashboard path `/<appkey>/dashboard` if needed |
| `Navbar.js` | Breadcrumb and search for `/<appkey>/` |

---

## 11. Frontend — Admin Console user access

| File | Add |
|------|-----|
| `UserModal.js` | Include modules from `partitionModulesForUserForm` |
| `UserPermissionsPanel.js` | Pass modules into `getModulesForAppKey` |

App toggle tabs come from `PORTAL_APP_KEYS` / `APP_META` once registries are updated.

---

## 12. Frontend — optional (parity with RM Store)

| Need | Files |
|------|--------|
| Dashboard Builder | `appNavPages.js`, `DashboardBuilder.js` options, backend `ALLOWED_APP_KEYS` |
| Quick Access | `QuickAccessBar.js`, `config/quickAccess.js` `BY_APP.<appkey>` |
| App Configuration | `appConfigTabsRegistry.js`, `appConfigPanels.js`, panel component |
| In-app activity logs | Module page filtering `app_type: "<appkey>"` |
| Version docs | `frontend/readme/version/<n>.x.x.md`, `version-notes/vX.Y.Z.md` |

No per-app frontend package. Use `frontend/package.json` only.

---

## 13. Worked example — HRMS (`hrms`)

| Piece | Value |
|-------|--------|
| App key | `hrms` |
| Label | `HRMS` |
| URL | `/hrms/dashboard` |
| API | `/api/hrms` |
| Tables | `hrms_attendance_log`, `hrms_attendance` |
| Modules | `hrms_attendance_log`, `hrms_attendance` |
| Backend | `backend/src/apps/hrms/` |
| Frontend | `frontend/src/apps/hrms/` + `frontend/src/app/hrms/` |
| Release line | `4.x.x` → [v4.1.0](../version-notes/v4.1.0.md) |

Flow:

```text
Device webhook / manual mark
  → hrms_attendance_log
  → upsert hrms_attendance (daily)
```

---

## 14. Worked example — RM Store (`rmstore`)

| Piece | Value |
|-------|--------|
| App key | `rmstore` |
| Label | `RM Store` |
| URL | `/rmstore/dashboard` |
| API | `/api/rmstore` |
| Prefix | `rmstore_` |
| Backend | `backend/src/apps/rmstore/` |
| Frontend | `frontend/src/apps/rmstore/` |
| Extras | Dashboard builder, Quick Access, App Configuration, uploads, activity logs |

Use RM Store when the new app needs full portal parity.

---

## 15. Build order

1. Backend skeleton + tables + `initDB` + `/api/<appkey>` mount  
2. Backend `portalModules.js` seed  
3. Frontend `apps/<appkey>` + thin `app/<appkey>` routes  
4. Wire `routes`, `appsRegistry`, `portalModules.data`, `moduleAppRegistry`, `shellNav`  
5. Wire `middleware.js`, `PermissionGuard`, `Navbar`, `RootLayout`  
6. Wire `UserModal` / `UserPermissionsPanel`  
7. First real module (list + API)  
8. Optional: dashboard, quick access, app config, logs  
9. Restart backend → seed modules → grant app + module access in Admin Console  
10. Smoke test  

---

## 16. Smoke test

- [ ] Launcher shows the app (label + icon)
- [ ] User without `app_access` is blocked by `AppGuard`
- [ ] `/<appkey>/dashboard` opens with sidebar
- [ ] Unauthenticated `/<appkey>/…` redirects to login (middleware)
- [ ] Module pages respect `accessControl` / `PermissionGuard`
- [ ] API calls hit `/api/<appkey>/…`
- [ ] Activity logs use `app_type = "<appkey>"`
- [ ] Admin Console Users shows app toggle + module permissions
- [ ] Tables exist after backend restart (`<appkey>_*`)

---

## 17. Rules

**Do**

- Keep FE `portalModules.data.js` and BE `portalModules.js` identical for gates, meta, modules, and keys
- Reuse `@/platform`, `@/ui`, `@/common` for shell and chrome
- Build domain code only under `apps/<appkey>`
- Use thin Next.js `app/` route files

**Do not**

- Import another product app (`@/apps/ims`, `@/apps/rmstore`, …) into the new app
- Create a separate Next.js or backend package for one portal app
- Use hyphenated app keys (`hr-ms` → use `hrms`)
- Skip middleware registration for `/<appkey>`
- Skip `activityLogger("<appkey>")` on the API mount

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [CREATE-NEW-MODULE.md](./CREATE-NEW-MODULE.md) | Add a module inside an existing app |
| [CREATE-NEW-APP.md](./CREATE-NEW-APP.md) | Earlier shell-focused notes |
| [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md) | Backend layout patterns |
| [FRONTEND_STRUCTURE.md](./FRONTEND_STRUCTURE.md) | Frontend layout patterns |
| [version/README.md](../version/README.md) | Version lines per app |
