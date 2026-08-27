import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";

export const gateEntryService = {
  listPending: () => api(ENDPOINTS.GATE_ENTRIES.PENDING, { method: "POST", body: {} }),
  getAll: () => api(ENDPOINTS.GATE_ENTRIES.LIST, { method: "POST", body: {} }),
  getDetails: (body) => api(ENDPOINTS.GATE_ENTRIES.DETAILS, { method: "POST", body }),
  scan: (qrData) => api(ENDPOINTS.GATE_ENTRIES.SCAN, { method: "POST", body: { qrData } }),
  save: (body) => api(ENDPOINTS.GATE_ENTRIES.SAVE, { method: "POST", body }),
  approve: (uid) => api(ENDPOINTS.GATE_ENTRIES.APPROVE, { method: "POST", body: { uid } }),
  delete: (uid) => api(ENDPOINTS.GATE_ENTRIES.DELETE, { method: "POST", body: { uid } }),
};
