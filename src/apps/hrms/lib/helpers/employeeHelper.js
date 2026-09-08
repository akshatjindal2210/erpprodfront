import { employeeService } from "@/apps/hrms/lib/services/hrms";

/** Cross-module employee pickers — always /helper with page perms (same as IMS). */
export async function fetchEmployeeViews({ pageModule, pageAction = "view", ...params } = {}) {
  const moduleName = pageModule;
  if (!moduleName) return { success: false, message: "pageModule required", data: [], total: 0 };
  return employeeService.helper({
    ...params,
    permission_module: moduleName,
    permission_action: pageAction,
  });
}
