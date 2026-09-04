"use client";

import RootLayoutComponent from "@/platform/layouts/RootLayout";
import { APP_SHELL } from "@/config/appsRegistry";
import PermissionGuard from "@/platform/components/guards/PermissionGuard";
import AppGuard from "@/platform/components/guards/AppGuard";
import ListViewSpanBootstrap from "@/ui/common/list/ListViewSpanBootstrap";
import PwaInstallGate from "@/common/pwa/components/PwaInstallGate";

export default function HrmsAppLayout({ children }) {
  return (
    <PwaInstallGate>
      <AppGuard appId="hrms">
        <RootLayoutComponent shell={APP_SHELL.HRMS}>
          <ListViewSpanBootstrap />
          <PermissionGuard>{children}</PermissionGuard>
        </RootLayoutComponent>
      </AppGuard>
    </PwaInstallGate>
  );
}
