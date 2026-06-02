"use client";

import { useEffect } from "react";
import { isPanelEditableTarget } from "@/core/utils/panelEditableTarget";

// Dashboard: block Ctrl+A and mouse drag-select on the panel; keep inputs/textareas selectable.
export default function DisableSelectAllShortcut() {
  useEffect(() => {
    const onKeyDown = (e) => {
      const isA = e.key === "a" || e.key === "A" || e.code === "KeyA";
      if (!isA) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.shiftKey || e.altKey) return;
      if (isPanelEditableTarget(e.target)) return;
      if (typeof e.target?.closest === "function" && e.target.closest("[data-list-table-root]")) return;

      e.preventDefault();
      e.stopPropagation();
    };

    const onSelectStart = (e) => {
      if (isPanelEditableTarget(e.target)) return;
      e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("selectstart", onSelectStart, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("selectstart", onSelectStart, true);
    };
  }, []);

  return null;
}
