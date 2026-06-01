"use client";

import RootLayoutComponent from "@/core/layouts/RootLayout";
import PermissionGuard from "@/core/components/guards/PermissionGuard";
import AppGuard from "@/core/components/guards/AppGuard";
import { APP_SHELL } from "@/config/appsRegistry";
import PwaInstallGate from "@/features/shared/pwa/components/PwaInstallGate";
import MasterDataPreloader from "@/core/components/common/MasterDataPreloader";
import ListViewSpanBootstrap from "@/core/components/common/ListViewSpanBootstrap";
import DisableSelectAllShortcut from "@/core/components/common/DisableSelectAllShortcut";
import ListPageFilterFocusHotkey from "@/core/components/common/ListPageFilterFocusHotkey";

export default function SettingsAppLayout({ children }) {
  return (
    <PwaInstallGate>
      <AppGuard appId="core">
        <RootLayoutComponent shell={APP_SHELL.SETTINGS}>
          <MasterDataPreloader />
          <ListViewSpanBootstrap />
          <DisableSelectAllShortcut />
          <ListPageFilterFocusHotkey />
          <PermissionGuard>
            {children}
          </PermissionGuard>
        </RootLayoutComponent>
      </AppGuard>
    </PwaInstallGate>
  );
}
