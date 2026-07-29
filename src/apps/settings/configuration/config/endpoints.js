/** Portal settings — IMS API paths (users, modules, permissions). */
const CORE_API = "/core";

export const ENDPOINTS = {
  USERS: {
    LIST: `${CORE_API}/auth/users/list`,
    ME: `${CORE_API}/auth/me`,
    GET: `${CORE_API}/auth/users/get`,
    CREATE: `${CORE_API}/auth/users/create`,
    UPDATE: `${CORE_API}/auth/users/update`,
    DELETE: `${CORE_API}/auth/users/delete`,
    LOGIN: `${CORE_API}/auth/login`,
    LOGOUT: `${CORE_API}/auth/logout`,
    VIEWS: `${CORE_API}/auth/users/helper`,
    IMS_LIST: `${CORE_API}/auth/users/ims`,
  },

  MODULES: {
    LIST: `${CORE_API}/auth/modules/list`,
    GET: `${CORE_API}/auth/modules/get`,
    CREATE: `${CORE_API}/auth/modules/create`,
    UPDATE: `${CORE_API}/auth/modules/update`,
    TOGGLE_STATUS: `${CORE_API}/auth/modules/toggle-status`,
    VIEWS: `${CORE_API}/auth/modules/helper`,
  },

  PERMISSIONS: {
    LIST: `${CORE_API}/auth/permissions/list`,
    CREATE: `${CORE_API}/auth/permissions/set`,
    BULK_CREATE: `${CORE_API}/auth/permissions/set-bulk`,
    GET: `${CORE_API}/auth/permissions/get`,
    UPDATE: `${CORE_API}/auth/permissions/update`,
    DELETE: `${CORE_API}/auth/permissions/remove`,
  },
};
