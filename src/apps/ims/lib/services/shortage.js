import { createCrudService } from "@/apps/ims/lib/crud/createCrudService";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";
import { api } from "@/platform/api/apiClient";

export function createShortageService(endpoints) {
  const service = createCrudService(endpoints);
  if (endpoints.MASTER_LIST) {
    service.getMasterList = (body = {}) =>
      api(endpoints.MASTER_LIST, {
        method: "POST",
        body,
      });
  }
  if (endpoints.BULK) {
    service.bulkCreate = (records, month, type = "PPC") =>
      api(endpoints.BULK, {
        method: "POST",
        body: { data: records, month, type },
      });
  }
  if (endpoints.BULK_PREVIEW) {
    service.bulkPreview = (rows, month, type = "PPC") =>
      api(endpoints.BULK_PREVIEW, {
        method: "POST",
        body: { data: rows, month, type },
      });
  }
  return service;
}

export const shortageService = createShortageService(ENDPOINTS.SHORTAGE);

/** UI labels — must match backend shortage.config.js (API validates on save). */
export const SHORTAGE_TYPES = ["PPC", "WIP", "Deviation", "Additional"];
export const SHORTAGE_BULK_IMPORT_TYPES = ["PPC", "WIP"];

export function createPackingDeviation(body) {
  return api(ENDPOINTS.SHORTAGE.PACKING_DEVIATION, { method: "POST", body });
}
