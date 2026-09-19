const BASE = "/hrms";

export const ENDPOINTS = {
  ATTENDANCE_LOG: {
    LIST: `${BASE}/attendance-log/list`,
    SYNC: `${BASE}/attendance-log/sync`,
    DELETE: `${BASE}/attendance-log/delete`,
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
  GATE_PASS: {
    LIST: `${BASE}/gate-pass/list`,
    SUBMIT: `${BASE}/gate-pass/submit`,
    UPDATE: `${BASE}/gate-pass/update`,
    VERIFY_HR: `${BASE}/gate-pass/verify/hr`,
    VERIFY_MANAGER: `${BASE}/gate-pass/verify/manager`,
    DELETE: `${BASE}/gate-pass/delete`,
  },
};
