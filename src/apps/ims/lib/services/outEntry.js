import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";
import { imsApiViews } from "@/apps/ims/lib/helpers/sortDropdownResponse";

export const outEntryService = {
  getAll:  (params) => api(ENDPOINTS.OUT_ENTRIES.LIST,   { method: "POST", body: params }),
  getById: (out_uid) => api(ENDPOINTS.OUT_ENTRIES.GET, { method: "POST", body: { out_uid } }),
  create:  (data) => api(ENDPOINTS.OUT_ENTRIES.CREATE, { method: "POST", body: data }),
  update:  (out_uid, data) => api(ENDPOINTS.OUT_ENTRIES.UPDATE, { method: "POST", body: { out_uid, ...data } }),
  delete:      (out_uid) => api(ENDPOINTS.OUT_ENTRIES.DELETE, { method: "POST", body: { out_uid } }),
  getViews: (params) => imsApiViews(ENDPOINTS.OUT_ENTRIES.VIEWS, params, "out_uid"),
  getViewById: (id, perms = {}) => api(ENDPOINTS.OUT_ENTRIES.VIEWS, { method: "POST", body: { id, ...perms } }),
  verifyBox:   (body) => api(ENDPOINTS.OUT_ENTRIES.VERIFY_BOX, { method: "POST", body }),
  batchScanBoxes: (body) => api(ENDPOINTS.OUT_ENTRIES.BATCH_SCAN_BOXES, { method: "POST", body }),
  getFuidDetails: (fuid, for_out_uid) =>
    api(ENDPOINTS.OUT_ENTRIES.GET_FUID_DETAILS, {
      method: "POST",
      body: {
        fuid,
        ...(for_out_uid != null && for_out_uid !== "" ? { for_out_uid } : {}),
      },
    }),
  getQcHoldDetails: (qc_hold_id, for_out_uid) =>
    api(ENDPOINTS.OUT_ENTRIES.GET_QC_HOLD_DETAILS, {
      method: "POST",
      body: {
        qc_hold_id,
        ...(for_out_uid != null && for_out_uid !== "" ? { for_out_uid } : {}),
      },
    }),
  getLinkedBoxes: (out_uid) =>
    api(ENDPOINTS.OUT_ENTRIES.LINKED_BOXES, { method: "POST", body: { out_uid } }),
  getAvailableBoxes: (item_dcode) =>
    api(ENDPOINTS.OUT_ENTRIES.AVAILABLE_BOXES, { method: "POST", body: { item_dcode } }),
  lockFuid: (fuid) => api(ENDPOINTS.OUT_ENTRIES.LOCK_FUID, { method: "POST", body: { fuid } }),
  getReasons: (params) => imsApiViews(ENDPOINTS.OUT_ENTRIES.REASONS, params, "reason"),
};
