"use client";

import { useEffect } from "react";
import { isPwaDevBypass, isPwaStandalone } from "@/platform/utils/pwa/pwa";

function isInspectShortcut(e) {
  if (e.key === "F12") return true;

  const key = (e.key || "").toLowerCase();
  const ctrlOrMeta = e.ctrlKey || e.metaKey;

  if (ctrlOrMeta && e.shiftKey && ["i", "j", "c", "k"].includes(key)) return true;
  if (ctrlOrMeta && e.altKey && ["i", "j", "c"].includes(key)) return true;
  if (ctrlOrMeta && !e.shiftKey && !e.altKey && key === "u") return true;

  return false;
}

export default function PwaSecurityGuards() {
  useEffect(() => {
    if (!isPwaStandalone() || isPwaDevBypass()) return;

    const onContextMenu = (e) => {
      e.preventDefault();
    };

    const onKeyDown = (e) => {
      if (!isInspectShortcut(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return null;
}

