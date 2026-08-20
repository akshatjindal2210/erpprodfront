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
    const err = new Error(data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export const qcCheckService = {
  getAll: (params) => api(ENDPOINTS.QC_CHECK.LIST, { method: "POST", body: params }),
  getById: (qc_check_uid) => api(ENDPOINTS.QC_CHECK.GET, { method: "POST", body: { qc_check_uid } }),
  getByHelper: (qc_check_uid, permissions = {}) => api(ENDPOINTS.QC_CHECK.HELPER, { method: "POST", body: { qc_check_uid, ...permissions } }),
  prepare: (body) => api(ENDPOINTS.QC_CHECK.PREPARE, { method: "POST", body }),
  approve: async ({ qc_check_uid, remarks, failure_reason, overall_result, items } = {}) => {
    if (items == null && (remarks == null || remarks === undefined) && failure_reason == null && overall_result == null) {
      return api(ENDPOINTS.QC_CHECK.APPROVE, { method: "POST", body: { qc_check_uid } });
    }
    const form = new FormData();
    if (qc_check_uid != null) form.append("qc_check_uid", String(qc_check_uid));
    if (remarks != null) form.append("remarks", String(remarks));
    if (failure_reason != null) form.append("failure_reason", String(failure_reason));
    if (overall_result != null) form.append("overall_result", String(overall_result));
    form.append(
      "items",
      JSON.stringify(
        (items || []).map((it) => ({
          spec_id: it.spec_id,
          actual_value: it.actual_value,
        }))
      )
    );
    for (const it of items || []) {
      if (it?.document_file instanceof File) {
        form.append(`doc_${it.spec_id}`, it.document_file);
      }
    }
    return postMultipart(ENDPOINTS.QC_CHECK.APPROVE, form);
  },
  reopen: (qc_check_uid) =>
    api(ENDPOINTS.QC_CHECK.REOPEN, { method: "POST", body: { qc_check_uid } }),
  delete: (qc_check_uid) =>
    api(ENDPOINTS.QC_CHECK.DELETE, { method: "POST", body: { qc_check_uid } }),
  /** Submit with optional per-spec document files (`doc_<spec_id>`). is_draft saves without approval queue. */
  submit: async ({ qc_check_uid, coil_no_uid, remarks, failure_reason, overall_result, items, is_draft = false, is_batch_qc = false }) => {
    const form = new FormData();
    if (qc_check_uid != null) form.append("qc_check_uid", String(qc_check_uid));
    if (coil_no_uid != null) form.append("coil_no_uid", String(coil_no_uid));
    if (remarks != null) form.append("remarks", String(remarks));
    if (failure_reason != null) form.append("failure_reason", String(failure_reason));
    if (overall_result != null) form.append("overall_result", String(overall_result));
    if (is_draft) form.append("is_draft", "true");
    if (is_batch_qc) form.append("is_batch_qc", "true");
    form.append(
      "items",
      JSON.stringify(
        (items || []).map((it) => ({
          spec_id: it.spec_id,
          actual_value: it.actual_value,
        }))
      )
    );
    for (const it of items || []) {
      if (it?.document_file instanceof File) {
        form.append(`doc_${it.spec_id}`, it.document_file);
      }
    }
    return postMultipart(ENDPOINTS.QC_CHECK.SUBMIT, form);
  },
};
