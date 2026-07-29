import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "viewMode";
const VALID_MODES = new Set(["table", "card"]);
const MOBILE_BREAKPOINT = 768;

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
}

/** Phone always uses card view; desktop respects saved preference. */
function resolveViewMode() {
  if (typeof window === "undefined") return "table";
  if (isMobileViewport()) return "card";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "table" || saved === "card") return saved;
  } catch {
    /* quota / private mode */
  }
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
    if (isMobileViewport()) return;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* quota / private mode */
    }
  }, []);

  return [viewMode, handleViewMode];
}
