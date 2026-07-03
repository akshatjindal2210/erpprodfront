import "./globals.css";
import "react-toastify/dist/ReactToastify.css";
import ReduxProvider from "@/core/components/providers/ReduxProvider";
import AppToastContainer from "@/core/components/common/AppToastContainer";
import SocketProvider from "@/core/components/providers/SocketProvider";
import PwaRegister from "@/features/shared/pwa/components/PwaRegister";
import WebPushRegistrar from "@/features/shared/pwa/components/WebPushRegistrar";
import TaskNotifyEnableBanner from "@/features/apps/task/pwa/TaskNotifyEnableBanner";
import PwaAutoOpenHandler from "@/features/shared/pwa/components/PwaAutoOpenHandler";
import PwaLaunchQueueHandler from "@/features/shared/pwa/components/PwaLaunchQueueHandler";
import PwaOrientationLock from "@/features/shared/pwa/components/PwaOrientationLock";
import PwaDevBypass from "@/features/shared/pwa/components/PwaDevBypass";
import PwaSecurityGuards from "@/features/shared/pwa/components/PwaSecurityGuards";
import AppKeyboardShortcutGuard from "@/core/components/common/AppKeyboardShortcutGuard";
import ListPageFilterFocusHotkey from "@/core/components/common/ListPageFilterFocusHotkey";
import DisableSelectAllShortcut from "@/core/components/common/DisableSelectAllShortcut";

export const metadata = {
  title: "JFL IT Services",
  description: "JFL IT Solutions.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body className="antialiased">
        <ReduxProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
          <PwaRegister />
          <WebPushRegistrar />
          <PwaOrientationLock />
          <TaskNotifyEnableBanner />
          <PwaLaunchQueueHandler />
          {/* <PwaAutoOpenHandler /> */}
          {/* <PwaDevBypass /> */}
          <PwaSecurityGuards />
          <AppKeyboardShortcutGuard />
          <ListPageFilterFocusHotkey />
          <DisableSelectAllShortcut />
          <AppToastContainer />
        </ReduxProvider>
      </body>
    </html>
  );
}
