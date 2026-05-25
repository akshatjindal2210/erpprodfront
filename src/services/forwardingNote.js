import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const forwardingNoteService = {
  getAll:      (params) => api(ENDPOINTS.FORWARDING_NOTES.LIST,   { method: "POST", body: params }),
  getAllItems: (params) => api(ENDPOINTS.FORWARDING_NOTES.LIST_ITEMS, { method: "POST", body: params }),
  getById:     (fuid) => api(ENDPOINTS.FORWARDING_NOTES.GET, { method: "POST", body: { fuid } }),
  getViews:    (params) => {
    const body = typeof params === "string" ? { search: params } : params;
    return api(ENDPOINTS.FORWARDING_NOTES.VIEWS, { method: "POST", body });
  },
  getViewById: (fuid) => api(ENDPOINTS.FORWARDING_NOTES.VIEWS, { method: "POST", body: { id: fuid } }),
  getTransporters: (params) => api(ENDPOINTS.FORWARDING_NOTES.TRANSPORTERS, { method: "POST", body: params }),
  create:      (data) => api(ENDPOINTS.FORWARDING_NOTES.CREATE, { method: "POST", body: data }),
  update:      (fuid, data) => api(ENDPOINTS.FORWARDING_NOTES.UPDATE, { method: "POST", body: { fuid, ...data } }),
  updateBill:  (fuid, bill_no) => api(ENDPOINTS.FORWARDING_NOTES.UPDATE_BILL, { method: "POST", body: { fuid, bill_no } }),
  delete:      (fuid) => api(ENDPOINTS.FORWARDING_NOTES.DELETE, { method: "POST", body: { fuid } }),
  unlockLock:  (fuid) => api(ENDPOINTS.FORWARDING_NOTES.UNLOCK_LOCK, { method: "POST", body: { fuid } }),
  lockLock:    (fuid) => api(ENDPOINTS.FORWARDING_NOTES.LOCK_LOCK, { method: "POST", body: { fuid } }),
  getAvailableBoxes: (data) => api(ENDPOINTS.FORWARDING_NOTES.AVAILABLE_BOXES, { method: "POST", body: data }),
  /** Full note + items; opens print dialog (user can “Save as PDF”). Optional `company_info`: { name, address } */
  printBill: (body) => api(ENDPOINTS.FORWARDING_NOTES.PRINT_BILL, { method: "POST", body }),
};