import { api } from "@/platform/api/apiClient";
import { CORE_ENDPOINTS as ENDPOINTS } from "@/platform/api/endpoints";

const S = ENDPOINTS.TRAINING.SOPS;

export const trainingVideoService = {
  getAll:  (params)   => api(ENDPOINTS.TRAINING.VIDEOS.LIST,   { method: "POST", body: params }),
  getById: (id, perms = {})       => api(ENDPOINTS.TRAINING.VIDEOS.GET,    { method: "POST", body: { id, ...perms } }),
  create:  (data)     => api(ENDPOINTS.TRAINING.VIDEOS.CREATE, { method: "POST", body: data }),
  update:  (id, data) => api(ENDPOINTS.TRAINING.VIDEOS.UPDATE, { method: "POST", body: { id, ...data } }),
  delete:  (id)       => api(ENDPOINTS.TRAINING.VIDEOS.DELETE, { method: "POST", body: { id } }),
  getViews: (params)  => api(ENDPOINTS.TRAINING.VIDEOS.VIEWS,  { method: "POST", body: params }),
  getViewById: (id, perms = {}) => api(ENDPOINTS.TRAINING.VIDEOS.VIEWS, { method: "POST", body: { id, ...perms } }),
};

export const moduleSopService = {
  getAll: (params) => api(S.LIST, { method: "POST", body: params }),
  getById: (id, perms = {}) => api(S.GET, { method: "POST", body: { id, ...perms } }),
  create: (data) => api(S.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(S.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id, perms = {}) => api(S.DELETE, { method: "POST", body: { id, ...perms } }),
  helper: (params) => api(S.HELPER, { method: "POST", body: params }),
};
