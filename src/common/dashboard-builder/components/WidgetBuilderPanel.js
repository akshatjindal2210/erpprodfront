"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal, PanelRight, Pin, PinOff } from "lucide-react";
import PropertyPanel from "./PropertyPanel";

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 560;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 240;
const MAX_WIDTH = 520;
const MAX_HEIGHT = 900;
/** Fallback when sticky app chrome can't be measured (navbar h-12 + quick bar ~h-10). */
const FALLBACK_CHROME_BOTTOM = 96;

function getAppChromeBottom() {
  if (typeof document === "undefined") return FALLBACK_CHROME_BOTTOM;
  const marked = document.querySelector("[data-app-top-chrome]");
  if (marked) {
    const bottom = marked.getBoundingClientRect().bottom;
    if (Number.isFinite(bottom) && bottom > 40) return Math.ceil(bottom);
  }
  const stickyBars = Array.from(document.querySelectorAll(".sticky.top-0"));
  let maxBottom = 0;
  stickyBars.forEach((el) => {
    const z = Number(window.getComputedStyle(el).zIndex);
    if (!Number.isFinite(z) || z < 100) return;
    const bottom = el.getBoundingClientRect().bottom;
    if (bottom > maxBottom) maxBottom = bottom;
  });
  if (maxBottom > 40) return Math.ceil(maxBottom);
  return FALLBACK_CHROME_BOTTOM;
}

function getBuilderToolbarBottom(chromeBottom) {
  if (typeof document === "undefined") return chromeBottom + 8;
  const toolbar = document.querySelector("[data-builder-toolbar-shell]");
  if (toolbar) {
    const bottom = toolbar.getBoundingClientRect().bottom;
    if (Number.isFinite(bottom) && bottom > chromeBottom) return Math.ceil(bottom);
  }
  return chromeBottom + 8;
}

function getMinTop() {
  const chromeBottom = getAppChromeBottom();
  return getBuilderToolbarBottom(chromeBottom) + 6;
}

export default function WidgetBuilderPanel({
  dockMode = "float",
  onDockModeChange,
  open = true,
  onOpenChange,
  onClose,
  selectedWidget,
  ...panelProps
}) {
  const dragRef = useRef({ active: false, offsetX: 0, offsetY: 0 });
  const resizeRef = useRef({ active: false, startX: 0, startY: 0, startW: DEFAULT_WIDTH, startH: DEFAULT_HEIGHT });
  const [position, setPosition] = useState(null);
  const [floatSize, setFloatSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [mounted, setMounted] = useState(false);
  const positionRef = useRef(null);
  const floatSizeRef = useRef({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    floatSizeRef.current = floatSize;
  }, [floatSize]);

  const clampPosition = useCallback((x, y, width, height) => {
    const w = width ?? floatSizeRef.current.width;
    const h = height ?? floatSizeRef.current.height;
    const minY = getMinTop();
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(minY, window.innerHeight - Math.min(h, 120) - 8);
    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(minY, y), maxY),
    };
  }, []);

  const clampSize = useCallback((width, height, top) => {
    const minTop = Number.isFinite(top) ? top : getMinTop();
    const maxH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, window.innerHeight - minTop - 12));
    return {
      width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width)),
      height: Math.min(maxH, Math.max(MIN_HEIGHT, height)),
    };
  }, []);

  useEffect(() => {
    if (dockMode !== "float" || typeof window === "undefined") return undefined;

    const placeOrClamp = () => {
      const prev = positionRef.current;
      const size = floatSizeRef.current;
      const minTop = getMinTop();
      const nextSize = clampSize(size.width, size.height, prev?.y ?? minTop);
      if (nextSize.width !== size.width || nextSize.height !== size.height) {
        floatSizeRef.current = nextSize;
        setFloatSize(nextSize);
      }
      if (!prev) {
        const nextPos = clampPosition(
          window.innerWidth - nextSize.width - 16,
          minTop,
          nextSize.width,
          nextSize.height,
        );
        positionRef.current = nextPos;
        setPosition(nextPos);
        return;
      }
      const nextPos = clampPosition(prev.x, prev.y, nextSize.width, nextSize.height);
      if (nextPos.x !== prev.x || nextPos.y !== prev.y) {
        positionRef.current = nextPos;
        setPosition(nextPos);
      }
    };

    placeOrClamp();
    window.addEventListener("resize", placeOrClamp);
    return () => window.removeEventListener("resize", placeOrClamp);
  }, [dockMode, clampPosition, clampSize]);

  useEffect(() => {
    if (dockMode !== "float") return undefined;
    const endInteraction = () => {
      dragRef.current.active = false;
      resizeRef.current.active = false;
    };
    const onMove = (event) => {
      if (dragRef.current.active) {
        const next = clampPosition(
          event.clientX - dragRef.current.offsetX,
          event.clientY - dragRef.current.offsetY,
        );
        positionRef.current = next;
        setPosition(next);
        return;
      }
      if (resizeRef.current.active) {
        const deltaX = event.clientX - resizeRef.current.startX;
        const deltaY = event.clientY - resizeRef.current.startY;
        const next = clampSize(
          resizeRef.current.startW + deltaX,
          resizeRef.current.startH + deltaY,
          positionRef.current?.y,
        );
        floatSizeRef.current = next;
        setFloatSize(next);
      }
    };
    // Color dialog / alt-tab can swallow mouseup — clear drag so the panel doesn't keep eating clicks.
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", endInteraction);
    window.addEventListener("pointerup", endInteraction);
    window.addEventListener("blur", endInteraction);
    document.addEventListener("visibilitychange", endInteraction);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", endInteraction);
      window.removeEventListener("pointerup", endInteraction);
      window.removeEventListener("blur", endInteraction);
      document.removeEventListener("visibilitychange", endInteraction);
    };
  }, [dockMode, clampPosition, clampSize]);

  const startDrag = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button, input, select, textarea, a, label")) return;
    dragRef.current.active = true;
    const host = e.currentTarget.closest("[data-widget-builder-panel]");
    const rect = host?.getBoundingClientRect?.();
    if (rect) {
      dragRef.current.offsetX = e.clientX - rect.left;
      dragRef.current.offsetY = e.clientY - rect.top;
    }
    e.preventDefault();
  }, []);

  if (!selectedWidget) return null;

  const panelHeader = (
    <div
      className={`px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0 ${
        dockMode === "float" ? "cursor-move select-none" : ""
      }`}
      onMouseDown={dockMode === "float" ? startDrag : undefined}
      title={dockMode === "float" ? "Drag to move" : undefined}
    >
      <div className="flex items-center gap-2 min-w-0">
        {dockMode === "float" && (
          <div className="h-6 w-6 grid place-items-center rounded border border-slate-200 bg-white text-slate-400 shrink-0">
            <GripHorizontal size={14} />
          </div>
        )}
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700 truncate">
          Widget Builder
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          title={dockMode === "fixed" ? "Float panel" : "Dock to right"}
          onClick={() => onDockModeChange?.(dockMode === "fixed" ? "float" : "fixed")}
          className="h-7 w-7 grid place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-700"
        >
          {dockMode === "fixed" ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
        <button
          type="button"
          title="Close panel"
          onClick={() => onClose?.()}
          className="h-7 w-7 grid place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-700"
        >
          ×
        </button>
      </div>
    </div>
  );

  if (!open) {
    const reopenBtn = (
      <button
        type="button"
        title="Open Widget Builder"
        onClick={() => onOpenChange?.(true)}
        className="fixed z-[90] bottom-5 right-5 h-10 px-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
      >
        <PanelRight size={15} />
        Builder
      </button>
    );
    if (dockMode === "float" && mounted) {
      return createPortal(reopenBtn, document.body);
    }
    return reopenBtn;
  }

  const panelBody = (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      <PropertyPanel selectedWidget={selectedWidget} {...panelProps} hideHeader />
    </div>
  );

  if (dockMode === "fixed") {
    return (
      <div
        data-widget-builder-panel
        className="w-[280px] xl:w-[300px] shrink-0 border-l border-slate-200 h-full min-h-0 flex flex-col bg-white z-40 shadow-xl"
        style={{ maxWidth: DEFAULT_WIDTH }}
      >
        {panelHeader}
        {panelBody}
      </div>
    );
  }

  const defaultTop = typeof window !== "undefined" ? getMinTop() : FALLBACK_CHROME_BOTTOM + 48;
  const floatStyle = position
    ? { left: position.x, top: position.y, width: floatSize.width, height: floatSize.height }
    : { right: 16, top: defaultTop, width: floatSize.width, height: floatSize.height };

  const floatPanel = (
    <div
      data-widget-builder-panel
      className="fixed z-[105] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
      style={floatStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {panelHeader}
      {panelBody}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
        title="Resize panel"
        onMouseDown={(e) => {
          resizeRef.current.active = true;
          resizeRef.current.startX = e.clientX;
          resizeRef.current.startY = e.clientY;
          resizeRef.current.startW = floatSize.width;
          resizeRef.current.startH = floatSize.height;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <svg viewBox="0 0 10 10" className="w-full h-full text-slate-300">
          <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(floatPanel, document.body);
}
