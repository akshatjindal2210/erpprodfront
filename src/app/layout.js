import "./globals.css";
import "react-toastify/dist/ReactToastify.css";
import ReduxProvider from "@/platform/components/providers/ReduxProvider";
import AppToastContainer from "@/ui/common/system/AppToastContainer";
import SocketProvider from "@/platform/components/providers/SocketProvider";
import PwaRegister from "@/common/pwa/components/PwaRegister";
import WebPushRegistrar from "@/common/pwa/components/WebPushRegistrar";
import TaskNotifyEnableBanner from "@/common/pwa/task/TaskNotifyEnableBanner";
import PwaAutoOpenHandler from "@/common/pwa/components/PwaAutoOpenHandler";
import PwaLaunchQueueHandler from "@/common/pwa/components/PwaLaunchQueueHandler";
import PwaOrientationLock from "@/common/pwa/components/PwaOrientationLock";
import PwaDevBypass from "@/common/pwa/components/PwaDevBypass";
import PwaSecurityGuards from "@/common/pwa/components/PwaSecurityGuards";
import AppKeyboardShortcutGuard from "@/ui/common/system/AppKeyboardShortcutGuard";
import ListPageFilterFocusHotkey from "@/ui/common/list/ListPageFilterFocusHotkey";
import DisableSelectAllShortcut from "@/ui/common/system/DisableSelectAllShortcut";

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
      <body>
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
