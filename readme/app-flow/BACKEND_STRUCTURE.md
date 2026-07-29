# Backend Structure Reorganization

---

## Purpose

The previous layout was **flat MVC per app** (`controllers/`, `models/`, `routes/`, `utils/` as separate layers). That became confusing once each product app grew many features:

- Related files for one feature were scattered across four folders
- Paths did not read clearly as: *which app → which module → which file*
- Cross-feature utils lived in a flat `utils/` tree that mixed shared and module-private code

**Goal:** mirror the frontend app-level layout so:

1. Every product app lives under `apps/`
2. Feature modules keep route + controller + model + utils together
3. App toolkit code lives in `lib/`
4. App management endpoints use `manage/` (IMS / Task)
5. Core (portal / settings API) is flattened like frontend Settings (`identity/`, `configuration/`, …)

**Business logic was not rewritten** — only file moves and import paths.

---

## Top-level layout

```text
backend/
├── app.js                 # process entry (HTTP + Socket.IO + boot)
└── src/
    ├── index.js           # Express mounts (/api/core, /api/task, /api/dashboard, /api)
    ├── config/            # shared platform config (purpose-split — see below)
    ├── platform/          # shared runtime (auth, ACL, activity, query helpers, …)
    ├── jobs/              # cron jobs (shared | task | system)
    ├── logging/
    ├── backfills/
    └── apps/
        ├── core/          # portal / settings API  → /api/core
        ├── ims/           # inventory             → /api
        ├── task/          # tasks                 → /api/task
        └── dashboard/     # dashboard builder     → /api/dashboard
```

API URL prefixes are **unchanged**.

---

## Platform vs apps (reuse)

Shared **runtime** lives under `src/platform/` so a new app does not copy middleware/utils from Core:

```text
src/platform/
  middleware/     → auth, optionalAuth, accessControl, activityLogger, pageHelperAccess
  utils/          → activity, auth (approval/days), query, logging, date, realtime, config helpers
  constants/      → shared messages
```

`apps/core/lib/middleware/*` and most `apps/core/lib/utils/*` are **re-export shims** pointing at `platform/` — existing imports keep working; logic was not rewritten.

**Stays in Core (not platform):**
- `lib/config/` — Core DDL, seeds, crud registry, view fields
- `lib/utils/helper/` — still depends on IMS sticker helpers / app config model

**App-local auth copies** (IMS / Task) remain for now — different token/user-field behavior; do not merge without an explicit behavior decision.

---

## Config layout (purpose + domain)

Flat config dumps were hard to scan. Config is now grouped by **what it is for**.

### Platform — `src/config/`

```text
src/config/
  app/            → runtime app settings (config.js, cors.js, appVersion.js)
  db/             → database client, table-name map, init orchestration, column helpers
  portal/         → portal module catalog + seed modules
  auth/           → permission cache
  push/           → web-push brand helpers
  preferences/    → user app preferences helpers
  audit/          → audit column helpers
```

### Per-app — `apps/<app>/lib/config/`

```text
lib/config/
  db/             → initDB, seed, syncSequences
  views/          → list/helper view field resolvers (IMS/Task); fields/ (Core)
  crud/           → CRUD module registry (Core)
  notifications/  → inbox / task notify config
  dashboard/      → dashboard stat keys (Task)
  tables/
    <domain>/     → DDL files grouped like product modules
```

**IMS `tables/` domains:** `category`, `stickers`, `location`, `packing-standard`, `box`, `inventory-inward`, `forwarding-note`, `out-entry`, `stock-adjustment`, `audit`, `qc-hold-material`, `schedule-planning`, `app-config`, `transaction-log`

**Core `tables/` domains:** `identity`, `notifications`, `training`, `activity-logs`, `configuration`, `db` (triggers)

**Task `tables/` domains:** `tasks`, `recurring-task`, `category`, `holidays`, `cl-task`, `red-ticket`, `reports`, `app-config`, `db`

---

## Layers inside each app

### IMS & Task (same idea as frontend)

```text
apps/<app>/
  lib/        → app toolkit (config, middleware, shared services/utils)
  modules/    → day-to-day feature modules
  manage/     → this app’s management APIs
  routes/     → thin aggregator only (index.js)
```

### Core (Settings-like — flattened)

Core *is* the portal/admin API, so there is **no** extra `manage/` wrapper:

```text
apps/core/
  lib/              → middleware, utils, config, constants
  identity/         → users, departments, designations, modules (+ permissions)
  configuration/    → appConfig, user preferences
  notifications/    → inbox, push, web-push / inbox notify services
  training/         → training videos, module SOPs
  activity-logs/    → activity log API
  routes/           → thin aggregator
```

### Dashboard

```text
apps/dashboard/
  lib/              → config, query utils
  modules/dashboard → controller + model
  routes/           → aggregator
```

---

## Feature mapping

### IMS

| Layer | Contents |
|-------|----------|
| `lib/` | config, constants, middleware, `ims.service`, `erp-api`, `packing-entry`, shared helpers |
| `modules/` | category, master, location, packing-standard, box, inventory-inward, forwarding-note, out-entry, stock-adjustment, inventory-report, erp-stock-report, schedule-planning, audit, qc-hold-material |
| `manage/` | log (box transaction logs), app-config |

Each module folder typically holds:

```text
modules/<feature>/
  routes/         → *.route.js
  controllers/    → *.controller.js
  models/         → *.model.js
  services/       → optional
  utils/          → purpose-named subfolders (see below)
```

Dense `utils/` folders are split by **content purpose** (not left as one flat dump):

| Module / area | Purpose folders |
|---------------|-----------------|
| `box/utils/` | `inventory/`, `override-customer/`, `stickers/`, `transactions/`, `uid/`, `backfill/` |
| `stock-adjustment/utils/` | `apply/`, `packing/`, `list/`, `minus/`, `doc/` |
| `qc-hold-material/utils/` | `list/`, `stock/`, `packing/`, `submission/` |
| `forwarding-note/utils/` | `list/`, `stock/`, `items/`, `packing/`, `messages/` |
| `out-entry/utils/` | `list/`, `scan/`, `fulfillment/`, `types/` |
| `core/lib/utils/` | `query/`, `activity/`, `auth/`, `config/`, `logging/`, `date/`, `realtime/`, `helper/` |
| `dashboard/lib/utils/` | `query/`, `mssql/`, `schema/` |
| `ims/lib/utils/erp-api/` | `lookup/`, `pack/`, `stock/`, `list/` |
| `ims/lib/utils/packing-entry/` | `list/`, `customers/`, `parse/`, `stickers/` |

Mixed domains are also split by name:

| Area | Split |
|------|--------|
| `core/notifications/` | `inbox/`, `push/` |
| `core/training/` | `videos/`, `sops/` |
| `core/identity/` | `users/`, `departments/`, `designations/`, `modules/`, `permissions/` |
| `task/manage/notifications/` | `controllers/`, `models/`, `routes/`, `services/` |

### Task

| Layer | Contents |
|-------|----------|
| `lib/` | config, shared (auth middleware, uploads, helpers) |
| `modules/` | tasks, recurring-task, category, holidays, reminders, cl-task, red-ticket, reports |
| `manage/` | notifications, logs, dashboard (task app config) |

### Core

| Layer | Contents |
|-------|----------|
| `identity/` | users, departments, designations, modules, permissions |
| `configuration/` | appConfig model, user app preferences |
| `notifications/` | `inbox/`, `push/` |
| `training/` | `videos/`, `sops/` |
| `activity-logs/` | portal activity logs |
| `lib/` | auth/ACL middleware, purpose-split utils, … |

---

## What stayed the same

| Concern | Status |
|---------|--------|
| HTTP paths (`/api/boxes`, `/api/core/auth`, …) | Unchanged |
| Controller / model / service logic | Unchanged |
| DB table names / SQL | Unchanged |
| Shared platform config (`src/config`) | Unchanged location |
| Jobs / backfills / logging | Still under `src/`; imports updated only |

---

## How to add a new feature (IMS / Task)

1. Create `apps/<app>/modules/<feature-name>/`
2. Add `*.route.js`, `*.controller.js`, `*.model.js` (and `utils/` if needed)
3. Mount the router in `apps/<app>/routes/index.js`
4. Put **app-wide** helpers in `lib/`, not inside another module

For management-only APIs (logs, app config, notification admin), prefer `manage/<name>/`.

---

## Final tree (summary)

```text
backend/src/apps/
├── core/
│   ├── lib/utils/         # activity | auth | config | date | helper | logging | query | realtime
│   ├── identity/          # users | departments | designations | modules | permissions
│   ├── configuration/
│   ├── notifications/     # inbox | push
│   ├── training/          # videos | sops
│   ├── activity-logs/
│   └── routes/index.js
├── ims/
│   ├── lib/utils/         # erp-api | packing-entry (purpose-split inside)
│   ├── modules/<feature>/ # controllers | models | routes | utils/<purpose>/
│   ├── manage/            # log | app-config
│   └── routes/index.js
├── task/
│   ├── lib/
│   ├── modules/<feature>/ # controllers | models | routes | helpers/<purpose>/
│   ├── manage/            # notifications | logs | dashboard
│   └── routes/index.js
└── dashboard/
    ├── lib/utils/         # query | mssql | schema
    ├── modules/dashboard/ # controllers | models
    └── routes/index.js
```

---

## Verification (after reorg)

- Broken relative imports: **0** (all `src/**/*.js` + `app.js` scanned)
- Express app module graph (`import ./src/index.js`): **OK**
- Jobs + `initDB` import graph: **OK**

Recommended smoke test: Login → IMS list → Task list → Settings/core auth → Dashboard widgets.
