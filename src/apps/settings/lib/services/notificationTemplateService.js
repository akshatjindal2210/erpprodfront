import { api } from "@/platform/api/apiClient";
import { CORE_ENDPOINTS as ENDPOINTS } from "@/platform/api/endpoints";

const N = ENDPOINTS.NOTIFICATION_TEMPLATES;

/** Module notification templates (managed from Training & SOPs) — templates CRUD, sent history, form options. */
export const notificationTemplateService = {
  getAll: (params) => api(N.LIST, { method: "POST", body: params }),
  getById: (id) => api(N.GET, { method: "POST", body: { id } }),
  create: (data) => api(N.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(N.UPDATE, { method: "POST", body: { id, ...data } }),
  toggle: (id, is_active) => api(N.TOGGLE, { method: "POST", body: { id, is_active } }),
  delete: (id) => api(N.DELETE, { method: "POST", body: { id } }),
  getLogs: (params) => api(N.LOGS, { method: "POST", body: params }),
  getOptions: () => api(N.OPTIONS, { method: "POST", body: {} }),
  previewRecipients: (audienceOrType, recipient_refs) =>
    api(N.RECIPIENTS_PREVIEW, { method: "POST", body:
        audienceOrType && typeof audienceOrType === "object" && !Array.isArray(audienceOrType)
          ? { audience: audienceOrType }
          : { recipient_type: audienceOrType, recipient_refs },
    }),
};
