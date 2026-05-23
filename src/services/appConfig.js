import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const appConfigService = {
  /** Super admin only */
  list: () => api(ENDPOINTS.APP_CONFIG.LIST, { method: "POST", body: {} }),
  update: (config_key, config_value) => api(ENDPOINTS.APP_CONFIG.UPDATE, { method: "PUT", body: { config_key, config_value } }),
};
