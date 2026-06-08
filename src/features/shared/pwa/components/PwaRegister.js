"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isAppDevelopment } from "@/core/utils/pwa";
import { ensureInstallPromptCapture } from "@/core/utils/pwaInstallPrompt";

export default function PwaRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (isAppDevelopment()) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }

    ensureInstallPromptCapture();

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 1000 * 60 * 60); // Check every hour

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New version available! 
              // We can either prompt the user or just let it take over on next reload.
              console.log("New PWA version available. It will be used on the next reload.");
            }
          });
        });
      } catch (err) {
        console.error("SW registration failed:", err);
      }
    };

    register();
  }, []);

  // Check for SW updates on every route change
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.update();
      });
    }
  }, [pathname]);

  return null;
}
