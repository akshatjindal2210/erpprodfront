"use client";

import { useSelector } from "react-redux";
import RootLayoutComponent from "@/components/layout/RootLayout";
import PermissionGuard from "@/components/PermissionGuard";
import { useSocket } from "@/hooks/useSocket";
import { selectUser } from "@/features/authSlice";
import MasterDataPreloader from "@/components/common/MasterDataPreloader";
import ListViewSpanBootstrap from "@/components/common/ListViewSpanBootstrap";
import DisableSelectAllShortcut from "@/components/common/DisableSelectAllShortcut";
import ListPageFilterFocusHotkey from "@/components/common/ListPageFilterFocusHotkey";
import PwaInstallGate from "@/components/pwa/PwaInstallGate";
import { useSyncAuthSession } from "@/hooks/useSyncAuthSession";

export default function DashboardLayout({ children }) {
  const user = useSelector(selectUser);
  useSyncAuthSession();
  useSocket(user?.id);

  return (
    <PwaInstallGate>
      <RootLayoutComponent>
        <MasterDataPreloader />
        <ListViewSpanBootstrap />
        <DisableSelectAllShortcut />
        <ListPageFilterFocusHotkey />
        <PermissionGuard>
          {children}
        </PermissionGuard>
      </RootLayoutComponent>
    </PwaInstallGate>
  );
}
