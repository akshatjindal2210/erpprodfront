/** HRMS /helper body — send the page the user is on, not hrms_employee. */
export function helperPerms(page, action = "view") {
  return { permission_module: page, permission_action: action };
}
