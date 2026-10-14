"use client";

import AppConfigScopedForm from "@/apps/settings/configuration/components/AppConfigScopedForm";
import { ENGINEERING_APP_CONFIG } from "@/apps/engineering/lib/config/app.config";

export default function EngineeringAppConfigForm() {
  return <AppConfigScopedForm config={ENGINEERING_APP_CONFIG} />;
}
