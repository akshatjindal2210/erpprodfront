import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const U = ENDPOINTS.USERS;

export const userService = {
  getAll: (params) => api.post(U.LIST, params),
  getById: (id) => api.post(U.GET, { id }),
  getViews: (params = {}) => api.post(U.HELPER, params),
  create: (data) => api.post(U.CREATE, data),
  update: (id, data) => api.post(U.UPDATE, { id, ...data }),
  delete: (id) => api.post(U.DELETE, { id }),

  getProfile: () => api.get(U.PROFILE),
  updateProfile: (data) => api.put(U.PROFILE, data),
  changePassword: (data) => api.put(U.PASSWORD, data),

  getStats: () => api.get(U.STATS),

  login: (credentials) => api.post(U.LOGIN, credentials),
  logout: () => api.post(U.LOGOUT),
};

