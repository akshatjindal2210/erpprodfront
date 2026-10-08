/**
 * Engineering /helper body (IMS style).
 * Pass the PAGE the user is on — not the helper module name.
 *
 * @example
 *   processMasterService.getViews({
 *     ...params,
 *     ...helperPerms(ENG_MODULES.MACHINE_MASTER, sopPermissionType),
 *     filters: { approved: true },
 *   })
 */
export function helperPerms(page, action = "view") {
  return { permission_module: page, permission_action: action };
}
