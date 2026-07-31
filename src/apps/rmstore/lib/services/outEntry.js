import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const outEntryService = {
  getAll: (params) => api(ENDPOINTS.OUT_ENTRY.LIST, { method: "POST", body: params }),
  getPendingList: (params) => api(ENDPOINTS.OUT_ENTRY.PENDING_LIST, { method: "POST", body: params }),
  getStoredMrns: (params) => api(ENDPOINTS.OUT_ENTRY.STORED_MRNS, { method: "POST", body: params }),
  getStoredMrnDetail: (params) =>
    api(ENDPOINTS.OUT_ENTRY.STORED_MRN_DETAIL, {
      method: "POST",
      body: typeof params === "object" && params != null ? params : { mrn_uid: params },
    }),
  getById: (out_uid) => api(ENDPOINTS.OUT_ENTRY.GET, { method: "POST", body: { out_uid } }),
  create: (data) => api(ENDPOINTS.OUT_ENTRY.CREATE, { method: "POST", body: data }),
  update: (out_uid, data) => api(ENDPOINTS.OUT_ENTRY.UPDATE, { method: "POST", body: { out_uid, ...data } }),
  approve: (out_uid, data = {}) => api(ENDPOINTS.OUT_ENTRY.APPROVE, { method: "POST", body: { out_uid, approved: true, ...data } }),
  delete: (out_uid) => api(ENDPOINTS.OUT_ENTRY.DELETE, { method: "POST", body: { out_uid } }),
};

