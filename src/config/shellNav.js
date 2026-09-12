/**
 * Resolves sidebar nav per app shell — keeps app-specific nav imports out of RootLayout.
 */
import { NAV_REGISTRY } from "@/apps/ims/lib/config/navRegistry";
import { SETTINGS_NAV_REGISTRY } from "@/apps/settings/configuration/config/settingsNavRegistry";
import { TASK_NAV_REGISTRY } from "@/apps/task/lib/config/navRegistry";
import { RM_STORE_NAV_REGISTRY } from "@/apps/rmstore/lib/config/navRegistry";
import { HRMS_NAV_REGISTRY } from "@/apps/hrms/lib/config/navRegistry";
import { PURCHASE_NAV_REGISTRY } from "@/apps/purchase/lib/config/navRegistry";
import { PRODUCTION_NAV_REGISTRY } from "@/apps/production/lib/config/navRegistry";
import { canShowTaskReportMenu } from "@/apps/task/lib/config/appConfig";
import { APP_SHELL } from "@/config/appsRegistry";

export function resolveShellNavRegistry(shell, { role, userData } = {}) {
  if (shell === APP_SHELL.SETTINGS) return SETTINGS_NAV_REGISTRY;

  if (shell === APP_SHELL.TASK) {
    return TASK_NAV_REGISTRY.filter((item) => {
      if (item.href === "/task/dashboard/reports") {
        return canShowTaskReportMenu(role, userData);
      }
      return true;
    });
  }

  if (shell === APP_SHELL.RM_STORE) return RM_STORE_NAV_REGISTRY;
  if (shell === APP_SHELL.HRMS) return HRMS_NAV_REGISTRY;
  if (shell === APP_SHELL.PURCHASE) return PURCHASE_NAV_REGISTRY;
  if (shell === APP_SHELL.PRODUCTION) return PRODUCTION_NAV_REGISTRY;
  if (shell === APP_SHELL.IMS) return NAV_REGISTRY;

  return undefined;
}

export function resolveShellBrand(shell) {
  if (shell === APP_SHELL.SETTINGS) return "Settings";
  if (shell === APP_SHELL.RM_STORE) return "RM Store";
  if (shell === APP_SHELL.HRMS) return "HRMS";
  if (shell === APP_SHELL.PURCHASE) return "Purchase";
  if (shell === APP_SHELL.PRODUCTION) return "Production";
  return "ERP Portal";
}

/** Module registries scanned for route-level permission checks. */
export const ALL_SHELL_NAV_REGISTRIES = [
  NAV_REGISTRY,
  SETTINGS_NAV_REGISTRY,
  TASK_NAV_REGISTRY,
  RM_STORE_NAV_REGISTRY,
  HRMS_NAV_REGISTRY,
  PURCHASE_NAV_REGISTRY,
  PRODUCTION_NAV_REGISTRY,
];
