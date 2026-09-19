import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/hrms/lib/config/endpoints";

export const attendanceLogService = {
  list(body = {}) {
    return api(ENDPOINTS.ATTENDANCE_LOG.LIST, { method: "POST", body });
  },
  sync(body = {}) {
    return api(ENDPOINTS.ATTENDANCE_LOG.SYNC, { method: "POST", body });
  },
  delete(id) {
    return api(ENDPOINTS.ATTENDANCE_LOG.DELETE, { method: "POST", body: typeof id === "object" ? id : { id } });
  },
  image(body = {}) {
    return api(ENDPOINTS.ATTENDANCE_LOG.IMAGE, { method: "POST", body });
  },
};

export const attendanceService = {
  list(body = {}) {
    return api(ENDPOINTS.ATTENDANCE.LIST, { method: "POST", body });
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
};

export const gatePassService = {
  list(body = {}) {
    return api(ENDPOINTS.GATE_PASS.LIST, { method: "POST", body });
  },
  submit(body) {
    return api(ENDPOINTS.GATE_PASS.SUBMIT, { method: "POST", body });
  },
  update(body) {
    return api(ENDPOINTS.GATE_PASS.UPDATE, { method: "POST", body });
  },
  verifyHr(body) {
    return api(ENDPOINTS.GATE_PASS.VERIFY_HR, { method: "POST", body });
  },
  verifyManager(body) {
    return api(ENDPOINTS.GATE_PASS.VERIFY_MANAGER, { method: "POST", body });
  },
  delete(id) {
    return api(ENDPOINTS.GATE_PASS.DELETE, { method: "POST", body: typeof id === "object" ? id : { id } });
  },
};

export const employeeService = {
  list(body = {}) {
    return api(ENDPOINTS.EMPLOYEE.LIST, { method: "POST", body });
  },
  sync(body = {}) {
    return api(ENDPOINTS.EMPLOYEE.SYNC, { method: "POST", body });
  },
  helper(body = {}) {
    return api(ENDPOINTS.EMPLOYEE.HELPER, { method: "POST", body });
  },
  updateMachine(body = {}) {
    return api(ENDPOINTS.EMPLOYEE.MACHINE_UPDATE, { method: "POST", body });
  },
  deactivateMachine(body = {}) {
    return api(ENDPOINTS.EMPLOYEE.MACHINE_DEACTIVATE, { method: "POST", body });
  },
};
