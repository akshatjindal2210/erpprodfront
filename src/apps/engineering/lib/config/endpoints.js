const BASE = "/engineering";

export const ENDPOINTS = {
  PROCESS_MASTER: {
    LIST: `${BASE}/process-master/list`,
    GET: `${BASE}/process-master/get`,
    CREATE: `${BASE}/process-master/create`,
    UPDATE: `${BASE}/process-master/update`,
    DELETE: `${BASE}/process-master/delete`,
    HELPER: `${BASE}/process-master/helper`,
  },
  MACHINE_MASTER: {
    LIST: `${BASE}/machine-master/list`,
    GET: `${BASE}/machine-master/get`,
    CREATE: `${BASE}/machine-master/create`,
    UPDATE: `${BASE}/machine-master/update`,
    DELETE: `${BASE}/machine-master/delete`,
  },
};
