"use client";

import RootLayoutComponent from "@/platform/layouts/RootLayout";
import PermissionGuard from "@/platform/components/guards/PermissionGuard";
import AppGuard from "@/platform/components/guards/AppGuard";
import ListViewSpanBootstrap from "@/ui/common/list/ListViewSpanBootstrap";
import PwaInstallGate from "@/common/pwa/components/PwaInstallGate";
import { APP_KEY } from "@/apps/template/lib/app.meta";

export default function AppLayout({ children }) {
  return (
    <PwaInstallGate>
      <AppGuard appId={APP_KEY}>
        <RootLayoutComponent shell={APP_KEY}>
          <ListViewSpanBootstrap />
          <PermissionGuard>{children}</PermissionGuard>
        </RootLayoutComponent>
      </AppGuard>
    </PwaInstallGate>
  );
}
