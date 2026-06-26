/** IMS /helper body — user jis page par hai woh bhejo, helper module nahi. */
export function helperPerms(page, action = "view") {
  return { permission_module: page, permission_action: action };
}
