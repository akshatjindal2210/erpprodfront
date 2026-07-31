import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

export const issueRequestService = {
  getAll: (params) => api(ENDPOINTS.ISSUE_REQUEST.LIST, { method: "POST", body: params }),
  getAllJobCards: (params) => api(ENDPOINTS.ISSUE_REQUEST.LIST_JOB_CARDS, { method: "POST", body: params }),
  getById: (issue_uid) => api(ENDPOINTS.ISSUE_REQUEST.GET, { method: "POST", body: { issue_uid } }),
  jobCardSummary: (job_cards, exclude_issue_uid = null) =>
    api(ENDPOINTS.ISSUE_REQUEST.JOB_CARD_SUMMARY, {
      method: "POST",
      body: { job_cards, ...(exclude_issue_uid ? { exclude_issue_uid } : {}) },
    }),
  availableCoils: ({ rm_item_code, rm_item_dcode, exclude_issue_uid = null } = {}) =>
    api(ENDPOINTS.ISSUE_REQUEST.AVAILABLE_COILS, {
      method: "POST",
      body: {
        ...(rm_item_code ? { rm_item_code } : {}),
        ...(rm_item_dcode ? { rm_item_dcode } : {}),
        ...(exclude_issue_uid ? { exclude_issue_uid } : {}),
      },
    }),
  create: (data) => api(ENDPOINTS.ISSUE_REQUEST.CREATE, { method: "POST", body: data }),
  update: (issue_uid, data) => api(ENDPOINTS.ISSUE_REQUEST.UPDATE, { method: "POST", body: { issue_uid, ...data } }),
  approve: (issue_uid, data = {}) => api(ENDPOINTS.ISSUE_REQUEST.APPROVE, { method: "POST", body: { issue_uid, ...data } }),
  delete: (issue_uid) => api(ENDPOINTS.ISSUE_REQUEST.DELETE, { method: "POST", body: { issue_uid } }),
  lockStoreOut: (issue_uid) => api(ENDPOINTS.ISSUE_REQUEST.LOCK_STORE_OUT, { method: "POST", body: { issue_uid } }),
  unlockStoreOut: (issue_uid) => api(ENDPOINTS.ISSUE_REQUEST.UNLOCK_STORE_OUT, { method: "POST", body: { issue_uid } }),
};
