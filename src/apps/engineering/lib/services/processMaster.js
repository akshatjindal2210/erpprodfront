import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/engineering/lib/config/endpoints";

function missingHelperPage(method) {
  return Promise.resolve({
    success: false,
    message: `${method}: permission_module required — pass current page (e.g. eng_machine_master)`,
    data: [],
    total: 0,
  });
}

/** Keep helper order as API returned (proccode ASC). */
function keepApiOrder(res) {
  const list = Array.isArray(res?.data) ? res.data : [];
  return { data: list, total: res?.total ?? list.length };
}

export const processMasterService = {
  getAll: (params) => api(ENDPOINTS.PROCESS_MASTER.LIST, { method: "POST", body: params }),
  getById: (proccode) => api(ENDPOINTS.PROCESS_MASTER.GET, { method: "POST", body: { proccode } }),
  create: (data) => api(ENDPOINTS.PROCESS_MASTER.CREATE, { method: "POST", body: data }),
  update: (proccode, data) => api(ENDPOINTS.PROCESS_MASTER.UPDATE, { method: "POST", body: { proccode, ...data } }),
  delete: (proccode) => api(ENDPOINTS.PROCESS_MASTER.DELETE, { method: "POST", body: { proccode } }),
  /** Dropdown helper — requires permission_module + permission_action from the calling page. Sorted by proccode ASC. */
  getViews: (params = {}) => {
    const { permission_module, permission_action = "view", ...rest } = params;
    if (!permission_module) return missingHelperPage("getViews");
    const connectivityOn = rest.filters?.connectivity === true || rest.filters?.connectivity === "true" || rest.filters?.connectivity === "1";
    return api(`${ENDPOINTS.PROCESS_MASTER.HELPER}${connectivityOn ? "?connectivity=true" : ""}`, {
      method: "POST",
      body: { permission_module, permission_action, ...rest },
    }).then(keepApiOrder);
  },
  /** Resolve one process for SearchableSelect via helper (no eng_process_master.view needed). */
  getViewById: async (proccode, perms = {}) => {
    const { permission_module, permission_action = "view" } = perms;
    if (!permission_module) return missingHelperPage("getViewById");
    const res = await api(ENDPOINTS.PROCESS_MASTER.HELPER, {
      method: "POST",
      body: { permission_module, permission_action, proccode },
    });
    const row = Array.isArray(res?.data) ? res.data[0] : null;
    return row ? { success: true, data: row } : { success: false, data: null };
  },
  /** Distinct ERP employee departments (deptname) for Process Master picker. */
  getDepartments: (params = {}) => api(ENDPOINTS.PROCESS_MASTER.DEPARTMENTS, { method: "POST", body: params }),
  getDepartmentByName: async (deptname) => {
    const name = String(deptname ?? "").trim();
    if (!name) return null;
    const res = await api(ENDPOINTS.PROCESS_MASTER.DEPARTMENTS, {
      method: "POST",
      body: { id: name, deptname: name },
    });
    return res?.data ?? null;
  },
};
