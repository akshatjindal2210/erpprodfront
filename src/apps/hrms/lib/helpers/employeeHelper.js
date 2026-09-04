import { employeeService } from "@/apps/hrms/lib/services/hrms";
import { helperPerms } from "@/apps/hrms/lib/helpers/helperPerms";

export const HRMS_EMPLOYEE_MODULE = "hrms_employee";

function missingHelperPage(method) {
  return {
    success: false,
    message: `${method}: permission_module required — pass current page (e.g. hrms_attendance)`,
    data: [],
    total: 0,
  };
}

/** User has Employee Master page access — full list/get APIs. */
export function hasEmployeeMasterAccess(canAccess) {
  if (typeof canAccess !== "function") return false;
  return canAccess(HRMS_EMPLOYEE_MODULE, "view").allowed;
}

/**
 * Load employees for a page — IMS-style simple if/else:
 * - has hrms_employee view → /employees/list (full master)
 * - else → /employees/helper with permission_module = calling page
 */
export async function fetchEmployeesForPage({ canAccess, pageModule, pageAction = "view", ...params } = {}) {
  if (hasEmployeeMasterAccess(canAccess)) {
    return employeeService.list({ page: 1, limit: 50000, sortBy: "emp_code", order: "ASC", ...params });
  }

  if (!pageModule) return missingHelperPage("fetchEmployeesForPage");

  return employeeService.helper({ sortBy: "emp_code", order: "ASC", ...params, ...helperPerms(pageModule, pageAction)});
}

/** Single employee — full get when master access, else compact helper row. */
export async function fetchEmployeeForPage({ canAccess, pageModule, pageAction = "view", emp_code, emp_dcode, id } = {}) {
  if (hasEmployeeMasterAccess(canAccess)) {
    return employeeService.get({ emp_code, emp_dcode });
  }

  if (!pageModule) {
    return { success: false, message: "pageModule required when employee master access is missing", data: null };
  }

  return employeeService.helper({ emp_code, emp_dcode, id: id ?? emp_dcode, ...helperPerms(pageModule, pageAction) });
}

/** Dropdown / AsyncSelect fetch — pass through search + pagination. */
export async function fetchEmployeeViews({ canAccess, pageModule, pageAction = "view", ...params } = {}) {
  const { permission_module, permission_action, ...rest } = params;

  if (hasEmployeeMasterAccess(canAccess)) {
    return employeeService.list({
      page: rest.page ?? 1,
      limit: rest.limit ?? 50000,
      sortBy: rest.sortBy ?? "emp_code",
      order: rest.order ?? "ASC",
      search: rest.search,
      filters: rest.filters,
    });
  }

  const moduleName = pageModule ?? permission_module;
  if (!moduleName) return missingHelperPage("fetchEmployeeViews");

  return employeeService.helper({...rest, ...helperPerms(moduleName, pageAction ?? permission_action ?? "view")});
}
