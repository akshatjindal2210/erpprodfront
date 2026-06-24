import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";

export const schedulePlanningService = {
  list: () =>
    api(ENDPOINTS.SCHEDULE_PLANNING.LIST, {
      method: "POST",
      body: {},
    }),
};
