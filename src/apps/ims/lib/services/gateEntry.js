import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";

export const gateEntryService = {
  listPending: () => api(ENDPOINTS.GATE_ENTRIES.PENDING, { method: "POST", body: {} }),
  list: () => api(ENDPOINTS.GATE_ENTRIES.LIST, { method: "POST", body: {} }),
  /** QR text or bill number → live IMS bill payload. */
  openBill: (qrOrBill) =>
    api(ENDPOINTS.GATE_ENTRIES.OPEN, {
      method: "POST",
      body: typeof qrOrBill === "string" ? { qrData: String(qrOrBill ?? "") } : qrOrBill,
    }),
  getDetails: (body) => api(ENDPOINTS.GATE_ENTRIES.DETAILS, { method: "POST", body }),
  save: (body) => api(ENDPOINTS.GATE_ENTRIES.SAVE, { method: "POST", body }),
  update: (body) => api(ENDPOINTS.GATE_ENTRIES.UPDATE, { method: "POST", body }),
  delete: (uid) => api(ENDPOINTS.GATE_ENTRIES.DELETE, { method: "POST", body: { uid } }),
};
