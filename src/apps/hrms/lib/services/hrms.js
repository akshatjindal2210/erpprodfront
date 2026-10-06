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

export const otApprovalService = {
  list(body = {}) {
    return api(ENDPOINTS.OT_APPROVAL.LIST, { method: "POST", body });
  },
  approve(body) {
    return api(ENDPOINTS.OT_APPROVAL.APPROVE, { method: "POST", body });
  },
  reject(body) {
    return api(ENDPOINTS.OT_APPROVAL.REJECT, { method: "POST", body });
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
  verifyApprove(body) {
    return api(ENDPOINTS.GATE_PASS.VERIFY_APPROVE, { method: "POST", body });
  },
  verifyManager(body) {
    return api(ENDPOINTS.GATE_PASS.VERIFY_MANAGER, { method: "POST", body });
  },
  view(id) {
    return api(ENDPOINTS.GATE_PASS.VIEW, { method: "POST", body: { id } });
  },
  scan(body) {
    return api(ENDPOINTS.GATE_PASS.SCAN, { method: "POST", body });
  },
  delete(id) {
    return api(ENDPOINTS.GATE_PASS.DELETE, { method: "POST", body: typeof id === "object" ? id : { id } });
  },
};

export const leaveService = {
  list(body = {}) {
    return api(ENDPOINTS.LEAVE.LIST, { method: "POST", body });
  },
  submit(body) {
    return api(ENDPOINTS.LEAVE.SUBMIT, { method: "POST", body });
  },
  update(body) {
    return api(ENDPOINTS.LEAVE.UPDATE, { method: "POST", body });
  },
  verifyApprove(body) {
    return api(ENDPOINTS.LEAVE.VERIFY_APPROVE, { method: "POST", body });
  },
  verifyManager(body) {
    return api(ENDPOINTS.LEAVE.VERIFY_MANAGER, { method: "POST", body });
  },
  delete(id) {
    return api(ENDPOINTS.LEAVE.DELETE, { method: "POST", body: typeof id === "object" ? id : { id } });
  },
};

export const loanService = {
  list(body = {}) {
    return api(ENDPOINTS.LOAN.LIST, { method: "POST", body });
  },
  submit(body) {
    return api(ENDPOINTS.LOAN.SUBMIT, { method: "POST", body });
  },
  update(body) {
    return api(ENDPOINTS.LOAN.UPDATE, { method: "POST", body });
  },
  verifyApprove(body) {
    return api(ENDPOINTS.LOAN.VERIFY_APPROVE, { method: "POST", body });
  },
  verifyManager(body) {
    return api(ENDPOINTS.LOAN.VERIFY_MANAGER, { method: "POST", body });
  },
  delete(id) {
    return api(ENDPOINTS.LOAN.DELETE, { method: "POST", body: typeof id === "object" ? id : { id } });
  },
  deductionsList(body) {
    return api(ENDPOINTS.LOAN.DEDUCTIONS_LIST, { method: "POST", body });
  },
};

export const loanDeductionService = {
  list(body = {}) {
    return api(ENDPOINTS.LOAN_DEDUCTION.LIST, { method: "POST", body });
  },
  detail(body) {
    return api(ENDPOINTS.LOAN_DEDUCTION.DETAIL, { method: "POST", body });
  },
  mark(body) {
    return api(ENDPOINTS.LOAN_DEDUCTION.MARK, { method: "POST", body });
  },
  undo(body) {
    return api(ENDPOINTS.LOAN_DEDUCTION.UNDO, { method: "POST", body });
  },
  approve(body) {
    return api(ENDPOINTS.LOAN_DEDUCTION.APPROVE, { method: "POST", body });
  },
  extra(body) {
    return api(ENDPOINTS.LOAN_DEDUCTION.EXTRA, { method: "POST", body });
  },
  extraUpdate(body) {
    return api(ENDPOINTS.LOAN_DEDUCTION.EXTRA_UPDATE, { method: "POST", body });
  },
  extraDelete(body) {
    return api(ENDPOINTS.LOAN_DEDUCTION.EXTRA_DELETE, { method: "POST", body });
  },
  delete(id) {
    return api(ENDPOINTS.LOAN_DEDUCTION.EXTRA_DELETE, { method: "POST", body: { id } });
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
