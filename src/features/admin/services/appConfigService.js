import { api } from "@/core/api/apiClient";
import { CORE_ENDPOINTS as ENDPOINTS } from "@/core/api/endpoints";

/** IMS-backed runtime config (`/api/app-config/*`). */
export const appConfigService = {
  list: () => api(ENDPOINTS.APP_CONFIG.LIST, { method: "POST", body: {} }),
  update: (config_key, config_value) =>
    api(ENDPOINTS.APP_CONFIG.UPDATE, { method: "PUT", body: { config_key, config_value } }),
};

