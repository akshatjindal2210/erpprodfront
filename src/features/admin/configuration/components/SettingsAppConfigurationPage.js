import { Suspense } from "react";
import AppConfigurationPage from "@/features/admin/configuration/components/AppConfigurationPage";

export default function SettingsAppConfigurationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-slate-500 text-sm font-semibold">Loading…</div>
      }
    >
      <AppConfigurationPage />
    </Suspense>
  );
}

