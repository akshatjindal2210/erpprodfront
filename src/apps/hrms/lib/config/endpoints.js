const BASE = "/hrms";

export const ENDPOINTS = {
  ATTENDANCE_LOG: {
    LIST: `${BASE}/attendance-log/list`,
    SYNC: `${BASE}/attendance-log/sync`,
    IMAGE: `${BASE}/attendance-log/image`,
  },
  ATTENDANCE: {
    LIST: `${BASE}/attendance/list`,
    PREVIEW: `${BASE}/attendance/preview`,
    SUBMIT: `${BASE}/attendance/submit`,
    UPDATE: `${BASE}/attendance/update`,
    DELETE: `${BASE}/attendance/delete`,
  },
  EMPLOYEE: {
    LIST: `${BASE}/employees/list`,
    SYNC: `${BASE}/employees/sync`,
    HELPER: `${BASE}/employees/helper`,
    MACHINE_UPDATE: `${BASE}/employees/machine/update`,
    MACHINE_DEACTIVATE: `${BASE}/employees/machine/deactivate`,
  },
};
