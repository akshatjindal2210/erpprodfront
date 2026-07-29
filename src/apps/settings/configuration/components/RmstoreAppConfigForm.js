"use client";

import AppConfigScopedForm from "@/apps/settings/configuration/components/AppConfigScopedForm";
import { RMSTORE_APP_CONFIG } from "@/apps/rmstore/lib/config/app.config";

export default function RmstoreAppConfigForm() {
  return <AppConfigScopedForm config={RMSTORE_APP_CONFIG} />;
}
