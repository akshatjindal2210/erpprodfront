"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import WidgetRenderer from "./WidgetRenderer";
import {
  HANDLE_STYLES,
  RESIZE_HANDLE_STYLES,
  selectionStyle,
  SimpleWidgetToolbar,
} from "./simpleBuilderChrome";
import {
  boxToInlineStyle,
  boxesFromChildren,
  boxWithId,
  containerContentHeightPx,
  defaultBoxForType,
  layoutPxFingerprint,
  normalizeBox,
  readWidgetBoxPx,
  savedStyleToCss,
  sanitizeNestedLayoutPx,
} from "../utils/floatingLayoutEngine";

const CANCEL_SELECTOR = ".simple-no-drag, button, a, input, textarea, select";

export default function SimpleNestedCanvas({
  childWidgets = [],
  layoutPx = [],
  readOnly = false,
  selectedWidgetId = null,
  onLayoutChange,
  onSelectWidget,
  onDeleteWidget,
  onAddChildWidget,
  containerId = null,
  onCloneChildWidget,
  isDraggingOver = false,
  onCanvasBackgroundClick,
  onContainerShellPointerDown,
  fillParentHeight = false,
  canvasScale = 1,
  dragScale = 1,
  isPhoneMode = false,
}) {
  // canvasScale remaps design→view when needed; keep 1 when parent CSS-scales the tree.
  const scale = Number(canvasScale) > 0 ? Number(canvasScale) : 1;
  // Parent SimpleBuilderCanvas applies CSS transform:scale(fitScale) — Rnd must match it
  // or drag/resize commits wrong pixel gaps (tight visually, spaced after publish).
  const rndScale = Number(dragScale) > 0 ? Number(dragScale) : 1;

  const boxes = useMemo(
    () => boxesFromChildren(childWidgets, layoutPx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childWidgets, layoutPxFingerprint(layoutPx)],
  );
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;
  const boxesFp = useMemo(() => layoutPxFingerprint(boxes), [boxes]);
  const [liveBoxes, setLiveBoxes] = useState(null);

  useEffect(() => {
    setLiveBoxes(null);
  }, [boxesFp]);

  const toView = useCallback((box) => normalizeBox({
    left: box.left * scale,
    top: box.top * scale,
    width: box.width * scale,
    height: box.height * scale,
  }), [scale]);

  const fromView = useCallback((patch) => {
    const next = { ...patch };
    if (patch.left != null) next.left = Number(patch.left) / scale;
    if (patch.top != null) next.top = Number(patch.top) / scale;
    if (patch.width != null) next.width = Number(patch.width) / scale;
    if (patch.height != null) next.height = Number(patch.height) / scale;
    return next;
  }, [scale]);

  const getBox = useCallback((id) => {
    const key = String(id);
    if (liveBoxes?.has(key)) return liveBoxes.get(key);
    return boxes.find((b) => String(b.i) === key) || null;
  }, [boxes, liveBoxes]);

  const commitBox = useCallback((id, viewPatch) => {
    const patch = fromView(viewPatch);
    const next = sanitizeNestedLayoutPx(
      boxesRef.current.map((box) => {
        if (String(box.i) !== String(id)) return box;
        return boxWithId(id, {
          ...box,
          ...patch,
          left: Math.max(0, Number(patch.left ?? box.left) || 0),
          top: Math.max(0, Number(patch.top ?? box.top) || 0),
        });
      }).filter(Boolean),
    );
    boxesRef.current = next;
    setLiveBoxes(null);
    onLayoutChangeRef.current?.(next, {});
  }, [fromView]);

  const designHeight = fillParentHeight
    ? undefined
    : Math.max(containerContentHeightPx(boxes, 8), readOnly ? 0 : 280);
  const canvasHeight = designHeight == null ? undefined : Math.ceil(designHeight * scale);

  if (!childWidgets.length) {
    return (
      <div
        className={`flex min-h-[120px] flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed ${
          isDraggingOver ? "border-blue-500 bg-blue-50/60" : "border-slate-300/80 bg-white/50"
        }`}
        onMouseDown={(e) => {
          if (e.target.closest("button")) {
            e.stopPropagation();
            return;
          }
          onContainerShellPointerDown?.(e);
        }}
      >
        <p className={`px-3 text-center text-[10px] font-semibold uppercase tracking-widest ${isDraggingOver ? "text-blue-700" : "text-slate-400"}`}>
          {isDraggingOver ? "Drop here" : "Add a widget inside"}
        </p>
        {!readOnly && containerId && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {["kpi", "heading", "table", "graph"].map((type) => (
              <button
                key={type}
                type="button"
                className="rounded-md bg-blue-600 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white hover:bg-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChildWidget?.(containerId, type);
                }}
              >
                + {type}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative w-full min-w-0 ${fillParentHeight ? "h-full min-h-0 flex-1" : ""}`}
      style={fillParentHeight
        ? { height: "100%", overflow: "hidden" }
        : { height: canvasHeight, minHeight: canvasHeight, overflow: "hidden" }}
      onMouseDown={(e) => {
        if (e.target.closest(".simple-rnd, button")) return;
        if (onContainerShellPointerDown) {
          onContainerShellPointerDown(e);
          return;
        }
        onCanvasBackgroundClick?.();
      }}
    >
      {childWidgets.map((child) => {
        const box = getBox(child.id) || normalizeBox(readWidgetBoxPx(child, 0));
        const viewBox = toView(box);
        const isSelected = !readOnly && String(selectedWidgetId) === String(child.id);
        const mins = defaultBoxForType(child.rawType || child.type);
        // Position shell: only colors/radius — no padding/margin (those inflate gaps between widgets).
        const css = savedStyleToCss(child.style || {});
        delete css.padding;
        delete css.paddingTop;
        delete css.paddingRight;
        delete css.paddingBottom;
        delete css.paddingLeft;
        delete css.margin;
        delete css.marginTop;
        delete css.marginRight;
        delete css.marginBottom;
        delete css.marginLeft;

        if (readOnly) {
          return (
            <div
              key={String(child.id)}
              style={{
                ...boxToInlineStyle(viewBox),
                ...css,
                width: viewBox.width,
                height: viewBox.height,
                overflow: "hidden",
                margin: 0,
                padding: 0,
              }}
            >
              <WidgetRenderer widget={child} readOnly nested designParity={false} pureSavedStyle suppressChrome isPhoneMode={isPhoneMode} />
            </div>
          );
        }

        return (
          <Rnd
            key={String(child.id)}
            className="simple-rnd"
            scale={rndScale}
            size={{ width: viewBox.width, height: viewBox.height }}
            position={{ x: viewBox.left, y: viewBox.top }}
            minWidth={Math.max(40, mins.width * 0.5 * scale)}
            minHeight={Math.max(32, mins.height * 0.5 * scale)}
            enableResizing={HANDLE_STYLES}
            resizeHandleStyles={RESIZE_HANDLE_STYLES}
            cancel={CANCEL_SELECTOR}
            style={{
              ...css,
              ...selectionStyle(isSelected, false),
              zIndex: isSelected ? 30 : 10,
              overflow: "visible",
              margin: 0,
              padding: 0,
            }}
            onDragStart={() => onSelectWidget?.(child.id)}
            onDrag={(_e, d) => {
              const design = fromView({ left: d.x, top: d.y, width: viewBox.width, height: viewBox.height });
              setLiveBoxes((prev) => {
                const map = new Map(prev || boxes.map((b) => [String(b.i), b]));
                const cur = map.get(String(child.id)) || box;
                map.set(String(child.id), { ...cur, left: design.left, top: design.top });
                return map;
              });
            }}
            onDragStop={(_e, d) => {
              commitBox(child.id, { left: Math.max(0, d.x), top: Math.max(0, d.y) });
            }}
            onResizeStart={() => onSelectWidget?.(child.id)}
            onResize={(_e, _dir, ref, _delta, pos) => {
              const design = fromView({
                left: pos.x,
                top: pos.y,
                width: ref.offsetWidth,
                height: ref.offsetHeight,
              });
              setLiveBoxes((prev) => {
                const map = new Map(prev || boxes.map((b) => [String(b.i), b]));
                map.set(String(child.id), design);
                return map;
              });
            }}
            onResizeStop={(_e, _dir, ref, _delta, pos) => {
              commitBox(child.id, {
                left: Math.max(0, pos.x),
                top: Math.max(0, pos.y),
                width: ref.offsetWidth,
                height: ref.offsetHeight,
              });
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onSelectWidget?.(child.id);
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <SimpleWidgetToolbar
              onEdit={(e) => { e.stopPropagation(); onSelectWidget?.(child.id); }}
              onClone={(e) => { e.stopPropagation(); onCloneChildWidget?.(containerId, child); }}
              onDelete={(e) => { e.stopPropagation(); onDeleteWidget?.(child); }}
            />
            <div className="h-full w-full min-h-0 min-w-0 overflow-hidden">
              <WidgetRenderer widget={child} readOnly={false} nested designParity={false} pureSavedStyle suppressChrome isPhoneMode={isPhoneMode} />
            </div>
          </Rnd>
        );
      })}
    </div>
  );
}
