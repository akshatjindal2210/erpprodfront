/**
 * App configuration tabs — each tab comes from that app's config file.
 */
import { IMS_APP_CONFIG } from "@/apps/ims/lib/config/app.config";
import { RMSTORE_APP_CONFIG } from "@/apps/rmstore/lib/config/app.config";
import { TASK_APP_CONFIG } from "@/apps/task/lib/config/settingsApp.config";
import {
  ADMIN_CONSOLE_APP_CONFIG,
  SHORTCUT_APP_CONFIG,
} from "@/apps/settings/configuration/config/globalApp.config";

export const APP_CONFIG_TABS = [
  ADMIN_CONSOLE_APP_CONFIG.tab,
  IMS_APP_CONFIG.tab,
  RMSTORE_APP_CONFIG.tab,
  TASK_APP_CONFIG.tab,
  SHORTCUT_APP_CONFIG.tab,
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
