"use client";

import { useEffect } from "react";
import { focusFirstListPageFilter, getListPageFilterStrip, isListPageFilterFocusBlocked } from "@/helpers/listPageFilterFocus";

/** Ctrl+F / Cmd+F — focus the first filter control on the current list page (browser find is overridden). */
export default function ListPageFilterFocusHotkey() {
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = (e.key || "").toLowerCase();
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || key !== "f") return;
      if (isListPageFilterFocusBlocked(e.target)) return;
      if (!getListPageFilterStrip()) return;

      e.preventDefault();
      e.stopPropagation();
      focusFirstListPageFilter();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}
