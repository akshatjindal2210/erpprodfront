import { createCrudService } from "@/apps/purchase/lib/crud/createCrudService";
import { ENDPOINTS } from "@/apps/purchase/lib/config/endpoints";
import { api } from "@/platform/api/apiClient";

export const SHORTAGE_TYPES = ["PPC", "WIP", "Deviation", "Additional"];
export const SHORTAGE_BULK_IMPORT_TYPES = ["PPC", "WIP"];

export const shortageService = createCrudService(ENDPOINTS.SHORTAGE);

shortageService.getMasterList = (body = {}) =>
  api(ENDPOINTS.SHORTAGE.MASTER_LIST, { method: "POST", body });

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
