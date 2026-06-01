import "./globals.css";
import "react-toastify/dist/ReactToastify.css";
import ReduxProvider from "@/core/components/providers/ReduxProvider";
import AppToastContainer from "@/core/components/common/AppToastContainer";
import SocketProvider from "@/core/components/providers/SocketProvider";
import PwaRegister from "@/features/shared/pwa/components/PwaRegister";
import PwaDevBypass from "@/features/shared/pwa/components/PwaDevBypass";
import PwaSecurityGuards from "@/features/shared/pwa/components/PwaSecurityGuards";

export const metadata = {
  title: "JFL IT Services",
  description: "JFL IT Solutions.",
  // manifest: "/manifest.webmanifest",
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
          {/* <PwaDevBypass /> */}
          <PwaSecurityGuards />
          <AppToastContainer />
        </ReduxProvider>
      </body>
    </html>
  );
}
