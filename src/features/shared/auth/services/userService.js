import { api } from "@/core/api/apiClient";
import { CORE_ENDPOINTS as ENDPOINTS } from "@/core/api/endpoints";

export const userService = {
  login: (credentials) => api(ENDPOINTS.AUTH.LOGIN, { method: "POST", body: credentials }),
  logout: () => api(ENDPOINTS.AUTH.LOGOUT, { method: "POST" }),
  me: (options = {}) => api(ENDPOINTS.AUTH.ME, { method: "GET", ...options }),

  changePassword: (data) => api(ENDPOINTS.AUTH.CHANGE_PASSWORD, { method: "PUT", body: data }),

  getAll: (params) => api(ENDPOINTS.USERS.LIST, { method: "POST", body: params }),

  getImsUsers: (params = {}) => api(ENDPOINTS.USERS.IMS, { method: "POST", body: params }),

  getById: (id) => api(ENDPOINTS.USERS.GET, { method: "POST", body: { id } }),

  create: (data) => api(ENDPOINTS.USERS.CREATE, { method: "POST", body: data }),

  update: (id, data) => api(ENDPOINTS.USERS.UPDATE, { method: "POST", body: { id, ...data } }),

  delete: (id) => api(ENDPOINTS.USERS.DELETE, { method: "POST", body: { id } }),

  getViews: (body = {}) => api(ENDPOINTS.USERS.HELPER, { method: "POST", body }),
};

