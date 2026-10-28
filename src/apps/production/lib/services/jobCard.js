import { ENDPOINTS } from "@/apps/production/lib/config/endpoints";
import { api } from "@/platform/api/apiClient";

/** Maintain Job Card (prod_jc) API — one job card per prime item, key = docno. */
export const jobCardService = {
  getRegister: (body = {}) =>
    api(body.permission_module ? ENDPOINTS.JC.REGISTER_HELPER : ENDPOINTS.JC.REGISTER, {
      method: "POST",
      body,
    }),
  getPending: (body = {}) => api(ENDPOINTS.JC.PENDING, { method: "POST", body }),
  getPendingShortage: () => api(ENDPOINTS.JC.PENDING_SHORTAGE, { method: "POST", body: {} }),
  getById: (docno, perms = {}) =>
    api(perms.permission_module ? ENDPOINTS.JC.GET_HELPER : ENDPOINTS.JC.GET, {
      method: "POST",
      body: { docno, ...perms },
    }),
  getPrimeProcess: (itemDcode, itemDcodes = []) =>
    api(ENDPOINTS.JC.PRIME_PROCESS, {
      method: "POST",
      body: { item_dcode: itemDcode, ...(itemDcodes.length ? { item_dcodes: itemDcodes } : {}) },
    }),
  estimateProduction: (item_dcode, qty, process_plan) =>
    api(ENDPOINTS.JC.ESTIMATE_PRODUCTION, { method: "POST", body: { item_dcode, qty, process_plan } }),
  suggestErpJobcardno: (body = {}) => api(ENDPOINTS.JC.SUGGEST_ERP_NO, { method: "POST", body }),
  create: (primeKey, shortageIds, processPlan, remarks = "", extra = {}) =>
    api(ENDPOINTS.JC.CREATE, {
      method: "POST",
      body: { prime_key: primeKey, shortage_ids: shortageIds, process_plan: processPlan, remarks, ...extra },
    }),
  update: (docno, data = {}) =>
    api(data.permission_module ? ENDPOINTS.JC.UPDATE_HELPER : ENDPOINTS.JC.UPDATE, {
      method: "POST",
      body: { docno, ...data },
    }),
  approve: (docno, data = {}) => api(ENDPOINTS.JC.APPROVE, { method: "POST", body: { docno, ...data } }),
  delete: (docno) => api(ENDPOINTS.JC.DELETE, { method: "POST", body: { docno } }),
};
