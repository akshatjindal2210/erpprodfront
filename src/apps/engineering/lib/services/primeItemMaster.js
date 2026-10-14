import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/engineering/lib/config/endpoints";
import { createProductionErpHelpers } from "@/apps/rmstore/lib/services/production";

const EP = ENDPOINTS.PRIME_ITEM_MASTER;

/** List / get reuse production table; create/update/delete only touch `prime_process` JSON. */
export const primeItemMasterService = {
  getAll: (params) => api(EP.LIST, { method: "POST", body: params }),
  getById: (production_id) => api(EP.GET, { method: "POST", body: { production_id } }),
  /** Insert or update full prime_process JSON on existing Item RM row. */
  create: (data) => api(EP.CREATE, { method: "POST", body: data }),
  update: (production_id, data) => api(EP.UPDATE, { method: "POST", body: { production_id, ...data } }),
  /** Clears prime_process only (does not delete Item RM row). */
  delete: (production_id) => api(EP.DELETE, { method: "POST", body: { production_id } }),
};

export const primeItemMasterHelpers = createProductionErpHelpers(EP);
