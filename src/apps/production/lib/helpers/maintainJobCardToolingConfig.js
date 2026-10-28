import { appConfigService } from "@/apps/settings/lib/services/appConfigService";
import { PRODUCTION_MAINTAIN_JOBCARD_TOOLING_KEY } from "@/apps/production/lib/config/app.config";

const asList = (val) => (Array.isArray(val) ? val : []);

/** App config: require tooling Yes before saving Maintain Job Card process plan. */
export async function fetchMaintainJobcardToolingRequired() {
  try {
    const res = await appConfigService.list("production");
    const item = asList(res?.data ?? res).find(
      (r) => String(r?.config_key ?? r?.key ?? "") === PRODUCTION_MAINTAIN_JOBCARD_TOOLING_KEY
    );
    const val = String(item?.config_value ?? item?.value ?? "").trim().toLowerCase();
    return val === "true";
  } catch {
    return false;
  }
}

export function toolingBlocksMaintainJobCardSave({ toolingRequired, toolingStatus, processTooling }) {
  if (!toolingRequired || !processTooling) return null;
  if (toolingStatus === "yes" || toolingStatus === true) return null;
  if (toolingStatus === "no" || toolingStatus === false) {
    return "Tooling is No — set Tooling to Yes in Production → Tooling before saving the process plan.";
  }
  return "Tooling is pending — approve tooling in Production → Tooling before saving the process plan.";
}
