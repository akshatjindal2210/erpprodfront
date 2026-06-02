"use client";

import { useEffect } from "react";
import { isAppDevelopment } from "@/core/utils/pwa";
import { ensureInstallPromptCapture } from "@/core/utils/pwaInstallPrompt";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (isAppDevelopment()) {
      // Dev (.env development): no SW — hard reload always gets latest Next.js build.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }

    ensureInstallPromptCapture();

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Silent fail to avoid noisy UI on unsupported environments.
      }
    };

    register();
  }, []);

  return null;
}
