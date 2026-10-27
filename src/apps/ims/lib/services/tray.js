import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";
import { imsApiViews } from "@/apps/ims/lib/helpers/sortDropdownResponse";

export const trayService = {
  getTypes: () => api(ENDPOINTS.TRAYS.TYPES, { method: "POST", body: {} }),
  getQrPayloads: (trays) =>
    api(ENDPOINTS.TRAYS.QR_PAYLOADS, {
      method: "POST",
      body: {
        trays: (Array.isArray(trays) ? trays : []).map((t) => ({
          id: t?.id ?? t?.tray_id ?? null,
          code: String(t?.code ?? "").trim().toUpperCase(),
        })),
      },
    }),
  getViews: (params) => imsApiViews(ENDPOINTS.TRAYS.VIEWS, params, "code"),
  getAll: (params) => api(ENDPOINTS.TRAYS.LIST, { method: "POST", body: params }),
  create: (data) => api(ENDPOINTS.TRAYS.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.TRAYS.UPDATE, { method: "POST", body: { id, ...data } }),
  updateBatch: (batch_id, data) => api(ENDPOINTS.TRAYS.UPDATE, { method: "POST", body: { batch_id, ...data } }),
  approveBatch: (batch_id, approved, remark) => api(ENDPOINTS.TRAYS.UPDATE, { method: "POST", body: { batch_id, approved, ...(remark !== undefined ? { remark } : {}) } }),
  updateStatus: (id, status, remark) => api(ENDPOINTS.TRAYS.UPDATE, { method: "POST", body: { id, status, ...(remark ? { remark } : {}) } }),
  updateStatusByIds: (ids, status, remark) => api(ENDPOINTS.TRAYS.UPDATE, { method: "POST", body: { ids, status, ...(remark ? { remark } : {}) } }),
  updateBatchStatus: (batch_id, status, remark) => api(ENDPOINTS.TRAYS.UPDATE, { method: "POST", body: { batch_id, status, ...(remark ? { remark } : {}) } }),
  deleteBatch: (batch_id) => api(ENDPOINTS.TRAYS.DELETE, { method: "POST", body: { batch_id } }),
  delete: (id) => api(ENDPOINTS.TRAYS.DELETE, { method: "POST", body: { id } }),
  deleteByIds: (ids) => api(ENDPOINTS.TRAYS.DELETE, { method: "POST", body: { ids } }),
};
