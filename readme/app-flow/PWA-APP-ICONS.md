# PWA / portal app icons

How to add or change app icons used by **PWA shortcuts**, **push notifications**, and (visually) the **9-dot JFL APPS** launcher.

## Files

| What | Path |
|------|------|
| Icon images | `frontend/public/push-icons/{id}.svg` |
| Icon map + shortcut list | `frontend/src/config/appIcons.js` |
| PWA manifest | `frontend/public/manifest.webmanifest` |
| 9-dot launcher apps | `frontend/src/config/appsRegistry.js` |
| Push brand (FE) | `frontend/src/config/pushAppBrand.js` |
| Push brand (BE) | `backend/src/config/push/pushAppBrand.js` |
| Service worker cache | `frontend/public/sw.js` (`STATIC_ASSETS` + bump `CACHE_NAME`) |

Current apps: **home**, **ims**, **rmstore**, **task**, **hrms**, **purchase**, **production**, **engineering**, **settings** (+ **core** = same as settings for push).

Icons match Lucide (same glyphs as the launcher). Style: colored rounded square + white stroke icon, 192×192.

---

## Add a new app icon

Example: new app id `crm`.

### 1. Create the SVG

Add:

`frontend/public/push-icons/crm.svg`

Copy an existing icon (e.g. `task.svg`), change:

- Gradient colors (match launcher accent)
- Inner white paths → use the same Lucide icon as in `appsRegistry.js`

### 2. Register in `appIcons.js`

```js
// APP_ICONS
crm: "/push-icons/crm.svg",

// PWA_SHORTCUTS
{ id: "crm", name: "CRM", shortName: "CRM", url: "/crm/dashboard" },
```

### 3. Add PWA shortcut in `manifest.webmanifest`

```json
{
  "name": "CRM",
  "short_name": "CRM",
  "description": "Open CRM",
  "url": "/crm/dashboard?mode=standalone",
  "icons": [{ "src": "/push-icons/crm.svg", "sizes": "192x192", "type": "image/svg+xml" }]
}
```

### 4. Add launcher entry in `appsRegistry.js`

Same `id`, Lucide `icon`, `href`, `accent`, `inLauncher: true` (and access rules as for other apps).

### 5. Push branding

**FE** `pushAppBrand.js`:

```js
crm: { label: "CRM", icon: APP_ICONS.crm, badge: APP_ICONS.crm, defaultUrl: "/crm/dashboard" },
```

**BE** `pushAppBrand.js` — same path `/push-icons/crm.svg` in `ICONS` + `PUSH_APP_BRAND`.

### 6. Service worker

In `sw.js`:

- Add `"/push-icons/crm.svg"` to `STATIC_ASSETS`
- Bump `CACHE_NAME` (e.g. `v48` → `v49`) so clients pick up the new file
- If needed, map `crm` in `pushIconForAppType`

---

## Change an existing icon only

1. Replace `frontend/public/push-icons/{id}.svg`
2. Bump `CACHE_NAME` in `sw.js`

No path changes needed if the filename stays the same.

---

## Short checklist

```
push-icons/{id}.svg
  → appIcons.js (APP_ICONS + PWA_SHORTCUTS)
  → manifest.webmanifest (shortcuts)
  → appsRegistry.js (launcher)
  → pushAppBrand.js (FE + BE)
  → sw.js (cache + version)
```

Full new-app setup (routes, modules, permissions): see [ADD-NEW-APP-STEPS.md](./ADD-NEW-APP-STEPS.md).
