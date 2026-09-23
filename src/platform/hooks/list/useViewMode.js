import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "viewMode";
const VALID_MODES = new Set(["table", "card"]);
const MOBILE_BREAKPOINT = 768;

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
}

/** Saved preference on all widths; phone defaults to card when nothing saved yet. */
function resolveViewMode() {
  if (typeof window === "undefined") return "table";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "table" || saved === "card") return saved;
  } catch {
    /* quota / private mode */
  }
  if (isMobileViewport()) return "card";
  return "table";
}

/** Only "table" | "card" — avoids storing React events / objects in state or localStorage (JSON / persist issues). */
export function useViewMode(defaultMode = "table") {
  const initial = VALID_MODES.has(defaultMode) ? defaultMode : "table";
  const [viewMode, setViewMode] = useState(initial);

  const syncViewMode = useCallback(() => {
    setViewMode(resolveViewMode());
  }, []);

  useEffect(() => {
    syncViewMode();
    window.addEventListener("resize", syncViewMode);
    return () => window.removeEventListener("resize", syncViewMode);
  }, [syncViewMode]);

  const handleViewMode = useCallback((mode) => {
    if (mode !== "table" && mode !== "card") return;
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* quota / private mode */
    }
  }, []);

  return [viewMode, handleViewMode];
}
