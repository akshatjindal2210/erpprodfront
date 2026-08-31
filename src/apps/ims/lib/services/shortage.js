import { createCrudService } from "@/apps/ims/lib/crud/createCrudService";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";
import { api } from "@/platform/api/apiClient";

export const shortageService = createCrudService(ENDPOINTS.SHORTAGE);

/** Super Admin PPC bulk — { data, month }. */
shortageService.bulkCreate = (records, month) =>
  api(ENDPOINTS.SHORTAGE.BULK, {
    method: "POST",
    body: { data: records, month },
  });

shortageService.bulkPreview = (rows, month) =>
  api(ENDPOINTS.SHORTAGE.BULK_PREVIEW, {
    method: "POST",
    body: { data: rows, month },
  });

export const SHORTAGE_TYPES = ["PPC", "Deviation", "Additional"];

/** Packing Entry → Create Deviation (auto-approved). Requires special permission. */
export function createPackingDeviation(body) {
  return api(ENDPOINTS.SHORTAGE.PACKING_DEVIATION, { method: "POST", body });
}
