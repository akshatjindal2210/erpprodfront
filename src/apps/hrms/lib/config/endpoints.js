/** HRMS API endpoints — mounted at `/api/hrms/...` (client prepends `/api`). */
const BASE = "/hrms";

export const ENDPOINTS = {
  ATTENDANCE_LOG: {
    LIST: `${BASE}/attendance-log/list`,
    EVENTS: `${BASE}/attendance-log/events`,
    SYNC: `${BASE}/attendance-log/sync`,
  },
  ATTENDANCE: {
    LIST: `${BASE}/attendance/list`,
    MARK: `${BASE}/attendance/mark`,
    PREVIEW: `${BASE}/attendance/preview`,
    SUBMIT: `${BASE}/attendance/submit`,
    UPDATE: `${BASE}/attendance/update`,
    DELETE: `${BASE}/attendance/delete`,
    APPROVE: `${BASE}/attendance/approve`,
  },
  EMPLOYEE: {
    LIST: `${BASE}/employees/list`,
    GET: `${BASE}/employees/get`,
    HELPER: `${BASE}/employees/helper`,
  },
};
