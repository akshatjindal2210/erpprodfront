import { useState, useEffect } from "react";

export function useViewMode(defaultMode = "table") {
  const storageKey = "viewMode";

  // Initialize with default mode to ensure server-client hydration match
  const [viewMode, setViewMode] = useState(defaultMode);

  // After mount, sync with localStorage if a saved value exists
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    // if (saved && saved !== defaultMode) setViewMode(saved);
    if (saved) {
      setViewMode(saved);
    } else {
      // Only check tab screen when user hasn't set it yet
      setViewMode(window.innerWidth < 768 ? "card" : "table");
    }
  }, []);

  // Update view mode and persist it in localStorage
  const handleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem(storageKey, mode);
  };

  return [viewMode, handleViewMode];
}

export function useSidebarCollapse(defaultState = false) {
  const storageKey = "sidebarCollapsed";

  const [collapsed, setCollapsed] = useState(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
    setIsLoaded(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem(storageKey, String(newState));
      return newState;
    });
  };

  return [collapsed, toggleCollapsed, isLoaded];
}