import api from "@/apps/task/lib/helpers/apiHelper";
import { ENDPOINTS } from "@/apps/task/lib/config/endpoints";

const R = ENDPOINTS.CL_TASKS;

function isFormData(data) {
  return typeof FormData !== "undefined" && data instanceof FormData;
}

function withFormId(data, key, id) {
  if (!isFormData(data)) return data;
  if (!data.has(key)) data.append(key, String(id));
  return data;
}

export const clTaskService = {
  getAll: (params) => api.post(R.LIST, params || {}),
  getMy: (params) => api.post(R.MY, params || {}),
  getVerification: (params) => api.post(R.VERIFICATION, params || {}),

  create: (data) => api.post(R.CREATE, data),

  update: (id, data) => {
    if (isFormData(data)) {
      return api.post(R.UPDATE, withFormId(data, "cl_task_id", id), {
        headers: { "Content-Type": undefined },
      });
    }
    return api.post(R.UPDATE, { cl_task_id: id, ...(data || {}) });
  },

  /** DeleteModal calls `service.delete(id)`. */
  delete: (id) => api.post(R.DELETE, { cl_task_id: id }),

  setActive: (id, approved) => api.post(R.APPROVE, { cl_task_id: id, approved }),

  submit: (id, data) => {
    if (isFormData(data)) {
      if (id != null && id !== "") {
        return api.post(R.SUBMIT, withFormId(data, "instance_id", id), {
          headers: { "Content-Type": undefined },
        });
      }
      return api.post(R.SUBMIT, data, {
        headers: { "Content-Type": undefined },
      });
    }
    if (id != null && id !== "") {
      return api.post(R.SUBMIT, { instance_id: id, ...(data || {}) });
    }
    return api.post(R.SUBMIT, data || {});
  },

  updateSubmission: (id, data) => {
    if (isFormData(data)) {
      return api.post(R.SUBMISSION_UPDATE, withFormId(data, "instance_id", id), {
        headers: { "Content-Type": undefined },
      });
    }
    return api.post(R.SUBMISSION_UPDATE, { instance_id: id, ...(data || {}) });
  },

  verify: (id, data) => api.post(R.VERIFY, { instance_id: id, ...(data || {}) }),

  updateVerificationReview: (id, data) =>
    api.post(R.VERIFICATION_UPDATE, { instance_id: id, ...(data || {}) }),

  deleteInstance: (id) => api.post(R.INSTANCE_DELETE, { instance_id: id }),

  /** Instance + submission_fills timeline (multi-submit history). */
  getInstance: (params) => api.post(R.INSTANCE, params || {}),
};
