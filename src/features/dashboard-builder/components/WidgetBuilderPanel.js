"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GripHorizontal, PanelRight, Pin, PinOff } from "lucide-react";
import PropertyPanel from "./PropertyPanel";

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 560;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 240;
const MAX_WIDTH = 520;
const MAX_HEIGHT = 900;

export default function WidgetBuilderPanel({
  dockMode = "fixed",
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

  const clampPosition = useCallback((x, y, width = floatSize.width) => {
    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - 80);
    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(8, y), maxY),
    };
  }, [floatSize.width]);

  useEffect(() => {
    if (dockMode !== "float" || position !== null) return;
    setPosition(clampPosition(window.innerWidth - floatSize.width - 16, 72));
  }, [dockMode, position, clampPosition, floatSize.width]);

  useEffect(() => {
    if (dockMode !== "float") return undefined;
    const onMove = (event) => {
      if (dragRef.current.active) {
        setPosition(
          clampPosition(
            event.clientX - dragRef.current.offsetX,
            event.clientY - dragRef.current.offsetY,
          ),
        );
        return;
      }
      if (resizeRef.current.active) {
        const deltaX = event.clientX - resizeRef.current.startX;
        const deltaY = event.clientY - resizeRef.current.startY;
        setFloatSize({
          width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeRef.current.startW + deltaX)),
          height: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, resizeRef.current.startH + deltaY)),
        });
      }
    };
    const onUp = () => {
      dragRef.current.active = false;
      resizeRef.current.active = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dockMode, clampPosition]);

  if (!selectedWidget) return null;

  const panelHeader = (
    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {dockMode === "float" && (
          <div
            className="h-6 w-6 grid place-items-center rounded border border-slate-200 text-slate-400 cursor-move shrink-0"
            onMouseDown={(e) => {
              dragRef.current.active = true;
              const host = e.currentTarget.closest("[data-widget-builder-panel]");
              const rect = host?.getBoundingClientRect?.();
              if (rect) {
                dragRef.current.offsetX = e.clientX - rect.left;
                dragRef.current.offsetY = e.clientY - rect.top;
              }
              e.preventDefault();
            }}
            title="Drag panel"
          >
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
    return (
      <button
        type="button"
        title="Open Widget Builder"
        onClick={() => onOpenChange?.(true)}
        className={`${dockMode === "float" ? "fixed z-[90] bottom-5 right-5" : "absolute z-[40] top-3 right-3"} h-10 px-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider`}
      >
        <PanelRight size={15} />
        Builder
      </button>
    );
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

  const floatStyle = position
    ? { left: position.x, top: position.y, width: floatSize.width, height: floatSize.height }
    : { right: 16, top: 72, width: floatSize.width, height: floatSize.height };

  return (
    <div
      data-widget-builder-panel
      className="fixed z-[90] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
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
}
