import { api } from "@/platform/api/apiClient";
import { API_BASE_URL } from "@/platform/utils/core/lib";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

async function postMultipart(endpoint, formData) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.message || `Upload failed (${res.status})`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export const stockAdjustmentService = {
  getAll: (params) => api(ENDPOINTS.STOCK_ADJUSTMENT.LIST, { method: "POST", body: params }),
  getById: (adjustment_id) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.GET, { method: "POST", body: { adjustment_id } }),
  getActiveCoils: (params) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.ACTIVE_COILS, { method: "POST", body: params }),
  create: (data) => api(ENDPOINTS.STOCK_ADJUSTMENT.CREATE, { method: "POST", body: data }),
  update: (adjustment_id, data) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.UPDATE, { method: "POST", body: { adjustment_id, ...data } }),
  delete: (adjustment_id) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.DELETE, { method: "POST", body: { adjustment_id } }),
  renderSingleSticker: (body) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.STICKER_RENDER_SINGLE, { method: "POST", body }),
  renderBulkStickers: (body) =>
    api(ENDPOINTS.STOCK_ADJUSTMENT.STICKER_RENDER_BULK, { method: "POST", body }),
  uploadDocs: async ({ adjustment_id, tcFile, rmtcFile, tc_remark, rmtc_remark }) => {
    if (!adjustment_id) throw new Error("adjustment_id required for document upload");
    const hasRemark = (tc_remark != null && String(tc_remark).trim()) || (rmtc_remark != null && String(rmtc_remark).trim());
    const sendsRemarkField = tc_remark != null || rmtc_remark != null;
    if (!tcFile && !rmtcFile && !hasRemark && !sendsRemarkField) {
      return { success: true, data: { adjustment_id } };
    }
    const form = new FormData();
    form.append("adjustment_id", String(adjustment_id));
    if (tcFile instanceof File) form.append("tc", tcFile);
    if (rmtcFile instanceof File) form.append("rmtc", rmtcFile);
    if (tc_remark != null) form.append("tc_remark", String(tc_remark).trim());
    if (rmtc_remark != null) form.append("rmtc_remark", String(rmtc_remark).trim());
    return postMultipart(ENDPOINTS.STOCK_ADJUSTMENT.UPLOAD_DOCS, form);
  },
};
