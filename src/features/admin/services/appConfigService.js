import { api } from "@/core/api/apiClient";
import { CORE_ENDPOINTS as ENDPOINTS } from "@/core/api/endpoints";

/** Runtime config (`/api/app-config/*`) — global admin console or per-app scope. */
export const appConfigService = {
  list: (app) =>
    api(ENDPOINTS.APP_CONFIG.LIST, {
      method: "POST",
      body: {
        app,
        permission_module: "app_configuration",
        permission_action: "view",
      },
    }),
  update: (config_key, config_value) =>
    api(ENDPOINTS.APP_CONFIG.UPDATE, {
      method: "PUT",
      body: {
        config_key,
        config_value,
        permission_module: "app_configuration",
        permission_action: "edit",
      },
    }),
};

