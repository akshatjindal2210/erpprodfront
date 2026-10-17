import { ENDPOINTS } from "@/apps/production/lib/config/endpoints";
import { api } from "@/platform/api/apiClient";

export const toolingService = {
  list: (surface = "pending") =>
    api(ENDPOINTS.TOOLING.LIST, { method: "POST", body: { surface } }),
  save: (primeKey, tooling, remark) =>
    api(ENDPOINTS.TOOLING.SAVE, { method: "POST", body: { prime_key: primeKey, tooling, remark } }),
  delete: (primeKey) =>
    api(ENDPOINTS.TOOLING.DELETE, { method: "POST", body: { prime_key: primeKey } }),
};
