import { useCallback } from "react";
import { useSelector } from "react-redux";
import { selectRole, selectPermissions } from "@/features/authSlice";

const FULL_ACCESS = { allowed: true,  days: 0 };
const NO_ACCESS   = { allowed: false, days: 0 };

/** match authSlice / PermissionGuard: missing flag = treat as active */
function isModuleDeactivated(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") {
    const n = value.trim().toLowerCase();
    return n === "0" || n === "false" || n === "inactive" || n === "off";
  }
  return value === false || value === 0;
}

export const useCanAccess = () => {
  const role        = useSelector(selectRole);
  const permissions = useSelector(selectPermissions);

  const checkAccess = useCallback((module, action = "view") => {
    // 1. Super Admin
    if (role === "super_admin") return FULL_ACCESS;

    // 2. Default allow if no module specified (for truly public pages if any)
    if (!module) return FULL_ACCESS;

    // 3. Check permission
    const perm = permissions?.find(p => p.module_name === module);
    
    // 4. Module row missing or explicitly deactivated
    if (!perm || isModuleDeactivated(perm.module_is_active)) return NO_ACCESS;

    // 5. Action Permission Check
    return {
      allowed: !!perm[`can_${action}`],
      days:    parseInt(perm[`can_${action}_days`] || 0, 10),
    };
  }, [role, permissions]);

  return checkAccess;
};
