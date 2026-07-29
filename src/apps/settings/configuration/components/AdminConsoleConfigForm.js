"use client";

import AppConfigScopedForm from "@/apps/settings/configuration/components/AppConfigScopedForm";
import { ADMIN_CONSOLE_APP_CONFIG } from "@/apps/settings/configuration/config/globalApp.config";

export default function AdminConsoleConfigForm() {
  return <AppConfigScopedForm config={ADMIN_CONSOLE_APP_CONFIG} />;
}
