import { isMobileDevice } from "@/platform/utils/pwa/pwa";
import { isRmstoreSuperAdmin } from "@/apps/rmstore/lib/utils/rmstoreSpecialPermissions";

/** MRN Portal + Stock Adjustment approve scan — keyboard type on phone only (normal users). */
export function resolveRmApproveKeyboardScan(keyboardTypeEnabled, user, role) {
  if (!keyboardTypeEnabled) return false;
  const isSuperAdmin =
    isRmstoreSuperAdmin(user) ||
    String(role || "").toLowerCase() === "super_admin";
  return isMobileDevice() || isSuperAdmin;
}
