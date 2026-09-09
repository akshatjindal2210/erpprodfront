"use client";

import { useEffect } from "react";
import { focusFirstListPageFilter, getListPageFilterStrip, isListPageFilterFocusBlocked } from "@/platform/utils/list/listPageFilterFocus";

/** Ctrl/Cmd+F — toggle Quick Search ↔ first table cell. */
export default function ListPageFilterFocusHotkey() {
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = (e.key || "").toLowerCase();
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || key !== "f") return;
      if (isListPageFilterFocusBlocked(e.target)) return;
      const strip = getListPageFilterStrip();
      if (!strip) return;

      e.preventDefault();
      e.stopPropagation();

      // In filter strip → table; else → Quick Search
      if (strip.contains(document.activeElement)) {
        document.activeElement.blur();
        const cells = document.querySelector("[data-list-table-root] tbody tr")?.querySelectorAll("td");
        if (!cells?.length) return;
        const td = cells[0].querySelector('input[type="checkbox"]') && cells[1] ? cells[1] : cells[0];
        td.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        return;
      }
      focusFirstListPageFilter();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}
