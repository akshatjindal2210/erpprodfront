import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";

export const boxService = {
  // ─── Box CRUD ───────────────────────────────────────────────
  getAll:  (params)               => api(ENDPOINTS.BOXES.LIST,   { method: "POST", body: params }),
  getInHandBoxesByPacking: (body) => api(ENDPOINTS.BOXES.IN_HAND_BY_PACKING, { method: "POST", body }),
  getSaAddBoxesByAdjustment: (body) => api(ENDPOINTS.BOXES.SA_ADD_BY_ADJUSTMENT, { method: "POST", body }),
  getById: (box_uid)              => api(ENDPOINTS.BOXES.GET,    { method: "POST", body: { box_uid } }),
  // create:  (data)            => api(ENDPOINTS.BOXES.CREATE, { method: "POST", body: data }),
  // update:  (box_uid, data)   => api(ENDPOINTS.BOXES.UPDATE, { method: "POST", body: { box_uid, ...data } }),
  // delete:  (box_uid)         => api(ENDPOINTS.BOXES.DELETE, { method: "POST", body: { box_uid } }),
  getViews: (params)         => api(ENDPOINTS.BOXES.VIEWS, { method: "POST", body: params }),

  // ─── Sticker ────────────────────────────────────────────────
  getStickers:      (body) => api(ENDPOINTS.BOXES.STICKER_FETCH,    { method: "POST", body }),
  generateStickers: (body) => api(ENDPOINTS.BOXES.STICKER_GENERATE, { method: "POST", body }),
  previewSticker: (body) => api(ENDPOINTS.BOXES.STICKER_PREVIEW, { method: "POST", body }),
  removeGeneratedStickers: (body) => api(ENDPOINTS.BOXES.STICKER_REMOVE, { method: "POST", body }),

  // ─── Download Tracking ───────────────────────────────────────
  trackDownload:     (body) => api(ENDPOINTS.BOXES.STICKER_DOWNLOAD,      { method: "POST", body }),
  trackBulkDownload: (body) => api(ENDPOINTS.BOXES.STICKER_DOWNLOAD_BULK, { method: "POST", body }),
  renderSingleSticker: (body) => api(ENDPOINTS.BOXES.STICKER_RENDER_SINGLE, { method: "POST", body }),
  renderBulkStickers:  (body) => api(ENDPOINTS.BOXES.STICKER_RENDER_BULK,   { method: "POST", body }),

  // ─── Customer Override ───────────────────────────────────────
  overrideCustomer: (body) => api(ENDPOINTS.BOXES.STICKER_OVERRIDE_CUST, { method: "POST", body }),

  // ─── History & Reports ───────────────────────────────────────
  getDownloadHistory: (body) => api(ENDPOINTS.BOXES.STICKER_DOWNLOAD_HISTORY,  { method: "POST", body }),
  getDownloadSummary: (body) => api(ENDPOINTS.BOXES.STICKER_DOWNLOAD_SUMMARY,  { method: "POST", body }),
  getStickerManagementList: (body) => api(ENDPOINTS.BOXES.STICKER_MANAGEMENT_LIST, { method: "POST", body }),
  createOverrideRequest: (body) => api(ENDPOINTS.BOXES.STICKER_OVERRIDE_REQUEST, { method: "POST", body }),
  getOverrideRequests: (body = {}) => api(ENDPOINTS.BOXES.STICKER_OVERRIDE_LIST, { method: "POST", body }),
  approveOverrideRequest: (body) => api(ENDPOINTS.BOXES.STICKER_OVERRIDE_APPROVE, { method: "POST", body }),
  updateOverrideRequest: (request_id, body) => api(ENDPOINTS.BOXES.STICKER_OVERRIDE_UPDATE, { method: "POST", body: { request_id, ...body } })
};

