"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GripHorizontal, PanelRightOpen } from "lucide-react";
import PropertyPanel from "./PropertyPanel";

const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 520;

export default function FloatingPropertyPanel({
  open = true,
  onOpenChange,
  selectedWidget,
  ...panelProps
}) {
  const dragRef = useRef({ active: false, offsetX: 0, offsetY: 0 });
  const [position, setPosition] = useState(null);

  const clampPosition = useCallback((x, y) => {
    const maxX = Math.max(8, window.innerWidth - PANEL_WIDTH - 8);
    const maxY = Math.max(8, window.innerHeight - 120);
    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(8, y), maxY),
    };
  }, []);

  useEffect(() => {
    if (position !== null) return;
    setPosition(clampPosition(window.innerWidth - PANEL_WIDTH - 16, 72));
  }, [position, clampPosition]);

  useEffect(() => {
    const onMove = (event) => {
      if (!dragRef.current.active) return;
      const next = clampPosition(
        event.clientX - dragRef.current.offsetX,
        event.clientY - dragRef.current.offsetY,
      );
      setPosition(next);
    };
    const onUp = () => {
      dragRef.current.active = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [clampPosition]);

  if (!selectedWidget) return null;

  if (!open) {
    return (
      <button
        type="button"
        title="Open Widget Builder"
        onClick={() => onOpenChange?.(true)}
        className="fixed z-[90] bottom-5 right-5 h-11 px-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
      >
        <PanelRightOpen size={16} />
        Widget Builder
      </button>
    );
  }

  const style = position
    ? { left: position.x, top: position.y, width: PANEL_WIDTH, maxHeight: PANEL_HEIGHT }
    : { right: 16, top: 72, width: PANEL_WIDTH, maxHeight: PANEL_HEIGHT };

  return (
    <div
      className="fixed z-[90] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="h-8 shrink-0 cursor-move bg-slate-50 border-b border-slate-100 flex items-center justify-center text-slate-400"
        onMouseDown={(e) => {
          dragRef.current.active = true;
          const rect = e.currentTarget.parentElement.getBoundingClientRect();
          dragRef.current.offsetX = e.clientX - rect.left;
          dragRef.current.offsetY = e.clientY - rect.top;
          e.preventDefault();
        }}
        title="Drag to move"
      >
        <GripHorizontal size={16} />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <PropertyPanel selectedWidget={selectedWidget} {...panelProps} />
      </div>
    </div>
  );
}
