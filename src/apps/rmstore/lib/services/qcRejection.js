import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const qcRejectionService = {
  getAll: (params) => api(ENDPOINTS.QC_REJECTION.LIST, { method: "POST", body: params }),
  getById: (qc_reject_uid) =>
    api(ENDPOINTS.QC_REJECTION.GET, { method: "POST", body: { qc_reject_uid } }),
  create: (data) => api(ENDPOINTS.QC_REJECTION.CREATE, { method: "POST", body: data }),
  registerFromCheck: (body) =>
    api(ENDPOINTS.QC_REJECTION.REGISTER_FROM_CHECK, { method: "POST", body }),
  generateStoreOut: (body) =>
    api(ENDPOINTS.QC_REJECTION.GENERATE_STORE_OUT, { method: "POST", body }),
  updateBill: (qc_reject_uid, bill_no) =>
    api(ENDPOINTS.QC_REJECTION.UPDATE_BILL, {
      method: "POST",
      body: { qc_reject_uid, bill_no },
    }),
  getBillNumbers: (params) =>
    api(ENDPOINTS.QC_REJECTION.BILL_NUMBERS, { method: "POST", body: params || {} }),
  delete: (qc_reject_uid) =>
    api(ENDPOINTS.QC_REJECTION.DELETE, { method: "POST", body: { qc_reject_uid } }),
};
