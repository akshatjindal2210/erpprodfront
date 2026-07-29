"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * When the installed PWA receives an external launch (e.g. /launch from Google Sites),
 * navigate to the target URL inside the app window.
 */
export default function PwaLaunchQueueHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !("launchQueue" in window)) return;

    window.launchQueue.setConsumer((launchParams) => {
      const target = launchParams?.targetURL;
      if (!target) return;

      try {
        const url = new URL(target);
        if (url.origin !== window.location.origin) return;

        const path = `${url.pathname}${url.search}${url.hash}`;
        if (path === "/launch" || path.startsWith("/launch?")) {
          router.replace("/home");
          return;
        }
        router.replace(path || "/home");
      } catch {
        // ignore malformed launch URLs
      }
    });
  }, [router]);

  return null;
}


