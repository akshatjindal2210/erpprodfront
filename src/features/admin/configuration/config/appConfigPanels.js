import ImsAppConfigForm from "../components/ImsAppConfigForm";
import TaskAppConfigForm from "../components/TaskAppConfigForm";

/** appId → settings form panel. New app: registry + component map here. */
export const APP_CONFIG_PANELS = {
  ims: ImsAppConfigForm,
  task: TaskAppConfigForm,
};

export function getAppConfigPanel(appId) {
  return APP_CONFIG_PANELS[appId] ?? null;
}

