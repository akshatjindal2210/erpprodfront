"use client";

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactGridLayout from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { GripVertical, Pencil, Trash2, Copy } from "lucide-react";
import WidgetRenderer from "./WidgetRenderer";
import { computeNestedLayoutPixelExtent, mergeNestedItemFromChild, NESTED_BUILDER_COLS, NESTED_GAP, NESTED_GRID_COLS, NESTED_ROW_HEIGHT,
  nestedLayoutFromBaseBuilder, nestedLayoutToBaseBuilder, normalizeNestedLayoutItem, resolveNestedBuilderGridMetrics, sanitizeNestedLiveLayout,
  scaleNestedLayoutToBuilder, scaleNestedLayoutToStorage, snapNestedLayoutOnCommit,
} from "../utils/dashboardLayoutEngine";

const NESTED_COLS = NESTED_GRID_COLS;

function nestedLayoutsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((item) => {
    const other = b.find((entry) => String(entry.i) === String(item.i));
    return other
      && Number(other.x) === Number(item.x)
      && Number(other.y) === Number(item.y)
      && Number(other.w) === Number(item.w)
      && Number(other.h) === Number(item.h);
  });
}

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
  onNestedGridWidthDiscover,
  nestedGridWidthPx = null,
  isContainerResizing = false,
  mobilePadding = {},
  isDraggingOver = false,
  isPhoneMode = false,
}) {
  const hostRef = useRef(null);
  const hostWidthRef = useRef(0);
  const notifiedParentRef = useRef(false);
  const activeNestedItemRef = useRef(null);
  const [hostWidth, setHostWidth] = useState(0);
  const [localFrozenWidth, setLocalFrozenWidth] = useState(null);
  const [interactionLayout, setInteractionLayout] = useState(null);

  const padTop = Math.max(0, Number(mobilePadding.top) || 0);
  const padRight = Math.max(0, Number(mobilePadding.right) || 0);
  const padBottom = Math.max(0, Number(mobilePadding.bottom) || 0);
  const padLeft = Math.max(0, Number(mobilePadding.left) || 0);
  const nestedPaddingStyle = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;

  const lockedGridWidth = Number.isFinite(Number(nestedGridWidthPx)) && Number(nestedGridWidthPx) > 0
    ? Math.round(Number(nestedGridWidthPx))
    : null;
  const baseLockedWidth = lockedGridWidth ?? localFrozenWidth ?? null;

  const layoutContentCols = useMemo(() => {
    const scaled = scaleNestedLayoutToBuilder(layout, NESTED_BUILDER_COLS);
    return scaled.reduce(
      (max, item) => Math.max(max, (Number(item.x) || 0) + Math.max(1, Number(item.w) || 1)),
      NESTED_BUILDER_COLS,
    );
  }, [layout]);

  const { gridCols, gridWidth } = useMemo(
    () => resolveNestedBuilderGridMetrics({
      lockedWidthPx: baseLockedWidth,
      hostWidthPx: hostWidth,
      readOnly,
      layout: [{ x: 0, y: 0, w: layoutContentCols, h: 1 }],
    }),
    [baseLockedWidth, hostWidth, readOnly, layoutContentCols],
  );

  useLayoutEffect(() => {
    notifiedParentRef.current = false;
    setLocalFrozenWidth(null);
  }, [containerId]);

  useLayoutEffect(() => {
    if (lockedGridWidth) {
      setLocalFrozenWidth(lockedGridWidth);
    }
  }, [lockedGridWidth]);

  const normalizedLayout = useMemo(() => {
    const childIds = new Set(childWidgets.map((child) => String(child.id)));
    const source = (Array.isArray(layout) ? layout : []).filter((item) => childIds.has(String(item.i)));
    const baseBuilder = readOnly
      ? source
      : scaleNestedLayoutToBuilder(source, NESTED_BUILDER_COLS);
    const displayLayout = readOnly
      ? baseBuilder
      : nestedLayoutFromBaseBuilder(baseBuilder, gridCols);
    return childWidgets.map((child, idx) => {
      const matched = displayLayout.find((item) => String(item.i) === String(child.id));
      const fallbackLayout = isPhoneMode ? (child.mobileLayout || {}) : (child.layout || {});
      const fallbackBase = readOnly
        ? fallbackLayout
        : scaleNestedLayoutToBuilder([mergeNestedItemFromChild(child, fallbackLayout)], NESTED_BUILDER_COLS)[0];
      const fallbackDisplay = readOnly
        ? fallbackBase
        : nestedLayoutFromBaseBuilder([fallbackBase], gridCols)[0];
      const base = matched
        ? { i: String(child.id), x: matched.x, y: matched.y, w: matched.w, h: matched.h }
        : fallbackDisplay;
      return normalizeNestedLayoutItem(base, idx, child.id, {
        lock: readOnly,
        rawType: child.rawType || child.type || "kpi",
        cols: gridCols,
      });
    });
  }, [childWidgets, layout, readOnly, isPhoneMode, gridCols]);

  const activeLayout = interactionLayout || normalizedLayout;
  const isInteracting = Boolean(interactionLayout);
  const layoutForBounds = isInteracting ? normalizedLayout : activeLayout;

  useLayoutEffect(() => {
    setInteractionLayout(null);
  }, [childWidgets.length, containerId]);

  const commitLayout = (nextLayout) => {
    const snapped = snapNestedLayoutOnCommit(nextLayout, activeNestedItemRef.current, gridCols);
    activeNestedItemRef.current = null;
    const normalized = snapped.map((item, idx) => {
      const child = childWidgets.find((entry) => String(entry.id) === String(item.i));
      return normalizeNestedLayoutItem(item, idx, item.i, {
        rawType: child?.rawType || child?.type || "kpi",
        cols: gridCols,
      });
    });
    const baseBuilder = nestedLayoutToBaseBuilder(normalized, gridCols);
    const storageLayout = readOnly
      ? normalized
      : scaleNestedLayoutToStorage(baseBuilder, NESTED_BUILDER_COLS).map((item, idx) => {
        const child = childWidgets.find((entry) => String(entry.id) === String(item.i));
        return normalizeNestedLayoutItem(item, idx, item.i, {
          rawType: child?.rawType || child?.type || "kpi",
          cols: NESTED_COLS,
        });
      });
    setInteractionLayout(null);
    onLayoutChange?.(storageLayout, { lockResizedIds: [] });
  };

  const handleLiveLayoutChange = (nextLayout) => {
    if (!activeNestedItemRef.current) return;
    const sanitized = sanitizeNestedLiveLayout(nextLayout, gridCols);
    setInteractionLayout((prev) => (nestedLayoutsEqual(prev, sanitized) ? prev : sanitized));
  };

  const handleInteractionStart = (_layout, oldItem) => {
    activeNestedItemRef.current = oldItem?.i ? String(oldItem.i) : null;
  };

  const handleInteractionStop = (nextLayout) => {
    commitLayout(nextLayout || []);
  };

  const nestedMaxRow = useMemo(
    () => Math.max(
      1,
      layoutForBounds.reduce(
        (max, item) => Math.max(max, (Number(item.y) || 0) + (Number(item.h) || 1)),
        0,
      ),
    ),
    [layoutForBounds],
  );

  const hostOverflowClass = readOnly ? "overflow-hidden" : "overflow-visible";

  const gridHeight = useMemo(
    () => {
      const contentHeight = Math.max(
        computeNestedLayoutPixelExtent(layoutForBounds, childWidgets),
        nestedMaxRow * NESTED_ROW_HEIGHT + Math.max(0, nestedMaxRow - 1) * NESTED_GAP,
      );
      return readOnly ? contentHeight : contentHeight + NESTED_GAP;
    },
    [layoutForBounds, childWidgets, nestedMaxRow, readOnly],
  );

  useLayoutEffect(() => {
    const node = hostRef.current;
    if (!node) return undefined;
    const update = () => {
      const next = Math.max(0, Math.floor(node.getBoundingClientRect().width));
      if (next === hostWidthRef.current) return;
      hostWidthRef.current = next;
      setHostWidth(next);
    };
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (observer) observer.observe(node);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerId, readOnly]);

  useLayoutEffect(() => {
    if (readOnly || isPhoneMode || lockedGridWidth) return;
    if (!childWidgets.length || hostWidth < 40) return;
    setLocalFrozenWidth((prev) => (prev != null ? prev : hostWidth));
  }, [readOnly, isPhoneMode, lockedGridWidth, childWidgets.length, hostWidth]);

  useLayoutEffect(() => {
    if (readOnly || isPhoneMode || lockedGridWidth || notifiedParentRef.current) return;
    if (localFrozenWidth == null || localFrozenWidth < 40) return;
    notifiedParentRef.current = true;
    queueMicrotask(() => {
      onNestedGridWidthDiscover?.(localFrozenWidth, { growOnly: true });
    });
  }, [readOnly, isPhoneMode, lockedGridWidth, localFrozenWidth, onNestedGridWidthDiscover]);

  void isContainerResizing;

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
      className="min-h-0 min-w-0 w-full overflow-hidden"
      style={{ padding: nestedPaddingStyle }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={hostRef}
        className={`relative w-full min-w-0 container-nested-grid-host ${hostOverflowClass}`}
        style={{ height: gridHeight, minHeight: gridHeight }}
      >
        {gridWidth > 0 && (
          <div
            className="absolute left-0 top-0"
            style={{
              width: gridWidth,
              height: gridHeight,
            }}
          >
            <ReactGridLayout
              className={`container-nested-grid${readOnly ? " read-only-nested" : ""}`}
              width={gridWidth}
              cols={gridCols}
              rowHeight={NESTED_ROW_HEIGHT}
              margin={[NESTED_GAP, NESTED_GAP]}
              containerPadding={[0, 0]}
              layout={activeLayout}
              compactType={null}
              preventCollision={false}
              autoSize={false}
              draggableCancel=".nested-widget-toolbar, .widget-action-bar, button, a, input, select, textarea, .react-resizable-handle"
              isDraggable={!readOnly}
              isResizable={!readOnly}
              resizeHandles={readOnly ? [] : ["se", "e", "s", "w"]}
              onDragStart={readOnly ? undefined : handleInteractionStart}
              onResizeStart={readOnly ? undefined : handleInteractionStart}
              onDrag={readOnly ? undefined : handleLiveLayoutChange}
              onResize={readOnly ? undefined : handleLiveLayoutChange}
              onDragStop={readOnly ? undefined : handleInteractionStop}
              onResizeStop={readOnly ? undefined : handleInteractionStop}
              style={{ minHeight: gridHeight, height: gridHeight }}
            >
              {childWidgets.map((child) => {
                const isSelected = !readOnly && String(selectedWidgetId) === String(child.id);
                return (
                  <div
                    key={String(child.id)}
                    className={`group relative h-full w-full overflow-visible cursor-grab active:cursor-grabbing ${
                      child.rawType === "heading" ? "heading-widget-cell " : ""
                    }${isSelected ? "z-30" : "z-10"}`}
                    onClick={readOnly ? undefined : (e) => {
                      if (e.target.closest("button, .react-resizable-handle")) return;
                      e.stopPropagation();
                      onSelectWidget?.(child.id);
                    }}
                  >
                    {!readOnly && (
                      <div
                        className={`nested-widget-toolbar absolute top-1 left-1 z-50 flex flex-row items-center gap-0.5 shrink-0 bg-white border border-slate-200 rounded-md shadow-sm p-0.5 transition-opacity pointer-events-auto ${
                          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <div
                          className="nested-drag-handle h-5 w-5 shrink-0 grid place-items-center rounded hover:bg-slate-100 cursor-grab active:cursor-grabbing"
                          title="Drag"
                        >
                          <GripVertical size={11} className="text-slate-400 pointer-events-none" />
                        </div>
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
                    )}
                    <div className={`nested-widget-shell w-full min-h-0 min-w-0 flex relative z-[1] self-start h-full ${
                      isSelected ? "ring-1 ring-blue-400 rounded-md" : ""
                    } ${readOnly ? (isInteracting ? "overflow-visible" : "overflow-hidden") : "overflow-visible"}`}>
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
            </ReactGridLayout>
          </div>
        )}
      </div>
    </div>
  );
}
