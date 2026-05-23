"use client";

import { useEffect } from "react";
import { ensureInstallPromptCapture } from "@/helpers/pwaInstallPrompt";

export default function PwaRegister() {
  useEffect(() => {
    ensureInstallPromptCapture();

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

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
