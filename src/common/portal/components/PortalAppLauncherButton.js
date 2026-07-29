"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { getLauncherApps } from "@/config/appsRegistry";
import AppLauncherDots from "./AppLauncherDots";
import AppLauncherMenu from "./AppLauncherMenu";

const BUTTON_THEMES = {
  dark: {
    open: "bg-white/15 text-white",
    closed: "text-slate-400 hover:bg-white/10 hover:text-white",
  },
  light: {
    open: "bg-slate-100 text-slate-800",
    closed: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
  },
};

/** 9-dot launcher in top navbar — aligned with bell / profile icons. */
export default function PortalAppLauncherButton({ theme = "dark" }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const btnRef = useRef(null);

  const role = useSelector((state) => state.auth.role);
  const permissions = useSelector((state) => state.auth.permissions);
  const appAccess = useSelector((state) => state.auth.app_access || {});
  const apps = useMemo(() => getLauncherApps(role, permissions, appAccess), [role, permissions, appAccess]);

  const updateAnchor = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({
      top: r.bottom + 6,
      right: window.innerWidth - r.right,
    });
  }, []);

  const toggle = () => {
    if (!open) updateAnchor();
    setOpen((v) => !v);
  };

  const tone = BUTTON_THEMES[theme] || BUTTON_THEMES.dark;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
          open ? tone.open : tone.closed
        }`}
        aria-label="Open applications"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <AppLauncherDots size="sm" />
      </button>

      <AppLauncherMenu
        apps={apps}
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor}
        onReposition={updateAnchor}
      />
    </>
  );
}
