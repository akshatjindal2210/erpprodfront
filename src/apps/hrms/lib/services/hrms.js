import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/hrms/lib/config/endpoints";

export const attendanceLogService = {
  list(body = {}) {
    return api(ENDPOINTS.ATTENDANCE_LOG.LIST, { method: "POST", body });
  },
  sync(body = {}) {
    return api(ENDPOINTS.ATTENDANCE_LOG.SYNC, { method: "POST", body });
  },
};

export const attendanceService = {
  list(body = {}) {
    return api(ENDPOINTS.ATTENDANCE.LIST, { method: "POST", body });
  },
  mark(body) {
    return api(ENDPOINTS.ATTENDANCE.MARK, { method: "POST", body });
  },
  preview(body) {
    return api(ENDPOINTS.ATTENDANCE.PREVIEW, { method: "POST", body });
  },
  submit(body) {
    return api(ENDPOINTS.ATTENDANCE.SUBMIT, { method: "POST", body });
  },
  update(body) {
    return api(ENDPOINTS.ATTENDANCE.UPDATE, { method: "POST", body });
  },
  delete(id) {
    return api(ENDPOINTS.ATTENDANCE.DELETE, { method: "POST", body: typeof id === "object" ? id : { id } });
  },
  approve(body) {
    return api(ENDPOINTS.ATTENDANCE.APPROVE, { method: "POST", body });
  },
};

export const employeeService = {
  list(body = {}) {
    return api(ENDPOINTS.EMPLOYEE.LIST, { method: "POST", body });
  },
  get(body) {
    return api(ENDPOINTS.EMPLOYEE.GET, { method: "POST", body });
  },
  helper(body = {}) {
    return api(ENDPOINTS.EMPLOYEE.HELPER, { method: "POST", body });
  },
};
