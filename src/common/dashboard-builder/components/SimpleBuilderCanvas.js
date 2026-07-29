"use client";

/**
 * Full-bleed canvas (builder + live).
 * Laptop (builder + publish): 1:1 design pixels + horizontal scroll (WYSIWYG).
 * Phone: fit to measured frame width (no CSS shrink of a wider desktop layout).
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Rnd } from "react-rnd";
import WidgetRenderer from "./WidgetRenderer";
import {
  DRAG_HANDLE_CLASS,
  HANDLE_STYLES,
  resizeHandleStylesForSelection,
  selectionStyle,
  SimpleWidgetToolbar,
} from "./simpleBuilderChrome";
import {
  boxToInlineStyle,
  boxWithId,
  equalizePhoneSideGutters,
  layoutPxFingerprint,
  normalizeBox,
  PHONE_CONTENT_WIDTH,
  PHONE_FRAME_INSET,
  phoneContentBoxesFromFrame,
  readWidgetBoxPx,
  resolveTopLevelBoxes,
  savedStyleToCss,
  sanitizeNestedLayoutPx,
} from "../utils/floatingLayoutEngine";
import { getWidgetClickUrl, navigateWidgetClickUrl, shouldIgnoreWidgetLinkClick, widgetHasClickLink } from "../utils/widgetClickLink";

// Cancel chrome buttons + nested children (parent container moves via toolbar grip only).
const CANCEL_SELECTOR = `.simple-no-drag, button, a, input, textarea, select, .simple-nested-canvas .simple-rnd`;
/** Extra room below content for dropping widgets in the builder (keep modest to avoid endless vertical scroll). */
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
  phoneMode = false,
}) {
  const router = useRouter();
  const topLevel = useMemo(() => {
    // Keep saved order so builder + publish paint the same way (no container re-sort).
    return (widgets || []).filter((w) => !w.containerId && !w.sectionId);
  }, [widgets]);

  const measureRef = useRef(null);
  // Seed from prop so a remount/resize never flashes an empty canvas (parentWidth===0 gate).
  const [parentWidth, setParentWidth] = useState(() => {
    const fromProp = Number(canvasWidth);
    return fromProp >= 200 ? Math.floor(fromProp) : 1200;
  });
  const [dragCanvasPad, setDragCanvasPad] = useState(0);
  const [liveBoxes, setLiveBoxes] = useState(null);

  const phoneFitWidth = useMemo(() => {
    const frameW = Number(canvasWidth) >= 200 ? Number(canvasWidth) : PHONE_CONTENT_WIDTH;
    return parentWidth >= 200 ? parentWidth : frameW;
  }, [canvasWidth, parentWidth]);

  // Saved designer coords (no group scale). Display may scale only when readOnly.
  const sourceBoxes = useMemo(
    () => {
      if (!phoneMode) return resolveTopLevelBoxes(topLevel, layoutPx);
      return resolveTopLevelBoxes(topLevel, layoutPx, { maxWidth: phoneFitWidth });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topLevel, layoutPxFingerprint(layoutPx), phoneMode, phoneFitWidth],
  );
  const sourceBoxesRef = useRef(sourceBoxes);
  sourceBoxesRef.current = sourceBoxes;

  const boxes = useMemo(
    () => {
      // Laptop / desktop: never phone-clamp or equalize — keep designer coords as saved.
      if (!phoneMode) return sourceBoxes;
      // Live/publish may scale-to-fill. Builder keeps exact sizes (resizing one
      // widget must not reshape siblings).
      return phoneContentBoxesFromFrame(sourceBoxes, phoneFitWidth, { fill: readOnly });
    },
    [sourceBoxes, phoneMode, phoneFitWidth, readOnly],
  );
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;
  const boxesFp = useMemo(() => layoutPxFingerprint(boxes), [boxes]);

  useEffect(() => {
    setLiveBoxes(null);
  }, [boxesFp]);

  const measureParent = useCallback(() => {
    const node = measureRef.current;
    if (!node) return;
    // Phone: measure the phone frame content box (full width). Gutters are layout insets.
    // Laptop: measure the canvas host — never a phone frame (avoids 390px clamp on desktop).
    const host = phoneMode
      ? (node.closest("[data-dashboard-phone-frame]") || node)
      : (node.closest("[data-dashboard-canvas-host]") || node);
    const w = Math.floor(
      host.clientWidth
      || host.getBoundingClientRect().width
      || node.clientWidth
      || 0,
    );
    const fromProp = Number(canvasWidth) >= 200 ? Math.floor(Number(canvasWidth)) : 0;
    let resolved = 0;
    if (phoneMode) {
      resolved = w >= 200 ? w : (fromProp >= 200 ? fromProp : PHONE_CONTENT_WIDTH);
    } else if (w >= 200) {
      resolved = w;
    } else if (fromProp >= 200) {
      resolved = fromProp;
    }
    // Never drop to 0 during window resize — keep last good width (avoids blank canvas).
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
    const host = phoneMode
      ? (node.closest("[data-dashboard-phone-frame]") || node)
      : (node.closest("[data-dashboard-canvas-host]") || node);
    const ro = new ResizeObserver(() => window.requestAnimationFrame(measureParent));
    ro.observe(host);
    if (phoneMode) {
      const frame = node.closest("[data-dashboard-phone-frame]");
      if (frame && frame !== host) ro.observe(frame);
    }
    window.addEventListener("resize", measureParent);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureParent);
    };
  }, [measureParent, phoneMode]);

  // Absolute design coords only — never shift the frame (that caused drag jumps / empty left).
  const designSize = useMemo(() => contentSizeOf(boxes), [boxes]);

  // Laptop builder + publish: same 1:1 coords + horizontal scroll (WYSIWYG).
  // Phone: never CSS-scale; surface matches measured frame.
  const useScrollLayout = !phoneMode;
  const fitScale = 1;

  const designHeight = useMemo(() => {
    if (readOnly) return designSize.height;
    if (phoneMode) {
      return Math.max(designSize.height + 80, 520);
    }
    return Math.max(MIN_BUILDER_HEIGHT, designSize.height + BOTTOM_ROOM_PX + dragCanvasPad);
  }, [readOnly, designSize.height, dragCanvasPad, phoneMode]);

  const scaledHeight = designHeight;

  const phoneFrameWidth = Number(canvasWidth) >= 200 ? Number(canvasWidth) : PHONE_CONTENT_WIDTH;
  const safeParentWidth = parentWidth >= 200 ? parentWidth : (Number(canvasWidth) >= 200 ? Math.floor(Number(canvasWidth)) : 1200);
  // Phone: always fill the content box (100%) — edge-to-edge.
  const surfaceWidth = phoneMode
    ? safeParentWidth
    : Math.max(designSize.width, safeParentWidth);

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

  const commitCanvasBox = useCallback((id, patch) => {
    const frameW = phoneMode && parentWidth >= 200
      ? parentWidth
      : (Number(canvasWidth) >= 200 ? Number(canvasWidth) : PHONE_CONTENT_WIDTH);
    // Commit against saved source boxes — never against display-fitted coords.
    let next = sanitizeNestedLayoutPx(
      sourceBoxesRef.current.map((box) => {
        if (String(box.i) !== String(id)) return box;
        const minLeft = phoneMode ? PHONE_FRAME_INSET : 0;
        return boxWithId(id, {
          ...box,
          left: patch.left != null ? Math.max(minLeft, Number(patch.left)) : box.left,
          top: patch.top != null ? Math.max(0, Number(patch.top)) : box.top,
          width: patch.width != null ? Math.max(40, Number(patch.width)) : box.width,
          height: patch.height != null ? Math.max(32, Number(patch.height)) : box.height,
        });
      }).filter(Boolean),
    );
    if (phoneMode) {
      // Clamp only the edited widget — do not re-fit the whole group.
      const edited = next.find((box) => String(box.i) === String(id));
      if (edited) {
        const [clamped] = equalizePhoneSideGutters([edited], frameW, PHONE_FRAME_INSET);
        next = next.map((box) => (
          String(box.i) === String(id) ? { i: String(id), ...normalizeBox(clamped) } : box
        ));
      }
    }
    sourceBoxesRef.current = next;
    boxesRef.current = phoneMode
      ? phoneContentBoxesFromFrame(next, frameW, { fill: false })
      : next;
    setLiveBoxes(null);
    setDragCanvasPad(0);
    onLayoutChangeRef.current?.(next, {});
  }, [phoneMode, parentWidth, canvasWidth]);

  const sendWidgetToBottom = useCallback((id) => {
    const frameW = phoneMode && parentWidth >= 200
      ? parentWidth
      : (Number(canvasWidth) >= 200 ? Number(canvasWidth) : PHONE_CONTENT_WIDTH);
    const others = sourceBoxesRef.current.filter((box) => String(box.i) !== String(id));
    const maxBottom = others.reduce((max, box) => Math.max(max, box.top + box.height), 0);
    const current = sourceBoxesRef.current.find((box) => String(box.i) === String(id));
    let next = sanitizeNestedLayoutPx(
      sourceBoxesRef.current.map((box) => {
        if (String(box.i) !== String(id)) return box;
        return boxWithId(id, {
          ...box,
          left: phoneMode ? PHONE_FRAME_INSET : Math.max(0, box.left),
          top: maxBottom + 24,
          width: current?.width ?? box.width,
          height: current?.height ?? box.height,
        });
      }).filter(Boolean),
    );
    if (phoneMode) {
      const edited = next.find((box) => String(box.i) === String(id));
      if (edited) {
        const [clamped] = equalizePhoneSideGutters([edited], frameW, PHONE_FRAME_INSET);
        next = next.map((box) => (
          String(box.i) === String(id) ? { i: String(id), ...normalizeBox(clamped) } : box
        ));
      }
      sourceBoxesRef.current = next;
      boxesRef.current = phoneContentBoxesFromFrame(next, frameW, { fill: false });
    } else {
      sourceBoxesRef.current = next;
      boxesRef.current = next;
    }
    setLiveBoxes(null);
    setDragCanvasPad(0);
    onLayoutChangeRef.current?.(next, {});
  }, [phoneMode, parentWidth, canvasWidth]);

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

  // Always paint widgets. A temporary 0-width measure during window resize used to
  // return an empty stub and then never recover (blank canvas until hard refresh).
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
          width: phoneMode ? "100%" : surfaceWidth,
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
          // Toolbar actions (clone/delete/edit) — do not steal the event for selection.
          if (e.target?.closest?.("[data-simple-toolbar], .simple-widget-toolbar, .simple-no-drag, button")) {
            return;
          }
          // Nested child: select it (do not select the parent container instead).
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
          const box = getBox(widget.id) || normalizeBox(readWidgetBoxPx(widget, 0));
          const canvasBox = box;
          const isSelected = !readOnly && String(selectedWidgetId) === String(widget.id);
          const isContainer = widget.rawType === "container" || widget.rawType === "section";
          const css = savedStyleToCss(widget.style || {}, { isContainer });
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
              key={String(widget.id)}
              className={`simple-rnd group${isContainer ? " simple-container-rnd" : ""}`}
              scale={fitScale}
              position={{ x: canvasBox.left, y: canvasBox.top }}
              size={{ width: canvasBox.width, height: canvasBox.height }}
              minWidth={isContainer ? 160 : 80}
              minHeight={isContainer ? 80 : 48}
              enableResizing={HANDLE_STYLES}
              resizeHandleStyles={resizeHandleStylesForSelection(isSelected)}
              // Containers are full of nested widgets — move only from the hover toolbar grip.
              dragHandleClassName={isContainer ? DRAG_HANDLE_CLASS : undefined}
              cancel={CANCEL_SELECTOR}
              bounds={phoneMode ? "parent" : undefined}
              style={{
                ...css,
                ...selectionStyle(isSelected, isContainer),
                zIndex: stackZ,
                overflow: isContainer ? "hidden" : "visible",
                display: isContainer ? "flex" : undefined,
                flexDirection: isContainer ? "column" : undefined,
              }}
              onDragStart={() => onSelectWidget?.(widget.id)}
              onDrag={(e, d) => {
                patchLiveBox(widget.id, { left: d.x, top: d.y });
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
                patchLiveBox(widget.id, {
                  left: pos.x,
                  top: pos.y,
                  width: ref.offsetWidth,
                  height: ref.offsetHeight,
                });
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
