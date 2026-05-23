"use client";

import { isAppDevelopment } from "@/helpers/pwa";

export default function PwaDevBypass() {
  if (!isAppDevelopment()) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] text-center bg-amber-500 text-amber-950 text-xs font-medium py-1.5 px-3 shadow-lg">
      Development mode — browser tab &amp; inspect allowed
    </div>
  );
}
