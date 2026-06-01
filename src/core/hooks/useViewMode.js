import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "viewMode";
const VALID_MODES = new Set(["table", "card"]);

function pickModeForWidth() {
  if (typeof window === "undefined") return "table";
  return window.innerWidth < 768 ? "card" : "table";
}

/** Only "table" | "card" — avoids storing React events / objects in state or localStorage (JSON / persist issues). */
export function useViewMode(defaultMode = "table") {
  const initial = VALID_MODES.has(defaultMode) ? defaultMode : "table";
  const [viewMode, setViewMode] = useState(initial);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "table" || saved === "card") {
        setViewMode(saved);
      } else if (saved) {
        localStorage.removeItem(STORAGE_KEY);
        setViewMode(pickModeForWidth());
      } else {
        setViewMode(pickModeForWidth());
      }
    } catch {
      setViewMode(initial);
    }
  }, [initial]);

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
