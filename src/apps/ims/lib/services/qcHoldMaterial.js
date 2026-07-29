import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";
import { imsApiViews } from "@/apps/ims/lib/helpers/sortDropdownResponse";

export const qcHoldMaterialService = {
  getAll: (params) => api(ENDPOINTS.QC_HOLD_MATERIAL.LIST, { method: "POST", body: params }),
  getById: (hold_id) => api(ENDPOINTS.QC_HOLD_MATERIAL.GET, { method: "POST", body: { hold_id } }),
  getActiveHolds: (search, opts = {}) =>
    api(ENDPOINTS.QC_HOLD_MATERIAL.ACTIVE_HOLDS, {
      method: "POST",
      body: { search, ...(opts.requireInStoreBoxes ? { require_in_store_boxes: true } : {}) },
    }),
  create: (data) => api(ENDPOINTS.QC_HOLD_MATERIAL.CREATE, { method: "POST", body: data }),
  submit: (data) => api(ENDPOINTS.QC_HOLD_MATERIAL.SUBMIT, { method: "POST", body: data }),
  approveSubmission: (body) => api(ENDPOINTS.QC_HOLD_MATERIAL.APPROVE_SUBMISSION, { method: "POST", body }),
  update: (hold_id, data) => api(ENDPOINTS.QC_HOLD_MATERIAL.UPDATE, { method: "POST", body: { hold_id, ...data } }),
  delete: (hold_id) => api(ENDPOINTS.QC_HOLD_MATERIAL.DELETE, { method: "POST", body: { hold_id } }),
  getPackingMeta: (packing_number) => api(ENDPOINTS.QC_HOLD_MATERIAL.PACKING_META, { method: "POST", body: { packing_number } }),
  verifyBox: (body) => api(ENDPOINTS.QC_HOLD_MATERIAL.VERIFY_BOX, { method: "POST", body }),
  expandFullHold: (body) => api(ENDPOINTS.QC_HOLD_MATERIAL.EXPAND_FULL_HOLD, { method: "POST", body }),
  getCompletionBoxes: (body) => api(ENDPOINTS.QC_HOLD_MATERIAL.COMPLETION_BOXES, { method: "POST", body }),
  getReasons: (params) => imsApiViews(ENDPOINTS.QC_HOLD_MATERIAL.REASONS, params, "reason"),
};
