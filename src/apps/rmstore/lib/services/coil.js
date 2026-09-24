import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";
import { rmApiViews } from "@/apps/rmstore/lib/helpers/sortDropdownResponse";

export const coilService = {
  getAll: (params) => api(ENDPOINTS.COIL.LIST, { method: "POST", body: params }),
  getByUid: (coil_no_uid) => api(ENDPOINTS.COIL.GET, { method: "POST", body: { coil_no_uid } }),
  getViews: (params) => rmApiViews(ENDPOINTS.COIL.HELPER, params, "coil_no_uid"),
  finderReport: (body) => api(ENDPOINTS.COIL.FINDER_REPORT, { method: "POST", body }),
};

/** POST /coils/helper — caller page module + action (same as IMS helper). */
export async function lookupCoilByUid(coil_no_uid, pageModule, action = "view", extra = {}) {
  const uid = String(coil_no_uid || "").trim();
  if (!uid) return null;
  const res = await coilService.getViews({
    coil_no_uid: uid,
    ...extra,
    permission_module: pageModule,
    permission_action: action,
  });
  if (res?.success === false) throw new Error(res?.message || "Could not load coil.");
  return res?.data ?? null;
}

export function lookupCoils(pageModule, params = {}, action = "view") {
  return coilService.getViews({ ...params, permission_module: pageModule, permission_action: action });
}
