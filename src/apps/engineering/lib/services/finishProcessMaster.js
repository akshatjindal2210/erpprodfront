import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/engineering/lib/config/endpoints";
import { createProductionErpHelpers } from "@/apps/rmstore/lib/services/production";

const EP = ENDPOINTS.FINISH_PROCESS_MASTER;

/** FG process plans — eng_item_process type "fg" (one row per FG item, on its prime item's prime). */
export const finishProcessMasterService = {
  getAll: (params) => api(EP.LIST, { method: "POST", body: params }),
  getById: (id) => api(EP.GET, { method: "POST", body: { id } }),
  /** The FG item's row, or a draft (id null) with its prime item's prime. */
  getByItem: (item_dcode) => api(EP.GET, { method: "POST", body: { item_dcode } }),
  /** Body `{ item_dcode, process: { stages } }` — insert or update the item's FG process. */
  create: (data) => api(EP.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(EP.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(EP.DELETE, { method: "POST", body: { id } }),
};

/** IMS item pickers only (FG item, RM). */
export const finishProcessMasterHelpers = createProductionErpHelpers(EP);
