import { createCrudService } from "@/apps/ims/lib/crud/createCrudService";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";
import { api } from "@/platform/api/apiClient";

export const shortageService = createCrudService(ENDPOINTS.SHORTAGE);

/** UI labels — must match backend shortage.config.js (API validates on save). */
export const SHORTAGE_TYPES = ["PPC", "WIP", "Deviation", "Additional"];
export const SHORTAGE_BULK_IMPORT_TYPES = ["PPC", "WIP"];

shortageService.bulkCreate = (records, month, type = "PPC") =>
  api(ENDPOINTS.SHORTAGE.BULK, {
    method: "POST",
    body: { data: records, month, type },
  });

shortageService.bulkPreview = (rows, month, type = "PPC") =>
  api(ENDPOINTS.SHORTAGE.BULK_PREVIEW, {
    method: "POST",
    body: { data: rows, month, type },
  });

export function createPackingDeviation(body) {
  return api(ENDPOINTS.SHORTAGE.PACKING_DEVIATION, { method: "POST", body });
}
