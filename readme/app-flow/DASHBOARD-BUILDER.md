# Dashboard Builder

Human-readable map of how the **Dashboard Builder** works in this ERP app: what we built, what is used today, what was leftover and removed, and what each frontend / backend / database piece does.

---

## 1. What this feature is

The Dashboard Builder lets a **Super Admin** design dashboards (KPI, table, graph, heading, container) for apps like Home, IMS, Task, and Admin Console.

- Design once on **laptop** and optionally again on **phone** (layouts stay separate).
- Save a **draft**, then **Publish** so normal users see it on live dashboard pages.
- Widget data can come from **Postgres (IMS)** or **SQL Server (ERP / HRMS)** using SELECT-only queries.

Live users never open the builder. They open `/home`, `/ims/dashboard`, etc., and see the published layout only.

---

## 2. How people use it (short flow)

```
Super Admin
  → /settings/dashboard-builder
  → pick App + Dashboard
  → add / move / style widgets (laptop or phone mode)
  → Save Draft  (Ctrl+S)
  → Publish     (Ctrl+Alt+U in browser, Ctrl+U in PWA)

Normal user
  → /home | /ims/dashboard | /task/dashboard | /settings/dashboard
  → read-only DashboardBuilder loads published JSON + runs queries
```

Keyboard shortcuts for the builder (Super Admin only, also listed under Help → Keyboard Shortcuts):

| Action | Browser | PWA |
|--------|---------|-----|
| Save Draft | Ctrl+S | Ctrl+S |
| Publish | Ctrl+Alt+U | Ctrl+U |
| Undo / Redo | Ctrl+Z / Ctrl+Y | same |

---

## 3. What we cleaned up (faltu / unused)

These files were **old experiments** that nothing imported anymore. They were removed safely:

| Removed file | Why it was unused |
|--------------|-------------------|
| `FloatingBuilderCanvas.js` | Replaced by `SimpleBuilderCanvas` (`react-rnd`) |
| `FloatingNestedCanvas.js` | Replaced by `SimpleNestedCanvas` (`react-rnd`) |
| `floatingCanvasInteraction.js` | Only used by the two files above |
| `DashboardLiveGrid.js` | Never wired into pages |
| `FloatingPropertyPanel.js` | Replaced by `WidgetBuilderPanel` |
| `QueryBuilder.js` | Never imported by Property Panel |

### Packages we still keep (on purpose)

| Package | Why it stays |
|---------|----------------|
| **`react-rnd`** | **Active** builder canvas. Drag / resize widgets on laptop and phone. |
| **`react-grid-layout`** | Still imported as a **legacy fallback** inside `DashboardBuilder` / `ContainerNestedGrid` when floating flags are turned off. Today both flags are `true`, so the grid path is not what you edit with — but removing the package would break those imports and risk a hard crash. Leaving it is the safe choice. |

Do **not** run `npm uninstall react-grid-layout` until the legacy branches are deleted in a dedicated cleanup PR with full builder + live regression testing.

---

## 4. Active layout mode (important)

Hardcoded flags:

- `USE_FLOATING_BUILDER = true` in `DashboardBuilder.js`
- `USE_FLOATING_NESTED = true` in `WidgetRenderer.js`

So today:

- Top-level canvas → `SimpleBuilderCanvas` + `react-rnd`
- Nested widgets inside a container → `SimpleNestedCanvas` + `react-rnd`
- Published layouts stored as pixel boxes: `layout_px` (laptop) and `layout_px_mobile` (phone)

Phone and laptop designs are **isolated**. Editing phone must not rewrite laptop boxes, and the reverse.

---

## 5. Frontend pages

| Route | What it does |
|-------|----------------|
| `/settings/dashboard-builder` | **Edit mode** (Super Admin). Full toolbar, panel, save / publish. |
| `/ims/dashboard/builder` | Redirects to `/settings/dashboard-builder`. |
| `/home` | Live Home dashboard (`readOnly`, `appKey="home"`). |
| `/ims/dashboard` | Live IMS dashboard. |
| `/task/dashboard` | Live Task dashboard. |
| `/settings/dashboard` | Live Admin Console dashboard. |

Related (not the builder itself):

- `QuickAccessBar` — dashboard picker / filters / keyboard shortcut help (builder shortcuts only for Super Admin).
- Shared empty state uses `DashboardHome` when nothing is published.

---

## 6. Frontend files (what each one does)

Base folder: `frontend/src/features/dashboard-builder/`

### Components

| File | Job |
|------|-----|
| `DashboardBuilder.js` | Heart of the feature. Edit + live modes, toolbar, undo/redo, dirty guard, laptop/phone switch, save draft / publish / clone / delete dashboard, hotkeys, canvas wiring. |
| `SimpleBuilderCanvas.js` | Top-level floating canvas. Places widgets with `react-rnd`. |
| `SimpleNestedCanvas.js` | Same idea, but for widgets **inside** a container. |
| `simpleBuilderChrome.js` | Selection outline, resize handles, small toolbars on widgets. |
| `WidgetRenderer.js` | Draws KPI / table / graph / heading / container. Runs live data display (charts via `recharts`). |
| `WidgetBuilderPanel.js` | Floating (or docked) shell around the property editor. Stays below app header so it does not slide under the navbar. |
| `PropertyPanel.js` | DATA + STYLE tabs: query, DB source, colors, fonts, sizes, table/graph options. Style patches are debounced so the page does not hang. |
| `ContainerNestedGrid.js` | **Legacy** nested grid (`react-grid-layout`). Only used if `USE_FLOATING_NESTED` is flipped to `false`. Kept for safety. |
| `DashboardAudienceUserSelect.js` | Multi-user picker when cloning or assigning a user-scoped dashboard. |

### Services / utils

| File | Job |
|------|-----|
| `services/dashboardApi.js` | Frontend HTTP client for `/api/dashboard/*` (list, save, publish, preview, live widgets, …). |
| `utils/floatingLayoutEngine.js` | Pixel box math: place, clone beside, sanitize `layout_px`, scale for phone width. |
| `utils/dashboardLayoutEngine.js` | Older/grid helpers still used for publish packing, nested metrics, and live fallbacks. |
| `utils/dashboardDbSources.js` | Labels / keys for Postgres vs ERP MSSQL vs HRMS MSSQL. |
| `utils/widgetQuery.js` | Detects empty placeholder queries vs real SQL. |
| `utils/dashboardFilterAccess.js` | Who can filter dashboards by user; builds runtime date/user/FY filters. |
| `utils/appNavPages.js` | Nav pages used for widget “Page Access” targeting. |

### Core touchpoints outside the feature folder

| File | Role for dashboard |
|------|--------------------|
| `core/utils/appHotkeys.js` | Save chord + publish chord swallow so the browser does not steal keys. |
| `core/utils/pwa.js` | `getListHotkeyParts` — Ctrl+Alt+key in browser, Ctrl+key in PWA. |
| `core/layouts/QuickAccessBar.js` | Shows builder shortcuts only to Super Admin; dashboard filters on live pages. |
| `core/layouts/Navbar.js` | `data-app-top-chrome` so the floating panel can sit below the sticky header. |

---

## 7. Backend files

Base folder: `backend/src/apps/dashboard/`  
Mounted at **`/api/dashboard`**.

| File | Job |
|------|-----|
| `routes/index.js` | Route table. Builder APIs need Super Admin; live dashboard APIs need any logged-in user. |
| `controllers/dashboard.controller.js` | Request handlers: tables/columns, widget CRUD, preview SQL, save draft, publish, clone, live widgets. |
| `models/dashboardConfig.model.js` | Reads/writes `mst_dashboard_configs` (list by app, upsert, audience, deactivate, …). |
| `config/initDB.js` | Boots dashboard DB pieces on server start. |
| `config/tables/dashboardConfig.table.js` | Creates `mst_dashboard_configs` if missing. |
| `utils/dashboardJsonSchema.js` | Normalize / store / runtime-map the big JSON document (widgets, meta, layouts, id remap from `tmp_*`). |
| `utils/queryExecutor.js` | Runs widget SELECT against Postgres or external MSSQL with runtime filters. |
| `utils/sqlGenerator.js` | SELECT-only check + safety `LIMIT`. |
| `utils/widgetQuery.js` | Placeholder / “has real query” helpers (server side). |
| `utils/externalMssqlQuery.js` | ERP / HRMS MSSQL wiring, placeholders, validation. |
| `utils/erpMssqlQuery.js` | Thin aliases over the external MSSQL helpers. |

### Main APIs

**Super Admin (builder)**

- `GET /tables`, `GET /columns/:table`
- `POST /widgets/list`, `POST /widgets`, `PUT /widgets/:id`, `DELETE /widgets/:id`
- `POST /widgets/preview`
- `POST /configs/save-draft`, `/publish`, `/unpublish`, `/delete`, `/clone-users`, `/list`, `/rename`

**Any authenticated user (live)**

- `POST /dashboard/user-dashboards`
- `POST /dashboard/status`
- `POST /dashboard/widgets` — returns permission-filtered widgets + layouts and executes queries as needed

Allowed `app_key` values: `home`, `ims`, `task`, `settings`.  
DB sources: `ims_postgresql`, `erp_mssql`, `hrms_mssql`.

Query placeholders supported in SQL text: `{{fromDate}}`, `{{toDate}}`, `{{userId}}`, `{{fyuid}}`.

---

## 8. Database

There is **one** dashboard table. Widgets are **not** separate rows.

### Table: `mst_dashboard_configs`

| Column | Type | Meaning |
|--------|------|---------|
| `id` | serial | Row id |
| `dashboard_json` | jsonb | Entire dashboard document |
| `created_at` | timestamp | Created |
| `updated_at` | timestamp | Last save |

GIN index on `dashboard_json` for JSON lookups.

### What lives inside `dashboard_json`

```text
{
  version: 1,
  meta: {
    appKey, pageKey, pageModule,
    dashboardKey, dashboardName,
    scope: "global" | "users",
    targetUserIds: [],
    defaultForUserIds: [],
    published: true/false,
    active: true/false,
    updatedAt, updatedBy
  },
  widgets: [ /* each widget object */ ],
  layout_px: [ { i, left, top, width, height } ],          // laptop
  canvas_width: number | null,
  layout_px_mobile: [ { i, left, top, width, height } ], // phone
  canvas_width_mobile: number | null
}
```

### Typical widget fields (stored)

- Identity: `id`, `rawType` / `type`, `title`, `description`
- Data: `query`, `dataSource`, `erpFilter`, `emptyText`
- Nesting: `sectionId` / container id, `nestedLayoutPx`, `mobileNestedLayoutPx`, presets
- Layout: grid-ish `layout` / `mobileLayout` (legacy), locks, device target
- Style: colors, fonts, padding, `boxPx`, chart/table options
- Targeting: page module / page key for “who sees this widget”

Widget builder types: **kpi**, **table**, **graph**, **heading**, **container**.

---

## 9. Laptop vs phone (design rule)

| Mode | What you edit | What gets saved |
|------|----------------|-----------------|
| Laptop | Desktop canvas | `layout_px`, `style.boxPx`, `nestedLayoutPx` |
| Phone | 390px phone frame | `layout_px_mobile`, mobile nested px |

Publish only writes phone top-level layout when the phone layout was actually customized. Live phone prefers phone layout; if missing, laptop layout is scaled into the phone width as a fallback.

---

## 10. Recent product fixes (this workstream)

Worth knowing so future changes do not undo them:

1. **WYSIWYG** — published view should match what you designed (no clever auto-reflow that fights the canvas).
2. **Phone / laptop isolation** — edits on one device store must not stamp the other.
3. **Style hang fix** — Property Panel style updates are style-only + debounced (no max update depth loop).
4. **Toolbar** — slim one-row bar; Add is a dropdown; Save / Publish stay pinned on the right; widgets strip is optional.
5. **Floating panel** — opens below sticky app chrome so the header does not cover “Widget Builder”.
6. **Hotkeys** — Save / Publish wired with refs **above** early access returns (avoids React hooks crash).

---

## 11. About the yellow “ERP (IMS) data could not be loaded” toast

This is **not** a Dashboard Builder bug.

- Postman hitting the **internal IMS API** can return `success: true` and records.
- Our ERP backend may still attach `ims_meta.ok = false` on **some other** IMS call in the same session (timeout, different `requestedData`, env URL mismatch, etc.).
- Frontend `apiClient` shows a warning toast when it sees that meta.

Widget SQL Server / Postgres results can still show numbers on the canvas while that toast appears. Treat it as an IMS link warning, not as “dashboard save failed”.

---

## 12. Safe change checklist (for future you)

- Keep `react-rnd` for the live floating builder.
- Do not uninstall `react-grid-layout` until legacy branches + `ContainerNestedGrid` are removed and tested.
- Never write phone layout into laptop stores (or reverse) without an explicit migration.
- Prefer style-only patches from Property Panel; avoid full widget replace on every color tick.
- Keep save/publish hotkey `useEffect` **above** any early `return` in `DashboardBuilder`.
- Keep floating panel min-top below `[data-app-top-chrome]` + builder toolbar.

---

## 13. One-paragraph summary

Super Admin designs dashboards at `/settings/dashboard-builder` on a floating pixel canvas (`react-rnd`), saves draft or publishes into Postgres table `mst_dashboard_configs.dashboard_json` (widgets + `layout_px` / `layout_px_mobile`), then users open app dashboard routes where `DashboardBuilder` runs read-only, loads `/api/dashboard/dashboard/widgets`, and executes each widget query against Postgres or MSSQL. Old floating/grid experiment files were removed; `react-grid-layout` remains only as a dormant legacy path so we do not break imports.
