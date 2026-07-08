"use client";

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { GripVertical, Pencil, Trash2, Copy } from "lucide-react";
import WidgetRenderer from "./WidgetRenderer";
import { computeNestedLayoutPixelExtent, mergeNestedItemFromChild } from "../utils/dashboardLayoutEngine";

const NESTED_COLS = 12;
const NESTED_ROW_HEIGHT = 48;
const NESTED_GAP = 8;

const defaultNestedWH = (rawType = "kpi") => {
  if (rawType === "heading") return { w: 12, h: 1 };
  if (rawType === "table" || rawType === "graph") return { w: 12, h: 3 };
  return { w: 4, h: 2 };
};

const normalizeNestedItem = (raw = {}, idx = 0, id = "", { lock = false, rawType = "kpi" } = {}) => {
  const defaults = defaultNestedWH(rawType);
  return {
    i: String(id || raw.i || `nested_${idx}`),
    x: Number.isFinite(Number(raw.x)) ? Number(raw.x) : 0,
    y: Number.isFinite(Number(raw.y)) ? Number(raw.y) : 0,
    w: Math.max(1, Number.isFinite(Number(raw.w)) ? Number(raw.w) : defaults.w),
    h: Math.max(1, Number.isFinite(Number(raw.h)) ? Number(raw.h) : defaults.h),
    minW: 1,
    minH: 1,
    static: lock,
    isResizable: !lock,
    isDraggable: !lock,
  };
};

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
  const [interactionLayout, setInteractionLayout] = useState(null);
  const [committedLayout, setCommittedLayout] = useState(null);

  const padTop = Math.max(0, Number(mobilePadding.top) || 0);
  const padRight = Math.max(0, Number(mobilePadding.right) || 0);
  const padBottom = Math.max(0, Number(mobilePadding.bottom) || 0);
  const padLeft = Math.max(0, Number(mobilePadding.left) || 0);
  const nestedPaddingStyle = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;

  const normalizedLayout = useMemo(() => {
    const childIds = new Set(childWidgets.map((child) => String(child.id)));
    const source = (Array.isArray(layout) ? layout : []).filter((item) => childIds.has(String(item.i)));
    return childWidgets.map((child, idx) => {
      const matched = source.find((item) => String(item.i) === String(child.id));
      // Publish/builder: container nested_layout coords first — never rewrite from stale child.layout.
      const base = matched
        ? { i: String(child.id), x: matched.x, y: matched.y, w: matched.w, h: matched.h }
        : mergeNestedItemFromChild(child, child.layout || {});
      return normalizeNestedItem(base, idx, child.id, {
        lock: readOnly,
        rawType: child.rawType || child.type || "kpi",
      });
    });
  }, [childWidgets, layout, readOnly]);

  const activeLayout = interactionLayout || committedLayout || normalizedLayout;

  useLayoutEffect(() => {
    if (!committedLayout) return;
    const synced = committedLayout.every((item) => {
      const norm = normalizedLayout.find((entry) => String(entry.i) === String(item.i));
      return norm
        && Number(norm.w) === Number(item.w)
        && Number(norm.h) === Number(item.h)
        && Number(norm.x) === Number(item.x)
        && Number(norm.y) === Number(item.y);
    });
    if (synced) setCommittedLayout(null);
  }, [normalizedLayout, committedLayout]);

  const commitLayout = (nextLayout) => {
    setInteractionLayout(null);
    setCommittedLayout(
      (nextLayout || []).map((item, idx) => {
        const child = childWidgets.find((entry) => String(entry.id) === String(item.i));
        return normalizeNestedItem(item, idx, item.i, {
          rawType: child?.rawType || child?.type || "kpi",
        });
      }),
    );
    onLayoutChange?.(nextLayout || [], { lockResizedIds: [] });
  };

  const nestedMaxRow = useMemo(
    () => Math.max(
      1,
      activeLayout.reduce(
        (max, item) => Math.max(max, (Number(item.y) || 0) + (Number(item.h) || 1)),
        0,
      ),
    ),
    [activeLayout],
  );

  const gridHeight = useMemo(
    () => Math.max(
      computeNestedLayoutPixelExtent(activeLayout, childWidgets),
      nestedMaxRow * NESTED_ROW_HEIGHT + Math.max(0, nestedMaxRow - 1) * NESTED_GAP,
    ),
    [activeLayout, childWidgets, nestedMaxRow],
  );

  useLayoutEffect(() => {
    const node = hostRef.current;
    if (!node) return undefined;
    const update = () => setWidth(Math.max(0, Math.floor(node.getBoundingClientRect().width)));
    update();
    const raf = window.requestAnimationFrame(update);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (observer) observer.observe(node);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [childWidgets.length, layout.length, nestedMaxRow, readOnly]);

  if (!childWidgets.length) {
    return (
      <div
        className={`flex-1 min-h-[120px] flex flex-col items-center justify-center gap-2 border border-dashed rounded-md bg-white/50 ${
          isDraggingOver ? "border-blue-500 bg-blue-50/60" : "border-slate-300/80"
        }`}
        style={{ padding: nestedPaddingStyle }}
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

  return (
    <div
      className={`${readOnly ? "shrink-0" : "min-h-0"} w-full overflow-visible`}
      style={{ padding: nestedPaddingStyle }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={hostRef}
        className="relative w-full overflow-visible"
        style={{ height: gridHeight, minHeight: gridHeight }}
      >
        {width > 0 && (
          <GridLayout
            className={`container-nested-grid${readOnly ? " read-only-nested" : ""}`}
            width={width}
            cols={NESTED_COLS}
            rowHeight={NESTED_ROW_HEIGHT}
            margin={[NESTED_GAP, NESTED_GAP]}
            containerPadding={[0, 0]}
            layout={activeLayout}
            compactType={null}
            preventCollision={false}
            draggableHandle={readOnly ? undefined : ".nested-drag-handle"}
            draggableCancel=".widget-action-bar, button, a, input, select, textarea, .react-resizable-handle"
            isDraggable={!readOnly}
            isResizable={!readOnly}
            resizeHandles={readOnly ? [] : ["se", "s", "e", "w"]}
            onLayoutChange={readOnly ? undefined : (nextLayout) => setInteractionLayout(nextLayout || [])}
            onDragStop={readOnly ? undefined : (nextLayout) => commitLayout(nextLayout || [])}
            onResizeStop={readOnly ? undefined : (nextLayout) => commitLayout(nextLayout || [])}
            style={{ minHeight: gridHeight, height: gridHeight }}
          >
            {childWidgets.map((child) => {
              const isSelected = !readOnly && String(selectedWidgetId) === String(child.id);
              return (
                <div
                  key={String(child.id)}
                  className={`group relative h-full w-full overflow-visible ${
                    child.rawType === "heading" ? "heading-widget-cell " : ""
                  }${isSelected ? "ring-1 ring-blue-400 z-30" : "z-10"}`}
                  onMouseDown={readOnly ? undefined : (e) => {
                    if (e.target.closest(".nested-drag-handle, .widget-action-bar, button, .react-resizable-handle")) return;
                    e.stopPropagation();
                    onSelectWidget?.(child.id);
                  }}
                  onClick={readOnly ? undefined : (e) => {
                    e.stopPropagation();
                    onSelectWidget?.(child.id);
                  }}
                >
                  {!readOnly && (
                    <>
                      <div className="nested-drag-handle absolute top-1 left-1 z-40 h-5 w-5 grid place-items-center cursor-move opacity-0 group-hover:opacity-100 bg-white shadow border border-slate-200 rounded transition-all">
                        <GripVertical size={11} className="text-slate-400 pointer-events-none" />
                      </div>
                      <div
                        className={`widget-action-bar absolute top-1 left-7 z-50 flex flex-row items-center gap-0.5 shrink-0 w-auto h-auto bg-white border border-slate-200 rounded shadow-sm p-0.5 transition-opacity pointer-events-auto ${
                          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <button
                          type="button"
                          className="h-5 w-5 shrink-0 grid place-items-center rounded hover:bg-slate-100 text-slate-600"
                          title="Edit"
                          onClick={(e) => { e.stopPropagation(); onSelectWidget?.(child.id); }}
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          type="button"
                          className="h-5 w-5 shrink-0 grid place-items-center rounded hover:bg-slate-100 text-slate-600"
                          title="Clone"
                          onClick={(e) => { e.stopPropagation(); onCloneChildWidget?.(containerId, child); }}
                        >
                          <Copy size={10} />
                        </button>
                        <button
                          type="button"
                          className="h-5 w-5 shrink-0 grid place-items-center rounded hover:bg-rose-50 text-rose-500"
                          title="Delete"
                          onClick={(e) => { e.stopPropagation(); onDeleteWidget?.(child); }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </>
                  )}
                  <div className="h-full w-full min-h-0 flex overflow-visible relative z-[1]">
                    <WidgetRenderer
                      widget={child}
                      readOnly={readOnly}
                      nested
                      isPhoneMode={isPhoneMode}
                      designParity
                    />
                  </div>
                </div>
              );
            })}
          </GridLayout>
        )}
      </div>
    </div>
  );
}
