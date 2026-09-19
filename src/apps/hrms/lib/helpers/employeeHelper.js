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

/** Helper list returns rows[]; single lookup returns one object. */
export function employeeHelperRows(data) {
  if (data == null) return [];
  return Array.isArray(data) ? data : [data];
}

export async function fetchEmployeeByDcode({ pageModule, pageAction = "view", emp_dcode } = {}) {
  const id = emp_dcode;
  if (id == null || String(id).trim() === "") return null;
  const res = await fetchEmployeeViews({ pageModule, pageAction, emp_dcode: id, id });
  return employeeHelperRows(res.data)[0] ?? null;
}
