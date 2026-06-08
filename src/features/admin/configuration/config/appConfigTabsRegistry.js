/**
 * App configuration tabs — global admin console + per-app settings.
 */
export const APP_CONFIG_TABS = [
  { id: "admin-console", label: "Admin Console", group: "global" },
  { id: "ims", label: "IMS", group: "app" },
  { id: "task", label: "Task", group: "app" },
];

export const DEFAULT_APP_CONFIG_TAB = APP_CONFIG_TABS[0]?.id ?? "admin-console";

const TAB_IDS = new Set(APP_CONFIG_TABS.map((t) => t.id));

export function isAppConfigTabId(id) {
  return id != null && TAB_IDS.has(String(id));
}

export function resolveAppConfigTab(id) {
  const key = String(id ?? "").trim();
  if (isAppConfigTabId(key)) return key;
  return DEFAULT_APP_CONFIG_TAB;
}

export function parseAppConfigTabFromSearchParams(searchParams) {
  const raw = searchParams?.get?.("app") ?? searchParams?.get?.("tab");
  return resolveAppConfigTab(raw);
}

export function buildAppConfigTabHref(appId) {
  const id = resolveAppConfigTab(appId);
  if (id === DEFAULT_APP_CONFIG_TAB) return "/settings/app-configuration";
  return `/settings/app-configuration?app=${encodeURIComponent(id)}`;
}
