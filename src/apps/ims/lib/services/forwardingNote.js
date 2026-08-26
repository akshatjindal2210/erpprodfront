import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";
import { imsApiViews } from "@/apps/ims/lib/helpers/sortDropdownResponse";

export const forwardingNoteService = {
  getAll:      (params) => api(ENDPOINTS.FORWARDING_NOTES.LIST,   { method: "POST", body: params }),
  getAllItems: (params) => api(ENDPOINTS.FORWARDING_NOTES.LIST_ITEMS, { method: "POST", body: params }),
  getById:     (fuidOrRow) => {
    const raw = typeof fuidOrRow === "object" && fuidOrRow != null ? fuidOrRow.fuid : fuidOrRow;
    const fuid = parseInt(String(raw ?? "").trim(), 10);
    return api(ENDPOINTS.FORWARDING_NOTES.GET, { method: "POST", body: { fuid } });
  },
  getViews: (params) => {
    const body = typeof params === "string" ? { search: params } : params;
    return imsApiViews(ENDPOINTS.FORWARDING_NOTES.VIEWS, body, "fuid");
  },
  getTransporters: (params) => imsApiViews(ENDPOINTS.FORWARDING_NOTES.TRANSPORTERS, params, "transporter_name"),
  getBillNumbers: (params) => imsApiViews(ENDPOINTS.FORWARDING_NOTES.BILL_NUMBERS, params, "bill_no"),
  create:      (data) => api(ENDPOINTS.FORWARDING_NOTES.CREATE, { method: "POST", body: data }),
  update:      (fuid, data) => api(ENDPOINTS.FORWARDING_NOTES.UPDATE, { method: "POST", body: { fuid, ...data } }),
  assignItemBill: (body) => api(ENDPOINTS.FORWARDING_NOTES.ASSIGN_ITEM_BILL, { method: "POST", body }),
  delete:      (fuid) => api(ENDPOINTS.FORWARDING_NOTES.DELETE, { method: "POST", body: { fuid } }),
  unlockLock:  (fuid) => api(ENDPOINTS.FORWARDING_NOTES.UNLOCK_LOCK, { method: "POST", body: { fuid } }),
  lockLock:    (fuid) => api(ENDPOINTS.FORWARDING_NOTES.LOCK_LOCK, { method: "POST", body: { fuid } }),
  getAvailableBoxes: (data) => api(ENDPOINTS.FORWARDING_NOTES.AVAILABLE_BOXES, { method: "POST", body: data }),
  getAvailableItems: (data) => api(ENDPOINTS.FORWARDING_NOTES.AVAILABLE_ITEMS, { method: "POST", body: data }),
  getErpStock: (data) => api(ENDPOINTS.FORWARDING_NOTES.ERP_STOCK, { method: "POST", body: data }),
  getCustomerCategory: (data) => api(ENDPOINTS.FORWARDING_NOTES.CUSTOMER_CATEGORY, { method: "POST", body: data }),
  /** Full note + items; opens print dialog (user can “Save as PDF”). Optional `company_info`: { name, address } */
  printBill: (body) => api(ENDPOINTS.FORWARDING_NOTES.PRINT_BILL, { method: "POST", body }),
};
