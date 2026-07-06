const NESTED_ROW_HEIGHT = 48;
const NESTED_GAP = 8;
const MAIN_ROW_HEIGHT = 64;
const MAIN_GAP = 12;
const GRID_COLS = 12;

export function resolveContainerPreset(widget = {}, layoutItem = {}) {
  const preset = String(widget.containerPreset || widget.container_preset || "").trim().toLowerCase();
  if (preset === "half") return "half";
  if (preset === "full") return "full";
  const layoutW = Number(layoutItem?.w ?? widget.layout?.w);
  if (Number.isFinite(layoutW) && layoutW <= 6) return "half";
  return "full";
}

export function applyDesktopContainerLayout(widget = {}, layoutItem = {}, cols = GRID_COLS) {
  const containerLayout = normalizeContainerLayoutItem(widget, layoutItem, cols);
  return {
    ...layoutItem,
    x: containerLayout.x,
    w: containerLayout.w,
  };
}

export function normalizeContainerLayoutItem(widget = {}, layoutItem = {}, cols = GRID_COLS) {
  const preset = resolveContainerPreset(widget, layoutItem);
  const width = preset === "half" ? 6 : cols;
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
      const nested = widget.mobileNestedLayout?.length
        ? widget.mobileNestedLayout
        : (widget.nestedLayout || []);
      const autoH = nestedLayoutToGridHeight(nested);
      h = resolveContainerGridHeight(autoH, item.h);
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

export function computeNestedGridPixelHeight(nestedLayout = [], { paddingPx = 32 } = {}) {
  if (!nestedLayout.length) return NESTED_ROW_HEIGHT * 3 + paddingPx;
  const maxExtent = nestedLayout.reduce(
    (max, item) => Math.max(max, (Number(item.y) || 0) + (Number(item.h) || 1)),
    0,
  );
  return Math.max(
    NESTED_ROW_HEIGHT * 3,
    maxExtent * (NESTED_ROW_HEIGHT + NESTED_GAP) - NESTED_GAP + paddingPx,
  );
}

export function nestedLayoutToGridHeight(nestedLayout = [], { minRows = 3, headerRows = 1, bufferRows = 1, paddingPx = 32 } = {}) {
  if (!nestedLayout.length) return minRows;
  const nestedPixelHeight = computeNestedGridPixelHeight(nestedLayout, { paddingPx });
  const mainCellStep = MAIN_ROW_HEIGHT + MAIN_GAP;
  const mainRows = Math.ceil(nestedPixelHeight / mainCellStep);
  return Math.max(minRows, mainRows + headerRows + bufferRows);
}

/** Keep manual container height when larger than auto-calculated content height. */
export function resolveContainerGridHeight(autoH, currentH) {
  const auto = Math.max(1, Number(autoH) || 1);
  const current = Math.max(1, Number(currentH) || auto);
  return Math.max(auto, current);
}

export function phoneContainerPaddingPx(widget = {}) {
  const padTop = Number(widget.mobilePaddingTop ?? widget.style?.mobilePaddingTop ?? 8) || 0;
  const padBottom = Number(widget.mobilePaddingBottom ?? widget.style?.mobilePaddingBottom ?? 8) || 0;
  return padTop + padBottom;
}

export function phoneContainerAutoGridHeight(widget = {}) {
  const nested = widget.mobileNestedLayout?.length
    ? widget.mobileNestedLayout
    : stackNestedLayoutForPhone(widget.nestedLayout || []);
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
    const skipManualDesktop = touchDesktop && manualIds.has(containerId);
    const skipManualMobile = touchMobile && manualIds.has(containerId);
    const nested = container.nestedLayout || [];
    const mobileNested = container.mobileNestedLayout?.length ? container.mobileNestedLayout : nested;
    const autoH = nestedLayoutToGridHeight(nested);
    const autoMobileH = nestedLayoutToGridHeight(mobileNested, {
      minRows: 2,
      headerRows: 0,
      bufferRows: 0,
      paddingPx: 24,
    });

    if (touchDesktop && !skipManualDesktop) {
      nextLayout = nextLayout.map((item) =>
        String(item.i) === containerId
          ? { ...item, h: resolveContainerGridHeight(autoH, item.h) }
          : item,
      );
      if (!nextLayout.some((item) => String(item.i) === containerId)) {
        nextLayout.push({
          ...(container.layout || {}),
          i: containerId,
          h: resolveContainerGridHeight(autoH, container.layout?.h),
        });
      }
    }

    if (touchMobile && !preserveMobileContainerHeights && !skipManualMobile) {
      nextMobile = nextMobile.map((item) =>
        String(item.i) === containerId
          ? {
              ...item,
              h: resolveContainerGridHeight(autoMobileH, item.h),
              x: 0,
              w: 12,
            }
          : item,
      );
      if (!nextMobile.some((item) => String(item.i) === containerId)) {
        nextMobile.push({
          ...(container.mobileLayout || container.layout || {}),
          i: containerId,
          h: resolveContainerGridHeight(autoMobileH, container.mobileLayout?.h ?? container.layout?.h),
          x: 0,
          w: 12,
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
        x: Number.isFinite(Number(item?.x)) ? Number(item.x) : (Number(layout.x) || 0),
        y: Number.isFinite(Number(item?.y)) ? Number(item.y) : (Number(layout.y) || 0),
        w: Math.max(1, Number.isFinite(Number(item?.w)) ? Number(item.w) : (Number(layout.w) || 3)),
        h: Math.max(1, Number.isFinite(Number(item?.h)) ? Number(item.h) : (Number(layout.h) || 2)),
      };
      ordered.push(nestedItem);
      childById.delete(String(child.id));
    });

    [...childById.values()].forEach((child, idx) => {
      const layout = pickLayout(child, {});
      ordered.push({
        i: String(child.id),
        x: Number(layout.x) || 0,
        y: Number(layout.y) || (ordered.length + idx) * 2,
        w: Math.max(1, Number(layout.w) || 3),
        h: Math.max(1, Number(layout.h) || 2),
      });
    });

    return ordered;
  };

  return widgets.map((widget) => {
    if (widget.rawType !== "container") return widget;
    const children = widgets.filter(
      (child) => String(child.containerId || child.sectionId) === String(widget.id),
    );
    const nestedLayout = reconcileNested(
      children,
      widget.nestedLayout,
      (child, item) => ({ ...item, ...(child.layout || {}) }),
    );
    const mobileNestedLayout = reconcileNested(
      children,
      widget.mobileNestedLayout,
      (child, item) => ({ ...item, ...(child.mobileLayout || child.layout || {}) }),
    );

    return { ...widget, nestedLayout, mobileNestedLayout };
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
      return { ...widget, sectionChildren };
    });
}

export function buildPhoneCanvasWidgets(widgets = []) {
  return buildCanvasWidgetsWithContainers(widgets).map((widget) => {
    if (widget.rawType !== "container") return widget;
    const desktopNested = widget.nestedLayout || [];
    const phoneNested = hasCustomMobileNestedLayout(desktopNested, widget.mobileNestedLayout || [])
      ? (widget.mobileNestedLayout || [])
      : stackNestedLayoutForPhone(
          widget.mobileNestedLayout?.length ? widget.mobileNestedLayout : desktopNested,
        );
    return { ...widget, nestedLayout: phoneNested };
  });
}

/** Phone live view / publish — custom mobile layout preserve; auto-stack sirf jab custom na ho. */
export function resolvePhoneTopLevelLayout(widgets = [], desktopLayout = [], mobileLayout = [], cols = GRID_COLS) {
  const topLevel = (widgets || []).filter((widget) => isTopLevelWidget(widget));
  const widgetIds = topLevel.map((widget) => String(widget.id));

  const desktopItems = widgetIds.map((id) => {
    const item = (desktopLayout || []).find((entry) => String(entry.i) === id);
    const widget = topLevel.find((entry) => String(entry.id) === id);
    return { ...(item || widget?.layout || {}), i: id };
  });

  if (!mobileLayout?.length || !hasCustomTopLevelMobileLayout(desktopLayout, mobileLayout)) {
    return stackLayoutForPhone(topLevel, desktopItems, cols);
  }

  const resolved = widgetIds.map((id) => {
    const mobileItem = (mobileLayout || []).find((entry) => String(entry.i) === id);
    const widget = topLevel.find((entry) => String(entry.id) === id);
    const fallback = desktopItems.find((entry) => String(entry.i) === id) || widget?.mobileLayout || widget?.layout || {};
    const source = mobileItem || fallback;
    if (widget?.rawType === "container") {
      return { ...source, i: id, x: 0, w: cols };
    }
    return { ...source, i: id };
  });

  return repackLayoutItems(resolved);
}

export function finalizePublishMobileLayout(widgets = [], desktopLayout = [], mobileLayout = [], cols = GRID_COLS) {
  return resolvePhoneTopLevelLayout(widgets, desktopLayout, mobileLayout, cols);
}

export function finalizeContainerMobileNested(widget = {}) {
  if (widget.rawType !== "container") return widget.mobileNestedLayout || [];
  if (hasCustomMobileNestedLayout(widget.nestedLayout || [], widget.mobileNestedLayout || [])) {
    return widget.mobileNestedLayout || [];
  }
  return stackNestedLayoutForPhone(widget.nestedLayout || []);
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
      const compactNested = repackLayoutItems(filteredNested.length ? filteredNested : fallbackNested);
      const compactMobileNested = repackLayoutItems(
        (widget.mobileNestedLayout || []).filter((item) => childIds.has(String(item.i))).length
          ? (widget.mobileNestedLayout || []).filter((item) => childIds.has(String(item.i)))
          : compactNested,
      );
      const containerH = resolveContainerGridHeight(
        nestedLayoutToGridHeight(compactNested),
        widget.layout?.h,
      );
      const containerMobileH = resolveContainerGridHeight(
        nestedLayoutToGridHeight(compactMobileNested),
        widget.mobileLayout?.h ?? widget.layout?.h,
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
