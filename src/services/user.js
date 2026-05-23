import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const userService = {
  // ===================== CRUD =====================
  getAll:  (params, opts = {}) => api(ENDPOINTS.USERS.LIST, { method: "POST", body: params, signal: opts.signal }),
  getById: (id)     => api(ENDPOINTS.USERS.GET,    { method: "POST", body: { id } }),
  create:  (data)   => api(ENDPOINTS.USERS.CREATE, { method: "POST", body: data }),
  update:  (id, data) => api(ENDPOINTS.USERS.UPDATE, { method: "POST", body: { id, ...data } }),
  delete:  (id)     => api(ENDPOINTS.USERS.DELETE, { method: "POST", body: { id } }),
  me:      ()       => api(ENDPOINTS.USERS.ME, { method: "POST", body: {} }),

  // ===================== AUTHENTICATION =====================
  login:  (credentials) => api(ENDPOINTS.USERS.LOGIN,  { method: "POST", body: credentials }),
  logout: ()            => api(ENDPOINTS.USERS.LOGOUT, { method: "POST" }),
  getViews: (params)    => api(ENDPOINTS.USERS.VIEWS, { method: "POST", body: params }),
  getViewById: (id, perms = {}) => api(ENDPOINTS.USERS.VIEWS, { method: "POST", body: { id, ...perms } }),
  getImsUsers: (params = {}) => api(ENDPOINTS.USERS.IMS_LIST, { method: "POST", body: params }),
};