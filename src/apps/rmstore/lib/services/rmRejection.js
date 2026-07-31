import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const rmRejectionService = {
  getAll: (params) => api(ENDPOINTS.RM_REJECTION.LIST, { method: "POST", body: params }),
  getPendingList: (params) => api(ENDPOINTS.RM_REJECTION.PENDING_LIST, { method: "POST", body: params }),
  getById: (qc_reject_uid) => api(ENDPOINTS.RM_REJECTION.GET, { method: "POST", body: { qc_reject_uid } }),
  create: (data) => api(ENDPOINTS.RM_REJECTION.CREATE, { method: "POST", body: data }),
  registerFromCheck: (body) => api(ENDPOINTS.RM_REJECTION.REGISTER_FROM_CHECK, { method: "POST", body }),
  generateStoreOut: (body) => api(ENDPOINTS.RM_REJECTION.GENERATE_STORE_OUT, { method: "POST", body }),
  generateStoreOutFromIpr: (body) => api(ENDPOINTS.RM_REJECTION.GENERATE_STORE_OUT_FROM_IPR, { method: "POST", body }),
  approveRegister: (body) => api(ENDPOINTS.RM_REJECTION.APPROVE_REGISTER, { method: "POST", body }),
  updateBill: (qc_reject_uid, bill_no) => api(ENDPOINTS.RM_REJECTION.UPDATE_BILL, { method: "POST", body: { qc_reject_uid, bill_no }}),
  getBillNumbers: (params) => api(ENDPOINTS.RM_REJECTION.BILL_NUMBERS, { method: "POST", body: params || {} }),
  delete: (qc_reject_uid) => api(ENDPOINTS.RM_REJECTION.DELETE, { method: "POST", body: { qc_reject_uid } }),
};
