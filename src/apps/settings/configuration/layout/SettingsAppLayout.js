"use client";

import RootLayoutComponent from "@/platform/layouts/RootLayout";
import PermissionGuard from "@/platform/components/guards/PermissionGuard";
import AppGuard from "@/platform/components/guards/AppGuard";
import { APP_SHELL } from "@/config/appsRegistry";
import PwaInstallGate from "@/common/pwa/components/PwaInstallGate";
import MasterDataPreloader from "@/ui/common/system/MasterDataPreloader";
import ListViewSpanBootstrap from "@/ui/common/list/ListViewSpanBootstrap";
export default function SettingsAppLayout({ children }) {
  return (
    <PwaInstallGate>
      <AppGuard appId="core">
        <RootLayoutComponent shell={APP_SHELL.SETTINGS}>
          <MasterDataPreloader />
          <ListViewSpanBootstrap />
          <PermissionGuard>
            {children}
          </PermissionGuard>
        </RootLayoutComponent>
      </AppGuard>
    </PwaInstallGate>
  );
}
