"use client";

import React, { useMemo } from "react";
import WidgetRenderer from "./WidgetRenderer";
import { resolvePublishedDesktopLayout, resolvePublishedPhoneLayout } from "../utils/dashboardLayoutEngine";

const DEFAULT_COLS = 12;
const DEFAULT_ROW_HEIGHT = 64;
const DEFAULT_GAP_X = 12;
const DEFAULT_GAP_Y = 12;

export default function DashboardLiveGrid({
  widgets = [],
  layout = [],
  cols = DEFAULT_COLS,
  rowHeight = DEFAULT_ROW_HEIGHT,
  gapX = DEFAULT_GAP_X,
  gapY = DEFAULT_GAP_Y,
  isPhoneMode = false,
  fullLayout = null,
}) {
  const widgetById = useMemo(
    () => new Map(widgets.map((widget) => [String(widget.id), widget])),
    [widgets],
  );

  const resolvedLayout = useMemo(() => {
    const ids = new Set(widgets.map((w) => String(w.id)));
    const filtered = (layout || []).filter((item) => ids.has(String(item.i)));
    if (isPhoneMode) {
      return resolvePublishedPhoneLayout(widgets, filtered, cols, fullLayout);
    }
    return resolvePublishedDesktopLayout(widgets, filtered, cols, fullLayout);
  }, [layout, widgets, isPhoneMode, cols, fullLayout]);

  const maxRow = useMemo(
    () => resolvedLayout.reduce(
      (max, item) => Math.max(max, item.y + item.h),
      0,
    ),
    [resolvedLayout],
  );

  if (!widgets.length) return null;

  return (
    <div
      className="dashboard-live-css-grid w-full"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: maxRow > 0
          ? `repeat(${maxRow}, ${rowHeight}px)`
          : undefined,
        gap: `${gapY}px ${gapX}px`,
        width: "100%",
        alignItems: "stretch",
      }}
    >
      {resolvedLayout.map((item) => {
        const widget = widgetById.get(String(item.i));
        if (!widget) return null;
        const isContainer = widget.rawType === "container";
        return (
          <div
            key={String(widget.id)}
            className={`dashboard-live-cell min-w-0 ${isContainer ? "dashboard-live-container-cell" : "mt-4"}`}
            style={{
              gridColumn: `${item.x + 1} / span ${item.w}`,
              gridRow: `${item.y + 1} / span ${item.h}`,
              minHeight: 0,
              minWidth: 0,
              height: isContainer ? "auto" : undefined,
              alignSelf: isContainer ? "start" : "stretch",
            }}
          >
            <WidgetRenderer
              widget={widget}
              readOnly
              isPhoneMode={isPhoneMode}
              isDropTarget={false}
              selectedWidgetId={null}
              onNestedLayoutChange={() => {}}
              onSelectWidget={() => {}}
              onDeleteWidget={() => {}}
              onAddChildWidget={() => {}}
              onCloneChildWidget={() => {}}
              onCloneWidget={() => {}}
            />
          </div>
        );
      })}
    </div>
  );
}
