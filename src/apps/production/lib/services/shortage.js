import { createCrudService } from "@/apps/production/lib/crud/createCrudService";
import { ENDPOINTS } from "@/apps/production/lib/config/endpoints";
import { api } from "@/platform/api/apiClient";

export const SHORTAGE_TYPES = ["PPC", "WIP", "Deviation", "Additional"];
export const SHORTAGE_LIST_TYPES = ["PPC", "Additional"];
export const SHORTAGE_BULK_IMPORT_TYPES = ["PPC", "WIP"];

export const shortageService = createCrudService(ENDPOINTS.SHORTAGE);

shortageService.getMasterList = (body = {}) =>
  api(ENDPOINTS.SHORTAGE.MASTER_LIST, { method: "POST", body });

shortageService.bulkCreate = (records, month, type = "PPC") =>
  api(ENDPOINTS.SHORTAGE.BULK, {
    method: "POST",
    body: { data: records, month, type },
  });

/** Prime Item tab — all statuses in one call (screen filters Pending / Approved / Rejected). */
shortageService.getPrimeItems = () =>
  api(ENDPOINTS.SHORTAGE.PRIME_ITEMS, { method: "POST", body: {} });

shortageService.getPrimeItemEntries = (prime_key, status) =>
  api(ENDPOINTS.SHORTAGE.PRIME_ENTRIES, { method: "POST", body: { prime_key, status } });

shortageService.approvePrimeItems = (primeItems, remark = "") =>
  api(ENDPOINTS.SHORTAGE.PRIME_APPROVE, { method: "POST", body: { prime_items: primeItems, remark } });

shortageService.rejectPrimeItems = (primeItems, remark = "") =>
  api(ENDPOINTS.SHORTAGE.PRIME_REJECT, { method: "POST", body: { prime_items: primeItems, remark } });

shortageService.resetPrimeItems = (primeItems, remark = "") =>
  api(ENDPOINTS.SHORTAGE.PRIME_RESET, { method: "POST", body: { prime_items: primeItems, remark } });

shortageService.bulkPreview =(rows, month, type = "PPC") =>
  api(ENDPOINTS.SHORTAGE.BULK_PREVIEW, {
    method: "POST",
    body: { data: rows, month, type },
  });
