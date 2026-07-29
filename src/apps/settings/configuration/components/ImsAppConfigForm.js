"use client";

import AppConfigScopedForm from "@/apps/settings/configuration/components/AppConfigScopedForm";
import { IMS_APP_CONFIG } from "@/apps/ims/lib/config/app.config";

export default function ImsAppConfigForm() {
  return <AppConfigScopedForm config={IMS_APP_CONFIG} />;
}
