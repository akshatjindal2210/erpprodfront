import { api } from "@/platform/api/apiClient";
import { API_BASE_URL } from "@/platform/utils/core/lib";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";

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

/** list: type "" | "register" · register may send from_date/to_date (all local on Gate Entry). */
export const invoiceReceivingService = {
  list: (type = "", { from_date, to_date, fromDate, toDate, gate_registered_only } = {}) => {
    const body = { type: type == null ? "" : String(type) };
    const from = from_date ?? fromDate;
    const to = to_date ?? toDate;
    if (from) body.from_date = String(from).slice(0, 10);
    if (to) body.to_date = String(to).slice(0, 10);
    if (gate_registered_only) body.gate_registered_only = true;
    return api(ENDPOINTS.INVOICE_RECEIVING.LIST, { method: "POST", body });
  },

  update: async ({ files = [], file, existing_paths = [], mode = "add", approved, remarks, prnbillno, billdt, uploaded_by, uploaded_at, acc_name }) => {
    const form = new FormData();
    form.append("mode", String(mode || "add"));
    if (approved != null) form.append("approved", approved ? "true" : "false");
    if (remarks != null) form.append("remarks", String(remarks));

    const fields = { prnbillno, billdt, uploaded_by, uploaded_at, acc_name };
    Object.entries(fields).forEach(([key, value]) => {
      if (value == null || value === "") return;
      form.append(key, String(value));
    });

    const paths = Array.isArray(existing_paths) ? existing_paths.filter(Boolean) : [];
    if (paths.length) form.append("existing_paths", JSON.stringify(paths));

    const uploads = [...(Array.isArray(files) ? files : []), ...(file instanceof File ? [file] : [])];
    uploads.forEach((f) => {
      if (f instanceof File) form.append("attachments", f);
    });

    return postMultipart(ENDPOINTS.INVOICE_RECEIVING.UPDATE, form);
  },

  /** Clears receiving on Gate Entry (register/pending row → pending again). */
  remove: ({ prnbillno, billdt }) =>
    api(ENDPOINTS.INVOICE_RECEIVING.DELETE, {
      method: "POST",
      body: { prnbillno, billdt },
    }),
};
