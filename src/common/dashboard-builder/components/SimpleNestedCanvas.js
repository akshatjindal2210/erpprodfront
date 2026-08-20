"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Rnd } from "react-rnd";
import WidgetRenderer from "./WidgetRenderer";
import { HANDLE_STYLES, resizeHandleStylesForSelection, selectionStyle, parityWidgetBodyShellStyle, SimpleWidgetToolbar } from "./simpleBuilderChrome";
import { boxToInlineStyle, boxesFromChildren, boxWithId, containerContentHeightPx, defaultBoxForType, fitNestedLayoutForPhoneEdit, fitNestedLayoutPxToWidth, fitNestedPhoneBoxes, layoutPxFingerprint, normalizeBox, readWidgetBoxPx, sanitizeNestedLayoutPx } from "../utils/floatingLayoutEngine";
import { getWidgetClickUrl, navigateWidgetClickUrl, shouldIgnoreWidgetLinkClick, widgetHasClickLink } from "../utils/widgetClickLink";

const CANCEL_SELECTOR = ".simple-no-drag, button, a, input, textarea, select";
const PHONE_NESTED_BOTTOM_ROOM = 160;

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
  const router = useRouter();
  const scale = Number(canvasScale) > 0 ? Number(canvasScale) : 1;
  const rndScale = Number(dragScale) > 0 ? Number(dragScale) : 1;

  const hostRef = useRef(null);
  const [hostWidth, setHostWidth] = useState(0);
  const [dragCanvasPad, setDragCanvasPad] = useState(0);

  useLayoutEffect(() => {
    const node = hostRef.current;
    if (!node) return undefined;
    const measure = () => {
      const w = Math.floor(node.clientWidth || node.getBoundingClientRect().width || 0);
      if (w >= 40) setHostWidth((prev) => (Math.abs(prev - w) <= 1 ? prev : w));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => window.requestAnimationFrame(measure));
    ro.observe(node);
    return () => ro.disconnect();
  }, [childWidgets.length]);

  const sourceBoxes = useMemo(
    () => boxesFromChildren(childWidgets, layoutPx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childWidgets, layoutPxFingerprint(layoutPx)],
  );

  // Phone builder: scale only when layout is wider than container; phone-sized coords stay 1:1.
  const phoneEditBoxes = useMemo(() => {
    if (!isPhoneMode || readOnly) return sourceBoxes;
    if (hostWidth < 40) return sourceBoxes;
    return fitNestedLayoutForPhoneEdit(sourceBoxes, hostWidth);
  }, [sourceBoxes, isPhoneMode, readOnly, hostWidth]);

  const boxes = useMemo(() => {
    if (!isPhoneMode || hostWidth < 40) {
      return isPhoneMode && !readOnly ? phoneEditBoxes : sourceBoxes;
    }
    if (!readOnly) return phoneEditBoxes;
    return fitNestedPhoneBoxes(phoneEditBoxes, hostWidth, { fill: true, pad: 0 });
  }, [sourceBoxes, phoneEditBoxes, isPhoneMode, hostWidth, readOnly]);

  const commitSourceRef = useRef(sourceBoxes);
  commitSourceRef.current = isPhoneMode && !readOnly ? phoneEditBoxes : sourceBoxes;

  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;

  const seededPhoneKeyRef = useRef("");
  useLayoutEffect(() => {
    if (!isPhoneMode || readOnly || hostWidth < 40) return;
    const fitted = fitNestedLayoutForPhoneEdit(sourceBoxes, hostWidth);
    const seedKey = `${layoutPxFingerprint(sourceBoxes)}:${hostWidth}`;
    if (seededPhoneKeyRef.current === seedKey) return;
    if (layoutPxFingerprint(fitted) === layoutPxFingerprint(sourceBoxes)) return;
    seededPhoneKeyRef.current = seedKey;
    commitSourceRef.current = fitted;
    onLayoutChangeRef.current?.(fitted, { skipHistory: true });
  }, [isPhoneMode, readOnly, hostWidth, sourceBoxes]);

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

  const patchLiveBox = useCallback((id, patch) => {
    setLiveBoxes((prev) => {
      const map = new Map(prev || boxes.map((b) => [String(b.i), b]));
      const cur = map.get(String(id)) || boxes.find((b) => String(b.i) === String(id));
      if (!cur) return prev;
      map.set(String(id), normalizeBox({ ...cur, ...patch }));
      return map;
    });
  }, [boxes]);

  const clampPhoneBox = useCallback((box, frameW) => {
    if (!box || !isPhoneMode || frameW < 40) return box;
    const [clamped] = fitNestedLayoutPxToWidth([normalizeBox(box)], frameW, 0);
    return { ...box, ...clamped };
  }, [isPhoneMode]);

  const commitBox = useCallback((id, viewPatch) => {
    const patch = fromView(viewPatch);
    const frameW = hostWidth >= 40 ? hostWidth : 0;
    let next = sanitizeNestedLayoutPx(
      commitSourceRef.current.map((box) => {
        if (String(box.i) !== String(id)) return box;
        return boxWithId(id, {
          ...box,
          left: patch.left != null ? Math.max(0, Number(patch.left)) : box.left,
          top: patch.top != null ? Math.max(0, Number(patch.top)) : box.top,
          width: patch.width != null ? Math.max(40, Number(patch.width)) : box.width,
          height: patch.height != null ? Math.max(32, Number(patch.height)) : box.height,
        });
      }).filter(Boolean),
    );
    const edited = next.find((box) => String(box.i) === String(id));
    if (edited && frameW && isPhoneMode) {
      const clamped = clampPhoneBox(edited, frameW);
      next = next.map((box) => (
        String(box.i) === String(id) ? { i: String(id), ...normalizeBox(clamped) } : box
      ));
    }
    commitSourceRef.current = next;
    setLiveBoxes(null);
    setDragCanvasPad(0);
    onLayoutChangeRef.current?.(next, {});
  }, [clampPhoneBox, fromView, hostWidth, isPhoneMode]);

  const phoneBuilderExpand = isPhoneMode && !readOnly;
  const clipNestedToContainer = !phoneBuilderExpand;
  const contentHeight = Math.max(
    containerContentHeightPx(boxes, 8),
    readOnly ? 0 : 280,
  );
  const designHeight = phoneBuilderExpand
    ? contentHeight + PHONE_NESTED_BOTTOM_ROOM + dragCanvasPad
    : undefined;
  const canvasHeight = designHeight == null ? undefined : Math.ceil(designHeight * scale);

  const hostStyle = phoneBuilderExpand
    ? {
      height: canvasHeight,
      minHeight: canvasHeight,
      overflow: "visible",
      maxWidth: "100%",
    }
    : {
      width: "100%",
      height: "100%",
      maxWidth: "100%",
      maxHeight: "100%",
      overflow: "hidden",
      minHeight: 0,
      boxSizing: "border-box",
    };

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
      ref={hostRef}
      className={`relative w-full min-w-0 ${clipNestedToContainer ? "h-full min-h-0 max-h-full flex-1" : ""}`}
      style={hostStyle}
      onMouseDown={(e) => {
        if (e.target.closest("button, .simple-no-drag, .simple-widget-toolbar")) return;
        if (e.target.closest(".simple-rnd")) {
          const id = e.target.closest(".simple-rnd")?.querySelector?.("[data-widget-id]")?.getAttribute("data-widget-id");
          if (id) {
            e.stopPropagation();
            onSelectWidget?.(id);
          }
          return;
        }
        if (onContainerShellPointerDown) {
          onContainerShellPointerDown(e);
          return;
        }
        onCanvasBackgroundClick?.();
      }}
      onPointerDownCapture={(e) => {
        if (readOnly) return;
        if (e.target.closest("button, .simple-no-drag, .simple-widget-toolbar")) return;
        const nested = e.target.closest(".simple-rnd");
        if (!nested) return;
        const id = nested.querySelector?.("[data-widget-id]")?.getAttribute("data-widget-id");
        if (id) onSelectWidget?.(id);
      }}
    >
      {childWidgets.map((child) => {
        const box = getBox(child.id) || normalizeBox(readWidgetBoxPx(child, 0));
        const viewBox = toView(box);
        const isSelected = !readOnly && String(selectedWidgetId) === String(child.id);
        const mins = defaultBoxForType(child.rawType || child.type);

        if (readOnly) {
          const clickable = widgetHasClickLink(child);
          const nestedShell = parityWidgetBodyShellStyle(child.style || {}, { nested: true, publish: readOnly });
          const shellRadius = nestedShell.borderRadius || "6px";
          return (
            <div
              key={String(child.id)}
              role={clickable ? "link" : undefined}
              tabIndex={clickable ? 0 : undefined}
              style={{
                ...boxToInlineStyle(viewBox),
                width: viewBox.width,
                height: viewBox.height,
                overflow: "hidden",
                margin: 0,
                padding: 0,
                boxSizing: "border-box",
                borderRadius: shellRadius,
                backgroundColor: nestedShell.backgroundColor,
                border: "none",
                boxShadow: "none",
                isolation: "isolate",
                cursor: clickable ? "pointer" : undefined,
              }}
              onClick={(e) => {
                if (!clickable) return;
                if (shouldIgnoreWidgetLinkClick(e)) return;
                e.stopPropagation();
                navigateWidgetClickUrl(getWidgetClickUrl(child), router);
              }}
              onKeyDown={(e) => {
                if (!clickable) return;
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                navigateWidgetClickUrl(getWidgetClickUrl(child), router);
              }}
            >
              <div
                className="h-full w-full min-h-0 min-w-0 rounded-[inherit] overflow-hidden"
                style={{
                  borderRadius: "inherit",
                  backgroundColor: "transparent",
                  border: "none",
                  boxShadow: "none",
                  padding: nestedShell.padding,
                }}
              >
                <WidgetRenderer widget={child} readOnly nested designParity pureSavedStyle suppressChrome isPhoneMode={isPhoneMode} />
              </div>
            </div>
          );
        }

        const nestedShell = parityWidgetBodyShellStyle(child.style || {}, { nested: true, publish: readOnly });
        return (
          <Rnd
            key={String(child.id)}
            className="simple-rnd simple-nested-child-rnd"
            scale={rndScale}
            size={{ width: viewBox.width, height: viewBox.height }}
            position={{ x: viewBox.left, y: viewBox.top }}
            minWidth={Math.max(40, mins.width * 0.5 * scale)}
            minHeight={Math.max(32, mins.height * 0.5 * scale)}
            enableResizing={HANDLE_STYLES}
            resizeHandleStyles={resizeHandleStylesForSelection(isSelected)}
            cancel={CANCEL_SELECTOR}
            bounds="parent"
            style={{
              ...selectionStyle(isSelected, false),
              zIndex: isSelected ? 30 : 10,
              overflow: "hidden",
              margin: 0,
              padding: 0,
              boxSizing: "border-box",
              backgroundColor: "transparent",
              border: "none",
              boxShadow: "none",
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onSelectWidget?.(child.id);
            }}
            onDragStart={() => onSelectWidget?.(child.id)}
            onDrag={(_e, d) => {
              patchLiveBox(child.id, fromView({
                left: d.x,
                top: d.y,
                width: viewBox.width,
                height: viewBox.height,
              }));
              if (phoneBuilderExpand) {
                const bottom = d.y + (Number(d.node?.offsetHeight) || viewBox.height);
                const baseH = canvasHeight || contentHeight;
                const needPad = Math.max(0, bottom + 80 - (baseH - dragCanvasPad));
                if (needPad > dragCanvasPad + 16) setDragCanvasPad(needPad);
              }
            }}
            onDragStop={(_e, d) => {
              commitBox(child.id, { left: Math.max(0, d.x), top: Math.max(0, d.y) });
            }}
            onResizeStart={() => onSelectWidget?.(child.id)}
            onResize={(_e, _dir, ref, _delta, pos) => {
              let design = fromView({
                left: pos.x,
                top: pos.y,
                width: ref.offsetWidth,
                height: ref.offsetHeight,
              });
              if (isPhoneMode && hostWidth >= 40) {
                design = clampPhoneBox(design, hostWidth);
              }
              patchLiveBox(child.id, design);
              if (phoneBuilderExpand) {
                const bottom = pos.y + ref.offsetHeight;
                const baseH = canvasHeight || contentHeight;
                const needPad = Math.max(0, bottom + 80 - (baseH - dragCanvasPad));
                if (needPad > dragCanvasPad + 16) setDragCanvasPad(needPad);
              }
            }}
            onResizeStop={(_e, _dir, ref, _delta, pos) => {
              commitBox(child.id, {
                left: Math.max(0, pos.x),
                top: Math.max(0, pos.y),
                width: ref.offsetWidth,
                height: ref.offsetHeight,
              });
            }}
          >
            {isSelected ? (
              <SimpleWidgetToolbar
                onEdit={(e) => { e.stopPropagation(); onSelectWidget?.(child.id); }}
                onClone={(e) => { e.stopPropagation(); onCloneChildWidget?.(containerId, child); }}
                onDelete={(e) => { e.stopPropagation(); onDeleteWidget?.(child); }}
              />
            ) : null}
            <div
              data-widget-id={String(child.id)}
              className="h-full w-full min-h-0 min-w-0 overflow-hidden rounded-[inherit]"
              style={nestedShell}
            >
              <WidgetRenderer widget={child} readOnly={false} nested designParity={false} pureSavedStyle suppressChrome isPhoneMode={isPhoneMode} />
            </div>
          </Rnd>
        );
      })}
    </div>
  );
}
