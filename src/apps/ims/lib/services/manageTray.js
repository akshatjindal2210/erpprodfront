import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";

export const manageTrayService = {
  getAll: (params) => api(ENDPOINTS.MANAGE_TRAY.LIST, { method: "POST", body: params }),
  get: (id, extra = {}) => api(ENDPOINTS.MANAGE_TRAY.GET, { method: "POST", body: { id, ...extra } }),
  reportSummary: () => api(ENDPOINTS.MANAGE_TRAY.REPORT_SUMMARY, { method: "POST", body: {} }),
  reportLedger: (params) => api(ENDPOINTS.MANAGE_TRAY.REPORT_LEDGER, { method: "POST", body: params }),
  scanSticker: (id, code) => api(ENDPOINTS.MANAGE_TRAY.SCAN_STICKER, { method: "POST", body: { id, code } }),
  scanTray: (id, code) => api(ENDPOINTS.MANAGE_TRAY.SCAN_TRAY, { method: "POST", body: { id, code } }),
  previewReceive: (code) => api(ENDPOINTS.MANAGE_TRAY.RECEIVE, { method: "POST", body: { code, preview: true } }),
  receiveTray: (code, payload = {}) => api(ENDPOINTS.MANAGE_TRAY.RECEIVE, { method: "POST", body: { code, preview: false, ...payload } }),
  scanReassignSticker: (code) => api(ENDPOINTS.MANAGE_TRAY.REASSIGN_STICKER, { method: "POST", body: { code } }),
  scanReassignTray: (code, extra = {}) => api(ENDPOINTS.MANAGE_TRAY.REASSIGN_TRAY, { method: "POST", body: { code, ...extra } }),
  reassignTray: (payload) => api(ENDPOINTS.MANAGE_TRAY.REASSIGN, { method: "POST", body: payload }),
  saveLinks: (id, payload) => api(ENDPOINTS.MANAGE_TRAY.SAVE_LINKS, { method: "POST", body: { id, ...payload } }),
  movePending: (id) => api(ENDPOINTS.MANAGE_TRAY.MOVE_PENDING, { method: "POST", body: { id } }),
  delete: (id) => api(ENDPOINTS.MANAGE_TRAY.DELETE, { method: "POST", body: { id } }),
};
