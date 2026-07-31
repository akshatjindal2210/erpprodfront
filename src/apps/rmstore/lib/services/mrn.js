import { api } from "@/platform/api/apiClient";
import { API_BASE_URL } from "@/platform/utils/core/lib";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";

/** ERP fields used when creating MRN on Generate (pending rows). */
function mrnSourceBody(source = {}) {
  return {
    uid: source.uid,
    mrnno: source.mrn_no ?? source.mrnno,
    itsrno: source.serial_no ?? source.itsrno,
    mrndt: source.mrn_dt ?? source.mrndt,
    billno: source.bill_no ?? source.billno,
    billdt: source.bill_dt ?? source.billdt,
    acc_code: source.acc_code,
    acc_name: source.acc_name,
    itemdcode: source.item_dcode ?? source.itemdcode,
    itemcode: source.item_code ?? source.itemcode,
    itemdesc: source.item_desc ?? source.itemdesc,
    itrecpqty: source.it_recp_qty ?? source.itrecpqty,
    itLotNo: source.it_lot_no ?? source.itLotNo,
    itunit: source.it_unit ?? source.itunit,
    fyid: source.fyid,
    userc: source.internal_create_user || source.userc || null,
    datec: source.internal_create_date || source.datec || null,
    internal_create_user: source.internal_create_user || source.userc || null,
    internal_create_date: source.internal_create_date || source.datec || null,
  };
}

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

export const mrnService = {
  getAll: (params) => api(ENDPOINTS.MRN.LIST, { method: "POST", body: params }),
  generate: (data) => api(ENDPOINTS.MRN.GENERATE, { method: "POST", body: data }),
  delete: (uid) => api(ENDPOINTS.MRN.DELETE, { method: "POST", body: { uid } }),
  getDetail: (uid) => api(ENDPOINTS.MRN.DETAIL, { method: "POST", body: { uid } }),
  getCoils: (uid, heat_no) =>
    api(ENDPOINTS.MRN.COILS, {
      method: "POST",
      body: { uid, ...(heat_no ? { heat_no } : {}) },
    }),
  previewSticker: (body) => api(ENDPOINTS.MRN.STICKER_PREVIEW, { method: "POST", body }),
  renderSingleSticker: (body) => api(ENDPOINTS.MRN.STICKER_RENDER_SINGLE, { method: "POST", body }),
  renderBulkStickers: (body) => api(ENDPOINTS.MRN.STICKER_RENDER_BULK, { method: "POST", body }),
  renderBatchQcSticker: (body) => api(ENDPOINTS.MRN.STICKER_RENDER_BATCH_QC, { method: "POST", body }),

  /**
   * Generate stickers — always keyed by uid (+ ERP fields when pending).
   */
  generateStickers: ({ uid, sourceRow, heat_no, coil_count, total_qty, coil_qtys, remarks }) => {
    const rowUid = uid || sourceRow?.uid;
    return api(ENDPOINTS.MRN.GENERATE_STICKERS, {
      method: "POST",
      body: {
        ...mrnSourceBody(sourceRow || { uid: rowUid }),
        uid: rowUid,
        heat_no: heat_no || null,
        coil_count,
        total_qty,
        coil_qtys,
        remarks: remarks || null,
      },
    });
  },

  /** Save in-progress sticker form without generating coils (optional TC/RMTC upload). */
  saveStickerDraft: async ({ uid, sourceRow, heat_no, coil_count, total_qty, coil_qtys, remarks, tcFile, rmtcFile }) => {
    const rowUid = uid || sourceRow?.uid;
    const form = new FormData();
    const body = {
      ...mrnSourceBody(sourceRow || { uid: rowUid }),
      uid: rowUid,
      heat_no: heat_no ?? "",
      coil_count,
      total_qty,
      coil_qtys: JSON.stringify(coil_qtys ?? []),
      remarks: remarks ?? "",
    };
    Object.entries(body).forEach(([key, value]) => {
      if (value != null && value !== "") form.append(key, String(value));
    });
    if (tcFile instanceof File) form.append("tc", tcFile);
    if (rmtcFile instanceof File) form.append("rmtc", rmtcFile);
    return postMultipart(ENDPOINTS.MRN.SAVE_STICKER_DRAFT, form);
  },

  /** TC + RMTC upload — both required on MRN after merge; pass only changed files when one already saved. */
  uploadDocs: async ({ uid, tcFile, rmtcFile, requireBoth = true }) => {
    if (!uid) throw new Error("uid required for document upload");
    if (requireBoth && (!tcFile || !rmtcFile)) throw new Error("Both TC and RMTC documents are required");
    if (!tcFile && !rmtcFile) return { success: true, data: { uid } };
    const form = new FormData();
    form.append("uid", String(uid));
    if (requireBoth) form.append("require_both", "true");
    else form.append("require_both", "false");
    if (tcFile instanceof File) form.append("tc", tcFile);
    if (rmtcFile instanceof File) form.append("rmtc", rmtcFile);
    return postMultipart(ENDPOINTS.MRN.UPLOAD_DOCS, form);
  },
};
