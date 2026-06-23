import api from "@/features/apps/task/helpers/apiHelper";
import { CORE_ENDPOINTS } from "@/core/api/endpoints";
import { CL_TASK_DEFAULTS_PREF } from "@/config/userAppPreferences";

const BASE = CORE_ENDPOINTS.USER_PREFERENCES;

export const userPreferenceService = {
  get: (app_type, pref_key) =>
    api.get(BASE, { params: { app_type, pref_key } }),

  set: (app_type, pref_key, pref_value) =>
    api.put(BASE, { app_type, pref_key, pref_value }),

  getClTaskDefaults: () =>
    userPreferenceService.get(CL_TASK_DEFAULTS_PREF.app_type, CL_TASK_DEFAULTS_PREF.pref_key),

  saveClTaskDefaults: (pref_value) =>
    userPreferenceService.set(
      CL_TASK_DEFAULTS_PREF.app_type,
      CL_TASK_DEFAULTS_PREF.pref_key,
      pref_value
    ),
};
