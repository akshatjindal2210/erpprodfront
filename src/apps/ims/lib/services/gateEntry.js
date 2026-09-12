import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";
import { getSelectedFinancialYear } from "@/platform/utils/global/financialYear";

export const gateEntryService = {
  listPending: () => api(ENDPOINTS.GATE_ENTRIES.PENDING, { method: "POST", body: {} }),
  list: (body = {}) => api(ENDPOINTS.GATE_ENTRIES.LIST, { method: "POST", body }),
  openBill: (qrOrBill) => {
    let body = typeof qrOrBill === "string" ? { qrData: String(qrOrBill ?? "").trim() } : qrOrBill;
    const s = String(body.qrData ?? "").replace(/\s+/g, "");
    if (body.qrData && /^\d+$/.test(s)) {
      const m = String(getSelectedFinancialYear().name || "").match(/^(\d{2,4})-(\d{2,4})$/);
      if (!m) throw new Error("Please select financial year first.");
      body = { bill_no: `HPF/${m[1].slice(-2)}-${m[2].slice(-2)}/${s}` };
    }
    return api(ENDPOINTS.GATE_ENTRIES.OPEN, { method: "POST", body });
  },
  getDetails: (body) => api(ENDPOINTS.GATE_ENTRIES.DETAILS, { method: "POST", body }),
  save: (body) => api(ENDPOINTS.GATE_ENTRIES.SAVE, { method: "POST", body }),
  update: (body) => api(ENDPOINTS.GATE_ENTRIES.UPDATE, { method: "POST", body }),
  delete: (uid) => api(ENDPOINTS.GATE_ENTRIES.DELETE, { method: "POST", body: { uid } }),
};
