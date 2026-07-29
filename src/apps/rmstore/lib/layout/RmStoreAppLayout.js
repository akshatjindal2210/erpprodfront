"use client";

import RootLayoutComponent from "@/platform/layouts/RootLayout";
import { APP_SHELL } from "@/config/appsRegistry";
import PermissionGuard from "@/platform/components/guards/PermissionGuard";
import AppGuard from "@/platform/components/guards/AppGuard";
import ListViewSpanBootstrap from "@/ui/common/list/ListViewSpanBootstrap";
import PwaInstallGate from "@/common/pwa/components/PwaInstallGate";

export default function RmStoreAppLayout({ children }) {
  return (
    <PwaInstallGate>
      <AppGuard appId="rmstore">
        <RootLayoutComponent shell={APP_SHELL.RM_STORE}>
          <ListViewSpanBootstrap />
          <PermissionGuard>{children}</PermissionGuard>
        </RootLayoutComponent>
      </AppGuard>
    </PwaInstallGate>
  );
}
