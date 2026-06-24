import AdminConsoleConfigForm from "../components/AdminConsoleConfigForm";
import ImsAppConfigForm from "../components/ImsAppConfigForm";
import TaskAppConfigForm from "../components/TaskAppConfigForm";
import ShortcutConfigForm from "../components/ShortcutConfigForm";

/** appId → settings form panel. New app: registry + component map here. */
export const APP_CONFIG_PANELS = {
  "admin-console": AdminConsoleConfigForm,
  ims: ImsAppConfigForm,
  task: TaskAppConfigForm,
  shortcut: ShortcutConfigForm,
};

export function getAppConfigPanel(appId) {
  return APP_CONFIG_PANELS[appId] ?? null;
}

