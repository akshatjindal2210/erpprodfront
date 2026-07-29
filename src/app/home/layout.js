"use client";

import RootLayoutComponent from "@/platform/layouts/RootLayout";
import { APP_SHELL } from "@/config/appsRegistry";
import PwaInstallGate from "@/common/pwa/components/PwaInstallGate";

export default function HomeLayout({ children }) {
  return (
    <PwaInstallGate>
      <RootLayoutComponent shell={APP_SHELL.PORTAL}>{children}</RootLayoutComponent>
    </PwaInstallGate>
  );
}

