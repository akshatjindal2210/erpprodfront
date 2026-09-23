import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";
import { getSelectedFinancialYear } from "@/platform/utils/global/financialYear";
import { looksLikeBillBase64, looksLikeEInvoiceJwt, looksLikePlainGateBillNo, normalizeBillScanInput } from "@/apps/ims/lib/helpers/qrScan";

/** Map scan / typed input to open-bill API body (backend parses qrData). */
function openBillRequestBody(qrOrBill) {
  if (qrOrBill != null && typeof qrOrBill === "object") {
    if (qrOrBill.qrData) {
      return { qrData: normalizeBillScanInput(qrOrBill.qrData) };
    }
    const bill_no = String(qrOrBill.bill_no ?? "").trim();
    const bill_dt = qrOrBill.bill_dt ? String(qrOrBill.bill_dt).trim() : null;
    if (!bill_no) return { bill_no: "" };
    return bill_dt ? { bill_no, bill_dt } : { bill_no };
  }

  const raw = normalizeBillScanInput(qrOrBill);
  if (!raw) return { bill_no: "" };

  const compact = raw.replace(/\s+/g, "");
  if (/^\d+$/.test(compact)) {
    const m = String(getSelectedFinancialYear().name || "").match(/^(\d{2,4})-(\d{2,4})$/);
    if (!m) throw new Error("Please select financial year first.");
    return { bill_no: `HPF/${m[1].slice(-2)}-${m[2].slice(-2)}/${compact}` };
  }

  if (looksLikePlainGateBillNo(raw)) {
    return { bill_no: raw.trim() };
  }

  if (looksLikeEInvoiceJwt(raw) || looksLikeBillBase64(raw) || (raw.startsWith("{") && raw.endsWith("}"))) 
  {
    return { qrData: raw };
  }

  return { bill_no: raw.trim() };
}

export const gateEntryService = {
  listPending: () => api(ENDPOINTS.GATE_ENTRIES.PENDING, { method: "POST", body: {} }),
  list: (body = {}) => api(ENDPOINTS.GATE_ENTRIES.LIST, { method: "POST", body }),
  openBill: (qrOrBill) => api(ENDPOINTS.GATE_ENTRIES.OPEN, { method: "POST", body: openBillRequestBody(qrOrBill) }),
  getDetails: (body) => api(ENDPOINTS.GATE_ENTRIES.DETAILS, { method: "POST", body }),
  save: (body) => api(ENDPOINTS.GATE_ENTRIES.SAVE, { method: "POST", body }),
  update: (body) => api(ENDPOINTS.GATE_ENTRIES.UPDATE, { method: "POST", body }),
  delete: (uid) => api(ENDPOINTS.GATE_ENTRIES.DELETE, { method: "POST", body: { uid } }),
};
