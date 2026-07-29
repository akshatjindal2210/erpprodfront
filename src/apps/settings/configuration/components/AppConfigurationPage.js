"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AppConfigTabBar from "@/apps/settings/configuration/components/AppConfigTabBar";
import {
  buildAppConfigTabHref,
  parseAppConfigTabFromSearchParams,
} from "@/apps/settings/configuration/config/appConfigTabsRegistry";
import { getAppConfigPanel } from "@/apps/settings/configuration/config/appConfigPanels";

export default function AppConfigurationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeAppId = useMemo(() => parseAppConfigTabFromSearchParams(searchParams), [searchParams]);

  const setApp = useCallback(
    (appId) => {
      router.replace(buildAppConfigTabHref(appId));
    },
    [router]
  );

  const ActivePanel = getAppConfigPanel(activeAppId);

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <AppConfigTabBar activeId={activeAppId} onSelect={setApp} />

        <div
          id={`app-config-panel-${activeAppId}`}
          role="tabpanel"
          aria-labelledby={`app-config-tab-${activeAppId}`}
          className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white"
        >
          {ActivePanel ? <ActivePanel /> : null}
        </div>
      </div>
    </div>
  );
}

