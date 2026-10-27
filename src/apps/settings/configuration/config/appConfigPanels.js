import AdminConsoleConfigForm from "../components/AdminConsoleConfigForm";
import ImsAppConfigForm from "../components/ImsAppConfigForm";
import RmstoreAppConfigForm from "../components/RmstoreAppConfigForm";
import TaskAppConfigForm from "../components/TaskAppConfigForm";
import HrmsAppConfigForm from "../components/HrmsAppConfigForm";
import EngineeringAppConfigForm from "../components/EngineeringAppConfigForm";
import ProductionAppConfigForm from "../components/ProductionAppConfigForm";
import ShortcutConfigForm from "../components/ShortcutConfigForm";

/** appId → settings form panel. New app: registry + component map here. */
export const APP_CONFIG_PANELS = {
  "admin-console": AdminConsoleConfigForm,
  ims: ImsAppConfigForm,
  rmstore: RmstoreAppConfigForm,
  hrms: HrmsAppConfigForm,
  engineering: EngineeringAppConfigForm,
  production: ProductionAppConfigForm,
  task: TaskAppConfigForm,
  shortcut: ShortcutConfigForm,
};

export function getAppConfigPanel(appId) {
  return APP_CONFIG_PANELS[appId] ?? null;
}

