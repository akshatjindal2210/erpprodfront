/**
 * App configuration tabs — new app: add id + label, join form in panel map.
 */
export const APP_CONFIG_TABS = [
  { id: "ims", label: "IMS" },
  { id: "task", label: "Task" },
];

export const DEFAULT_APP_CONFIG_TAB = APP_CONFIG_TABS[0]?.id ?? "ims";

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
