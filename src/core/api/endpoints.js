const CORE_API = "/core";

export const CORE_ENDPOINTS = {
  AUTH: {
    LOGIN: `${CORE_API}/auth/login`,
    LOGOUT: `${CORE_API}/auth/logout`,
    ME: `${CORE_API}/auth/me`,
    CHANGE_PASSWORD: `${CORE_API}/auth/password`,
    STATS: `${CORE_API}/auth/stats`,
  },
  USERS: {
    LIST: `${CORE_API}/auth/users/list`,
    IMS: `${CORE_API}/auth/users/ims`,
    GET: `${CORE_API}/auth/users/get`,
    CREATE: `${CORE_API}/auth/users/create`,
    UPDATE: `${CORE_API}/auth/users/update`,
    DELETE: `${CORE_API}/auth/users/delete`,
    HELPER: `${CORE_API}/auth/users/helper`,
  },
  PERMISSIONS: {
    LIST: `${CORE_API}/auth/permissions/list`,
    GET: `${CORE_API}/auth/permissions/get`,
    SET: `${CORE_API}/auth/permissions/set`,
    SET_BULK: `${CORE_API}/auth/permissions/set-bulk`,
    UPDATE: `${CORE_API}/auth/permissions/update`,
    REMOVE: `${CORE_API}/auth/permissions/remove`,
  },
  MODULES: {
    LIST: `${CORE_API}/auth/modules/list`,
    GET: `${CORE_API}/auth/modules/get`,
    CREATE: `${CORE_API}/auth/modules/create`,
    UPDATE: `${CORE_API}/auth/modules/update`,
    TOGGLE_STATUS: `${CORE_API}/auth/modules/toggle-status`,
    VIEWS: `${CORE_API}/auth/modules/helper`,
  },
  DEPARTMENTS: {
    LIST: `${CORE_API}/auth/departments/list`,
    GET: `${CORE_API}/auth/departments/get`,
    CREATE: `${CORE_API}/auth/departments/create`,
    UPDATE: `${CORE_API}/auth/departments/update`,
    DELETE: `${CORE_API}/auth/departments/delete`,
    HELPER: `${CORE_API}/auth/departments/helper`,
  },
  DESIGNATIONS: {
    LIST: `${CORE_API}/auth/designations/list`,
    GET: `${CORE_API}/auth/designations/get`,
    CREATE: `${CORE_API}/auth/designations/create`,
    UPDATE: `${CORE_API}/auth/designations/update`,
    DELETE: `${CORE_API}/auth/designations/delete`,
    HELPER: `${CORE_API}/auth/designations/helper`,
  },
  TRAINING: {
    VIDEOS: {
      LIST: `${CORE_API}/training/list`,
      GET: `${CORE_API}/training/get`,
      CREATE: `${CORE_API}/training/create`,
      UPDATE: `${CORE_API}/training/update`,
      DELETE: `${CORE_API}/training/delete`,
      VIEWS: `${CORE_API}/training/helper`,
    },
    SOPS: {
      LIST: `${CORE_API}/sop/list`,
      GET: `${CORE_API}/sop/get`,
      CREATE: `${CORE_API}/sop/create`,
      UPDATE: `${CORE_API}/sop/update`,
      DELETE: `${CORE_API}/sop/delete`,
      HELPER: `${CORE_API}/sop/helper`,
    }
  },
  APP_CONFIG: {
    LIST: "/app-config/list",
    UPDATE: "/app-config",
  },
};
