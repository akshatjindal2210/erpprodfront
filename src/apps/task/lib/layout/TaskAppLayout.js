"use client";

import RootLayoutComponent from "@/platform/layouts/RootLayout";
import AppGuard from "@/platform/components/guards/AppGuard";
import { APP_SHELL } from "@/config/appsRegistry";
import PwaInstallGate from "@/common/pwa/components/PwaInstallGate";
import RouteGuard from "@/apps/task/lib/guards/RouteGuard";

export default function TaskAppLayout({ children }) {
  return (
    <PwaInstallGate>
      <AppGuard appId="task">
        <RootLayoutComponent shell={APP_SHELL.TASK}>
          <RouteGuard>{children}</RouteGuard>
        </RootLayoutComponent>
      </AppGuard>
    </PwaInstallGate>
  );
}
