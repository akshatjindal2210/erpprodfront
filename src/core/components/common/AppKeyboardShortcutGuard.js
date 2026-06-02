"use client";

import { useEffect } from "react";
import { shouldSwallowAppShortcut } from "@/core/utils/appHotkeys";

/** Block browser defaults for ERP list/save/copy shortcuts (handlers run in DataTable / Drawer). */
export default function AppKeyboardShortcutGuard() {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (shouldSwallowAppShortcut(e)) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}
