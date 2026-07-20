"use client";

import RootLayoutComponent from "@/core/layouts/RootLayout";
import AppGuard from "@/core/components/guards/AppGuard";
import { APP_SHELL } from "@/config/appsRegistry";
import PwaInstallGate from "@/features/shared/pwa/components/PwaInstallGate";
import RouteGuard from "@/features/apps/task/guards/RouteGuard";

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
