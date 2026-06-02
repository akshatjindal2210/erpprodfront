"use client";

import RootLayoutComponent from "@/core/layouts/RootLayout";import { APP_SHELL } from "@/config/appsRegistry";
import PermissionGuard from "@/core/components/guards/PermissionGuard";
import AppGuard from "@/core/components/guards/AppGuard";
import MasterDataPreloader from "@/core/components/common/MasterDataPreloader";
import ListViewSpanBootstrap from "@/core/components/common/ListViewSpanBootstrap";
import PwaInstallGate from "@/features/shared/pwa/components/PwaInstallGate";

export default function ImsAppLayout({ children }) {
  return (
    <PwaInstallGate>
      <AppGuard appId="ims">
        <RootLayoutComponent shell={APP_SHELL.IMS}>
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

