import { api } from "@/platform/api/apiClient";
import { withSortedViewsData } from "@/apps/rmstore/lib/helpers/sortDropdownResponse";

/** Shared ERP master helpers (items / ledgers) — same `/master/...` routes as IMS. */
const MASTER = {
  ITEMS_VIEWS: "/master/items/helper",
  LEDGERS_VIEWS: "/master/ledgers/helper",
};

function missingHelperPage(method) {
  return {
    success: false,
    message: "Could not load the list because this page is not configured correctly. Please contact your administrator.",
    data: [],
    total: 0,
  };
}

export const erpMasterHelpers = {
  getItemsViews: async (params = {}) => {
    const { permission_module, permission_action = "view", ...rest } = params;
    if (!permission_module) return missingHelperPage("getItemsViews");
    const res = await api(MASTER.ITEMS_VIEWS, {
      method: "POST",
      body: { permission_module, permission_action, ...rest },
    });
    return withSortedViewsData(res, "item_code");
  },
  getItemViewById: (id, perms = {}) => api(MASTER.ITEMS_VIEWS, { method: "POST", body: { id, ...perms } }),
  getLedgersViews: async (params = {}) => {
    const { permission_module, permission_action = "view", ...rest } = params;
    if (!permission_module) return missingHelperPage("getLedgersViews");
    const res = await api(MASTER.LEDGERS_VIEWS, {
      method: "POST",
      body: { permission_module, permission_action, ...rest },
    });
    return withSortedViewsData(res, "acc_name");
  },
  getLedgerViewById: (id, perms = {}) => api(MASTER.LEDGERS_VIEWS, { method: "POST", body: { id, ...perms } }),
};
