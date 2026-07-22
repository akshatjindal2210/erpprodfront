# Dashboard Builder

Human-readable map of how the **Dashboard Builder** works: end-to-end flow, laptop vs phone, containers, save/publish, live view, and the main frontend / backend / database pieces.

Related: [HYBRID_TEMP_TABLES.md](./HYBRID_TEMP_TABLES.md) for Hybrid (ERP/HRMS + Postgres) widgets.

---

## 1. What this feature is

The Dashboard Builder lets a **Super Admin** design dashboards (KPI, table, graph, heading, container, hybrid) for apps such as Home, IMS, Task, and Admin Console.

- Design on **laptop** and optionally again on **phone** (layouts stay separate).
- **Save draft**, then **Publish** so normal users see it on live dashboard pages.
- Widget data from **Postgres (IMS)**, **SQL Server (ERP / HRMS)**, or **Hybrid** (MSSQL + Postgres merge).

Live users never open the builder. They open `/home`, `/ims/dashboard`, etc., and see the published layout only.

---

## 2. End-to-end flow (A → Z)

```text
Super Admin
  → /settings/dashboard-builder
  → pick App + Dashboard
  → add widgets (KPI / table / graph / heading / container)
  → laptop canvas: drag / resize (floating pixels)
  → optional phone mode: separate layout_px_mobile
  → nest widgets inside containers (floating nested canvas)
  → Preview / style in Widget Builder panel
  → Ctrl+Z / Ctrl+Y undo-redo (layout + config; data rows reattached)
  → Save Draft  (Ctrl+S)
  → Publish     (Ctrl+Alt+U in browser, Ctrl+U in PWA)
  → stored in mst_dashboard_configs.dashboard_json

Normal user
  → /home | /ims/dashboard | /task/dashboard | /settings/dashboard
  → read-only DashboardBuilder
  → POST /api/dashboard/dashboard/widgets
  → permission-filtered widgets + layout_px / layout_px_mobile
  → each widget query runs (Postgres / MSSQL / Hybrid)
  → same floating canvas paint (WYSIWYG with builder)
```

### Keyboard shortcuts (builder only)

| Action | Browser | PWA |
|--------|---------|-----|
| Save Draft | Ctrl+S | Ctrl+S |
| Publish | Ctrl+Alt+U | Ctrl+U |
| Undo / Redo | Ctrl+Z / Ctrl+Y | same |

---

## 3. Active layout mode (floating only)

Hardcoded flag:

- `USE_FLOATING_BUILDER = true` in `DashboardBuilder.js`

Today the canvas is **always** floating pixels (`react-rnd`):

| Surface | Component |
|---------|-----------|
| Top-level canvas | `SimpleBuilderCanvas` |
| Nested widgets inside a container | `SimpleNestedCanvas` (via `WidgetRenderer`) |

Published positions live as pixel boxes:

- Laptop: `layout_px`, per-widget `style.boxPx`, container `nestedLayoutPx`
- Phone: `layout_px_mobile`, `mobileNestedLayoutPx`

Phone and laptop stores are **isolated**. Editing phone must not rewrite laptop boxes, and the reverse.

Legacy `react-grid-layout` CSS / measurement helpers may still appear for width measurement and older grid fields used on publish fallback. The interactive RGL canvas and `ContainerNestedGrid` path have been removed.

---

## 4. Builder UX rules (current behaviour)

### Top-level widgets

- Drag / resize anywhere on the widget body (except cancelled chrome buttons).
- Selected widget shows toolbar: **Move grip**, Edit, Clone, Delete (and Send to bottom when applicable).

### Containers

- Nested children fill most of the shell, so the container moves only from the **Move** grip.
- Hover the container → toolbar appears (Move, Edit, Clone, Delete). Cursor becomes grab on Move.
- **Container height does not auto-grow** when you select, add, or drag nested widgets. The shell stays at the height you set; nested content is clipped inside.
- Nested widgets select / drag / resize on their own without stealing the parent’s size.

### Nested widgets

- Click selects the child (not the parent).
- Resize one nested widget must **not** rewrite sibling sizes (commits use source boxes, not display-fitted coords).
- Clone inside a container prefers a free slot below / beside; preview rows are copied and quiet-previewed.

### Undo / redo

- History snapshots omit heavy `data` / `previewData` for speed.
- On undo/redo, rows are reattached from live widgets **or** a runtime cache by id (so delete → undo does not blank KPIs).

### Window resize

- Canvas keeps the last good measured width; it must not remount blank when the host briefly reports a tiny width.

---

## 5. Laptop vs phone

| Mode | What you edit | What gets saved |
|------|----------------|-----------------|
| Laptop | Desktop floating canvas | `layout_px`, `style.boxPx`, `nestedLayoutPx` |
| Phone | ~390px phone frame | `layout_px_mobile`, `mobileNestedLayoutPx` |

Phone constants (engine):

- Outer frame ~390px, content width with bezel inset, equal side gutters (`PHONE_FRAME_INSET`).

Publish includes phone top-level layout when mobile px exists / phone was customized. Live phone prefers phone layout; if missing, laptop layout is scaled into the phone width as a fallback.

---

## 6. Save draft / publish flow

```text
buildDashboardJsonPayload()
  → widgets (normalized, no preview rows)
  → layout_px (+ layout_px_mobile when present)
  → canvas_width / canvas_width_mobile
  → POST /configs/save-draft  or  /configs/publish

Backend
  → CORS headers first (so size/parse errors are visible to the browser)
  → JSON body limit 100mb (dashboard payloads + large configs)
  → remapDashboardWidgetIds(tmp_* → w_*)
       including nestedLayoutPx, mobileNestedLayoutPx, layout_px_mobile
  → upsert mst_dashboard_configs.dashboard_json
```

If Save/Publish shows “Server not responding” with `(failed)` network entries, check backend is up and the reverse proxy body size limit matches (Express accepts up to 100mb).

After a successful draft save, the builder reloads widgets so local `tmp_*` ids become persisted ids.

---

## 7. Live (published) view

1. User opens app dashboard route with `readOnly`.
2. `POST /dashboard/widgets` returns widgets the user may see + layouts.
3. Permission-hidden widgets are omitted; remaining floating boxes may pack gaps so holes close without changing designer spacing when nothing was filtered.
4. Empty containers (no visible children) are hidden on publish without reflowing siblings on laptop WYSIWYG.
5. Laptop live uses 1:1 design pixels + horizontal scroll (same as builder). Phone live fits to measured frame width.

---

## 8. Frontend pages

| Route | What it does |
|-------|----------------|
| `/settings/dashboard-builder` | **Edit mode** (Super Admin). Full toolbar, panel, save / publish. |
| `/ims/dashboard/builder` | Redirects to `/settings/dashboard-builder`. |
| `/home` | Live Home dashboard (`readOnly`, `appKey="home"`). |
| `/ims/dashboard` | Live IMS dashboard. |
| `/task/dashboard` | Live Task dashboard. |
| `/settings/dashboard` | Live Admin Console dashboard. |

Related:

- `QuickAccessBar` — dashboard picker / filters / keyboard shortcut help (builder shortcuts for Super Admin).
- Empty published state uses shared `DashboardHome` when nothing is published.

---

## 9. Frontend files

Base: `frontend/src/features/dashboard-builder/`

### Components

| File | Job |
|------|-----|
| `DashboardBuilder.js` | Edit + live modes, toolbar, undo/redo + runtime data cache, dirty guard, laptop/phone switch, save / publish / clone, hotkeys, canvas host. |
| `SimpleBuilderCanvas.js` | Top-level floating canvas (`react-rnd`). Container Move via hover toolbar grip. |
| `SimpleNestedCanvas.js` | Nested floating canvas inside containers. |
| `simpleBuilderChrome.js` | Selection outline, resize handles, widget toolbar (Move / Edit / Clone / Delete). |
| `WidgetRenderer.js` | KPI / table / graph / heading / container / hybrid display; nested host for `SimpleNestedCanvas`. |
| `WidgetBuilderPanel.js` | Floating / docked shell around the property editor. |
| `PropertyPanel.js` | DATA + STYLE (+ Hybrid steps); debounced style patches. |
| `DashboardAudienceUserSelect.js` | Multi-user picker for user-scoped / clone dashboards. |

### Services / utils

| File | Job |
|------|-----|
| `services/dashboardApi.js` | HTTP client for `/api/dashboard/*`. |
| `utils/floatingLayoutEngine.js` | Pixel box math: sanitize, clone, phone gutters, merge `layout_px`, gap pack. |
| `utils/dashboardLayoutEngine.js` | Grid/publish helpers still used for legacy fields and packing fallbacks. |
| `utils/dashboardDbSources.js` | Postgres / ERP / HRMS / Hybrid source keys. |
| `utils/widgetQuery.js` | Empty placeholder vs real SQL. |
| `utils/dashboardFilterAccess.js` | Who can filter by user; runtime date/user/FY filters. |
| `utils/appNavPages.js` | Nav pages for widget page-access targeting. |
| `utils/tableToolbar.js` | Table search align / width helpers. |

### Core touchpoints

| File | Role |
|------|------|
| `core/api/apiClient.js` | Fetch wrapper; IMS / “Server not responding” toasts. |
| `core/utils/appHotkeys.js` | Save / publish chord handling. |
| `core/utils/pwa.js` | Browser vs PWA hotkey parts. |
| `core/layouts/QuickAccessBar.js` | Builder shortcuts + live filters. |

---

## 10. Backend files

Base: `backend/src/apps/dashboard/` — mounted at **`/api/dashboard`**.

| File | Job |
|------|-----|
| `routes/index.js` | Builder APIs = Super Admin; live APIs = logged-in user. |
| `controllers/dashboard.controller.js` | Tables/columns, widget CRUD, preview, hybrid preview, save draft, publish, clone, live widgets. |
| `models/dashboardConfig.model.js` | `mst_dashboard_configs` upsert / list / audience. |
| `utils/dashboardJsonSchema.js` | Document normalize; `tmp_*` → `w_*` remap (including mobile nested px). |
| `utils/queryExecutor.js` | Widget SELECT (Postgres / MSSQL / Hybrid). |
| `utils/hybridQueryEngine.js` | Session TEMP + merge for Hybrid. |
| `utils/sqlGenerator.js` | SELECT-only + safety LIMIT. |
| `utils/externalMssqlQuery.js` | ERP / HRMS MSSQL helpers. |

App body parser (`backend/src/index.js`): CORS first, then `express.json` / urlencoded with **100mb** limit (`config.bodyParserLimit`).

### Main APIs

**Super Admin (builder)**

- `GET /tables`, `GET /columns/:table`
- `POST /widgets/list`, `POST /widgets`, `PUT /widgets/:id`, `DELETE /widgets/:id`
- `POST /widgets/preview`, `POST /widgets/hybrid-preview`
- `POST /configs/save-draft`, `/publish`, `/unpublish`, `/delete`, `/clone-users`, `/list`, `/rename`

**Any authenticated user (live)**

- `POST /dashboard/user-dashboards`
- `POST /dashboard/status`
- `POST /dashboard/widgets`

Allowed `app_key`: `home`, `ims`, `task`, `settings`.  
DB sources: `ims_postgresql`, `erp_mssql`, `hrms_mssql`, `hybrid`.

SQL placeholders: `{{fromDate}}`, `{{toDate}}`, `{{userId}}`, `{{fyuid}}`, and Hybrid `{{temp_erp_data}}`.

---

## 11. Database

One table. Widgets are **not** separate rows.

### Table: `mst_dashboard_configs`

| Column | Type | Meaning |
|--------|------|---------|
| `id` | serial | Row id |
| `dashboard_json` | jsonb | Entire dashboard document |
| `created_at` | timestamp | Created |
| `updated_at` | timestamp | Last save |

### Shape inside `dashboard_json`

```text
{
  version: 2,
  meta: {
    appKey, pageKey, pageModule,
    dashboardKey, dashboardName,
    scope: "global" | "users",
    targetUserIds: [],
    defaultForUserIds: [],
    published, active,
    updatedAt, updatedBy
  },
  widgets: [ /* widget objects */ ],
  layout_px: [ { i, left, top, width, height } ],
  canvas_width: number | null,
  layout_px_mobile: [ { i, left, top, width, height } ],
  canvas_width_mobile: number | null
}
```

### Typical widget fields

- Identity: `id`, `rawType` / `type`, `title`, `description`
- Data: `query`, `dataSource`, `erpFilter`, `emptyText`, Hybrid `chart_config`
- Nesting: `sectionId` / container id, `nestedLayoutPx`, `mobileNestedLayoutPx`
- Layout: legacy grid `layout` / `mobileLayout`, locks, device target
- Style: colors, fonts, padding, `boxPx`, chart/table options
- Targeting: page module / page key for visibility

Builder types: **kpi**, **table**, **graph**, **heading**, **container**, **hybrid**.

---

## 12. Product fixes to preserve

Do not regress these without an explicit decision:

1. **WYSIWYG laptop** — builder and publish use the same 1:1 pixel layout + horizontal scroll.
2. **Phone / laptop isolation** — never stamp one store into the other by accident.
3. **Container height** — user-set height stays fixed; nested select/add/drag must not auto-grow the shell.
4. **Sibling nested sizes** — resizing one nested widget must not rescale siblings.
5. **Undo data** — undo/redo must not blank KPI/table numbers (runtime cache merge).
6. **Id remap** — save/publish remaps `tmp_*` in `layout_px`, `layout_px_mobile`, and nested px lists.
7. **IMS toast** — only when the request failed or returned no usable primary data.
8. **Style panel** — debounced style-only patches (no max-update-depth loops).
9. **Hotkeys** — save/publish effects registered above any early access `return`.

---

## 13. About the yellow toasts

### “ERP (IMS) data could not be loaded”

From `apiClient` when `ims_meta.ok = false`.

- **Show** when the request failed because of IMS, or succeeded with **no usable primary data**.
- **Do not show** when the page already has usable content (e.g. KPI/table rows present) despite a secondary IMS failure.

### “Server not responding…”

From `apiClient` when fetch never got an HTTP response (network / backend down / CORS-hidden parse error).

- Restart backend after body-limit / CORS order changes.
- Confirm Save/Publish status in DevTools (real 413 vs `(failed)`).

Failed widgets still show in-widget errors separately.

---

## 14. Safe change checklist

- Keep `react-rnd` as the interactive canvas.
- Do not reintroduce RGL nested grids or auto-growing container shells without product sign-off.
- Never write phone layout into laptop stores (or reverse) without an explicit migration.
- Prefer style-only Property Panel patches; avoid full widget replace on every color tick.
- Keep save/publish hotkey `useEffect` **above** early returns in `DashboardBuilder`.
- Keep floating panel below `[data-app-top-chrome]` + builder toolbar.
- After changing Express body limits, restart backend and align any reverse-proxy max body size.

---

## 15. One-paragraph summary

Super Admin designs dashboards at `/settings/dashboard-builder` on a floating pixel canvas (`SimpleBuilderCanvas` / `SimpleNestedCanvas` + `react-rnd`), keeps laptop and phone layouts separate, saves draft or publishes into `mst_dashboard_configs.dashboard_json` (widgets + `layout_px` / `layout_px_mobile`), then users open app dashboard routes where read-only `DashboardBuilder` loads `/api/dashboard/dashboard/widgets` and runs each widget query against Postgres, MSSQL, or Hybrid. Container shells keep user-defined size; nested interactions and undo/redo preserve layout and visible data without regenerating old grid behaviour.
