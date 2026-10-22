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
    QR: `${BASE}/machine-master/qr`,
    CREATE: `${BASE}/machine-master/create`,
    UPDATE: `${BASE}/machine-master/update`,
    DELETE: `${BASE}/machine-master/delete`,
    HELPER: `${BASE}/machine-master/helper`,
  },
  /** Same table as RM Store Item RM Master (`rmstore_master_production`). */
  PRIME_ITEM_MASTER: {
    LIST: `${BASE}/prime-item-master/list`,
    GET: `${BASE}/prime-item-master/get`,
    CREATE: `${BASE}/prime-item-master/create`,
    UPDATE: `${BASE}/prime-item-master/update`,
    DELETE: `${BASE}/prime-item-master/delete`,
    APPROVE: `${BASE}/prime-item-master/approve`,
    PRODUCTION_ITEMS_VIEWS: `${BASE}/prime-item-master/production-items/helper`,
    RM_ITEMS_VIEWS: `${BASE}/prime-item-master/rm-items/helper`,
  },
  FINISH_PROCESS_MASTER: {
    LIST: `${BASE}/finish-process-master/list`,
    GET: `${BASE}/finish-process-master/get`,
    CREATE: `${BASE}/finish-process-master/create`,
    UPDATE: `${BASE}/finish-process-master/update`,
    DELETE: `${BASE}/finish-process-master/delete`,
    APPROVE: `${BASE}/finish-process-master/approve`,
    PRODUCTION_ITEMS_VIEWS: `${BASE}/finish-process-master/production-items/helper`,
    RM_ITEMS_VIEWS: `${BASE}/finish-process-master/rm-items/helper`,
  },
};
