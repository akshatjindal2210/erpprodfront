"use client";

import { useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
const LAUNCHER_COLS = 3;
const CELL_PX = 84;
const PANEL_X_PAD = 16;
const MAX_ROWS_BEFORE_SCROLL = 3;

function getPortalLauncherLayout(appCount) {
  const count = Math.max(appCount, 0);
  const rows = count === 0 ? 0 : Math.ceil(count / LAUNCHER_COLS);
  const scrollable = rows > MAX_ROWS_BEFORE_SCROLL;
  return {
    cols: LAUNCHER_COLS,
    width: LAUNCHER_COLS * CELL_PX + PANEL_X_PAD,
    maxGridHeight: scrollable ? MAX_ROWS_BEFORE_SCROLL * CELL_PX : undefined,
    scrollable,
  };
}

function AppLauncherTile({ app, onSelect }) {
  const Icon = app.icon;
  const disabled = app.comingSoon;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onSelect(app.href)}
      className={`group flex flex-col items-center justify-start gap-1.5 rounded-lg px-1 py-2.5 min-h-[84px] transition-colors ${
        disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-50"
      }`}
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm bg-gradient-to-br ${app.accent || "from-slate-500 to-slate-700"} ${
          disabled ? "" : "group-hover:scale-[1.03] transition-transform"
        }`}
      >
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <span className="text-[11px] font-semibold text-slate-800 leading-tight text-center px-0.5 line-clamp-2">
        {app.name}
      </span>
      {app.comingSoon && (
        <span className="text-[8px] font-bold uppercase tracking-wide text-amber-600 leading-none">
          Soon
        </span>
      )}
    </button>
  );
}

export default function AppLauncherMenu({ apps, open, onClose, anchor, onReposition }) {
  const router = useRouter();
  const panelRef = useRef(null);

  const visibleApps = useMemo(
    () => apps.filter((app) => app.available !== false),
    [apps]
  );
  const layout = useMemo(() => getPortalLauncherLayout(visibleApps.length), [visibleApps.length]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    const onScrollOrResize = () => onReposition?.();

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, onClose, onReposition]);

  const handleSelect = (href) => {
    onClose();
    router.push(href);
  };

  if (!open || !anchor || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Applications"
      className="fixed z-[200] animate-in fade-in zoom-in-95 duration-150"
      style={{ top: anchor.top, right: anchor.right, width: layout.width }}
    >
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            JFL Apps
          </p>
        </div>

        <div
          className={`p-2 grid gap-0.5 ${layout.scrollable ? "overflow-y-auto custom-scrollbar" : ""}`}
          style={{
            gridTemplateColumns: `repeat(${LAUNCHER_COLS}, minmax(0, 1fr))`,
            maxHeight: layout.maxGridHeight,
          }}
        >
          {visibleApps.map((app) => (
            <AppLauncherTile key={app.id} app={app} onSelect={handleSelect} />
          ))}
        </div>

      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
      `}</style>
    </div>,
    document.body
  );
}
