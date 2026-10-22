import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/engineering/lib/config/endpoints";
import { createProductionErpHelpers } from "@/apps/rmstore/lib/services/production";

const EP = ENDPOINTS.PRIME_ITEM_MASTER;

/** Prime process plans — eng_item_process type "prime" (one row per prime item). */
export const primeItemMasterService = {
  getAll: (params) => api(EP.LIST, { method: "POST", body: params }),
  getById: (id) => api(EP.GET, { method: "POST", body: { id } }),
  /** The prime item's saved prime (data null when none). */
  getByItem: (item_dcode) => api(EP.GET, { method: "POST", body: { item_dcode } }),
  /** Body `{ item_dcode, process: { stages } }` — insert or update the item's prime. */
  create: (data) => api(EP.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(EP.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(EP.DELETE, { method: "POST", body: { id } }),
  approve: (id, approved = true) => api(EP.APPROVE, { method: "POST", body: { id, approved } }),
};

/** IMS item pickers only (prime item, RM). */
export const primeItemMasterHelpers = createProductionErpHelpers(EP);
