"use client";

/**
 * Full-bleed canvas (builder + live).
 * Design coordinates stay as-is; a CSS scale fits them to 100% parent width.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Rnd } from "react-rnd";
import WidgetRenderer from "./WidgetRenderer";
import {
  HANDLE_STYLES,
  resizeHandleStylesForSelection,
  selectionStyle,
  SimpleWidgetToolbar,
} from "./simpleBuilderChrome";
import {
  boxToInlineStyle,
  boxWithId,
  layoutPxFingerprint,
  normalizeBox,
  readWidgetBoxPx,
  resolveTopLevelBoxes,
  savedStyleToCss,
  sanitizeNestedLayoutPx,
} from "../utils/floatingLayoutEngine";
import { getWidgetClickUrl, navigateWidgetClickUrl, shouldIgnoreWidgetLinkClick, widgetHasClickLink } from "../utils/widgetClickLink";

const CANCEL_SELECTOR = ".simple-no-drag, button, a, input, textarea, select, .simple-nested-canvas";
/** Extra room below content for dropping widgets in the builder (keep modest to avoid endless vertical scroll). */
const BOTTOM_ROOM_PX = 320;
const MIN_BUILDER_HEIGHT = 560;
const EDGE_SCROLL_PX = 72;
const EDGE_SCROLL_SPEED = 28;

function contentOriginOf(boxes = []) {
  if (!boxes.length) return { x: 0, y: 0 };
  const minLeft = boxes.reduce((min, box) => Math.min(min, box.left), Infinity);
  const minTop = boxes.reduce((min, box) => Math.min(min, box.top), Infinity);
  return {
    x: Number.isFinite(minLeft) ? Math.max(0, minLeft) : 0,
    y: Number.isFinite(minTop) ? Math.max(0, minTop) : 0,
  };
}

function contentSizeOf(boxes = [], origin = { x: 0, y: 0 }) {
  const maxRight = boxes.reduce((max, box) => Math.max(max, box.left + box.width), 0);
  const maxBottom = boxes.reduce((max, box) => Math.max(max, box.top + box.height), 0);
  return {
    width: Math.max(1, maxRight - origin.x),
    height: Math.max(1, maxBottom - origin.y),
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
  onNestedGridWidthDiscover,
  isDropTargetIds = new Set(),
  isContainerResizingId = null,
  canvasWidth = 1200,
  phoneMode = false,
}) {
  const router = useRouter();
  const topLevel = useMemo(() => {
    // Keep saved order so builder + publish paint the same way (no container re-sort).
    return (widgets || []).filter((w) => !w.containerId && !w.sectionId);
  }, [widgets]);

  const boxes = useMemo(
    () => resolveTopLevelBoxes(topLevel, layoutPx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topLevel, layoutPxFingerprint(layoutPx)],
  );
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;

  const measureRef = useRef(null);
  const [parentWidth, setParentWidth] = useState(0);
  const [dragCanvasPad, setDragCanvasPad] = useState(0);
  const boxesFp = useMemo(() => layoutPxFingerprint(boxes), [boxes]);

  const measureParent = useCallback(() => {
    const node = measureRef.current;
    if (!node) return;
    // Phone builder lives inside a 390px frame — never measure the outer full-width host
    // (that was scaling widgets up 3x and making everything huge).
    const phoneFrame = node.closest("[data-dashboard-phone-frame]");
    const host = phoneFrame || node.closest("[data-dashboard-canvas-host]") || node;
    const w = Math.floor(
      host.clientWidth
      || host.getBoundingClientRect().width
      || node.clientWidth
      || 0,
    );
    const fromProp = Number(canvasWidth) >= 200 ? Math.floor(Number(canvasWidth)) : 0;
    let resolved = w >= 200 ? w : fromProp;
    if (phoneMode || phoneFrame) {
      // Lock to the phone frame / prop width — never expand to desktop host width.
      resolved = fromProp >= 200 ? fromProp : Math.min(w || 390, 390);
    } else if (w >= 200) {
      // Prefer the visible host width — never inflate past what is on screen
      // (inflating caused horizontal scroll / layout shake on Publish → live).
      resolved = w;
    } else if (fromProp >= 200) {
      resolved = fromProp;
    }
    if (resolved >= 200) {
      setParentWidth((prev) => (Math.abs(prev - resolved) <= 1 ? prev : resolved));
    }
  }, [canvasWidth, phoneMode]);

  useLayoutEffect(() => {
    measureParent();
  }, [measureParent, topLevel.length, readOnly, boxesFp, phoneMode]);

  useEffect(() => {
    const node = measureRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const phoneFrame = node.closest("[data-dashboard-phone-frame]");
    const host = phoneFrame || node.closest("[data-dashboard-canvas-host]") || node;
    const ro = new ResizeObserver(() => window.requestAnimationFrame(measureParent));
    ro.observe(host);
    window.addEventListener("resize", measureParent);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureParent);
    };
  }, [measureParent, phoneMode]);

  const origin = useMemo(() => contentOriginOf(boxes), [boxes]);
  const designSize = useMemo(() => contentSizeOf(boxes, origin), [boxes, origin]);

  // Builder: 1:1 + scroll when content is wider than the screen.
  // Publish/live: shrink-to-fit width so there is no giant empty horizontal scroll.
  const useScrollLayout = !readOnly && !phoneMode;

  const fitScale = useMemo(() => {
    if (parentWidth < 200 || designSize.width < 40) return 1;
    if (useScrollLayout) return 1;
    // Live: shrink only when content is wider than the host — never leave a blank right strip.
    if (designSize.width <= parentWidth) return 1;
    return parentWidth / designSize.width;
  }, [parentWidth, designSize.width, useScrollLayout]);

  const designHeight = useMemo(() => {
    if (readOnly) return designSize.height;
    if (phoneMode) {
      return Math.max(designSize.height + 80, 520);
    }
    return Math.max(MIN_BUILDER_HEIGHT, designSize.height + BOTTOM_ROOM_PX + dragCanvasPad);
  }, [readOnly, designSize.height, dragCanvasPad, phoneMode]);

  const scaledHeight = Math.ceil(designHeight * fitScale);

  // Always fill the visible host width so right-side empty band disappears.
  // Builder may grow past it when widgets are wider (horizontal scroll).
  const surfaceWidth = phoneMode
    ? designSize.width
    : Math.max(designSize.width, parentWidth);

  const commitCanvasBox = useCallback((id, patch) => {
    const next = sanitizeNestedLayoutPx(
      boxesRef.current.map((box) => {
        if (String(box.i) !== String(id)) return box;
        const left = patch.left != null ? Math.max(0, Number(patch.left) + origin.x) : box.left;
        const top = patch.top != null ? Math.max(0, Number(patch.top) + origin.y) : box.top;
        return boxWithId(id, {
          ...box,
          left,
          top,
          width: patch.width != null ? Math.max(40, Number(patch.width)) : box.width,
          height: patch.height != null ? Math.max(32, Number(patch.height)) : box.height,
        });
      }).filter(Boolean),
    );
    boxesRef.current = next;
    setDragCanvasPad(0);
    onLayoutChangeRef.current?.(next, {});
  }, [origin.x, origin.y]);

  const sendWidgetToBottom = useCallback((id) => {
    const others = boxesRef.current.filter((box) => String(box.i) !== String(id));
    const maxBottom = others.reduce((max, box) => Math.max(max, box.top + box.height), 0);
    const current = boxesRef.current.find((box) => String(box.i) === String(id));
    const next = sanitizeNestedLayoutPx(
      boxesRef.current.map((box) => {
        if (String(box.i) !== String(id)) return box;
        return boxWithId(id, {
          ...box,
          left: origin.x,
          top: maxBottom + 24,
          width: current?.width ?? box.width,
          height: current?.height ?? box.height,
        });
      }).filter(Boolean),
    );
    boxesRef.current = next;
    setDragCanvasPad(0);
    onLayoutChangeRef.current?.(next, {});
  }, [origin.x]);

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
    if (clientX > rect.right - EDGE_SCROLL_PX) scroller.scrollLeft += EDGE_SCROLL_SPEED;
    else if (clientX < rect.left + EDGE_SCROLL_PX) scroller.scrollLeft = Math.max(0, scroller.scrollLeft - EDGE_SCROLL_SPEED);
  }, [getScroller]);

  if (!topLevel.length) {
    return (
      <div
        ref={measureRef}
        className="flex min-h-[320px] w-full items-center justify-center border border-dashed border-slate-300 bg-white/60"
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Add a widget to start building
        </p>
      </div>
    );
  }

  if (parentWidth < 200) {
    return <div ref={measureRef} className="w-full min-h-[240px]" />;
  }

  return (
    <div
      ref={measureRef}
      className={`relative min-w-0 ${useScrollLayout ? "" : "w-full max-w-full overflow-hidden"}`}
      style={{
        height: scaledHeight,
        minHeight: readOnly ? scaledHeight : Math.max(scaledHeight, 420),
        width: useScrollLayout ? surfaceWidth : "100%",
      }}
    >
      <div
        className="relative origin-top-left"
        style={{
          width: surfaceWidth,
          height: designHeight,
          transform: `scale(${fitScale})`,
          transformOrigin: "top left",
          backgroundImage: readOnly
            ? undefined
            : "radial-gradient(#e2e8f0 1px, transparent 1px)",
          backgroundSize: readOnly ? undefined : "18px 18px",
        }}
        onMouseDownCapture={(e) => {
          if (readOnly) return;
          const host = e.target?.closest?.("[data-widget-id]")
            || e.target?.closest?.(".simple-rnd")?.querySelector?.("[data-widget-id]");
          if (host) {
            const id = host.getAttribute("data-widget-id");
            if (id) onSelectWidget?.(id);
            return;
          }
          // Empty canvas only — do not clear on the later click (avoids select→deselect race).
          if (e.target === e.currentTarget || !e.target?.closest?.(".simple-rnd")) {
            onSelectWidget?.(null);
          }
        }}
      >
        {!readOnly && !phoneMode && (
          <div
            className="pointer-events-none absolute left-3 right-3 border-t border-dashed border-slate-300/80"
            style={{ top: Math.max(0, designHeight - BOTTOM_ROOM_PX + 40) }}
          >
            <span className="absolute -top-5 left-0 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
              Drop widgets below here
            </span>
          </div>
        )}

        {topLevel.map((widget, idx) => {
          const box = boxes.find((b) => String(b.i) === String(widget.id))
            || normalizeBox(readWidgetBoxPx(widget, 0));
          const canvasBox = {
            ...box,
            left: box.left - origin.x,
            top: box.top - origin.y,
          };
          const isSelected = !readOnly && String(selectedWidgetId) === String(widget.id);
          const isContainer = widget.rawType === "container" || widget.rawType === "section";
          const css = savedStyleToCss(widget.style || {}, { isContainer });
          const isDropTarget = isDropTargetIds.has(String(widget.id));
          // Stable stacking (same in builder + live). Selection only boosts in builder.
          const stackZ = isSelected ? 40 : (10 + idx);

          if (readOnly) {
            const clickable = widgetHasClickLink(widget);
            return (
              <div
                key={String(widget.id)}
                role={clickable ? "link" : undefined}
                tabIndex={clickable ? 0 : undefined}
                style={{
                  ...boxToInlineStyle(canvasBox),
                  ...css,
                  width: canvasBox.width,
                  height: canvasBox.height,
                  overflow: "hidden",
                  zIndex: stackZ,
                  display: isContainer ? "flex" : undefined,
                  flexDirection: isContainer ? "column" : undefined,
                  boxSizing: "border-box",
                  cursor: clickable ? "pointer" : undefined,
                }}
                onClick={(e) => {
                  if (!clickable) return;
                  if (shouldIgnoreWidgetLinkClick(e)) return;
                  e.stopPropagation();
                  navigateWidgetClickUrl(getWidgetClickUrl(widget), router);
                }}
                onKeyDown={(e) => {
                  if (!clickable) return;
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  navigateWidgetClickUrl(getWidgetClickUrl(widget), router);
                }}
              >
                <WidgetRenderer
                  widget={widget}
                  readOnly
                  designParity
                  nested={false}
                  isPhoneMode={phoneMode}
                  pureSavedStyle
                  suppressChrome
                />
              </div>
            );
          }

          return (
            <Rnd
              key={`${widget.id}:${boxesFp}`}
              className="simple-rnd"
              scale={fitScale}
              default={{
                x: canvasBox.left,
                y: canvasBox.top,
                width: canvasBox.width,
                height: canvasBox.height,
              }}
              minWidth={isContainer ? 160 : 80}
              minHeight={isContainer ? 80 : 48}
              enableResizing={HANDLE_STYLES}
              resizeHandleStyles={resizeHandleStylesForSelection(isSelected)}
              cancel={CANCEL_SELECTOR}
              style={{
                ...css,
                ...selectionStyle(isSelected, isContainer),
                zIndex: stackZ,
                overflow: "visible",
                display: isContainer ? "flex" : undefined,
                flexDirection: isContainer ? "column" : undefined,
                boxShadow: isDropTarget
                  ? "0 0 0 2px #60a5fa"
                  : (selectionStyle(isSelected, isContainer).boxShadow || css.boxShadow),
              }}
              onDragStart={() => onSelectWidget?.(widget.id)}
              onDrag={(e, d) => {
                const bottom = d.y + (Number(d.node?.offsetHeight) || canvasBox.height);
                const needPad = Math.max(0, bottom + 400 - (designHeight - dragCanvasPad));
                if (needPad > dragCanvasPad + 20) setDragCanvasPad(needPad);
                autoScrollWhileDragging(e.clientX, e.clientY);
              }}
              onDragStop={(_e, d) => {
                commitCanvasBox(widget.id, { left: d.x, top: d.y });
              }}
              onResizeStart={() => onSelectWidget?.(widget.id)}
              onResize={(_e, _dir, ref, _delta, pos) => {
                const bottom = pos.y + ref.offsetHeight;
                const needPad = Math.max(0, bottom + 400 - (designHeight - dragCanvasPad));
                if (needPad > dragCanvasPad + 20) setDragCanvasPad(needPad);
              }}
              onResizeStop={(_e, _dir, ref, _delta, pos) => {
                commitCanvasBox(widget.id, {
                  left: pos.x,
                  top: pos.y,
                  width: ref.offsetWidth,
                  height: ref.offsetHeight,
                });
              }}
            >
              {isSelected ? (
                <SimpleWidgetToolbar
                  onEdit={(e) => { e.stopPropagation(); onSelectWidget?.(widget.id); }}
                  onClone={(e) => { e.stopPropagation(); onCloneWidget?.(widget); }}
                  onDelete={(e) => { e.stopPropagation(); onDeleteWidget?.(widget); }}
                  onSendToBottom={(e) => { e.stopPropagation(); sendWidgetToBottom(widget.id); }}
                />
              ) : null}
              <div
                data-widget-id={String(widget.id)}
                className={`simple-widget-body min-h-0 min-w-0 h-full flex-1 ${isContainer ? "simple-nested-canvas flex flex-col overflow-hidden" : "overflow-hidden"}`}
              >
                <WidgetRenderer
                  widget={widget}
                  readOnly={false}
                  designParity={false}
                  nested={false}
                  isPhoneMode={phoneMode}
                  selectedWidgetId={selectedWidgetId}
                  onNestedLayoutChange={onNestedLayoutChange}
                  onSelectWidget={onSelectWidget}
                  onDeleteWidget={onDeleteWidget}
                  onAddChildWidget={onAddChildWidget}
                  onCloneChildWidget={onCloneChildWidget}
                  onCloneWidget={onCloneWidget}
                  onNestedGridWidthDiscover={onNestedGridWidthDiscover}
                  isDropTarget={isDropTarget}
                  isContainerResizing={String(isContainerResizingId) === String(widget.id)}
                  pureSavedStyle
                  suppressChrome
                  canvasScale={1}
                  dragScale={fitScale}
                />
              </div>
            </Rnd>
          );
        })}
      </div>
    </div>
  );
}
