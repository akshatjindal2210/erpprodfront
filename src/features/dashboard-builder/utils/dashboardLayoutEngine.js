const NESTED_ROW_HEIGHT = 28;
const NESTED_GAP = 8;
const MAIN_ROW_HEIGHT = 64;
const MAIN_GAP = 12;
const GRID_COLS = 12;
const NESTED_INNER_PAD_DESKTOP = 8;
const CONTAINER_HEIGHT_BUFFER = 8;
const CONTAINER_HEADER_PX = 32;
/** Breathing room below container before the next dashboard widget (grid row allocation only). */
const LIVE_CONTAINER_ROW_GAP_PX = 12;

export { NESTED_INNER_PAD_DESKTOP, LIVE_CONTAINER_ROW_GAP_PX, NESTED_ROW_HEIGHT, NESTED_GAP };

export function inferContainerPresetFromLayout(layoutItem = {}, cols = GRID_COLS) {
  const width = Math.max(1, Number(layoutItem?.w) || cols);
  return width <= cols / 2 ? "half" : "full";
}

export function resolveContainerPreset(widget = {}, layoutItem = {}) {
  const preset = String(widget.containerPreset || widget.container_preset || "").trim().toLowerCase();
  const layoutW = Number(layoutItem?.w ?? widget.layout?.w);
  if (preset === "half") return "half";
  if (preset === "full") {
    if (Number.isFinite(layoutW) && layoutW <= 6) return "half";
    return "full";
  }
  if (Number.isFinite(layoutW) && layoutW <= 6) return "half";
  return "full";
}

export function applyDesktopContainerLayout(widget = {}, layoutItem = {}, cols = GRID_COLS) {
  const rawW = Number(layoutItem?.w ?? widget.layout?.w);
  const rawX = Number(layoutItem?.x ?? widget.layout?.x ?? 0);
  if (Number.isFinite(rawW) && rawW >= 1) {
    const w = Math.max(1, Math.min(cols, Math.round(rawW)));
    const x = Math.max(0, Math.min(cols - w, rawX));
    return { ...layoutItem, x, w };
  }
  const containerLayout = normalizeContainerLayoutItem(widget, layoutItem, cols);
  return {
    ...layoutItem,
    x: containerLayout.x,
    w: containerLayout.w,
  };
}

export function normalizeContainerLayoutItem(widget = {}, layoutItem = {}, cols = GRID_COLS) {
  const preset = resolveContainerPreset(widget, layoutItem);
  const rawW = Number(layoutItem?.w ?? widget.layout?.w);
  const presetDefault = preset === "half" ? Math.floor(cols / 2) : cols;
  const width = Number.isFinite(rawW) && rawW >= 1
    ? Math.max(1, Math.min(cols, Math.round(rawW)))
    : presetDefault;
  const rawX = Number(layoutItem?.x ?? widget.layout?.x ?? 0);
  const x = width >= cols ? 0 : Math.max(0, Math.min(cols - width, rawX));
  return { preset, w: width, x };
}

export function layoutCoordsEqual(itemA = {}, itemB = {}) {
  return Number(itemA.x) === Number(itemB.x)
    && Number(itemA.y) === Number(itemB.y)
    && Number(itemA.w) === Number(itemB.w)
    && Number(itemA.h) === Number(itemB.h);
}

export function hasCustomMobileNestedLayout(nested = [], mobileNested = []) {
  if (!mobileNested.length) return false;
  if (!nested.length) return true;
  return mobileNested.some((mobileItem) => {
    const desktopItem = nested.find((item) => String(item.i) === String(mobileItem.i));
    if (!desktopItem) return true;
    return !layoutCoordsEqual(mobileItem, desktopItem);
  });
}

export function hasCustomTopLevelMobileLayout(desktopLayout = [], mobileLayout = []) {
  if (!mobileLayout.length) return false;
  return mobileLayout.some((mobileItem) => {
    const desktopItem = desktopLayout.find((item) => String(item.i) === String(mobileItem.i));
    if (!desktopItem) return true;
    return !layoutCoordsEqual(mobileItem, desktopItem);
  });
}

export function hasCustomPhoneLayout(widgets = [], desktopLayout = [], mobileLayout = []) {
  if (hasCustomTopLevelMobileLayout(desktopLayout, mobileLayout)) return true;
  return widgets.some(
    (widget) =>
      widget.rawType === "container"
      && hasCustomMobileNestedLayout(widget.nestedLayout || [], widget.mobileNestedLayout || []),
  );
}

export function stackLayoutForPhone(widgets = [], layouts = [], cols = GRID_COLS) {
  const widgetById = new Map((widgets || []).map((widget) => [String(widget.id), widget]));
  const sorted = [...(layouts || [])].sort((a, b) => {
    const yDiff = (Number(a.y) || 0) - (Number(b.y) || 0);
    if (yDiff !== 0) return yDiff;
    return (Number(a.x) || 0) - (Number(b.x) || 0);
  });
  let y = 0;
  return sorted.map((item, idx) => {
    const widget = widgetById.get(String(item.i));
    let h = Math.max(1, Number(item.h) || 2);
    if (widget?.rawType === "container") {
      const nested = resolvePhoneNestedLayoutForDisplay(
        widget.nestedLayout || [],
        widget.mobileNestedLayout || [],
      );
      const autoH = nestedLayoutToGridHeight(nested);
      h = resolveContainerGridHeight(autoH, item.h, { locked: isContainerLayoutLocked(widget) });
    } else if (widget?.rawType === "heading") {
      h = Math.max(1, Number(item.h) || 1);
    } else if (widget?.rawType === "table" || widget?.rawType === "graph") {
      h = Math.max(3, Math.min(Number(item.h) || 3, 6));
    } else {
      const desktopH = Math.max(1, Number(item.h) || 2);
      h = desktopH <= 1 ? 1 : Math.max(2, Math.min(desktopH, 4));
    }
    const next = {
      ...item,
      i: String(item.i || `phone_${idx}`),
      x: 0,
      w: cols,
      y,
      h,
    };
    y += h;
    return next;
  });
}

/** Phone nested: use saved mobile_nested_layout only when it differs from desktop; else stack. */
export function resolvePhoneNestedLayoutForDisplay(desktopNested = [], mobileNested = [], cols = GRID_COLS) {
  const desktop = sanitizeNestedLayoutItems(desktopNested);
  const mobile = sanitizeNestedLayoutItems(mobileNested);
  if (mobile.length && hasCustomMobileNestedLayout(desktop, mobile)) {
    return mobile;
  }
  if (!desktop.length) return [];
  return stackNestedLayoutForPhone(desktop, cols);
}

export function stackNestedLayoutForPhone(nestedLayout = [], cols = GRID_COLS) {
  const sorted = [...(nestedLayout || [])].sort((a, b) => {
    const yDiff = (Number(a.y) || 0) - (Number(b.y) || 0);
    if (yDiff !== 0) return yDiff;
    return (Number(a.x) || 0) - (Number(b.x) || 0);
  });
  let y = 0;
  return sorted.map((item, idx) => {
    const h = Math.max(1, Number(item.h) || 2);
    const next = {
      ...item,
      i: String(item.i || `nested_${idx}`),
      x: 0,
      w: cols,
      y,
      h,
    };
    y += h;
    return next;
  });
}

export function isTopLevelWidget(widget = {}) {
  return !widget.containerId && !widget.sectionId;
}

export function repackLayoutItems(items = []) {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => {
    const yDiff = (Number(a.y) || 0) - (Number(b.y) || 0);
    if (yDiff !== 0) return yDiff;
    return (Number(a.x) || 0) - (Number(b.x) || 0);
  });

  const rowMap = new Map();
  for (const item of sorted) {
    const rowY = Number(item.y) || 0;
    if (!rowMap.has(rowY)) rowMap.set(rowY, []);
    rowMap.get(rowY).push(item);
  }

  const packed = [];
  let nextY = 0;
  for (const rowY of [...rowMap.keys()].sort((a, b) => a - b)) {
    const rowItems = [...rowMap.get(rowY)].sort(
      (a, b) => (Number(a.x) || 0) - (Number(b.x) || 0),
    );
    const rowHeight = Math.max(...rowItems.map((item) => Math.max(1, Number(item.h) || 1)));
    let nextX = 0;
    for (const item of rowItems) {
      packed.push({
        ...item,
        i: String(item.i),
        x: nextX,
        y: nextY,
        w: Math.max(1, Number(item.w) || 1),
        h: Math.max(1, Number(item.h) || 1),
      });
      nextX += Math.max(1, Number(item.w) || 1);
    }
    nextY += rowHeight;
  }
  return packed;
}

function isVisuallyBefore(a, b) {
  const ay = Number(a.y) || 0;
  const by = Number(b.y) || 0;
  if (ay !== by) return ay < by;
  return (Number(a.x) || 0) < (Number(b.x) || 0);
}

function violatesPackedOrder(candidate, priorPlaced = []) {
  return priorPlaced.some((entry) => isVisuallyBefore(candidate, entry));
}

function findEarliestPackedSlot(w, h, occupied = [], cols = GRID_COLS, minY = 0, priorPlaced = []) {
  const maxCols = Math.max(1, Number(cols) || GRID_COLS);
  const width = Math.max(1, Math.min(maxCols, Number(w) || 1));
  const height = Math.max(1, Number(h) || 1);
  for (let tryY = Math.max(0, Number(minY) || 0); tryY < minY + 5000; tryY += 1) {
    for (let tryX = 0; tryX <= maxCols - width; tryX += 1) {
      const candidate = { x: tryX, y: tryY, w: width, h: height };
      if (occupied.some((entry) => layoutItemsCollide(candidate, entry))) continue;
      if (violatesPackedOrder(candidate, priorPlaced)) continue;
      return candidate;
    }
  }
  return { x: 0, y: Math.max(0, Number(minY) || 0), w: width, h: height };
}

/**
 * After permission filtering hides widgets/containers:
 * - Hidden slots collapse completely (including full-width containers) — no empty hole.
 * - Remaining widgets keep designer order and flow into freed space.
 * - Preserves each visible item's w/h; only moves x/y.
 */
export function packLayoutGaps(visibleItems = [], cols = GRID_COLS, fullLayout = null) {
  if (!visibleItems.length) return [];
  const maxCols = Math.max(1, Number(cols) || GRID_COLS);
  const visibleIds = new Set(visibleItems.map((item) => String(item.i)));
  const visibleById = new Map(
    visibleItems.map((item) => [String(item.i), {
      ...item,
      i: String(item.i),
      x: Math.max(0, Number(item.x) || 0),
      y: Math.max(0, Number(item.y) || 0),
      w: Math.max(1, Math.min(maxCols, Number(item.w) || 1)),
      h: Math.max(1, Number(item.h) || 1),
    }]),
  );

  // Prefer blueprint order (all saved slots) so hidden containers are skipped and later
  // widgets move up in the same sequence the designer placed them.
  const layoutSource = (fullLayout?.length ? fullLayout : visibleItems).map((item) => ({
    i: String(item.i),
    x: Math.max(0, Number(item.x) || 0),
    y: Math.max(0, Number(item.y) || 0),
    w: Math.max(1, Math.min(maxCols, Number(item.w) || 1)),
    h: Math.max(1, Number(item.h) || 1),
    visible: visibleIds.has(String(item.i)),
  }));

  const blueprint = [...layoutSource].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const occupied = [];
  const packed = [];

  for (const slot of blueprint) {
    if (!slot.visible) {
      // No-permission widget/container: skip entirely — do not reserve empty space.
      continue;
    }

    const source = visibleById.get(String(slot.i));
    if (!source) continue;

    const priorPlaced = occupied.map((entry) => ({
      x: entry.x,
      y: entry.y,
      w: entry.w,
      h: entry.h,
    }));
    const position = findEarliestPackedSlot(source.w, source.h, occupied, maxCols, 0, priorPlaced);
    const placed = {
      ...source,
      i: String(source.i),
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
    };
    packed.push(placed);
    occupied.push(placed);
  }

  return packed.sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

/** Published/live: use saved nested_layout coords; fill any missing children from their layout. */
export function buildNestedLayoutForLiveDisplay(container = {}, allWidgets = [], options = {}) {
  const phone = options?.phone === true;
  const containerId = String(container.id || "");
  const savedPhoneNested = Array.isArray(container.mobileNestedLayout) ? container.mobileNestedLayout : [];
  const savedDesktopNested = Array.isArray(container.nestedLayout) ? container.nestedLayout : [];
  const savedNestedLayout = phone
    ? resolvePhoneNestedLayoutForDisplay(savedDesktopNested, savedPhoneNested)
    : savedDesktopNested;
  if (!containerId) return sanitizeNestedLayoutItems(savedNestedLayout);
  const children = (allWidgets || []).filter(
    (child) => String(child.containerId || child.sectionId || "") === containerId,
  );
  // Permission hid every nested child — no empty nested slots.
  if (!children.length) return [];

  const nestedById = new Map(savedNestedLayout.map((item) => [String(item.i), item]));

  let resolved = sanitizeNestedLayoutItems(
    children.map((child, idx) => {
      const saved = nestedById.get(String(child.id));
      if (saved) {
        return mergeNestedItemFromChild(child, saved);
      }
      const childLayout = phone
        ? (child.mobileLayout || child.layout || {})
        : (child.layout || {});
      return mergeNestedItemFromChild(
        child,
        childLayout.i ? childLayout : { i: String(child.id), x: (idx % 3) * 4, y: 0, w: 4, h: 2 },
      );
    }),
  );

  if (isNestedLayoutCorrupt(resolved)) {
    resolved = repairNestedLayoutItems(resolved, children);
  }
  const childIds = new Set(children.map((child) => String(child.id)));
  const hadHiddenChildren = savedNestedLayout.some((item) => !childIds.has(String(item.i)))
    || savedNestedLayout.length > children.length;
  // Same as laptop: pack leftover holes when permission hid nested widgets.
  return hadHiddenChildren ? packLayoutGaps(resolved, 12, savedNestedLayout) : resolved;
}

/** Build nested layout from container children (child.layout wins over stale nested_layout). */
export function buildNestedLayoutFromChildren(container = {}, allWidgets = []) {
  const containerId = String(container.id || "");
  if (!containerId) return sanitizeNestedLayoutItems(container.nestedLayout || []);
  const nestedById = new Map(
    (Array.isArray(container.nestedLayout) ? container.nestedLayout : []).map((item) => [String(item.i), item]),
  );
  const children = (allWidgets || []).filter(
    (child) => String(child.containerId || child.sectionId || "") === containerId,
  );
  if (!children.length) return sanitizeNestedLayoutItems(container.nestedLayout || []);
  return sanitizeNestedLayoutItems(
    children.map((child) => mergeNestedItemFromChild(child, nestedById.get(String(child.id)) || {})),
  );
}

/** Resolve container auto-heights and remove vertical gaps between rows (preserves x). */
export function compactLiveLayoutForDisplay(widgets = [], layout = [], allWidgets = null) {
  const widgetById = new Map((widgets || []).map((w) => [String(w.id), w]));
  const ids = new Set((widgets || []).map((w) => String(w.id)));
  const widgetPool = allWidgets || widgets;

  const resolved = (layout || [])
    .filter((item) => ids.has(String(item.i)))
    .map((item) => {
      const widget = widgetById.get(String(item.i));
      const next = {
        i: String(item.i),
        x: Math.max(0, Number(item.x) || 0),
        y: Math.max(0, Number(item.y) || 0),
        w: Math.max(1, Number(item.w) || 1),
        h: Math.max(1, Number(item.h) || 1),
      };
      if (widget?.rawType === "container") {
        if (shouldPreserveSavedLayout(widget)) {
          // Keep designer height (taller empty shell is intentional).
          const withHeight = applyMainLayoutPixelsToItem(next, widget);
          next.h = Math.max(1, Number(withHeight.h) || next.h);
        } else {
          const nested = buildNestedLayoutForLiveDisplay(widget, widgetPool);
          next.h = containerAutoGridHeight(widget, nested, { trailingGapPx: 0, allWidgets: widgetPool });
        }
      }
      return next;
    })
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));

  const packed = [];
  for (const item of resolved) {
    let tryY = 0;
    while (packed.some((placed) => layoutItemsCollide({ ...item, y: tryY }, placed))) {
      tryY += 1;
    }
    packed.push({ ...item, y: tryY });
  }

  return packed.sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

/** True when container/widget must keep saved grid size (publish/builder parity). */
export function shouldPreserveSavedLayout(widget = {}) {
  return isWidgetLayoutLocked(widget) || hasManualWidgetLayout(widget);
}

/** Published desktop: keep sizes, pack leftover holes after permission-hidden widgets. */
export function resolvePublishedDesktopLayout(widgets = [], layout = [], cols = GRID_COLS, fullLayout = null) {
  const topLevel = (widgets || []).filter((widget) => isTopLevelWidget(widget));
  const ids = setFromIds(topLevel);
  const source = (layout || []).filter((item) => ids.has(String(item.i)));
  const allLocked = topLevel.every(
    (widget) => widget.rawType !== "container" || shouldPreserveSavedLayout(widget),
  );

  let resolved;
  if (allLocked) {
    resolved = source.map((item) => {
      const widget = topLevel.find((entry) => String(entry.id) === String(item.i));
      const next = {
        ...item,
        i: String(item.i),
        x: Math.max(0, Number(item.x) || 0),
        y: Math.max(0, Number(item.y) || 0),
        w: Math.max(1, Number(item.w) || 1),
        h: Math.max(1, Number(item.h) || 1),
      };
      if (widget?.rawType === "container") {
        const containerLayout = applyDesktopContainerLayout(widget, item, cols);
        const withHeight = applyMainLayoutPixelsToItem(
          { ...next, ...containerLayout },
          widget,
        );
        return {
          ...withHeight,
          x: containerLayout.x,
          // Always keep saved grid width — never rewrite from canvas-dependent layoutWidthPx.
          w: containerLayout.w,
        };
      }
      return applyMainLayoutPixelsToItem(next, widget);
    });
  } else {
    resolved = source.map((item) => {
      const widget = topLevel.find((entry) => String(entry.id) === String(item.i));
      if (widget?.rawType === "container") {
        const containerLayout = applyDesktopContainerLayout(widget, item, cols);
        if (shouldPreserveSavedLayout(widget)) {
          const withHeight = applyMainLayoutPixelsToItem(
            { ...item, i: String(item.i), ...containerLayout },
            widget,
          );
          return { ...withHeight, x: containerLayout.x, w: containerLayout.w };
        }
        const nested = buildNestedLayoutForLiveDisplay(widget, widgets);
        return {
          ...item,
          i: String(item.i),
          ...containerLayout,
          h: containerAutoGridHeight(widget, nested, { trailingGapPx: 0, allWidgets: widgets }),
        };
      }
      return { ...item, i: String(item.i) };
    });
    resolved = compactLiveLayoutForDisplay(topLevel, resolved, widgets);
  }

  // Hidden (no-permission) widgets: collapse middle gaps, keep trailing row ends empty.
  return packLayoutGaps(resolved, cols, fullLayout?.length ? fullLayout : null);
}

/** Published phone: saved mobile_layout when customized; otherwise stack from desktop. */
export function resolvePublishedPhoneLayout(
  widgets = [],
  mobileLayout = [],
  cols = GRID_COLS,
  fullMobileLayout = null,
  desktopLayout = null,
) {
  const topLevel = (widgets || []).filter((widget) => isTopLevelWidget(widget));
  const ids = setFromIds(topLevel);
  const mobileBlueprint = fullMobileLayout?.length ? fullMobileLayout : mobileLayout;

  const desktopItems = (desktopLayout?.length
    ? desktopLayout
    : topLevel.map((widget) => ({
      ...(widget.layout && typeof widget.layout === "object" ? widget.layout : {}),
      i: String(widget.id),
    })))
    .filter((item) => ids.has(String(item.i)));

  let source = (mobileLayout || []).filter((item) => ids.has(String(item.i)));

  if (!source.length) {
    source = topLevel
      .map((widget) => {
        const mobile = widget.mobileLayout && typeof widget.mobileLayout === "object"
          ? widget.mobileLayout
          : null;
        if (!mobile || !Object.keys(mobile).length) return null;
        return {
          i: String(widget.id),
          x: Math.max(0, Number(mobile.x) || 0),
          y: Math.max(0, Number(mobile.y) || 0),
          w: Math.max(1, Math.min(cols, Number(mobile.w) || cols)),
          h: Math.max(1, Number(mobile.h) || 1),
        };
      })
      .filter(Boolean);
  }

  const useStacked = !source.length || !hasCustomTopLevelMobileLayout(desktopItems, source);

  let resolved;
  if (useStacked) {
    const stackSource = desktopItems.length ? desktopItems : source;
    resolved = stackLayoutForPhone(topLevel, stackSource, cols);
  } else {
    resolved = source.map((item) => {
      const widget = topLevel.find((entry) => String(entry.id) === String(item.i));
      const next = {
        ...item,
        i: String(item.i),
        x: Math.max(0, Math.min(Math.max(0, cols - 1), Number(item.x) || 0)),
        y: Math.max(0, Number(item.y) || 0),
        w: Math.max(1, Math.min(cols, Number(item.w) || cols)),
        h: Math.max(1, Number(item.h) || 1),
      };
      if (widget?.rawType === "container" && shouldPreserveSavedLayout(widget)) {
        const withHeight = applyMainLayoutPixelsToItem(next, widget);
        return { ...withHeight, x: next.x, w: next.w, h: next.h };
      }
      return next;
    });
  }

  resolved = resolved.map((item) => {
    const widget = topLevel.find((entry) => String(entry.id) === String(item.i));
    if (widget?.rawType === "container" && !shouldPreserveSavedLayout(widget)) {
      return { ...item, h: fitPhoneContainerGridHeight(widget, item) };
    }
    return item;
  });

  return packLayoutGaps(
    resolved,
    cols,
    mobileBlueprint?.length ? mobileBlueprint : null,
  );
}

function setFromIds(widgets = []) {
  return new Set((widgets || []).map((widget) => String(widget.id)));
}

/** Reconcile nested coords from saved layout + child pixel locks for live display. */
export function resolvePublishedNestedLayout(container = {}, allWidgets = []) {
  return buildNestedLayoutForLiveDisplay(container, allWidgets);
}

/** Phone publish/live nested layout — uses mobile_nested_layout only. */
export function resolvePublishedPhoneNestedLayout(container = {}, allWidgets = []) {
  return buildNestedLayoutForLiveDisplay(container, allWidgets, { phone: true });
}

/** Phone live/publish: keep saved x/w, trim container empty rows, pack y only. */
export function compactPhoneLiveLayoutForDisplay(widgets = [], layout = []) {
  const widgetById = new Map((widgets || []).map((w) => [String(w.id), w]));
  const ids = new Set((widgets || []).map((w) => String(w.id)));

  const resolved = (layout || [])
    .filter((item) => ids.has(String(item.i)))
    .map((item) => {
      const widget = widgetById.get(String(item.i));
      const next = {
        i: String(item.i),
        x: Math.max(0, Number(item.x) || 0),
        y: Math.max(0, Number(item.y) || 0),
        w: Math.max(1, Number(item.w) || 1),
        h: Math.max(1, Number(item.h) || 1),
      };
      if (widget?.rawType === "container") {
        next.h = fitPhoneContainerGridHeight(widget, next);
      }
      return next;
    })
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));

  const packed = [];
  for (const item of resolved) {
    let tryY = 0;
    while (packed.some((placed) => layoutItemsCollide({ ...item, y: tryY }, placed))) {
      tryY += 1;
    }
    packed.push({ ...item, y: tryY });
  }

  return packed.sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

/** Place a new nested widget beside the last one when there is room, otherwise on the next row. */
export function placeNextNestedLayoutItem(existingNested = [], nextItem = {}, cols = 12) {
  const item = {
    ...nextItem,
    w: Math.max(1, Number(nextItem.w) || 4),
    h: Math.max(1, Number(nextItem.h) || 2),
    x: Math.max(0, Number(nextItem.x) || 0),
    y: Math.max(0, Number(nextItem.y) || 0),
  };
  if (!existingNested.length) {
    return { ...item, x: 0, y: 0 };
  }
  const lastItem = existingNested[existingNested.length - 1];
  const lastX = Math.max(0, Number(lastItem.x) || 0);
  const lastY = Math.max(0, Number(lastItem.y) || 0);
  const lastW = Math.max(1, Number(lastItem.w) || 1);
  const nextX = lastX + lastW;
  if (nextX + item.w <= cols) {
    return { ...item, x: nextX, y: lastY };
  }
  const maxY = existingNested.reduce(
    (acc, entry) => Math.max(acc, (Number(entry.y) || 0) + (Number(entry.h) || 1)),
    0,
  );
  return { ...item, x: 0, y: maxY };
}

export function computeNestedContentPixelHeight(nestedLayout = []) {
  const maxExtent = computeNestedTallestExtentRows(nestedLayout);
  return maxExtent * (NESTED_ROW_HEIGHT + NESTED_GAP) - NESTED_GAP;
}

/** Pixel height for one nested grid item from its row span (h). */
export function computeNestedItemPixelHeight(gridH = 1) {
  const h = Math.max(1, Number(gridH) || 1);
  return h * NESTED_ROW_HEIGHT + Math.max(0, h - 1) * NESTED_GAP;
}

/** Pixel width for one nested grid item from its column span (w). */
export function computeNestedItemPixelWidth(gridW = 1, colWidth = 80) {
  const w = Math.max(1, Number(gridW) || 1);
  const cw = Math.max(16, Math.round(colWidth));
  return Math.round(w * cw + Math.max(0, w - 1) * NESTED_GAP);
}

/** Persist exact nested widget height for publish/load parity (width stays as grid w). */
export function nestedLayoutItemPixelStyle(nestedItem = {}) {
  const h = Math.max(1, Number(nestedItem.h) || 1);
  return {
    layoutHeightPx: computeNestedItemPixelHeight(h),
  };
}

/** Persist exact top-level height from main grid coords (width stays as grid w). */
export function mainLayoutItemPixelStyle(layoutItem = {}) {
  const { heightPx } = mainGridLayoutToPixels(layoutItem);
  return { heightPx };
}

/** Restore main grid height from saved pixels; never rewrite width from layoutWidthPx (canvas-dependent). */
export function applyMainLayoutPixelsToItem(item = {}, widget = {}) {
  const next = { ...item };
  const { heightPx } = readWidgetLayoutPixels(widget);
  if (heightPx != null) {
    next.h = pixelToMainGridH(heightPx);
  }
  return next;
}

/** Nested grid sizing stays on saved grid coords — do not rewrite from layoutHeightPx. */
export function applyNestedLayoutPixelsToItem(item = {}, child = {}, colWidth = 80) {
  void child;
  void colWidth;
  return { ...item };
}

/** Pixel bottom edge of nested content from saved grid rows (nested_layout is source of truth). */
export function computeNestedLayoutPixelExtent(nestedLayout = [], children = []) {
  void children;
  if (!nestedLayout.length) return 0;
  let maxBottom = 0;
  for (const item of nestedLayout) {
    const gridH = Math.max(1, Number(item.h) || 1);
    const topPx = (Number(item.y) || 0) * (NESTED_ROW_HEIGHT + NESTED_GAP);
    maxBottom = Math.max(maxBottom, topPx + computeNestedItemPixelHeight(gridH));
  }
  return maxBottom;
}

/** Builder nested grid host height: tallest child row extent + small inner padding. */
export function computeContainerNestedHostHeight(nestedLayout = [], { paddingPx = NESTED_INNER_PAD_DESKTOP } = {}) {
  return computeNestedContentPixelHeight(nestedLayout) + Math.max(0, Number(paddingPx) || 0);
}

export function computeNestedGridPixelHeight(nestedLayout = [], { paddingPx = NESTED_INNER_PAD_DESKTOP, minRows = 1 } = {}) {
  const minPixelHeight = minRows * NESTED_ROW_HEIGHT + Math.max(0, minRows - 1) * NESTED_GAP;
  const contentHeight = computeNestedContentPixelHeight(nestedLayout);
  return Math.max(minPixelHeight, contentHeight) + Math.max(0, Number(paddingPx) || 0);
}

export function nestedLayoutToGridHeight(nestedLayout = [], { minRows = 3, headerRows = 1, bufferRows = 1, paddingPx = 32 } = {}) {
  if (!nestedLayout.length) return minRows;
  const nestedPixelHeight = computeNestedGridPixelHeight(nestedLayout, { paddingPx });
  const mainCellStep = MAIN_ROW_HEIGHT + MAIN_GAP;
  const mainRows = Math.ceil(nestedPixelHeight / mainCellStep);
  return Math.max(minRows, mainRows + headerRows + bufferRows);
}

export function isWidgetLayoutLocked(widget = {}) {
  return widget.layoutLocked === true || widget.layout_locked === true;
}

export function readWidgetLayoutPixels(widget = {}) {
  const style = widget.style && typeof widget.style === "object" ? widget.style : {};
  const widthPx = Number(style.layoutWidthPx ?? widget.layoutWidthPx);
  const heightPx = Number(style.layoutHeightPx ?? widget.layoutHeightPx);
  return {
    widthPx: Number.isFinite(widthPx) && widthPx > 0 ? Math.round(widthPx) : null,
    heightPx: Number.isFinite(heightPx) && heightPx > 0 ? Math.round(heightPx) : null,
  };
}

/** Fixed inner nested-grid canvas width — keeps child widgets from shrinking when the container shell narrows. */
export function readNestedGridWidthPx(widget = {}) {
  const style = widget.style && typeof widget.style === "object" ? widget.style : {};
  const chartConfig = widget.chart_config && typeof widget.chart_config === "object" ? widget.chart_config : {};
  const widthPx = Number(
    style.nestedGridWidthPx
    ?? widget.nestedGridWidthPx
    ?? chartConfig.nested_grid_width_px
    ?? chartConfig.nestedGridWidthPx,
  );
  return Number.isFinite(widthPx) && widthPx > 0 ? Math.round(widthPx) : null;
}

/** Inner nested-grid canvas width from the container shell pixel width (minus padding). */
export function containerInnerNestedWidthFromShellPx(widget = {}, shellWidthPx = 0) {
  const widthPx = Math.max(0, Number(shellWidthPx) || 0);
  const pad = resolveWidgetSpacingPx(widget.style, "padding", 12);
  const innerPad = containerNestedInnerPaddingPx(widget, { forPhone: false });
  return Math.max(120, widthPx - pad.left - pad.right - innerPad);
}

/** Use locked nested canvas width; expand to host when container grows, scroll when it shrinks. */
export function resolveNestedGridCanvasWidthPx(lockedWidthPx, hostWidthPx) {
  const locked = Number.isFinite(Number(lockedWidthPx)) && Number(lockedWidthPx) > 0
    ? Math.round(Number(lockedWidthPx))
    : null;
  const host = Number.isFinite(Number(hostWidthPx)) && Number(hostWidthPx) > 0
    ? Math.round(Number(hostWidthPx))
    : 0;
  if (locked != null && locked > 0) {
    return Math.max(locked, host);
  }
  return host;
}

export function isNarrowContainerShell(containerGridW, cols = 12) {
  const w = Number(containerGridW);
  if (!Number.isFinite(w) || w <= 0) return false;
  return w < Math.max(1, Number(cols) || 12);
}

export function shouldNestedGridScrollHorizontally(lockedWidthPx, hostWidthPx, { tolerancePx = 8 } = {}) {
  const locked = Number.isFinite(Number(lockedWidthPx)) && Number(lockedWidthPx) > 0
    ? Math.round(Number(lockedWidthPx))
    : null;
  const host = Number.isFinite(Number(hostWidthPx)) && Number(hostWidthPx) > 0
    ? Math.round(Number(hostWidthPx))
    : 0;
  const tolerance = Math.max(0, Number(tolerancePx) || 0);
  return locked != null && host > 0 && locked > host + tolerance;
}

/**
 * Keep inner canvas wide when the container shell narrows; snap to shell when it grows back
 * (clears stale horizontal scroll after shrink → publish → restore).
 */
export function resolveNextNestedGridWidthPx(priorLocked, shellInnerWidth, { tolerancePx = 8 } = {}) {
  const locked = Number.isFinite(Number(priorLocked)) && Number(priorLocked) > 0
    ? Math.round(Number(priorLocked))
    : null;
  const shell = Number.isFinite(Number(shellInnerWidth)) && Number(shellInnerWidth) > 0
    ? Math.round(Number(shellInnerWidth))
    : null;
  const tolerance = Math.max(0, Number(tolerancePx) || 0);
  if (shell == null) return locked;
  if (locked == null) return shell;
  if (shell >= locked - tolerance) return shell;
  return locked;
}

/** Snap saved container height pixels when the shell grew back or nested content needs more room. */
export function resolveNextContainerLayoutHeightPx(
  widget = {},
  layoutItem = null,
  {
    colWidth = 80,
    rowHeight = MAIN_ROW_HEIGHT,
    gapX = MAIN_GAP,
    gapY = MAIN_GAP,
    tolerancePx = 8,
    nestedLayout = null,
    allWidgets = null,
  } = {},
) {
  const { heightPx: savedHeight } = readWidgetLayoutPixels(widget);
  const layout = layoutItem && typeof layoutItem === "object"
    ? layoutItem
    : (widget.layout && typeof widget.layout === "object" ? widget.layout : {});
  const { heightPx: shellHeight } = mainGridLayoutToPixels(layout, { colWidth, rowHeight, gapX, gapY });
  const tolerance = Math.max(0, Number(tolerancePx) || 0);
  const nested = Array.isArray(nestedLayout) ? nestedLayout : (widget.nestedLayout || []);
  const contentOuterPx = nested.length
    ? computeContainerOuterPixelHeight(widget, nested, allWidgets)
    : null;
  const minFitHeight = Math.max(
    shellHeight ?? 0,
    contentOuterPx ?? 0,
  ) || null;

  if (minFitHeight == null) return savedHeight;
  if (savedHeight == null) return minFitHeight;
  if (minFitHeight > savedHeight + tolerance) return minFitHeight;
  if (shellHeight != null && shellHeight >= savedHeight - tolerance) {
    return Math.max(shellHeight, minFitHeight);
  }
  return savedHeight;
}

/** Derive nested inner canvas width from the container shell grid coords (desktop builder). */
export function inferNestedGridWidthPx(
  widget = {},
  layoutItem = null,
  { colWidth = 80, rowHeight = MAIN_ROW_HEIGHT, gapX = MAIN_GAP, gapY = MAIN_GAP } = {},
) {
  const saved = readNestedGridWidthPx(widget);
  if (saved != null) return saved;
  const layout = layoutItem && typeof layoutItem === "object"
    ? layoutItem
    : (widget.layout && typeof widget.layout === "object" ? widget.layout : {});
  const { widthPx } = mainGridLayoutToPixels(layout, { colWidth, rowHeight, gapX, gapY });
  return containerInnerNestedWidthFromShellPx(widget, widthPx);
}

export function hasManualWidgetLayout(widget = {}) {
  if (isWidgetLayoutLocked(widget)) return true;
  const { widthPx, heightPx } = readWidgetLayoutPixels(widget);
  return widthPx != null || heightPx != null;
}

export function isContainerLayoutLocked(widget = {}) {
  return shouldPreserveSavedLayout(widget);
}

export function pixelToNestedGridW(px, colWidth = 80, gap = NESTED_GAP, cols = 12) {
  const minW = Math.max(16, Math.round(colWidth));
  return Math.max(1, Math.min(
    cols,
    Math.round((Math.max(minW, Number(px) || minW) + gap) / (minW + gap)),
  ));
}

export function pixelToNestedGridH(px, rowHeight = NESTED_ROW_HEIGHT, gap = NESTED_GAP) {
  const minH = Math.max(16, Math.round(rowHeight));
  return Math.max(1, Math.min(
    30,
    Math.round((Math.max(minH, Number(px) || minH) + gap) / (minH + gap)),
  ));
}

export function mainGridPixelCapacity(h, rowHeight = MAIN_ROW_HEIGHT, gap = MAIN_GAP) {
  const rows = Math.max(1, Number(h) || 1);
  return rows * rowHeight + Math.max(0, rows - 1) * gap;
}

export function pixelToMainGridH(px, rowHeight = MAIN_ROW_HEIGHT, gap = MAIN_GAP) {
  const target = Math.max(0, Number(px) || 0);
  if (target <= 0) return 1;
  let h = 1;
  const maxH = 30;
  while (mainGridPixelCapacity(h, rowHeight, gap) < target && h < maxH) {
    h += 1;
  }
  return Math.max(1, h);
}

export function pixelToMainGridW(px, colWidth = 80, gap = MAIN_GAP, cols = GRID_COLS) {
  const minW = Math.max(16, Math.round(colWidth));
  return Math.max(1, Math.min(
    cols,
    Math.round((Math.max(minW, Number(px) || minW) + gap) / (minW + gap)),
  ));
}

export function mainGridLayoutToPixels(
  layoutItem = {},
  { colWidth = 80, rowHeight = MAIN_ROW_HEIGHT, gapX = MAIN_GAP, gapY = MAIN_GAP } = {},
) {
  const w = Math.max(1, Number(layoutItem.w) || 1);
  const h = Math.max(1, Number(layoutItem.h) || 1);
  const cw = Math.max(16, Math.round(colWidth));
  const rh = Math.max(16, Math.round(rowHeight));
  return {
    widthPx: Math.round(w * cw + Math.max(0, w - 1) * gapX),
    heightPx: Math.round(h * rh + Math.max(0, h - 1) * gapY),
  };
}

/** Nested layout coords: container nested_layout is canonical when present. */
export function mergeNestedItemFromChild(child = {}, nestedItem = {}) {
  const childLayout = child.layout && typeof child.layout === "object" ? child.layout : {};
  const nested = nestedItem && typeof nestedItem === "object" ? nestedItem : {};
  const nestedHasCoords = ["x", "y", "w", "h"].some((key) => Number.isFinite(Number(nested[key])));

  // Saved nested_layout wins for publish/builder parity.
  if (nestedHasCoords) {
    return {
      i: String(nested.i || child.id || ""),
      x: Math.max(0, Number(nested.x ?? childLayout.x) || 0),
      y: Math.max(0, Number(nested.y ?? childLayout.y) || 0),
      w: Math.max(1, Number(nested.w ?? childLayout.w) || 1),
      h: Math.max(1, Number(nested.h ?? childLayout.h) || 1),
    };
  }

  const source = { ...nested, ...childLayout };
  return {
    i: String(nested.i || child.id || ""),
    x: Math.max(0, Number(source.x ?? nested.x ?? childLayout.x) || 0),
    y: Math.max(0, Number(source.y ?? nested.y ?? childLayout.y) || 0),
    w: Math.max(1, Number(source.w ?? nested.w ?? childLayout.w) || 1),
    h: Math.max(1, Number(source.h ?? nested.h ?? childLayout.h) || 1),
  };
}

/** Tallest nested widget extent in grid rows (max bottom edge: y + h). */
export function computeNestedTallestExtentRows(nestedLayout = []) {
  if (!nestedLayout.length) return 1;
  return Math.max(
    1,
    nestedLayout.reduce(
      (max, item) => Math.max(max, (Number(item.y) || 0) + (Number(item.h) || 1)),
      0,
    ),
  );
}

/** Auto-grow to fit nested content unless the user locked manual dimensions. */
export function resolveContainerGridHeight(autoH, currentH, options = {}) {
  const locked = options.locked === true;
  const auto = Math.max(1, Number(autoH) || 1);
  const current = Math.max(1, Number(currentH) || auto);
  if (locked) return current;
  return auto;
}

export function resolveWidgetSpacingPx(style = {}, kind = "padding", fallback = 8) {
  const uniform = Number.isFinite(Number(style?.[kind]))
    ? Math.max(0, Number(style[kind]))
    : fallback;
  const readSide = (side) => {
    const key = `${kind}${side}`;
    const val = style?.[key];
    return Number.isFinite(Number(val)) ? Math.max(0, Number(val)) : uniform;
  };
  return {
    top: readSide("Top"),
    right: readSide("Right"),
    bottom: readSide("Bottom"),
    left: readSide("Left"),
  };
}

export function spacingPxToCss(spacing = {}) {
  const top = Math.max(0, Number(spacing.top) || 0);
  const right = Math.max(0, Number(spacing.right) || 0);
  const bottom = Math.max(0, Number(spacing.bottom) || 0);
  const left = Math.max(0, Number(spacing.left) || 0);
  return `${top}px ${right}px ${bottom}px ${left}px`;
}

export function containerShellPaddingPx(widget = {}) {
  const pad = resolveWidgetSpacingPx(widget.style, "padding", 12);
  return Math.max(8, pad.top + pad.bottom);
}

export function computeContainerOuterPixelHeight(widget = {}, nestedOverride = null, allWidgets = null) {
  const nested = nestedOverride || widget.nestedLayout || [];
  if (!nested.length) {
    return containerShellPaddingPx(widget) + 120;
  }
  const hasHeader = Boolean(String(widget.title || "").trim() || String(widget.description || "").trim());
  const pad = resolveWidgetSpacingPx(widget.style, "padding", 12);
  const shellVerticalPad = pad.top + pad.bottom;
  const nestedInnerPad = containerNestedInnerPaddingPx(widget, { forPhone: false });
  const children = Array.isArray(allWidgets)
    ? allWidgets.filter(
      (child) => String(child.containerId || child.sectionId || "") === String(widget.id || ""),
    )
    : [];
  const nestedContentPx = computeNestedContentPixelHeight(nested);
  const headerPx = hasHeader ? CONTAINER_HEADER_PX : 0;
  return shellVerticalPad + nestedInnerPad + nestedContentPx + headerPx + CONTAINER_HEIGHT_BUFFER;
}

export function containerAutoGridHeight(widget = {}, nestedOverride = null, options = {}) {
  const nested = nestedOverride || widget.nestedLayout || [];
  if (!nested.length) return 2;
  const trailingGapPx = options.trailingGapPx ?? LIVE_CONTAINER_ROW_GAP_PX;
  const allWidgets = options.allWidgets || null;
  const outerPx = computeContainerOuterPixelHeight(widget, nested, allWidgets)
    + Math.max(0, Number(trailingGapPx) || 0);
  return pixelToMainGridH(outerPx);
}

function layoutItemsCollide(a, b) {
  const ax1 = Number(a.x) || 0;
  const ax2 = ax1 + Math.max(1, Number(a.w) || 1);
  const bx1 = Number(b.x) || 0;
  const bx2 = bx1 + Math.max(1, Number(b.w) || 1);
  if (ax2 <= bx1 || bx2 <= ax1) return false;

  const ay1 = Number(a.y) || 0;
  const ay2 = ay1 + Math.max(1, Number(a.h) || 1);
  const by1 = Number(b.y) || 0;
  const by2 = by1 + Math.max(1, Number(b.h) || 1);
  return !(ay2 <= by1 || by2 <= ay1);
}

/** Builder + live: manual/locked containers keep saved height; others hug nested content. */
export function resolveContainerDisplayHeight(widget = {}, layoutItem = {}, allWidgets = null) {
  if (shouldPreserveSavedLayout(widget)) {
    const { heightPx } = readWidgetLayoutPixels(widget);
    if (heightPx != null) {
      return pixelToMainGridH(heightPx);
    }
    return Math.max(1, Number(layoutItem.h ?? widget.layout?.h) || 1);
  }
  const nested = allWidgets
    ? buildNestedLayoutFromChildren(widget, allWidgets)
    : (widget.nestedLayout || []);
  return containerAutoGridHeight(widget, nested, { allWidgets });
}

/** Container height = nested widgets only unless designer locked a taller shell. */
export function resolveLiveContainerDisplayHeight(widget = {}, layoutItem = {}, allWidgets = null) {
  if (shouldPreserveSavedLayout(widget)) {
    const { heightPx } = readWidgetLayoutPixels(widget);
    if (heightPx != null) {
      return Math.max(
        pixelToMainGridH(heightPx),
        Math.max(1, Number(layoutItem.h ?? widget.layout?.h) || 1),
      );
    }
    return Math.max(1, Number(layoutItem.h ?? widget.layout?.h) || 1);
  }
  const nested = allWidgets
    ? buildNestedLayoutForLiveDisplay(widget, allWidgets)
    : (widget.nestedLayout || []);
  return containerAutoGridHeight(widget, nested, { allWidgets });
}

const defaultNestedWidthForType = (rawType = "kpi") => {
  if (rawType === "kpi") return 4;
  if (rawType === "heading") return 12;
  if (rawType === "table" || rawType === "graph") return 12;
  return 6;
};

/** Normalize nested layout coords without changing saved w/h semantics. */
export function sanitizeNestedLayoutItems(nestedLayout = []) {
  if (!Array.isArray(nestedLayout)) return [];
  return nestedLayout.map((item) => ({
    i: String(item.i),
    x: Math.max(0, Number(item.x) || 0),
    y: Math.max(0, Number(item.y) || 0),
    w: Math.max(1, Number(item.w) || 1),
    h: Math.max(1, Number(item.h) || 1),
  }));
}

export function isNestedLayoutCorrupt(nestedLayout = []) {
  if (!nestedLayout.length) return false;
  const rowMap = new Map();
  nestedLayout.forEach((item) => {
    const rowY = Number(item.y) || 0;
    if (!rowMap.has(rowY)) rowMap.set(rowY, []);
    rowMap.get(rowY).push(item);
  });
  for (const rowItems of rowMap.values()) {
    if (rowItems.length > 1 && rowItems.every((item) => Number(item.w) <= 1)) {
      return true;
    }
  }
  return false;
}

/** Fix corrupted clone layouts where KPI cards were squished to w=1. */
export function repairNestedLayoutItems(nestedLayout = [], children = []) {
  if (!Array.isArray(nestedLayout) || !nestedLayout.length) return [];
  const childById = new Map((children || []).map((child) => [String(child.id), child]));
  const items = sanitizeNestedLayoutItems(nestedLayout);

  const rowMap = new Map();
  items.forEach((item) => {
    const rowY = item.y;
    if (!rowMap.has(rowY)) rowMap.set(rowY, []);
    rowMap.get(rowY).push(item);
  });

  rowMap.forEach((rowItems) => {
    if (rowItems.length === 1) {
      return;
    }

    const allTooNarrow = rowItems.every((item) => Number(item.w) <= 1);
    if (!allTooNarrow) return;

    const slotW = Math.max(1, Math.floor(12 / rowItems.length));
    let nextX = 0;
    rowItems
      .sort((a, b) => (Number(a.x) || 0) - (Number(b.x) || 0))
      .forEach((item) => {
        item.w = slotW;
        item.x = nextX;
        nextX += slotW;
      });
  });

  return items;
}

export function phoneContainerPaddingPx(widget = {}) {
  const padTop = Number(widget.mobilePaddingTop ?? widget.style?.mobilePaddingTop ?? 8) || 0;
  const padBottom = Number(widget.mobilePaddingBottom ?? widget.style?.mobilePaddingBottom ?? 8) || 0;
  return padTop + padBottom;
}

/** Inner padding around nested grid inside container shell (desktop builder/live uses 0). */
export function containerNestedInnerPaddingPx(widget = {}, { forPhone = false } = {}) {
  if (!forPhone) return 0;
  return phoneContainerPaddingPx(widget);
}

export function phoneContainerAutoGridHeight(widget = {}) {
  const nested = resolvePhoneNestedLayoutForDisplay(
    widget.nestedLayout || [],
    widget.mobileNestedLayout || [],
  );
  const hasHeader = Boolean(String(widget.title || "").trim() || String(widget.description || "").trim());
  return nestedLayoutToGridHeight(nested, {
    minRows: 1,
    headerRows: hasHeader ? 1 : 0,
    bufferRows: 0,
    paddingPx: phoneContainerPaddingPx(widget),
  });
}

/** Live phone: saved builder height, but never taller than nested content (no empty shell). */
export function fitPhoneContainerGridHeight(widget = {}, layoutItem = {}) {
  const autoH = phoneContainerAutoGridHeight(widget);
  const savedH = Math.max(1, Number(layoutItem.h) || autoH);
  return Math.max(1, Math.min(savedH, autoH));
}

export function syncAllContainerHeights(widgets = [], layout = [], mobileLayout = [], options = {}) {
  const {
    preserveMobileContainerHeights = false,
    syncSurface = "both",
    manualSizedContainerIds = null,
  } = options;
  const containers = widgets.filter((widget) => widget.rawType === "container");
  if (!containers.length) return { layout, mobileLayout };

  let nextLayout = [...layout];
  let nextMobile = [...mobileLayout];
  const touchDesktop = syncSurface === "both" || syncSurface === "desktop";
  const touchMobile = syncSurface === "both" || syncSurface === "mobile";
  const manualIds = manualSizedContainerIds instanceof Set ? manualSizedContainerIds : new Set();

  containers.forEach((container) => {
    const containerId = String(container.id);
    const layoutLocked = isContainerLayoutLocked(container);
    const skipManualDesktop = touchDesktop && (manualIds.has(containerId) || layoutLocked);
    const skipManualMobile = touchMobile && (manualIds.has(containerId) || layoutLocked);
    const autoH = containerAutoGridHeight(
      container,
      buildNestedLayoutFromChildren(container, widgets),
      { allWidgets: widgets },
    );
    const autoMobileH = containerAutoGridHeight(
      { ...container, nestedLayout: container.mobileNestedLayout?.length ? container.mobileNestedLayout : container.nestedLayout },
      buildNestedLayoutFromChildren(
        { ...container, nestedLayout: container.mobileNestedLayout?.length ? container.mobileNestedLayout : container.nestedLayout },
        widgets,
      ),
      { allWidgets: widgets },
    );

    if (touchDesktop && !skipManualDesktop) {
      nextLayout = nextLayout.map((item) =>
        String(item.i) === containerId
          ? { ...item, h: resolveContainerGridHeight(autoH, item.h, { locked: false }) }
          : item,
      );
      if (!nextLayout.some((item) => String(item.i) === containerId)) {
        nextLayout.push({
          ...(container.layout || {}),
          i: containerId,
          h: resolveContainerGridHeight(autoH, container.layout?.h, { locked: false }),
        });
      }
    }

    if (touchMobile && !preserveMobileContainerHeights && !skipManualMobile) {
      nextMobile = nextMobile.map((item) =>
        String(item.i) === containerId
          ? {
              ...item,
              h: resolveContainerGridHeight(autoMobileH, item.h, { locked: false }),
            }
          : item,
      );
      if (!nextMobile.some((item) => String(item.i) === containerId)) {
        nextMobile.push({
          ...(container.mobileLayout || container.layout || {}),
          i: containerId,
          h: resolveContainerGridHeight(autoMobileH, container.mobileLayout?.h ?? container.layout?.h, { locked: false }),
        });
      }
    }
  });

  return { layout: nextLayout, mobileLayout: nextMobile };
}

export function hydrateContainerNestedLayouts(widgets = []) {
  const containers = widgets.filter((widget) => widget.rawType === "container");
  if (!containers.length) return widgets;

  const reconcileNested = (children = [], existingNested = [], pickLayout) => {
    const childById = new Map(children.map((child) => [String(child.id), child]));
    const ordered = [];

    (Array.isArray(existingNested) ? existingNested : []).forEach((item) => {
      const child = childById.get(String(item.i));
      if (!child) return;
      const layout = pickLayout(child, item);
      const nestedItem = {
        i: String(child.id),
        x: Math.max(0, Number(layout.x) || 0),
        y: Math.max(0, Number(layout.y) || 0),
        w: Math.max(1, Number(layout.w) || 3),
        h: Math.max(1, Number(layout.h) || 1),
      };
      ordered.push(nestedItem);
      childById.delete(String(child.id));
    });

    [...childById.values()].forEach((child, idx) => {
      const layout = pickLayout(child, {});
      ordered.push({
        i: String(child.id),
        x: Math.max(0, Number(layout.x) || 0),
        y: Math.max(0, Number(layout.y) || (ordered.length + idx) * 2),
        w: Math.max(1, Number(layout.w) || 3),
        h: Math.max(1, Number(layout.h) || 1),
      });
    });

    return ordered;
  };

  const pickNestedLayout = (child, item) =>
    mergeNestedItemFromChild(child, { ...item, i: String(child.id) });

  return widgets.map((widget) => {
    if (widget.rawType !== "container") return widget;
    const children = widgets.filter(
      (child) => String(child.containerId || child.sectionId) === String(widget.id),
    );
    const reconciledDesktop = reconcileNested(
      children,
      widget.nestedLayout,
      pickNestedLayout,
    );
    const reconciledMobile = reconcileNested(
      children,
      widget.mobileNestedLayout,
      (child, item) => pickNestedLayout(child, { ...(child.mobileLayout || child.layout || {}), ...item }),
    );
    const nestedLayout = isNestedLayoutCorrupt(reconciledDesktop)
      ? repairNestedLayoutItems(reconciledDesktop, children)
      : sanitizeNestedLayoutItems(reconciledDesktop);
    const mobileNestedLayout = isNestedLayoutCorrupt(reconciledMobile)
      ? repairNestedLayoutItems(reconciledMobile, children)
      : sanitizeNestedLayoutItems(reconciledMobile);

    return { ...widget, nestedLayout, mobileNestedLayout };
  });
}

/** Keep nested child layout coords aligned with the parent container nested_layout arrays. */
export function syncNestedChildLayoutsFromContainers(widgets = []) {
  const containerById = new Map(
    widgets.filter((widget) => widget.rawType === "container").map((widget) => [String(widget.id), widget]),
  );
  return widgets.map((widget) => {
    const parentId = String(widget.containerId || widget.sectionId || "");
    if (!parentId) return widget;
    const parent = containerById.get(parentId);
    if (!parent) return widget;
    const nestedItem = (parent.nestedLayout || []).find((item) => String(item.i) === String(widget.id));
    const mobileItem = (parent.mobileNestedLayout || []).find((item) => String(item.i) === String(widget.id));
    if (!nestedItem && !mobileItem) return widget;
    return {
      ...widget,
      ...(nestedItem ? { layout: { ...nestedItem } } : {}),
      ...(mobileItem ? { mobileLayout: { ...mobileItem } } : {}),
    };
  });
}

export function buildCanvasWidgetsWithContainers(widgets = []) {
  return widgets
    .filter((widget) => isTopLevelWidget(widget))
    .map((widget) => {
      if (widget.rawType !== "container") return widget;
      const sectionChildren = widgets.filter(
        (child) => String(child.containerId || child.sectionId) === String(widget.id),
      );
      const savedNested = Array.isArray(widget.nestedLayout) && widget.nestedLayout.length
        ? sanitizeNestedLayoutItems(widget.nestedLayout)
        : null;
      const nestedLayout = savedNested || buildNestedLayoutFromChildren(widget, widgets);
      return { ...widget, sectionChildren, nestedLayout };
    });
}

export function buildPhoneCanvasWidgets(widgets = []) {
  return buildCanvasWidgetsWithContainers(widgets).map((widget) => {
    if (widget.rawType !== "container") return widget;
    // Prefer already-resolved phone nested (from resolvePublishedPhoneNestedLayout),
    // then saved mobile_nested_layout, then desktop nested — never auto-stack published phone.
    const phoneNested = Array.isArray(widget.nestedLayout) && widget.nestedLayout.length
      ? widget.nestedLayout
      : (Array.isArray(widget.mobileNestedLayout) && widget.mobileNestedLayout.length
        ? widget.mobileNestedLayout
        : (widget.nestedLayout || []));
    return {
      ...widget,
      nestedLayout: phoneNested,
      mobileNestedLayout: Array.isArray(widget.mobileNestedLayout) && widget.mobileNestedLayout.length
        ? widget.mobileNestedLayout
        : phoneNested,
    };
  });
}

/** Phone live view / publish — saved mobile_layout only (laptop layout never mixed in). */
export function resolvePhoneTopLevelLayout(
  widgets = [],
  desktopLayout = [],
  mobileLayout = [],
  cols = GRID_COLS,
  fullMobileLayout = null,
) {
  return resolvePublishedPhoneLayout(widgets, mobileLayout, cols, fullMobileLayout);
}

export function finalizePublishMobileLayout(widgets = [], desktopLayout = [], mobileLayout = [], cols = GRID_COLS) {
  return resolvePhoneTopLevelLayout(widgets, desktopLayout, mobileLayout, cols);
}

export function finalizeContainerMobileNested(widget = {}) {
  if (widget.rawType !== "container") return widget.mobileNestedLayout || [];
  const savedMobile = Array.isArray(widget.mobileNestedLayout) ? widget.mobileNestedLayout : [];
  if (savedMobile.length) return savedMobile;
  return Array.isArray(widget.nestedLayout) ? widget.nestedLayout : [];
}

export function prepareLiveDashboardLayout(widgets = [], { isMobile = false } = {}) {
  const hydrated = hydrateContainerNestedLayouts(widgets);
  const topLevel = hydrated.filter((widget) => isTopLevelWidget(widget));
  const childWidgets = hydrated.filter((widget) => widget.containerId || widget.sectionId);

  const visibleTop = [];
  const desktopLayouts = [];
  const mobileLayouts = [];

  const sortedTop = [...topLevel].sort(
    (a, b) => (Number(a.layout?.y) || 0) - (Number(b.layout?.y) || 0)
      || (Number(a.layout?.x) || 0) - (Number(b.layout?.x) || 0),
  );

  for (const widget of sortedTop) {
    if (widget.rawType === "container") {
      const children = childWidgets.filter(
        (child) => String(child.containerId || child.sectionId) === String(widget.id),
      );
      if (!children.length) continue;

      const nestedSource = isMobile
        ? (widget.mobileNestedLayout?.length ? widget.mobileNestedLayout : widget.nestedLayout)
        : (widget.nestedLayout?.length ? widget.nestedLayout : widget.mobileNestedLayout);
      const childIds = new Set(children.map((child) => String(child.id)));
      const filteredNested = (nestedSource || []).filter((item) => childIds.has(String(item.i)));
      const fallbackNested = children.map((child, idx) => ({
        i: String(child.id),
        x: Number(child.layout?.x) || 0,
        y: Number(child.layout?.y) || idx * 2,
        w: Math.max(1, Number(child.layout?.w) || 3),
        h: Math.max(1, Number(child.layout?.h) || 2),
      }));
      const compactNested = filteredNested.length ? filteredNested : fallbackNested;
      const compactMobileNested = (widget.mobileNestedLayout || []).filter((item) => childIds.has(String(item.i))).length
          ? (widget.mobileNestedLayout || []).filter((item) => childIds.has(String(item.i)))
          : compactNested;
      const locked = isContainerLayoutLocked(widget);
      const containerH = resolveContainerGridHeight(
        nestedLayoutToGridHeight(compactNested),
        widget.layout?.h,
        { locked },
      );
      const containerMobileH = resolveContainerGridHeight(
        nestedLayoutToGridHeight(compactMobileNested),
        widget.mobileLayout?.h ?? widget.layout?.h,
        { locked },
      );

      visibleTop.push({
        ...widget,
        sectionChildren: children,
        nestedLayout: compactNested,
        mobileNestedLayout: compactMobileNested,
      });
      desktopLayouts.push({
        ...(widget.layout || {}),
        i: String(widget.id),
        h: containerH,
        ...normalizeContainerLayoutItem(widget, widget.layout || {}),
      });
      mobileLayouts.push({
        ...(widget.mobileLayout || widget.layout || {}),
        i: String(widget.id),
        x: 0,
        w: 12,
        h: containerMobileH,
      });
      continue;
    }

    visibleTop.push(widget);
    desktopLayouts.push({ ...(widget.layout || {}), i: String(widget.id) });
    mobileLayouts.push({
      ...(widget.mobileLayout || widget.layout || {}),
      i: String(widget.id),
    });
  }

  const packedDesktop = repackLayoutItems(desktopLayouts);
  const packedMobile = repackLayoutItems(mobileLayouts);

  return {
    widgets: visibleTop,
    layout: packedDesktop,
    mobileLayout: packedMobile,
  };
}
