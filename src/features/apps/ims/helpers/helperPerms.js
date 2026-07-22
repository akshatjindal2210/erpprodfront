/** IMS /helper body — send the page the user is on, not the helper module name. */
export function helperPerms(page, action = "view") {
  return { permission_module: page, permission_action: action };
}
