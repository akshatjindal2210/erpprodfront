import { ROUTES as IMS_ROUTES } from "@/features/apps/ims/utils/routes";
import { ROUTES as TASK_ROUTES } from "@/features/apps/task/utils/routes";
import { ROUTES as SETTINGS_ROUTES } from "@/features/admin/configuration/utils/routes";

/** Portal — all app routes in one place (launcher, navbar, guards). */
export const ROUTES = {
  HOME: "/home",
  ACTIVITY_LOGS: "/home/activity-logs",
  ...IMS_ROUTES,
  ...TASK_ROUTES,
  ...SETTINGS_ROUTES,
};

