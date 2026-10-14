import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/engineering/lib/config/endpoints";

export const machineMasterService = {
  getAll: (params) => api(ENDPOINTS.MACHINE_MASTER.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.MACHINE_MASTER.GET, { method: "POST", body: { id } }),
  /** QR payload (public URL or plain number) for print/download. */
  getQr: (id) => api(ENDPOINTS.MACHINE_MASTER.QR, { method: "POST", body: { id } }),
  create: (data) => {
    if (data instanceof FormData) {
      return api(ENDPOINTS.MACHINE_MASTER.CREATE, { method: "POST", body: data });
    }
    return api(ENDPOINTS.MACHINE_MASTER.CREATE, { method: "POST", body: data });
  },
  update: (id, data) => {
    if (data instanceof FormData) {
      data.append("id", String(id));
      return api(ENDPOINTS.MACHINE_MASTER.UPDATE, { method: "POST", body: data });
    }
    return api(ENDPOINTS.MACHINE_MASTER.UPDATE, { method: "POST", body: { id, ...data } });
  },
  delete: (id) => api(ENDPOINTS.MACHINE_MASTER.DELETE, { method: "POST", body: { id } }),
  /** Dropdown helper — approved machines; pass page perms + optional `filters.process_id`. Sorted by id ASC. */
  getViews: (params = {}) =>
    api(ENDPOINTS.MACHINE_MASTER.HELPER, { method: "POST", body: params }).then((res) => {
      const list = Array.isArray(res?.data) ? res.data : [];
      return { data: list, total: res?.total ?? list.length };
    }),
  /** Resolve one machine for SearchableSelect (multi prefill). */
  getViewById: async (id, perms = {}) => {
    const res = await api(ENDPOINTS.MACHINE_MASTER.HELPER, { method: "POST", body: { ...perms, id } });
    const row = Array.isArray(res?.data) ? res.data[0] : null;
    return row ? { success: true, data: row } : { success: false, data: null };
  },
};
