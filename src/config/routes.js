import { ROUTES as IMS_ROUTES } from "@/apps/ims/lib/utils/routes";
import { ROUTES as TASK_ROUTES } from "@/apps/task/lib/utils/routes";
import { ROUTES as SETTINGS_ROUTES } from "@/apps/settings/configuration/utils/routes";
import { ROUTES as RM_STORE_ROUTES } from "@/apps/rmstore/lib/utils/routes";
import { ROUTES as HRMS_ROUTES } from "@/apps/hrms/lib/utils/routes";

/** Portal — all app routes in one place (launcher, navbar, guards). */
export const ROUTES = {
  HOME: "/home",
  ACTIVITY_LOGS: "/home/activity-logs",
  ...IMS_ROUTES,
  ...RM_STORE_ROUTES,
  ...TASK_ROUTES,
  ...HRMS_ROUTES,
  ...SETTINGS_ROUTES,
};

