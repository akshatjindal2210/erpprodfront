"use client";

import AppConfigScopedForm from "@/apps/settings/configuration/components/AppConfigScopedForm";
import { TASK_APP_CONFIG } from "@/apps/task/lib/config/settingsApp.config";

export default function TaskAppConfigForm() {
  return <AppConfigScopedForm config={TASK_APP_CONFIG} />;
}
