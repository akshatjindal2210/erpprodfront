"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Rnd } from "react-rnd";
import WidgetRenderer from "./WidgetRenderer";
import { DRAG_HANDLE_CLASS, HANDLE_STYLES, resizeHandleStylesForSelection, selectionStyle, builderWidgetTypeLabel, parityWidgetBodyShellStyle, SimpleWidgetToolbar } from "./simpleBuilderChrome";
import { boxWithId, contentBoundsPx, defaultTopLevelBoxForType, fitNestedLayoutPxToWidth, layoutPxFingerprint, normalizeBox, PHONE_CONTENT_WIDTH, PHONE_FRAME_INSET, LAPTOP_DESIGN_CANVAS_WIDTH, LAPTOP_CANVAS_INSET, placeNextBoxPx, clampLayoutPxToLaptopFrame, phoneContentBoxesFromFrame, readWidgetBoxPx, resolveTopLevelBoxes, sanitizeNestedLayoutPx, scaleLayoutPx, shiftLayoutPxToTop } from "../utils/floatingLayoutEngine";
import { DASHBOARD_CANVAS_BG, DASHBOARD_CANVAS_GRID_DOT } from "../utils/dashboardBuilderTheme";
import { getWidgetClickUrl, navigateWidgetClickUrl, resolveWidgetDrawerOpenPayload, shouldIgnoreWidgetLinkClick, widgetHasClickLink, widgetOpensDrawer } from "../utils/widgetClickLink";

const CANCEL_SELECTOR = `.simple-no-drag, button, a, input, textarea, select, .simple-nested-canvas .simple-rnd`;
const BOTTOM_ROOM_PX = 320;
const MIN_BUILDER_HEIGHT = 560;
const EDGE_SCROLL_PX = 72;
const EDGE_SCROLL_SPEED = 28;

function contentSizeOf(boxes = []) {
  const maxRight = boxes.reduce((max, box) => Math.max(max, box.left + box.width), 0);
  const maxBottom = boxes.reduce((max, box) => Math.max(max, box.top + box.height), 0);
  return {
    width: Math.max(1, maxRight),
    height: Math.max(1, maxBottom),
  };
}

export default function SimpleBuilderCanvas({
  widgets = [],
  layoutPx = [],
  readOnly = false,
  selectedWidgetId = null,
  onLayoutChange,
  onSelectWidget,
  onDeleteWidget,
  onCloneWidget,
  onNestedLayoutChange,
  onAddChildWidget,
  onCloneChildWidget,
  canvasWidth = 1200,
  hostViewportWidth = 0,
  phoneMode = false,
  onOpenWidgetDrawer,
}) {
  const router = useRouter();
  const topLevel = useMemo(() => {
    return (widgets || []).filter((w) => !w.containerId && !w.sectionId);
  }, [widgets]);

  const measureRef = useRef(null);
  const [parentWidth, setParentWidth] = useState(0);
  const [hostHeight, setHostHeight] = useState(0);
  const [dragCanvasPad, setDragCanvasPad] = useState(0);
  const [liveBoxes, setLiveBoxes] = useState(null);

  const phoneFitWidth = useMemo(() => {
    const frameW = Number(canvasWidth) >= 200 ? Number(canvasWidth) : PHONE_CONTENT_WIDTH;
    return parentWidth >= 200 ? parentWidth : frameW;
  }, [canvasWidth, parentWidth]);

  const designW = Number(canvasWidth) >= 200 ? Math.floor(Number(canvasWidth)) : LAPTOP_DESIGN_CANVAS_WIDTH;
  const isLaptopFixedFrame = !phoneMode;

  const sourceBoxes = useMemo(
    () => {
      if (phoneMode) {
        const fromParent = sanitizeNestedLayoutPx(layoutPx);
        if (fromParent.length) return fromParent;
        return resolveTopLevelBoxes(topLevel, layoutPx, { maxWidth: phoneFitWidth, phoneMode: true });
      }
      return resolveTopLevelBoxes(topLevel, layoutPx, { maxWidth: designW });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topLevel, layoutPxFingerprint(layoutPx), phoneMode, phoneFitWidth, designW],
  );
  const sourceBoxesRef = useRef(sourceBoxes);
  sourceBoxesRef.current = sourceBoxes;

  const isDesignWidthLeak = useCallback((w) => (
    isLaptopFixedFrame && w >= 200 && Math.abs(w - designW) <= 16
  ), [isLaptopFixedFrame, designW]);

  const readShellViewportWidth = useCallback(() => {
    if (typeof window === "undefined") return 0;
    const vvW = Math.floor(window.visualViewport?.width || 0);
    const layoutW = vvW >= 200 ? vvW : Math.floor(window.innerWidth);
    if (phoneMode || layoutW < 768) {
      return Math.max(320, layoutW);
    }
    const collapsed = localStorage.getItem("sidebarCollapsed") === "true";
    const sidebarW = collapsed ? 56 : 224;
    return Math.max(320, layoutW - sidebarW);
  }, [phoneMode]);

  const viewportW = useMemo(() => {
    const fromHost = Number(hostViewportWidth) >= 200 ? Math.floor(Number(hostViewportWidth)) : 0;
    const fromParent = parentWidth >= 200 ? parentWidth : 0;
    let domW = Math.max(fromHost, fromParent);
    if (isDesignWidthLeak(domW)) domW = 0;
    const shellW = readShellViewportWidth();
    if (isLaptopFixedFrame) {
      if (domW >= 200) return domW;
      return Math.max(shellW, 320);
    }
    if (domW >= 200) return domW;
    if (shellW >= 200) return shellW;
    return 320;
  }, [hostViewportWidth, parentWidth, isLaptopFixedFrame, isDesignWidthLeak, readShellViewportWidth]);

  const fitScale = useMemo(() => {
    if (phoneMode || designW < 200) return 1;
    const vw = Math.max(200, viewportW);
    const raw = (vw - 4) / designW;
    return Math.max(0.05, Math.min(3, Math.round(raw * 1000) / 1000));
  }, [phoneMode, designW, viewportW]);

  const boxes = useMemo(
    () => {
      if (phoneMode) {
        if (!readOnly) {
          const bounds = contentBoundsPx(sourceBoxes, 0);
          const span = Math.max(bounds.width, 40);
          if (span > phoneFitWidth + 32) {
            return scaleLayoutPx(sourceBoxes, span, phoneFitWidth);
          }
          return sourceBoxes;
        }
        return phoneContentBoxesFromFrame(sourceBoxes, phoneFitWidth, { fill: true });
      }
      return sourceBoxes;
    },
    [sourceBoxes, phoneMode, phoneFitWidth, readOnly],
  );
  const displayBoxes = useMemo(() => {
    if (!phoneMode || !readOnly || !boxes.length) return boxes;
    return shiftLayoutPxToTop(boxes, PHONE_FRAME_INSET);
  }, [boxes, phoneMode, readOnly]);
  const boxesRef = useRef(displayBoxes);
  boxesRef.current = displayBoxes;
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;
  const boxesFp = useMemo(() => layoutPxFingerprint(boxes), [boxes]);

  useEffect(() => {
    setLiveBoxes(null);
  }, [boxesFp]);

  const measureParent = useCallback(() => {
    const node = measureRef.current;
    if (!node) return;
    const fromProp = Number(canvasWidth) >= 200 ? Math.floor(Number(canvasWidth)) : 0;
    const canvasHost = node.closest("[data-dashboard-canvas-host]");
    const host = phoneMode
      ? (node.closest("[data-dashboard-phone-frame]") || node)
      : (canvasHost || node.closest("[data-dashboard-laptop-frame]") || node);
    const hostW = Math.max(0, Math.floor(host.clientWidth || 0));
    const hostRectW = Math.max(0, Math.floor(host.getBoundingClientRect?.().width || 0));
    const selfW = Math.max(0, Math.floor(node.getBoundingClientRect?.().width || node.clientWidth || 0));
    const hostH = Math.floor(
      host.getBoundingClientRect?.().height
      || host.clientHeight
      || 0,
    );
    if (hostH >= 120) {
      setHostHeight((prev) => (Math.abs(prev - hostH) <= 1 ? prev : hostH));
    }
    let resolved = 0;
    if (phoneMode) {
      const w = Math.max(hostW, hostRectW, selfW);
      resolved = w >= 200 ? w : (fromProp >= 200 ? fromProp : PHONE_CONTENT_WIDTH);
    } else if (isLaptopFixedFrame) {
      const pick = (w) => (w >= 200 && !isDesignWidthLeak(w) ? w : 0);
      resolved = Math.max(pick(selfW), pick(hostRectW), pick(hostW));
      if (!resolved) {
        const shellW = readShellViewportWidth();
        if (shellW >= 200) resolved = shellW;
      }
    } else {
      const w = Math.max(hostW, hostRectW, selfW);
      if (w >= 200) resolved = w;
      else if (fromProp >= 200) resolved = fromProp;
    }
    if (resolved >= 200) {
      setParentWidth((prev) => (Math.abs(prev - resolved) <= 1 ? prev : resolved));
    }
  }, [canvasWidth, phoneMode, isLaptopFixedFrame, isDesignWidthLeak, readShellViewportWidth]);

  useLayoutEffect(() => {
    measureParent();
  }, [measureParent, topLevel.length, boxesFp, phoneMode, designW]);

  useEffect(() => {
    const node = measureRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const host = phoneMode
      ? (node.closest("[data-dashboard-phone-frame]") || node)
      : (node.closest("[data-dashboard-canvas-host]") || node.closest("[data-dashboard-laptop-frame]") || node);
    const ro = new ResizeObserver(() => window.requestAnimationFrame(measureParent));
    ro.observe(node);
    ro.observe(host);
    if (!phoneMode) {
      const laptopFrame = node.closest("[data-dashboard-laptop-frame]");
      if (laptopFrame && laptopFrame !== host) ro.observe(laptopFrame);
    }
    if (phoneMode) {
      const frame = node.closest("[data-dashboard-phone-frame]");
      if (frame && frame !== host) ro.observe(frame);
    }
    window.addEventListener("resize", measureParent);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measureParent);
    vv?.addEventListener("scroll", measureParent);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureParent);
      vv?.removeEventListener("resize", measureParent);
      vv?.removeEventListener("scroll", measureParent);
    };
  }, [measureParent, phoneMode]);

  useEffect(() => {
    if (!selectedWidgetId || readOnly) return undefined;
    const timer = window.requestAnimationFrame(() => {
      const host = measureRef.current?.querySelector(
        `[data-widget-id="${String(selectedWidgetId)}"]`,
      )?.closest(".simple-rnd");
      const scroller = host?.closest(".overflow-y-auto, .overflow-auto");
      if (!host || !scroller) return;
      const hostRect = host.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      if (hostRect.top < scrollerRect.top || hostRect.bottom > scrollerRect.bottom) {
        host.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
    });
    return () => window.cancelAnimationFrame(timer);
  }, [selectedWidgetId, readOnly, topLevel.length]);

  const designSize = useMemo(() => contentSizeOf(displayBoxes), [displayBoxes]);

  const designHeight = useMemo(() => {
    const contentH = designSize.height;
    if (readOnly && isLaptopFixedFrame) {
      return contentH;
    }
    if (readOnly) return contentH;
    if (phoneMode) {
      return Math.max(contentH + 80, 520);
    }
    return Math.max(MIN_BUILDER_HEIGHT, contentH + BOTTOM_ROOM_PX + dragCanvasPad);
  }, [readOnly, designSize.height, dragCanvasPad, phoneMode, isLaptopFixedFrame]);

  const scaledHeight = isLaptopFixedFrame
    ? Math.ceil(designHeight * fitScale)
    : designHeight;
  const scaledWidth = isLaptopFixedFrame
    ? Math.ceil(designW * fitScale)
    : null;
  const canvasInnerWidth = isLaptopFixedFrame ? designW : "100%";
  const laptopScaled = isLaptopFixedFrame && fitScale > 0;

  const canvasInset = isLaptopFixedFrame ? LAPTOP_CANVAS_INSET : 0;
  const contentW = isLaptopFixedFrame ? Math.max(80, designW - canvasInset * 2) : designW;
  const contentH = isLaptopFixedFrame
    ? Math.max(120, designHeight - canvasInset * 2)
    : designHeight;

  const getBox = useCallback((id) => {
    const key = String(id);
    if (liveBoxes?.has(key)) return liveBoxes.get(key);
    return displayBoxes.find((b) => String(b.i) === key) || null;
  }, [displayBoxes, liveBoxes]);

  const patchLiveBox = useCallback((id, patch) => {
    setLiveBoxes((prev) => {
      const map = new Map(prev || boxes.map((b) => [String(b.i), b]));
      const cur = map.get(String(id)) || boxes.find((b) => String(b.i) === String(id));
      if (!cur) return prev;
      map.set(String(id), normalizeBox({ ...cur, ...patch }));
      return map;
    });
  }, [boxes]);

  const getFrameWidth = useCallback(() => {
    if (isLaptopFixedFrame) return designW;
    if (parentWidth >= 200) return parentWidth;
    const fromProp = Number(canvasWidth);
    return fromProp >= 200 ? fromProp : PHONE_CONTENT_WIDTH;
  }, [isLaptopFixedFrame, designW, parentWidth, canvasWidth]);

  const clampBoxInFrame = useCallback((box, frameW) => {
    if (!box) return box;
    if (phoneMode) {
      const [clamped] = fitNestedLayoutPxToWidth([normalizeBox(box)], frameW, PHONE_FRAME_INSET);
      return { ...box, ...clamped };
    }
    const [clamped] = clampLayoutPxToLaptopFrame([normalizeBox(box)], frameW, LAPTOP_CANVAS_INSET);
    return { ...box, ...clamped };
  }, [phoneMode]);

  const commitCanvasBox = useCallback((id, patch) => {
    const frameW = getFrameWidth();
    const minEdge = phoneMode ? PHONE_FRAME_INSET : LAPTOP_CANVAS_INSET;
    let next = sanitizeNestedLayoutPx(
      sourceBoxesRef.current.map((box) => {
        if (String(box.i) !== String(id)) return box;
        return boxWithId(id, {
          ...box,
          left: patch.left != null ? Math.max(minEdge, Number(patch.left)) : box.left,
          top: patch.top != null ? Math.max(minEdge, Number(patch.top)) : box.top,
          width: patch.width != null ? Math.max(40, Number(patch.width)) : box.width,
          height: patch.height != null ? Math.max(32, Number(patch.height)) : box.height,
        });
      }).filter(Boolean),
    );
    const edited = next.find((box) => String(box.i) === String(id));
    if (edited) {
      const clamped = clampBoxInFrame(edited, frameW);
      next = next.map((box) => (
        String(box.i) === String(id) ? { i: String(id), ...normalizeBox(clamped) } : box
      ));
    }
    sourceBoxesRef.current = next;
    boxesRef.current = next;
    setLiveBoxes(null);
    setDragCanvasPad(0);
    onLayoutChangeRef.current?.(next, {});
  }, [clampBoxInFrame, getFrameWidth, phoneMode]);

  const sendWidgetToBottom = useCallback((id) => {
    const frameW = getFrameWidth();
    const others = sourceBoxesRef.current.filter((box) => String(box.i) !== String(id));
    const maxBottom = others.reduce((max, box) => Math.max(max, box.top + box.height), 0);
    const current = sourceBoxesRef.current.find((box) => String(box.i) === String(id));
    let next = sanitizeNestedLayoutPx(
      sourceBoxesRef.current.map((box) => {
        if (String(box.i) !== String(id)) return box;
        return boxWithId(id, {
          ...box,
          left: phoneMode ? PHONE_FRAME_INSET : LAPTOP_CANVAS_INSET,
          top: maxBottom + 24,
          width: current?.width ?? box.width,
          height: current?.height ?? box.height,
        });
      }).filter(Boolean),
    );
    const edited = next.find((box) => String(box.i) === String(id));
    if (edited) {
      const clamped = clampBoxInFrame(edited, frameW);
      next = next.map((box) => (
        String(box.i) === String(id) ? { i: String(id), ...normalizeBox(clamped) } : box
      ));
    }
    sourceBoxesRef.current = next;
    boxesRef.current = next;
    setLiveBoxes(null);
    setDragCanvasPad(0);
    onLayoutChangeRef.current?.(next, {});
  }, [clampBoxInFrame, getFrameWidth, phoneMode]);

  const getScroller = useCallback(() => {
    if (!measureRef.current) return null;
    return measureRef.current.closest(".overflow-auto, .overflow-y-auto, .overflow-x-auto");
  }, []);

  const autoScrollWhileDragging = useCallback((clientX, clientY) => {
    const scroller = getScroller();
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    if (clientY > rect.bottom - EDGE_SCROLL_PX) scroller.scrollTop += EDGE_SCROLL_SPEED;
    else if (clientY < rect.top + EDGE_SCROLL_PX) scroller.scrollTop = Math.max(0, scroller.scrollTop - EDGE_SCROLL_SPEED);
  }, [getScroller]);

  if (!topLevel.length) {
    return (
      <div
        ref={measureRef}
        className="flex min-h-[320px] w-full items-center justify-center bg-[#f8fafc] px-4 py-8"
      >
        <div className="flex min-h-[280px] w-full max-w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Add a widget to start building
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={measureRef}
      className="relative w-full min-w-0 max-w-full overflow-x-hidden"
      style={{
        backgroundColor: DASHBOARD_CANVAS_BG,
        height: scaledHeight,
        minHeight: isLaptopFixedFrame && !readOnly ? Math.max(scaledHeight, 420) : scaledHeight,
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <div
        className="relative w-full min-w-0 max-w-full overflow-hidden"
        style={{ width: "100%", maxWidth: "100%", height: scaledHeight }}
      >
        <div
          className="absolute left-0 top-0 overflow-hidden"
          style={
            laptopScaled
              ? { width: scaledWidth, height: scaledHeight, maxWidth: "100%" }
              : { width: "100%", height: scaledHeight }
          }
        >
        <div
          className="absolute left-0 top-0"
          data-dashboard-design-canvas
          style={{
            width: canvasInnerWidth,
            height: designHeight,
            transform: laptopScaled ? `scale(${fitScale})` : undefined,
            transformOrigin: laptopScaled ? "top left" : undefined,
            overflow: laptopScaled ? "visible" : "hidden",
            backgroundColor: DASHBOARD_CANVAS_BG,
            backgroundImage: readOnly
              ? undefined
              : `radial-gradient(${DASHBOARD_CANVAS_GRID_DOT} 1px, transparent 1px)`,
            backgroundSize: readOnly ? undefined : "22px 22px",
          }}
        onMouseDownCapture={(e) => {
          if (readOnly) return;
          if (e.target?.closest?.("[data-simple-toolbar], .simple-widget-toolbar, .simple-no-drag, button")) {
            return;
          }
          const nestedHost = e.target?.closest?.(".simple-nested-canvas .simple-rnd [data-widget-id]")
            || e.target?.closest?.(".simple-nested-canvas .simple-rnd")?.querySelector?.("[data-widget-id]");
          if (nestedHost) {
            const nestedId = nestedHost.getAttribute("data-widget-id");
            if (nestedId) onSelectWidget?.(nestedId);
            return;
          }
          const host = e.target?.closest?.("[data-widget-id]")
            || e.target?.closest?.(".simple-rnd")?.querySelector?.("[data-widget-id]");
          if (host) {
            const id = host.getAttribute("data-widget-id");
            if (id) onSelectWidget?.(id);
            return;
          }
          if (e.target === e.currentTarget || !e.target?.closest?.(".simple-rnd")) {
            onSelectWidget?.(null);
          }
        }}
      >
        {!readOnly && !phoneMode && (
          <div
            className="pointer-events-none absolute left-3 right-3 border-t border-dashed border-slate-300/80"
            style={{ top: Math.max(canvasInset, designHeight - BOTTOM_ROOM_PX + 40) }}
          >
            <span className="absolute -top-5 left-0 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
              Drop widgets below here
            </span>
          </div>
        )}

        {!readOnly && isLaptopFixedFrame ? (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-sm border border-dashed border-slate-200/50"
            style={{
              left: canvasInset,
              top: canvasInset,
              width: contentW,
              height: contentH,
            }}
          />
        ) : null}

        <div
          className="absolute"
          style={
            isLaptopFixedFrame
              ? { left: canvasInset, top: canvasInset, width: contentW, height: contentH }
              : { left: 0, top: 0, width: "100%", height: "100%" }
          }
          data-dashboard-content-zone="true"
        >
        {topLevel.map((widget, idx) => {
          const phoneFallbackBase = defaultTopLevelBoxForType(
            widget.rawType || widget.type,
            widget.containerPreset,
            phoneFitWidth,
          );
          const phoneFallback = normalizeBox(
            placeNextBoxPx(boxes.slice(0, idx), phoneFallbackBase, phoneFitWidth),
          );
          const box = getBox(widget.id)
            || (phoneMode ? phoneFallback : null)
            || normalizeBox(readWidgetBoxPx(widget, idx));
          const canvasBox = box;
          const isSelected = !readOnly && String(selectedWidgetId) === String(widget.id);
          const isContainer = widget.rawType === "container" || widget.rawType === "section";
          const shellCss = {
            backgroundColor: "transparent",
            border: "none",
            boxShadow: "none",
          };
          const bodyShellStyleBase = parityWidgetBodyShellStyle(widget.style || {}, { isContainer, publish: readOnly });
          const shellRadius = Number.isFinite(Number(widget.style?.borderRadius))
            ? `${Number(widget.style.borderRadius)}px`
            : (isContainer ? "8px" : "6px");
          const bodyShellStyle = readOnly
            ? {
              borderRadius: "inherit",
              backgroundColor: "transparent",
              border: "none",
              boxShadow: "none",
              padding: bodyShellStyleBase.padding,
            }
            : {
              ...bodyShellStyleBase,
              borderRadius: shellRadius,
            };
          const rndClipStyle = readOnly
            ? {
              backgroundColor: bodyShellStyleBase.backgroundColor,
              borderRadius: shellRadius,
              border: "none",
              boxShadow: "none",
            }
            : shellCss;
          const stackZ = isSelected ? 40 : (10 + idx);

          const rndX = isLaptopFixedFrame
            ? canvasBox.left - canvasInset
            : canvasBox.left;
          const rndY = isLaptopFixedFrame
            ? canvasBox.top - canvasInset
            : canvasBox.top;

          const clickable = readOnly && widgetHasClickLink(widget);
          const handleWidgetActivate = () => {
            if (!clickable) return;
            if (widgetOpensDrawer(widget)) {
              const payload = resolveWidgetDrawerOpenPayload(widget);
              if (payload) onOpenWidgetDrawer?.(payload);
              return;
            }
            navigateWidgetClickUrl(getWidgetClickUrl(widget), router);
          };
          const widgetBody = (
            <div
              data-widget-id={String(widget.id)}
              className={`simple-widget-body relative min-h-0 min-w-0 max-h-full h-full flex-1 ${readOnly ? "" : "rounded-md"} ${isContainer ? "simple-nested-canvas flex flex-col overflow-hidden" : "overflow-hidden"}${!readOnly && isContainer ? " border-2 border-dashed border-slate-300" : ""}`}
              style={bodyShellStyle}
            >
              {!readOnly ? (
                <div
                  className={`pointer-events-none absolute right-2 top-2 z-[55] rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                    isContainer
                      ? "bg-violet-600/90 text-white"
                      : "bg-slate-700/85 text-white"
                  }`}
                >
                  {builderWidgetTypeLabel(widget, isContainer)}
                </div>
              ) : null}
              <WidgetRenderer
                widget={widget}
                readOnly={readOnly}
                designParity
                nested={false}
                isPhoneMode={phoneMode}
                selectedWidgetId={readOnly ? null : selectedWidgetId}
                onNestedLayoutChange={readOnly ? undefined : onNestedLayoutChange}
                onSelectWidget={readOnly ? undefined : onSelectWidget}
                onDeleteWidget={readOnly ? undefined : onDeleteWidget}
                onAddChildWidget={readOnly ? undefined : onAddChildWidget}
                onCloneChildWidget={readOnly ? undefined : onCloneChildWidget}
                onCloneWidget={readOnly ? undefined : onCloneWidget}
                onOpenWidgetDrawer={readOnly ? onOpenWidgetDrawer : undefined}
                pureSavedStyle
                suppressChrome
                canvasScale={1}
                dragScale={readOnly ? 1 : fitScale}
              />
            </div>
          );

          if (readOnly) {
            return (
              <Rnd
                key={String(widget.id)}
                className={`simple-rnd simple-rnd-readonly${isContainer ? " simple-container-rnd" : ""}`}
                disableDragging
                enableResizing={false}
                scale={laptopScaled ? fitScale : 1}
                position={{ x: rndX, y: rndY }}
                size={{ width: canvasBox.width, height: canvasBox.height }}
                bounds="parent"
                role={clickable ? "link" : undefined}
                tabIndex={clickable ? 0 : undefined}
                style={{
                  ...rndClipStyle,
                  zIndex: stackZ,
                  overflow: "hidden",
                  borderRadius: shellRadius,
                  isolation: "isolate",
                  boxSizing: "border-box",
                  display: isContainer ? "flex" : undefined,
                  flexDirection: isContainer ? "column" : undefined,
                  cursor: clickable ? "pointer" : undefined,
                }}
                onClick={(e) => {
                  if (!clickable) return;
                  if (shouldIgnoreWidgetLinkClick(e)) return;
                  e.stopPropagation();
                  handleWidgetActivate();
                }}
                onKeyDown={(e) => {
                  if (!clickable) return;
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  handleWidgetActivate();
                }}
              >
                {widgetBody}
              </Rnd>
            );
          }

          return (
            <Rnd
              key={String(widget.id)}
              className={`simple-rnd group${isContainer ? " simple-container-rnd" : ""}${isSelected ? " simple-rnd-selected" : ""}`}
              scale={laptopScaled ? fitScale : 1}
              position={{ x: rndX, y: rndY }}
              size={{ width: canvasBox.width, height: canvasBox.height }}
              minWidth={isContainer ? 160 : 80}
              minHeight={isContainer ? 80 : 48}
              enableResizing={HANDLE_STYLES}
              resizeHandleStyles={resizeHandleStylesForSelection(isSelected)}
              dragHandleClassName={isContainer ? DRAG_HANDLE_CLASS : undefined}
              cancel={CANCEL_SELECTOR}
              bounds="parent"
              onMouseDown={(e) => {
                if (e.target?.closest?.("[data-simple-toolbar], .simple-no-drag, button, a, input, textarea, select")) return;
                onSelectWidget?.(widget.id);
              }}
              style={{
                ...shellCss,
                ...selectionStyle(isSelected, isContainer),
                zIndex: stackZ,
                overflow: "hidden",
                boxSizing: "border-box",
                maxWidth: isContainer ? "100%" : undefined,
                maxHeight: isContainer ? "100%" : undefined,
                minHeight: isContainer ? 0 : undefined,
                display: isContainer ? "flex" : undefined,
                flexDirection: isContainer ? "column" : undefined,
              }}
              onDragStart={() => onSelectWidget?.(widget.id)}
              onDrag={(e, d) => {
                patchLiveBox(widget.id, {
                  left: d.x + canvasInset,
                  top: d.y + canvasInset,
                });
                const bottom = d.y + canvasInset + (Number(d.node?.offsetHeight) || canvasBox.height);
                const needPad = Math.max(0, bottom + 400 - (designHeight - dragCanvasPad));
                if (needPad > dragCanvasPad + 20) setDragCanvasPad(needPad);
                autoScrollWhileDragging(e.clientX, e.clientY);
              }}
              onDragStop={(_e, d) => {
                commitCanvasBox(widget.id, {
                  left: d.x + canvasInset,
                  top: d.y + canvasInset,
                });
              }}
              onResizeStart={() => onSelectWidget?.(widget.id)}
              onResize={(_e, _dir, ref, _delta, pos) => {
                let patch = {
                  left: pos.x + canvasInset,
                  top: pos.y + canvasInset,
                  width: ref.offsetWidth,
                  height: ref.offsetHeight,
                };
                if (phoneMode) {
                  const [clamped] = fitNestedLayoutPxToWidth(
                    [normalizeBox(patch)],
                    getFrameWidth(),
                    PHONE_FRAME_INSET,
                  );
                  patch = { ...patch, ...clamped };
                }
                patchLiveBox(widget.id, patch);
                const bottom = pos.y + canvasInset + ref.offsetHeight;
                const needPad = Math.max(0, bottom + 400 - (designHeight - dragCanvasPad));
                if (needPad > dragCanvasPad + 20) setDragCanvasPad(needPad);
              }}
              onResizeStop={(_e, _dir, ref, _delta, pos) => {
                commitCanvasBox(widget.id, {
                  left: pos.x + canvasInset,
                  top: pos.y + canvasInset,
                  width: ref.offsetWidth,
                  height: ref.offsetHeight,
                });
              }}
            >
              {(isSelected || isContainer) ? (
                <div
                  className={
                    isContainer && !isSelected
                      ? "pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
                      : undefined
                  }
                >
                  <SimpleWidgetToolbar
                    onEdit={(e) => { e.stopPropagation(); onSelectWidget?.(widget.id); }}
                    onClone={(e) => { e.stopPropagation(); onCloneWidget?.(widget); }}
                    onDelete={(e) => { e.stopPropagation(); onDeleteWidget?.(widget); }}
                    onSendToBottom={isContainer ? undefined : ((e) => { e.stopPropagation(); sendWidgetToBottom(widget.id); })}
                  />
                </div>
              ) : null}
              {widgetBody}
              {isSelected ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-[60] rounded-md shadow-[inset_0_0_0_2px_#3b82f6]"
                />
              ) : null}
            </Rnd>
          );
        })}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
