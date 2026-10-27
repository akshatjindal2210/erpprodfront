"use client";

import AppConfigScopedForm from "@/apps/settings/configuration/components/AppConfigScopedForm";
import { PRODUCTION_APP_CONFIG } from "@/apps/production/lib/config/app.config";

export default function ProductionAppConfigForm() {
  return <AppConfigScopedForm config={PRODUCTION_APP_CONFIG} />;
}
