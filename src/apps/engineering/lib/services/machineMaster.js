import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/engineering/lib/config/endpoints";

export const machineMasterService = {
  getAll: (params) => api(ENDPOINTS.MACHINE_MASTER.LIST, { method: "POST", body: params }),
  getById: (maccode) => api(ENDPOINTS.MACHINE_MASTER.GET, { method: "POST", body: { maccode } }),
  /** QR payload (public URL or plain number) for print/download. */
  getQr: (maccode) => api(ENDPOINTS.MACHINE_MASTER.QR, { method: "POST", body: { maccode } }),
  create: (data) => {
    if (data instanceof FormData) {
      return api(ENDPOINTS.MACHINE_MASTER.CREATE, { method: "POST", body: data });
    }
    return api(ENDPOINTS.MACHINE_MASTER.CREATE, { method: "POST", body: data });
  },
  update: (maccode, data) => {
    if (data instanceof FormData) {
      data.append("maccode", String(maccode));
      return api(ENDPOINTS.MACHINE_MASTER.UPDATE, { method: "POST", body: data });
    }
    return api(ENDPOINTS.MACHINE_MASTER.UPDATE, { method: "POST", body: { maccode, ...data } });
  },
  delete: (maccode) => api(ENDPOINTS.MACHINE_MASTER.DELETE, { method: "POST", body: { maccode } }),
  /** Dropdown helper — approved machines; pass page perms + optional `filters.macproccode`. Sorted by maccode ASC. */
  getViews: (params = {}) =>
    api(ENDPOINTS.MACHINE_MASTER.HELPER, { method: "POST", body: params }).then((res) => {
      const list = Array.isArray(res?.data) ? res.data : [];
      return { data: list, total: res?.total ?? list.length };
    }),
  /** Resolve one machine for SearchableSelect (multi prefill). */
  getViewById: async (maccode, perms = {}) => {
    const res = await api(ENDPOINTS.MACHINE_MASTER.HELPER, { method: "POST", body: { ...perms, maccode } });
    const row = Array.isArray(res?.data) ? res.data[0] : null;
    return row ? { success: true, data: row } : { success: false, data: null };
  },
};
