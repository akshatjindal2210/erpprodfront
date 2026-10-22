import { ENDPOINTS } from "@/apps/production/lib/config/endpoints";
import { api } from "@/platform/api/apiClient";

/** Maintain Job Card API — one job card per prime item, key = docno. */
export const jobCardService = {
  /** All job cards (one row per card). Optional body.approved true|false to filter. */
  getRegister: (body = {}) => api(ENDPOINTS.JOB_CARD.REGISTER, { method: "POST", body }),
  /** Unapproved job cards only. */
  getPending: (body = {}) => api(ENDPOINTS.JOB_CARD.PENDING, { method: "POST", body }),
  getPendingShortage: () => api(ENDPOINTS.JOB_CARD.PENDING_SHORTAGE, { method: "POST", body: {} }),
  getById: (docno) => api(ENDPOINTS.JOB_CARD.GET, { method: "POST", body: { docno } }),
  /** item_dcodes (New Job Card) → server also checks Finish Process of each item. */
  getPrimeProcess: (itemDcode, itemDcodes = []) => api(ENDPOINTS.JOB_CARD.PRIME_PROCESS, { method: "POST", body: { item_dcode: itemDcode, ...(itemDcodes.length ? { item_dcodes: itemDcodes } : {}) } }),
  estimateProduction: (item_dcode, qty, process_plan) => api(ENDPOINTS.JOB_CARD.ESTIMATE_PRODUCTION, { method: "POST", body: { item_dcode, qty, process_plan } }),
  /** One job card for the prime item from its shortage entries. */
  /** Always created Pending — tooling approves after entry, then authorize on Register. */
  create: (primeKey, shortageIds, processPlan, remarks = "") => api(ENDPOINTS.JOB_CARD.CREATE, { method: "POST", body: { prime_key: primeKey, shortage_ids: shortageIds, process_plan: processPlan, remarks } }),
  update: (docno, data) => api(ENDPOINTS.JOB_CARD.UPDATE, { method: "POST", body: { docno, ...data } }),
  /** data = edits made in the Approve drawer (saved + authorized together). */
  approve: (docno, data = {}) => api(ENDPOINTS.JOB_CARD.APPROVE, { method: "POST", body: { docno, ...data } }),
  delete: (docno) => api(ENDPOINTS.JOB_CARD.DELETE, { method: "POST", body: { docno } }),
};
