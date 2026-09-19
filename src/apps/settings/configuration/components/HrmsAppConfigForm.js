"use client";

import AppConfigScopedForm from "@/apps/settings/configuration/components/AppConfigScopedForm";
import { HRMS_APP_CONFIG } from "@/apps/hrms/lib/config/app.config";

export default function HrmsAppConfigForm() {
  return <AppConfigScopedForm config={HRMS_APP_CONFIG} />;
}
