import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/engineering/lib/config/endpoints";
import { withSortedViewsData } from "@/apps/ims/lib/helpers/sortDropdownResponse";

function missingHelperPage(method) {
  return Promise.resolve({
    success: false,
    message: `${method}: permission_module required — pass current page (e.g. eng_machine_master)`,
    data: [],
    total: 0,
  });
}

export const processMasterService = {
  getAll: (params) => api(ENDPOINTS.PROCESS_MASTER.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.PROCESS_MASTER.GET, { method: "POST", body: { id } }),
  create: (data) => api(ENDPOINTS.PROCESS_MASTER.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.PROCESS_MASTER.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(ENDPOINTS.PROCESS_MASTER.DELETE, { method: "POST", body: { id } }),
  /** Dropdown helper — requires permission_module + permission_action from the calling page. */
  getViews: (params = {}) => {
    const { permission_module, permission_action = "view", ...rest } = params;
    if (!permission_module) return missingHelperPage("getViews");
    return api(ENDPOINTS.PROCESS_MASTER.HELPER, {
      method: "POST",
      body: { permission_module, permission_action, ...rest },
    }).then((res) => {
      const list = Array.isArray(res?.data) ? res.data : [];
      const sorted = withSortedViewsData({ data: list, total: res?.total }, "label");
      return { data: sorted?.data ?? list, total: res?.total ?? list.length };
    });
  },
  /** Resolve one process for SearchableSelect via helper (no eng_process_master.view needed). */
  getViewById: async (id, perms = {}) => {
    const { permission_module, permission_action = "view" } = perms;
    if (!permission_module) return missingHelperPage("getViewById");
    const res = await api(ENDPOINTS.PROCESS_MASTER.HELPER, {
      method: "POST",
      body: { permission_module, permission_action, id },
    });
    const row = Array.isArray(res?.data) ? res.data[0] : null;
    return row ? { success: true, data: row } : { success: false, data: null };
  },
};
