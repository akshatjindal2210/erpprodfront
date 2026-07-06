"use client";

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { GripVertical, Pencil, Trash2, Copy } from "lucide-react";
import WidgetRenderer from "./WidgetRenderer";

import { computeNestedGridPixelHeight } from "../utils/dashboardLayoutEngine";

const NESTED_COLS = 12;
const NESTED_ROW_HEIGHT = 48;
const NESTED_GAP = 8;

const normalizeNestedItem = (raw = {}, idx = 0, id = "", { lock = false } = {}) => ({
  i: String(id || raw.i || `nested_${idx}`),
  x: Number.isFinite(Number(raw.x)) ? Number(raw.x) : 0,
  y: Number.isFinite(Number(raw.y)) ? Number(raw.y) : idx * 2,
  w: Math.max(1, Number.isFinite(Number(raw.w)) ? Number(raw.w) : 3),
  h: Math.max(1, Number.isFinite(Number(raw.h)) ? Number(raw.h) : 2),
  minW: 1,
  minH: 1,
  static: lock,
  isResizable: !lock,
  isDraggable: !lock,
});

export default function ContainerNestedGrid({
  childWidgets = [],
  layout = [],
  readOnly = false,
  selectedWidgetId = null,
  onLayoutChange,
  onSelectWidget,
  onDeleteWidget,
  onAddChildWidget,
  containerId = null,
  onCloneChildWidget,
  mobilePadding = {},
  isDraggingOver = false,
  isPhoneMode = false,
}) {
  const hostRef = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = hostRef.current;
    if (!node) return undefined;
    const update = () => setWidth(Math.max(0, Math.floor(node.getBoundingClientRect().width)));
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (observer) observer.observe(node);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const normalizedLayout = useMemo(() => {
    const childIds = new Set(childWidgets.map((child) => String(child.id)));
    const source = layout.filter((item) => childIds.has(String(item.i)));
    return childWidgets.map((child, idx) => {
      const matched = source.find((item) => String(item.i) === String(child.id));
      return normalizeNestedItem(matched || child.layout || {}, idx, child.id, { lock: readOnly });
    });
  }, [childWidgets, layout, readOnly]);

  const padTop = Math.max(0, Number(mobilePadding.top) || 0);
  const padRight = Math.max(0, Number(mobilePadding.right) || 0);
  const padBottom = Math.max(0, Number(mobilePadding.bottom) || 0);
  const padLeft = Math.max(0, Number(mobilePadding.left) || 0);

  const gridHeight = useMemo(() => {
    if (readOnly) return null;
    const innerPad = padTop + padBottom + 16;
    return computeNestedGridPixelHeight(normalizedLayout, { paddingPx: innerPad });
  }, [normalizedLayout, padTop, padBottom, readOnly]);

  if (!childWidgets.length) {
    return (
      <div
        ref={hostRef}
        className={`flex-1 min-h-[120px] flex flex-col items-center justify-center gap-2 border border-dashed rounded-md bg-white/50 ${
          isDraggingOver ? "border-blue-500 bg-blue-50/60" : "border-slate-300/80"
        }`}
        style={{ padding: `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px` }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={`text-[10px] uppercase tracking-widest font-semibold text-center px-3 ${isDraggingOver ? "text-blue-700" : "text-slate-400"}`}>
          {isDraggingOver ? "Release to drop widget here" : "Drag a widget here or add below"}
        </p>
        {!readOnly && containerId && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {["kpi", "heading", "table", "graph"].map((childType) => (
              <button
                key={`quick-${childType}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChildWidget?.(containerId, childType);
                }}
                className="px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700"
              >
                + {childType}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const nestedHostStyle = readOnly
    ? {
        width: "100%",
        minWidth: 0,
        height: "100%",
        overflow: "hidden",
        ...(isPhoneMode
          ? { padding: `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px` }
          : null),
      }
    : { padding: `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`, minHeight: gridHeight };
  const nestedGridStyle = readOnly ? { height: "100%" } : { minHeight: gridHeight };

  return (
    <div
      ref={hostRef}
      className="flex-1 min-h-0 w-full"
      style={nestedHostStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {width > 0 && (
        <GridLayout
          className="container-nested-grid"
          width={width}
          cols={NESTED_COLS}
          rowHeight={NESTED_ROW_HEIGHT}
          margin={[NESTED_GAP, NESTED_GAP]}
          containerPadding={[0, 0]}
          layout={normalizedLayout}
          compactType={null}
          preventCollision={false}
          draggableHandle={readOnly ? undefined : ".nested-drag-handle"}
          isDraggable={!readOnly}
          isResizable={!readOnly}
          resizeHandles={readOnly ? [] : ["s", "w", "e", "n", "sw", "nw", "se", "ne"]}
          onDragStop={(nextLayout) => onLayoutChange?.(nextLayout || [])}
          onResizeStop={(nextLayout) => onLayoutChange?.(nextLayout || [])}
          style={nestedGridStyle}
        >
          {childWidgets.map((child) => (
            <div
              key={String(child.id)}
              className={`group relative h-full w-full ${String(selectedWidgetId) === String(child.id) ? "z-20" : "z-10"}`}
              onMouseDown={(e) => {
                if (readOnly) return;
                if (e.target.closest(".nested-drag-handle, .widget-action-bar, button, .react-resizable-handle")) return;
                e.stopPropagation();
                onSelectWidget?.(child.id);
              }}
              onClick={(e) => {
                if (readOnly) return;
                e.stopPropagation();
                onSelectWidget?.(child.id);
              }}
            >
              {!readOnly && String(selectedWidgetId) === String(child.id) && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-l pointer-events-none z-0" />
              )}
              {!readOnly && (
                <>
                  <div className="nested-drag-handle absolute top-1 left-1 z-40 h-5 w-5 grid place-items-center cursor-move opacity-0 group-hover:opacity-100 bg-white shadow border border-slate-200 rounded transition-all">
                    <GripVertical size={11} className="text-slate-400 pointer-events-none" />
                  </div>
                  {String(selectedWidgetId) === String(child.id) && (
                    <div className="widget-action-bar absolute top-1 left-7 z-40 flex items-center gap-0.5 bg-white border border-slate-200 rounded shadow-sm p-0.5">
                      <button
                        type="button"
                        className="h-5 w-5 grid place-items-center rounded hover:bg-slate-100 text-slate-600"
                        title="Edit"
                        onClick={(e) => { e.stopPropagation(); onSelectWidget?.(child.id); }}
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        type="button"
                        className="h-5 w-5 grid place-items-center rounded hover:bg-slate-100 text-slate-600"
                        title="Clone"
                        onClick={(e) => { e.stopPropagation(); onCloneChildWidget?.(containerId, child); }}
                      >
                        <Copy size={10} />
                      </button>
                      <button
                        type="button"
                        className="h-5 w-5 grid place-items-center rounded hover:bg-rose-50 text-rose-500"
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); onDeleteWidget?.(child); }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </>
              )}
              <WidgetRenderer widget={child} readOnly={readOnly} nested isPhoneMode={isPhoneMode} />
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
