import "./globals.css";
import "react-toastify/dist/ReactToastify.css";
import ReduxProvider from "@/components/ReduxProvider";
import AppToastContainer from "@/components/common/AppToastContainer";
import SocketProvider from "@/components/SocketProvider";
import PwaRegister from "@/components/pwa/PwaRegister";
import PwaDevBypass from "@/components/pwa/PwaDevBypass";
import PwaSecurityGuards from "@/components/pwa/PwaSecurityGuards";

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