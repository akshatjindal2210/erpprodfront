# Frontend Structure Reorganization

---

## Purpose

The previous layout was **MVC-style** (`components/`, `services/`, `helpers/` as separate layers). That became confusing once we had multiple product apps (IMS, Task, Settings):

- The same kind of code lived sometimes under `features/apps/...`, sometimes under `core/`
- Task imported helpers from IMS (cross-app leakage)
- It was unclear where to put shared code when adding a 4th app
- Paths did not read clearly as: *which app → which module → which file*

**Goal:** a simple, scalable layout where:

1. Every product app lives under `apps/`
2. Feature modules are clearly separated
3. Global UI is separate
4. Platform (engine) vs cross-app product code is clearly separated
5. App-level management screens use `manage/` — not named `admin/`, to avoid confusion with the Settings console

---

## What we did

### 1. Removed the MVC / `features` layout

| Before | After |
|--------|-------|
| `features/apps/task/...` | `apps/task/...` |
| `features/apps/ims/...` | `apps/ims/...` |
| `features/admin/...` | `apps/settings/...` |
| `features/shared/...` | `common/...` (cross-app) |
| `features/dashboard-builder/...` | `common/dashboard-builder/` |
| `core/components/common` + `ui` | `ui/common` + `ui/primitives` |

The top-level `features/` folder has been **fully removed**.

### 2. Meaningful top-level folders

| Folder | Meaning |
|--------|---------|
| `app/` | Next.js routes only (URLs) |
| `apps/` | All product apps (task, ims, settings, and future apps) |
| `platform/` | Engine — API, Redux, layouts, hooks, guards *(formerly `core`)* |
| `common/` | Cross-app product — PWA, login, portal, dashboard-builder *(formerly top-level `shared`)* |
| `ui/` | Global shared UI kit |
| `config/` | Portal registry / app launcher config |

### 3. Clear layers inside each product app

```text
apps/<app>/
  lib/       → app toolkit (config, layout, services, helpers, ui)
  modules/   → day-to-day feature modules
  manage/    → this app’s management screens (dashboard, logs, …) — not Settings
```

**Task**

| Layer | Contents |
|-------|----------|
| `lib/` | config, layout, guards, helpers, hooks, services, ui |
| `modules/` | tasks, cl-task, recurring-task, red-ticket, reminders, reports, category, holidays |
| `manage/` | dashboard, logs, notifications |

**IMS**

| Layer | Contents |
|-------|----------|
| `lib/` | config, layout, helpers, services, utils |
| `modules/` | box, audit, master, inward, out, FN, stickers, … |
| `manage/` | log (system / activity logs) |

**Settings (Admin Console) — flattened**

Settings *is* the console, so there is **no** extra `admin/` or `manage/` wrapper inside it:

| Layer | Contents |
|-------|----------|
| `lib/` | config, services |
| `identity/` | users, departments, designations, modules |
| `configuration/` | app config, layout, nav registry |
| `notifications/` | notification tools |
| `training/` | SOP / training |

> Note: `modules/cl-task/admin/` is **module-private** master UI (CL Task definitions). It is not the same as app-level `manage/`.

### 4. Made PWA global

PWA code used to be split across `task` and `shared`. It now lives here:

```text
common/pwa/
  components/     → install, register, security, orientation…
  webPushSubscribe.js
  task/           → task notify / inbox / bell (under PWA, but task-flavoured)
```

The whole product runs as a PWA, so this does not belong inside a single app.

### 5. Fixed cross-app UI leakage

List-shell helpers that used to live under IMS (and were imported by Task) are now in global UI:

- `ui/common/list/listPageShellClasses.js`
- `ui/common/list/clientListSearch.js`
- `ui/common/list/useAppliedListSearch.js`
- `ui/common/list/dateFilterDefaults.js`
- `ui/common/list/ImsSegmentedTabs.js`

Platform helpers used by the engine:

- `platform/utils/global/financialYear.js`
- `platform/utils/global/scanFeedback.js`

This avoids **platform → apps** dependencies (cleaner and safer).

### 6. Purpose-based subfolders (dense flats)

Large flat folders were split by purpose. Logic is unchanged — only paths moved.

**`ui/common/`**

| Subfolder | Purpose |
|-----------|---------|
| `list/` | List-page shell (toolbar, filter strip, export, client search) |
| `date/` | Date range / filter date pickers |
| `forms/` | Shared form fields (select, textarea, …) |
| `scan/` | Laser / QR / scan inputs |
| `modals/` | Shared modals (delete, global detail) |
| `system/` | Gates, toast, shortcuts, SOP, loaders, file preview |
| `table/` | Table skeletons / empty / pagination |
| `Constants.js` | Shared constants at root (used by forms and apps) |

**`platform/utils/`**

| Subfolder | Purpose |
|-----------|---------|
| `list/` | List search, export, hotkeys, table cell selection |
| `pwa/` | PWA detect / install / launch helpers |
| `auth/` | Auth profile, company network, permission days |
| `form/` | Form focus, editable target, select sort |
| `device/` | Device scan settings |
| `core/` | lib, cn, toast, financial-year helpers, utilHelper, … |
| `global/` | Session / box UID / scan snackbar barrel |

**`platform/hooks/`**

| Subfolder | Purpose |
|-----------|---------|
| `auth/` | Access, logout, session sync, network guard |
| `list/` | List export, drawer hotkeys, view mode |
| `scan/` | Laser / QR / device scan hooks |
| `pwa/` | PWA install hook |
| `system/` | Escape key, socket |

### 7. Imports and aliases

`jsconfig.json` aliases:

```json
{
  "@/apps/*": ["./src/apps/*"],
  "@/platform/*": ["./src/platform/*"],
  "@/common/*": ["./src/common/*"],
  "@/ui/*": ["./src/ui/*"],
  "@/config/*": ["./src/config/*"]
}
```

Business logic inside files was **not** rewritten — only moves and import paths.

---

## Why this design

| Problem | Solution |
|---------|----------|
| Chaos as more apps are added | Keep all apps under `apps/` |
| Hard to tell which file you are in | Path reads as `apps/task/modules/tasks/Page.js` |
| Where does shared code go? | Clear rules: `platform` / `common` / `ui` |
| Day-to-day vs management screens mixed | `modules/` vs `manage/` |
| Task importing from IMS | Shared list UI → `ui/common` |
| PWA used by every app | `common/pwa` |

---

## How to add a new (4th) app

```text
apps/my-new-app/
  lib/        ← config, layout, services, helpers
  modules/    ← feature pages (day-to-day work)
  manage/     ← optional: this app’s logs / dashboard / management screens
```

| If the code is… | Import from |
|-----------------|-------------|
| API, auth, permissions, navbar shell | `@/platform/...` |
| Login, PWA, portal, dashboard builder | `@/common/...` |
| DateFilter, DataTable, toolbar | `@/ui/...` |
| Specific to this app only | `@/apps/my-new-app/lib/...` |
| A new feature | `@/apps/my-new-app/modules/<name>/` |
| App management UI | `@/apps/my-new-app/manage/<name>/` |

Keep route files (`app/.../page.js`) as thin re-exports, as they are now.

---

## Final tree (summary)

```text
frontend/src/
├── app/              # Next.js URLs only
├── apps/
│   ├── task/         # lib + modules + manage
│   ├── ims/          # lib + modules + manage
│   └── settings/     # lib + identity + configuration + … (flat console)
├── platform/         # system engine (ex-core)
│   ├── hooks/        # auth | list | scan | pwa | system
│   └── utils/        # list | pwa | auth | form | device | core | global
├── common/           # cross-app product (PWA, auth, portal, …)
├── ui/               # global UI kit
│   ├── common/       # list | date | forms | scan | modals | system | table
│   └── primitives/
└── config/           # portal / launcher registry
```

---

## Verification (after reorg)

- Missing `@/` imports: **0** (536 JS files scanned)
- Old aliases (`@/core`, `@/features`, `@/shared`, …): **0**
- Old folders (`features`, `core`, top-level `shared`, `modules`): **removed**
- Production `next build`: **passed**

Recommended smoke test: Login → Task list → IMS list → Settings.  
Clear `.next` if paths look stale after a pull.

---
