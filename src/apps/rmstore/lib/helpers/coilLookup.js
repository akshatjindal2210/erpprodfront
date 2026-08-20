import { coilService } from "@/apps/rmstore/lib/services/coil";

/**
 * Build permission context for POST /coils/helper (same pattern as store-locations/helper).
 * Caller module must be listed in backend helperViews fieldsForCoils.
 */
export function coilHelperContext(permissionModule, permissionAction = "view") {
  return {
    permission_module: permissionModule,
    permission_action: permissionAction,
  };
}

function missingHelperPage(fnName) {
  return Promise.resolve({
    success: false,
    message: `permission_module required for ${fnName}`,
    data: null,
    total: 0,
  });
}

/** Fetch one coil by UID via helper — for users without rm_coils module access. */
export async function lookupCoilByUid(coil_no_uid, ctx) {
  const uid = String(coil_no_uid || "").trim();
  if (!uid) return null;
  if (!ctx?.permission_module) {
    const res = await missingHelperPage("lookupCoilByUid");
    throw new Error(res.message);
  }
  const res = await coilService.getViews({ coil_no_uid: uid, ...ctx });
  if (res?.success === false) throw new Error(res?.message || "Could not load coil details.");
  return res?.data ?? null;
}

/** List/search coils via helper — same filters as coil list API. */
export async function lookupCoils(params, ctx) {
  if (!ctx?.permission_module) return missingHelperPage("lookupCoils");
  return coilService.getViews({ ...(params || {}), ...ctx });
}
