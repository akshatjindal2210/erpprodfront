import { useCallback } from "react";
import { useSelector } from "react-redux";
import { MODULE_APP_KEY, APP_META } from "@/config/moduleAppRegistry";

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
  const role        = useSelector((state) => state.auth.role);
  const permissions = useSelector((state) => state.auth.permissions);
  const appAccess   = useSelector((state) => state.auth.app_access || {});

  const checkAccess = useCallback((module, action = "view") => {
    // 1. Super Admin
    if (role?.toLowerCase() === "super_admin") return FULL_ACCESS;

    // 2. Default allow if no module specified (for truly public pages if any)
    if (!module) return FULL_ACCESS;

    // 3. Check App Level Access first
    const appKey = MODULE_APP_KEY[module];
    if (appKey) {
      if (!appAccess[appKey]) {
        return NO_ACCESS;
      }
      
      // If the app doesn't use granular permissions, allow full access if app access is ON
      if (APP_META[appKey]?.permissions === false) {
        return FULL_ACCESS;
      }
    }

    // 4. Check permission
    const perm = permissions?.find(p => p.module_name === module);
    
    // 5. Module row missing or explicitly deactivated
    if (!perm || isModuleDeactivated(perm.module_is_active)) return NO_ACCESS;

    // 6. Action Permission Check
    return {
      allowed: !!perm[`can_${action}`],
      days:    parseInt(perm[`can_${action}_days`] || 0, 10),
    };
  }, [role, permissions, appAccess]);

  return checkAccess;
};
