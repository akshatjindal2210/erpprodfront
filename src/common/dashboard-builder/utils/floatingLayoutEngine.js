/** Pixel-based floating layout — no grid columns in builder. */
export const FLOAT_GAP = 8;
/** Outer phone chrome width (includes bezel border). */
export const PHONE_OUTER_WIDTH = 390;
/** `border-4` on each side — content box is outer minus this. */
export const PHONE_BEZEL_BORDER = 4;
/** Visible phone canvas width inside the bezel (390 - 4 - 4). */
export const PHONE_CONTENT_WIDTH = PHONE_OUTER_WIDTH - PHONE_BEZEL_BORDER * 2;
/** Fixed laptop design canvas — builder + publish reference width (fits all laptop screens via scale). */
export const LAPTOP_DESIGN_CANVAS_WIDTH = 1366;
/** Equal gap from every edge of the laptop canvas (builder + publish). */
export const LAPTOP_CANVAS_INSET = 8;

/** Snap scale to device pixels so scaled text/widgets stay sharp (avoids blur from sub-pixel transform). */
export function snapCanvasFitScale(rawScale) {
  const raw = Math.max(0.05, Number(rawScale) || 0.05);
  if (typeof window === "undefined") return raw;
  const dpr = window.devicePixelRatio || 1;
  return Math.max(0.05, Math.round(raw * dpr * 500) / (dpr * 500));
}
/** Phone side gutter — slight equal gap (≈4px), not edge-to-edge. */
export const PHONE_FRAME_INSET = 4;
/** Inner gutter inside container widgets — stops nested cards clipping on right/bottom edges. */
export const CONTAINER_NESTED_INSET = 6;
export const DEFAULT_KPI_BOX = { left: 0, top: 0, width: 168, height: 64 };
export const DEFAULT_TABLE_BOX = { left: 0, top: 0, width: 320, height: 160 };
export const DEFAULT_HEADING_BOX = { left: 0, top: 0, width: 240, height: 36 };
export const DEFAULT_TOP_KPI_BOX = { left: 12, top: 12, width: 200, height: 72 };
export const DEFAULT_TOP_TABLE_BOX = { left: 12, top: 12, width: 640, height: 220 };
export const DEFAULT_TOP_HEADING_BOX = { left: 12, top: 12, width: 640, height: 40 };
export const DEFAULT_TOP_CONTAINER_BOX = { left: 12, top: 12, width: 800, height: 280 };

export function normalizeBox(raw = {}) {
  return {
    left: Math.max(0, Math.round(Number(raw.left ?? raw.x) || 0)),
    top: Math.max(0, Math.round(Number(raw.top ?? raw.y) || 0)),
    width: Math.max(40, Math.round(Number(raw.width ?? raw.w) || DEFAULT_KPI_BOX.width)),
    height: Math.max(32, Math.round(Number(raw.height ?? raw.h) || DEFAULT_KPI_BOX.height)),
  };
}

export function defaultBoxForType(rawType = "kpi") {
  if (rawType === "table" || rawType === "graph" || rawType === "hybrid") return { ...DEFAULT_TABLE_BOX };
  if (rawType === "heading") return { ...DEFAULT_HEADING_BOX };
  return { ...DEFAULT_KPI_BOX };
}

export function defaultTopLevelBoxForType(rawType = "kpi", containerPreset = "full", canvasWidth = 1200) {
  const pad = LAPTOP_CANVAS_INSET;
  const maxW = Math.max(160, Math.min(Number(canvasWidth) || 1200, 1600) - pad * 2);
  if (rawType === "container" || rawType === "section") {
    const width = containerPreset === "half"
      ? Math.max(200, Math.floor((maxW - FLOAT_GAP) / 2))
      : Math.min(720, maxW);
    return { left: pad, top: pad, width, height: DEFAULT_TOP_CONTAINER_BOX.height };
  }
  if (rawType === "table" || rawType === "graph" || rawType === "hybrid") {
    return {
      left: pad,
      top: pad,
      width: Math.min(DEFAULT_TOP_TABLE_BOX.width, maxW),
      height: DEFAULT_TOP_TABLE_BOX.height,
    };
  }
  if (rawType === "heading") {
    // Sensible title width — not full canvas (avoids a giant first heading).
    return { left: pad, top: pad, width: Math.min(420, maxW), height: DEFAULT_TOP_HEADING_BOX.height };
  }
  return {
    left: pad,
    top: pad,
    width: Math.min(DEFAULT_TOP_KPI_BOX.width, maxW),
    height: DEFAULT_TOP_KPI_BOX.height,
  };
}

export function gridItemToBoxPx(item = {}, metrics = {}) {
  const colWidth = Number(metrics.colWidth) || 80;
  const rowHeight = Number(metrics.rowHeight) || 64;
  const gapX = Number(metrics.gapX) || 12;
  const gapY = Number(metrics.gapY) || 12;
  const x = Number(item.x) || 0;
  const y = Number(item.y) || 0;
  const w = Math.max(1, Number(item.w) || 1);
  const h = Math.max(1, Number(item.h) || 1);
  return normalizeBox({
    left: x * (colWidth + gapX),
    top: y * (rowHeight + gapY),
    width: w * colWidth + (w - 1) * gapX,
    height: h * rowHeight + (h - 1) * gapY,
  });
}

export function boxesFromTopLevelWidgets(widgets = [], layoutPx = [], gridLayout = [], metrics = {}) {
  const topLevel = (widgets || []).filter((widget) => !widget.containerId && !widget.sectionId);
  const byId = new Map((layoutPx || []).map((item) => [String(item.i), normalizeBox(item)]));
  const gridById = new Map((gridLayout || []).map((item) => [String(item.i), item]));
  const canvasWidth = Number(metrics.canvasWidth) || 1200;

  return topLevel.map((widget, idx) => {
    const matched = byId.get(String(widget.id));
    if (matched) return { i: String(widget.id), ...matched };
    const fromStyle = widget.style?.boxPx;
    if (fromStyle && Number.isFinite(Number(fromStyle.width))) {
      return { i: String(widget.id), ...normalizeBox(fromStyle) };
    }
    const gridItem = gridById.get(String(widget.id)) || widget.layout;
    if (gridItem && Number.isFinite(Number(gridItem.w))) {
      return { i: String(widget.id), ...gridItemToBoxPx(gridItem, metrics) };
    }
    const base = defaultTopLevelBoxForType(widget.rawType || widget.type, widget.containerPreset, canvasWidth);
    return {
      i: String(widget.id),
      ...base,
      left: padOffset(idx, base.width),
      top: padOffsetRow(idx, base.height),
    };
  });
}

function padOffset(idx, width) {
  return 12 + (idx % 2) * (width + FLOAT_GAP);
}

function padOffsetRow(idx, height) {
  return 12 + Math.floor(idx / 2) * (height + FLOAT_GAP);
}

export function containerShellHeightFromNested(nestedBoxes = [], shellPadding = 24, minHeight = 120) {
  const inner = containerContentHeightPx(nestedBoxes, 8);
  return Math.max(minHeight, inner + shellPadding);
}

export function readWidgetBoxPx(widget = {}, idx = 0) {
  const fromStyle = widget.style?.boxPx || widget.boxPx;
  if (fromStyle && Number.isFinite(Number(fromStyle.width))) {
    return normalizeBox(fromStyle);
  }
  const fromLayout = widget.layout?.boxPx;
  if (fromLayout && Number.isFinite(Number(fromLayout.width))) {
    return normalizeBox(fromLayout);
  }
  const nested = Array.isArray(widget.nestedLayoutPx)
    ? widget.nestedLayoutPx.find((item) => String(item.i) === String(widget.id))
    : null;
  if (nested) return normalizeBox(nested);
  const base = defaultBoxForType(widget.rawType || widget.type);
  return {
    ...base,
    left: (idx % 3) * (base.width + FLOAT_GAP),
    top: Math.floor(idx / 3) * (base.height + FLOAT_GAP),
  };
}

export function boxesFromChildren(childWidgets = [], nestedLayoutPx = []) {
  const byId = new Map(
    (nestedLayoutPx || []).map((item) => [String(item.i), normalizeBox(item)]),
  );
  return childWidgets.map((child, idx) => {
    const matched = byId.get(String(child.id));
    return {
      i: String(child.id),
      ...(matched || readWidgetBoxPx(child, idx)),
    };
  });
}

/**
 * Ensure every top-level widget has a pixel box (layout_px + style.boxPx fallback).
 * @param {object} [options]
 * @param {number} [options.maxWidth] When set (e.g. phone 390), never fall back to desktop
 *   style.boxPx that is wider than the frame — that used to inflate design width and
 *   collapse CSS fitScale (squashed phone view / huge jump on select).
 */
export function resolveTopLevelBoxes(topLevelWidgets = [], layoutPx = [], options = {}) {
  const maxWidth = Number(options?.maxWidth);
  const phoneMode = options?.phoneMode === true;
  const clampFrame = Number.isFinite(maxWidth) && maxWidth >= 200;
  const phoneSafe = clampFrame && phoneMode;
  const inset = phoneSafe ? PHONE_FRAME_INSET : 0;
  const maxInner = phoneSafe ? Math.max(40, maxWidth - inset * 2) : null;
  const byId = new Map(
    sanitizeNestedLayoutPx(layoutPx).map((item) => [String(item.i), normalizeBox(item)]),
  );
  const placed = [];
  const resolved = topLevelWidgets.map((widget, idx) => {
    const id = String(widget.id);
    const matched = byId.get(id);
    if (matched) {
      let box = { i: id, ...matched };
      if (phoneSafe && box.width > maxInner) {
        box = {
          ...box,
          width: maxInner,
          left: Math.min(Math.max(inset, box.left), Math.max(inset, maxWidth - inset - maxInner)),
        };
      }
      placed.push(box);
      return box;
    }
    const fromStyle = widget.style?.boxPx;
    if (
      fromStyle
      && Number.isFinite(Number(fromStyle.width))
      && !(phoneSafe && Number(fromStyle.width) > maxInner + 8)
    ) {
      const box = { i: id, ...normalizeBox(fromStyle) };
      placed.push(box);
      return box;
    }
    // Phone: place a frame-sized default below existing content (never leak desktop 640px tables).
    const base = phoneSafe
      ? defaultTopLevelBoxForType(widget.rawType || widget.type, widget.containerPreset, maxWidth)
      : readWidgetBoxPx(widget, idx);
    if (phoneSafe) {
      base.width = Math.min(base.width, maxInner);
    }
    // Never default-stack on top of existing widgets (hides tables under containers on live).
    const box = { i: id, ...placeNextBoxPx(placed, base, clampFrame ? maxWidth : null) };
    if (phoneSafe) {
      box.width = Math.min(box.width, maxInner);
      box.left = Math.min(Math.max(inset, box.left), Math.max(inset, maxWidth - inset - box.width));
    }
    placed.push(box);
    return box;
  });
  if (phoneSafe) return equalizePhoneSideGutters(resolved, maxWidth, inset);
  if (clampFrame && !phoneMode) return clampLayoutPxToLaptopFrame(resolved, maxWidth, LAPTOP_CANVAS_INSET);
  return resolved;
}

/**
 * Keep phone floating layout complete + clamped to the phone frame.
 * Existing mobile boxes are preserved (clamped); widgets missing from mobilePx
 * (e.g. added on laptop after phone was customized) get a phone-safe box stacked below.
 */
export function ensurePhoneLayoutPx(
  topLevelWidgets = [],
  mobilePx = [],
  { phoneWidth = 390, desktopPx = [], equalize = true } = {},
) {
  const width = Math.max(200, Number(phoneWidth) || 390);
  const inset = PHONE_FRAME_INSET;
  const maxInner = Math.max(40, width - inset * 2);
  const existing = fitNestedLayoutPxToWidth(sanitizeNestedLayoutPx(mobilePx), width, inset);
  const existingIds = new Set(existing.map((box) => String(box.i)));
  const desktopById = new Map(
    sanitizeNestedLayoutPx(desktopPx).map((item) => [String(item.i), normalizeBox(item)]),
  );
  const placed = existing.map((box) => ({ ...box }));

  (topLevelWidgets || []).forEach((widget) => {
    if (!widget || widget.containerId || widget.sectionId) return;
    const id = String(widget.id);
    if (existingIds.has(id)) return;
    const desk = desktopById.get(id);
    const base = desk
      ? {
          left: inset,
          top: inset,
          width: Math.min(Math.max(40, desk.width), maxInner),
          height: Math.max(32, desk.height),
        }
      : defaultTopLevelBoxForType(widget.rawType || widget.type, widget.containerPreset, width);
    base.width = Math.min(Math.max(40, base.width), maxInner);
    const next = placeNextBoxPx(placed, base, width);
    next.width = Math.min(next.width, maxInner);
    next.left = Math.min(Math.max(inset, next.left), Math.max(inset, width - inset - next.width));
    placed.push({ i: id, ...normalizeBox(next) });
    existingIds.add(id);
  });

  return equalize
    ? equalizePhoneSideGutters(placed, width, inset)
    : fitNestedLayoutPxToWidth(placed, width, inset);
}

/**
 * Complete phone nested layout inside a container shell.
 * Keeps saved mobile nested boxes; scales/stacks missing children from desktop nested px.
 */
export function ensureNestedPhoneLayoutPx(
  children = [],
  mobilePx = [],
  desktopPx = [],
  containerWidth = 360,
) {
  const width = Math.max(40, Number(containerWidth) || 360);
  const existing = fitNestedLayoutPxToWidth(sanitizeNestedLayoutPx(mobilePx), width, 0);
  const existingIds = new Set(existing.map((box) => String(box.i)));
  const desktopList = sanitizeNestedLayoutPx(desktopPx);
  const desktopById = new Map(desktopList.map((item) => [String(item.i), normalizeBox(item)]));
  const desktopSpan = Math.max(40, contentBoundsPx(desktopList, 8).width);
  const scale = desktopSpan > width + 8 ? width / desktopSpan : 1;
  const placed = existing.map((box) => ({ ...box }));

  (children || []).forEach((child) => {
    const id = String(child.id);
    if (existingIds.has(id)) return;
    const desk = desktopById.get(id);
    let base;
    if (desk) {
      base = normalizeBox({
        left: Math.max(0, Math.round(desk.left * scale)),
        top: Math.max(0, desk.top),
        width: Math.max(40, Math.round(desk.width * scale)),
        height: Math.max(32, desk.height),
      });
      base.width = Math.min(base.width, width);
    } else {
      base = defaultBoxForType(child.rawType || child.type);
      base.width = Math.min(base.width, width);
    }
    const next = placeNextBoxPx(placed, base, width);
    placed.push({ i: id, ...normalizeBox(next) });
    existingIds.add(id);
  });

  return fitNestedLayoutPxToWidth(placed, width, 0);
}

/** Phone nested display — auto-scale from laptop when phone nested was never customized. */
export function resolvePhoneNestedLayoutPx(
  children = [],
  desktopPx = [],
  mobilePx = [],
  containerWidth = 360,
  { phoneNestedCustomized = false } = {},
) {
  const width = Math.max(40, Number(containerWidth) || 360);
  const desktopList = sanitizeNestedLayoutPx(desktopPx);
  const mobileList = sanitizeNestedLayoutPx(mobilePx);
  if (phoneNestedCustomized && mobileList.length) {
    return ensureNestedPhoneLayoutPx(children, mobileList, desktopList, width);
  }
  if (!desktopList.length) return mobileList;
  const fromW = Math.max(40, contentBoundsPx(desktopList, 8).width);
  const scaled = scaleLayoutPx(desktopList, fromW, width);
  return ensureNestedPhoneLayoutPx(children, scaled, desktopList, width);
}

export function scaleLayoutPx(items = [], fromWidth, toWidth) {
  const from = Number(fromWidth);
  const to = Number(toWidth);
  const normalized = sanitizeNestedLayoutPx(items);
  if (!normalized.length || !Number.isFinite(from) || !Number.isFinite(to) || from < 200 || to < 200) {
    return normalized;
  }
  if (Math.abs(from - to) < 8) {
    const maxRight = normalized.reduce((max, box) => Math.max(max, box.left + box.width), 0);
    if (maxRight <= to + 48) return normalized;
    // Phone-sized target: keep equal gutters. Wider targets: only clamp overflow.
    return to <= 420
      ? equalizePhoneSideGutters(normalized, to, PHONE_FRAME_INSET)
      : fitNestedLayoutPxToWidth(normalized, to, 0);
  }
  const s = to / from;
  const scaled = normalized.map((item) => ({
    i: item.i,
    left: Math.max(0, Math.round(item.left * s)),
    top: Math.max(0, Math.round(item.top * s)),
    width: Math.max(40, Math.round(item.width * s)),
    height: Math.max(32, Math.round(item.height * s)),
  }));
  if (to <= 420) {
    return equalizePhoneSideGutters(scaled, to, PHONE_FRAME_INSET);
  }
  return fitNestedLayoutPxToWidth(scaled, to, 0);
}

/** Stretch layout so the right edge meets targetWidth (published laptop edge-to-edge). */
export function stretchLayoutPxToWidth(items = [], targetWidth = 0) {
  const list = sanitizeNestedLayoutPx(items);
  const frame = Math.max(40, Math.round(Number(targetWidth) || 0));
  if (!list.length || frame < 200) return list;
  const maxRight = list.reduce((max, box) => Math.max(max, box.left + box.width), 0);
  if (maxRight <= 0 || frame - maxRight <= 2) return list;
  const s = frame / maxRight;
  return list.map((box) => ({
    i: box.i,
    left: Math.round(box.left * s),
    top: box.top,
    width: Math.max(40, Math.round(box.width * s)),
    height: box.height,
  }));
}

export function layoutPxFingerprint(items = []) {
  return sanitizeNestedLayoutPx(items)
    .map((item) => `${item.i}:${item.left},${item.top},${item.width},${item.height}`)
    .join("|");
}

/** True when every box fits inside the phone frame (corrupt laptop layout_px). */
export function isPhoneSizedLayoutPx(items = []) {
  const bounds = contentBoundsPx(sanitizeNestedLayoutPx(items), 0);
  return bounds.width > 0 && bounds.width <= PHONE_OUTER_WIDTH + 16;
}

/** Saved mobile layout still uses laptop-scale coordinates — must re-scale from desktop. */
export function isLaptopSizedLayoutPx(items = []) {
  const bounds = contentBoundsPx(sanitizeNestedLayoutPx(items), 0);
  return bounds.width > PHONE_OUTER_WIDTH + 48;
}

/** Build laptop top-level px from widget boxPx when layout_px is missing. */
export function desktopPxFromWidgetBoxPx(topLevelWidgets = []) {
  return sanitizeNestedLayoutPx(
    (topLevelWidgets || []).map((widget) => {
      const bp = widget?.style?.boxPx;
      if (!bp || !Number.isFinite(Number(bp.width))) return null;
      return { i: String(widget.id), ...normalizeBox(bp) };
    }).filter(Boolean),
  );
}

/** Laptop boxPx — wider than phone frame or extends past phone width. */
export function isLaptopBoxPx(boxPx = {}) {
  if (!Number.isFinite(Number(boxPx.width))) return false;
  const w = Number(boxPx.width);
  const right = Number(boxPx.left || 0) + w;
  return w > PHONE_OUTER_WIDTH + 16 || right > PHONE_OUTER_WIDTH + 16;
}

/** Widgets eligible for desktop layout_px merge — skips phone-only placements (no layout_px entry, no laptop boxPx). */
export function widgetsForDesktopLayoutMerge(widgets = [], layoutPx = []) {
  const desktopIds = new Set(
    sanitizeNestedLayoutPx(layoutPx).map((item) => String(item.i)),
  );
  return (widgets || []).filter((widget) => {
    if (widget?.containerId || widget?.sectionId) return false;
    const id = String(widget.id);
    if (desktopIds.has(id)) return true;
    const fromStyle = widget.style?.boxPx;
    return fromStyle
      && Number.isFinite(Number(fromStyle.width))
      && Number.isFinite(Number(fromStyle.left))
      && Number.isFinite(Number(fromStyle.top))
      && isLaptopBoxPx(fromStyle);
  });
}

/** Recover laptop layout_px from widget chart_config boxPx when layout_px was saved at phone width. */
export function recoverDesktopLayoutPxFromWidgets(widgets = [], layoutPx = []) {
  const normalized = sanitizeNestedLayoutPx(layoutPx);
  if (!isPhoneSizedLayoutPx(normalized)) return normalized;
  const topLevel = (widgets || []).filter((widget) => !widget?.containerId && !widget?.sectionId);
  const fromWidgets = topLevel
    .map((widget) => {
      const bp = widget.style?.boxPx;
      if (!isLaptopBoxPx(bp)) return null;
      return { i: String(widget.id), ...normalizeBox(bp) };
    })
    .filter(Boolean);
  if (!fromWidgets.length) return normalized;
  const recovered = sanitizeNestedLayoutPx(fromWidgets);
  if (!isPhoneSizedLayoutPx(recovered)) return recovered;
  return normalized;
}

/** Merge layout_px with per-widget style.boxPx so publish never drops moved positions.
 * layout_px / canvas commits are the source of truth; boxPx only fills missing ids. */
export function mergeLayoutPxFromWidgets(layoutPx = [], widgets = []) {
  const byId = new Map(
    sanitizeNestedLayoutPx(layoutPx).map((item) => [String(item.i), normalizeBox(item)]),
  );
  (widgets || []).forEach((widget) => {
    if (widget?.containerId || widget?.sectionId) return;
    const id = String(widget.id);
    if (byId.has(id)) return;
    const fromStyle = widget.style?.boxPx;
    if (fromStyle && Number.isFinite(Number(fromStyle.width))) {
      byId.set(id, normalizeBox(fromStyle));
      return;
    }
    byId.set(id, normalizeBox(readWidgetBoxPx(widget, byId.size)));
  });
  return sanitizeNestedLayoutPx(
    [...byId.entries()].map(([i, box]) => ({ i, ...box })),
  );
}

/** Shrink boxes so they stay inside a parent width.
 * pad>0 → equal left/right gutter (phone). pad=0 → only prevent right overflow (desktop/nested). */
export function fitNestedLayoutPxToWidth(items = [], parentWidth = 0, pad = 8) {
  const frame = Math.max(40, Number(parentWidth) || 0);
  if (!frame) return sanitizeNestedLayoutPx(items);
  const inset = Math.max(0, Number(pad) || 0);
  const maxW = Math.max(40, frame - inset * 2);
  const maxRight = frame - inset;
  return sanitizeNestedLayoutPx(items).map((item) => {
    let w = Math.min(Math.max(40, item.width), maxW);
    let left = Math.max(inset, item.left);
    if (left + w > maxRight) {
      left = Math.max(inset, maxRight - w);
    }
    if (left + w > maxRight) {
      w = Math.max(40, maxRight - left);
    }
    return { ...item, left, width: w };
  });
}

/** Keep laptop widgets/containers inside equal gaps on all sides (builder + publish). */
export function clampLayoutPxToLaptopFrame(
  items = [],
  canvasWidth = LAPTOP_DESIGN_CANVAS_WIDTH,
  inset = LAPTOP_CANVAS_INSET,
) {
  const frame = Math.max(200, Number(canvasWidth) || LAPTOP_DESIGN_CANVAS_WIDTH);
  const pad = Math.max(0, Number(inset) || 0);
  const maxW = Math.max(40, frame - pad * 2);
  const maxRight = frame - pad;
  // Preserve optional `i`, but still clamp anonymous boxes (e.g. clone candidates).
  const list = (Array.isArray(items) ? items : []).map((item) => {
    const box = normalizeBox(item || {});
    const id = String(item?.i ?? item?.id ?? "").trim();
    if (id && id !== "undefined" && id !== "null") return { i: id, ...box };
    return box;
  });
  return list.map((item) => {
    let width = Math.min(Math.max(40, item.width), maxW);
    let left = Math.max(pad, item.left);
    let top = Math.max(pad, item.top);
    if (left + width > maxRight) {
      left = Math.max(pad, maxRight - width);
    }
    if (left + width > maxRight) {
      width = Math.max(40, maxRight - left);
    }
    return { ...item, left, top, width };
  });
}

/**
 * Keep phone widgets inside the visible frame with matching left/right gutters.
 * Full-width widgets are pinned to inset on both sides (no flush-left / gap-right).
 * Pass inset=0 when CSS padding already provides the gutters (content-box coords).
 */
export function equalizePhoneSideGutters(items = [], phoneWidth = 390, inset = PHONE_FRAME_INSET) {
  const frame = Math.max(200, Number(phoneWidth) || 390);
  const pad = Number.isFinite(Number(inset)) ? Math.max(0, Number(inset)) : PHONE_FRAME_INSET;
  const maxW = Math.max(40, frame - pad * 2);
  const fitted = fitNestedLayoutPxToWidth(items, frame, pad);
  if (!fitted.length) return fitted;

  return fitted.map((box) => {
    let width = Math.min(Math.max(40, box.width), maxW);
    let left = Math.max(pad, box.left);
    // Near full-bleed → lock to equal gutters.
    if (width >= maxW - 12) {
      return { ...box, left: pad, width: maxW };
    }
    if (left + width > frame - pad) {
      left = Math.max(pad, frame - pad - width);
    }
    return { ...box, left, width };
  });
}

/**
 * Map saved phone boxes into the measured phone content width.
 * @param {{ fill?: boolean }} options
 *   fill=true  (live/publish): scale design → frame so wider phones have no empty right gutter.
 *   fill=false (builder edit): keep exact sizes; only clamp inside the frame with equal insets.
 *   Editing must NOT rescale siblings when one widget is resized.
 */
export function phoneContentBoxesFromFrame(
  items = [],
  contentWidth = PHONE_CONTENT_WIDTH,
  options = {},
) {
  const fill = options?.fill === true;
  const frame = Math.max(200, Number(contentWidth) || PHONE_CONTENT_WIDTH);
  const inset = PHONE_FRAME_INSET;
  const inner = Math.max(40, frame - inset * 2);
  const list = sanitizeNestedLayoutPx(items);
  if (!list.length) return list;

  if (!fill) {
    // Builder: preserve designer width/height/left/top — only keep inside gutters.
    return equalizePhoneSideGutters(list, frame, inset);
  }

  const minLeft = list.reduce((min, box) => Math.min(min, box.left), Infinity);
  const originX = Number.isFinite(minLeft) ? Math.max(0, minLeft) : 0;
  const shifted = list.map((box) => ({
    ...box,
    left: Math.max(0, box.left - originX),
  }));
  const maxRight = shifted.reduce((max, box) => Math.max(max, box.left + box.width), 0);
  const span = Math.max(40, maxRight);
  const scale = inner / span;

  const fitted = shifted.map((box) => ({
    ...box,
    left: Math.round(box.left * scale),
    width: Math.max(40, Math.round(box.width * scale)),
  }));

  return fitted.map((box) => {
    let width = Math.min(Math.max(40, box.width), inner);
    let left = inset + Math.max(0, box.left);
    if (width >= inner - 8) {
      return { ...box, left: inset, width: inner };
    }
    if (left + width > frame - inset) {
      left = Math.max(inset, frame - inset - width);
    }
    return { ...box, left, width };
  });
}

/**
 * Fit nested phone children inside a container width.
 * @param {{ fill?: boolean }} options
 *   fill=true  (live): scale children to fill container (up or down).
 *   fill=false (builder): keep exact sizes; only clamp overflow.
 */
export function fitNestedPhoneBoxes(items = [], containerWidth = 0, options = {}) {
  const fill = options?.fill === true;
  const frame = Math.max(40, Number(containerWidth) || 0);
  const list = sanitizeNestedLayoutPx(items);
  if (!list.length || frame < 40) return list;
  const pad = Number.isFinite(Number(options?.pad)) ? Math.max(0, Number(options.pad)) : PHONE_FRAME_INSET;
  const inner = Math.max(40, frame - pad * 2);

  if (!fill) {
    return fitNestedLayoutPxToWidth(list, frame, pad);
  }

  const minLeft = list.reduce((min, box) => Math.min(min, box.left), Infinity);
  const originX = Number.isFinite(minLeft) ? Math.max(0, minLeft) : 0;
  const shifted = list.map((box) => ({
    ...box,
    left: Math.max(0, box.left - originX),
  }));
  const maxRight = shifted.reduce((max, box) => Math.max(max, box.left + box.width), 0);
  const span = Math.max(40, maxRight);

  // Live phone: always map design span → container inner width.
  // Old early-return (span <= inner+48) only clamped and left ~350px widgets
  // with an empty right gutter when the real phone was wider than the builder frame.
  if (Math.abs(span - inner) < 2) {
    return fitNestedLayoutPxToWidth(
      shifted.map((box) => ({ ...box, left: pad + box.left })),
      frame,
      pad,
    );
  }

  const scale = inner / span;
  return shifted.map((box) => {
    const width = Math.max(32, Math.round(box.width * scale));
    let left = pad + Math.round(box.left * scale);
    if (width >= inner - 8) {
      return { ...box, left: pad, width: inner };
    }
    if (left + width > frame - pad) {
      left = Math.max(pad, frame - pad - width);
    }
    return { ...box, left, width: Math.min(width, inner) };
  });
}

/** Scale laptop nested coords into a phone container (side-by-side KPIs, etc.). */
export function fitNestedLayoutForPhoneEdit(items = [], containerWidth = 0) {
  const frame = Math.max(40, Number(containerWidth) || 0);
  const list = sanitizeNestedLayoutPx(items);
  if (!list.length || frame < 40) return list;
  const maxRight = list.reduce((max, box) => Math.max(max, box.left + box.width), 0);
  if (maxRight <= frame + 48) return list;
  return fitNestedPhoneBoxes(list, frame, { fill: true, pad: 0 });
}

export function contentBoundsPx(items = [], pad = 24) {
  const list = sanitizeNestedLayoutPx(items);
  if (!list.length) return { width: 1200, height: 400 };
  const maxRight = list.reduce((max, box) => Math.max(max, box.left + box.width), 0);
  const maxBottom = list.reduce((max, box) => Math.max(max, box.top + box.height), 0);
  return {
    width: Math.max(320, Math.round(maxRight + pad)),
    height: Math.max(240, Math.round(maxBottom + pad)),
  };
}

export function boxPxToGridItem(box = {}, id, metrics = {}) {
  const colWidth = Math.max(8, Number(metrics.colWidth) || 40);
  const rowHeight = Math.max(8, Number(metrics.rowHeight) || 64);
  const gapX = Number(metrics.gapX) || 0;
  const gapY = Number(metrics.gapY) || 0;
  const cols = Math.max(1, Number(metrics.cols) || 12);
  const b = normalizeBox(box);
  const stepX = colWidth + gapX;
  const stepY = rowHeight + gapY;
  const x = Math.max(0, Math.min(cols - 1, Math.round(b.left / stepX)));
  const y = Math.max(0, Math.round(b.top / stepY));
  const w = Math.max(1, Math.min(cols - x, Math.round((b.width + gapX) / stepX) || 1));
  const h = Math.max(1, Math.round((b.height + gapY) / stepY) || 1);
  return { i: String(id), x, y, w, h };
}

export function placeNextBoxPx(existing = [], nextBox = DEFAULT_KPI_BOX, canvasWidth = null) {
  const box = normalizeBox(nextBox);
  const pad = Number(canvasWidth) >= 200 ? LAPTOP_CANVAS_INSET : 12;
  const gap = FLOAT_GAP;
  const list = sanitizeNestedLayoutPx(existing);
  if (!list.length) return { ...box, left: pad, top: pad };

  const explicitWidth = Number.isFinite(Number(canvasWidth)) && Number(canvasWidth) >= 200
    ? Math.round(Number(canvasWidth))
    : 0;
  const inferredWidth = list.reduce((max, item) => Math.max(max, item.left + item.width), 0);
  const maxRight = explicitWidth >= 200
    ? explicitWidth - pad
    : Math.max(pad + 80, inferredWidth);

  const sorted = [...list].sort((a, b) => (a.top - b.top) || (a.left - b.left));
  const last = sorted[sorted.length - 1];
  const width = Math.max(40, box.width);
  const besideLeft = last.left + last.width + gap;
  const besideTop = last.top;

  if (besideLeft + width <= maxRight + 0.5) {
    return { ...box, left: besideLeft, top: besideTop };
  }

  const rowTolerance = Math.max(24, Math.round(last.height * 0.45));
  const rowWidgets = sorted.filter((item) => Math.abs(item.top - last.top) <= rowTolerance);
  const rowBottom = rowWidgets.reduce(
    (max, item) => Math.max(max, item.top + item.height),
    last.top + last.height,
  );
  return { ...box, left: pad, top: rowBottom + gap };
}

/**
 * Live / published only: fill holes left by permission-hidden widgets.
 *
 * Flow rules (reading order: top→bottom, left→right from the SAVED blueprint):
 * 1. Skip hidden widgets entirely.
 * 2. Remaining widgets pack from the left of the current row
 *    (e.g. row had c1,c2,c3 but only c3 is allowed → c3 sits first).
 * 3. Leftover width on that row is offered to the next widget (c4, c5, …).
 *    If it fits, it is pulled up beside the previous; if not, it wraps to the next row.
 * 4. Width/height of each widget are preserved — only left/top are reassigned for display.
 * 5. If nothing was hidden vs the saved blueprint, return coords unchanged.
 *
 * @param {Array} visibleBoxes  boxes for widgets the user can see
 * @param {Array|null} fullBlueprint  full saved layout_px (incl. hidden) for hole detection
 * @param {{ gap?: number, pad?: number, canvasWidth?: number|null }} options
 */
export function packLayoutPxGaps(
  visibleBoxes = [],
  fullBlueprint = null,
  { gap = FLOAT_GAP, pad = 12, canvasWidth = null, activeWidgetIds = null } = {},
) {
  const visible = sanitizeNestedLayoutPx(visibleBoxes);
  if (!visible.length) return [];

  const blueprint = sanitizeNestedLayoutPx(fullBlueprint || []);
  if (blueprint.length) {
    const visibleIds = new Set(visible.map((box) => String(box.i)));
    const activeIds = activeWidgetIds instanceof Set
      ? activeWidgetIds
      : (Array.isArray(activeWidgetIds) ? new Set(activeWidgetIds.map(String)) : null);
    const hadHidden = blueprint.some((box) => {
      const id = String(box.i);
      if (visibleIds.has(id)) return false;
      if (activeIds && !activeIds.has(id)) return false;
      return true;
    });
    // Nothing filtered out — keep designer spacing exactly.
    if (!hadHidden) return visible;
  }

  const widthSource = blueprint.length ? blueprint : visible;
  const inferredWidth = widthSource.reduce(
    (max, box) => Math.max(max, box.left + box.width),
    0,
  );
  const explicitWidth = Number.isFinite(Number(canvasWidth)) && Number(canvasWidth) >= 200
    ? Math.round(Number(canvasWidth))
    : 0;
  // Never pack tighter than the designed content width (avoids false wraps).
  const rowMaxWidth = Math.max(pad + 80, explicitWidth, inferredWidth);

  const visibleById = new Map(visible.map((box) => [String(box.i), box]));

  // Prefer blueprint reading order so "next" is stable even if we re-pack twice.
  let sorted;
  if (blueprint.length) {
    const seen = new Set();
    sorted = [];
    const blueprintOrder = [...blueprint].sort((a, b) => (a.top - b.top) || (a.left - b.left));
    for (const slot of blueprintOrder) {
      const id = String(slot.i);
      if (seen.has(id)) continue;
      const box = visibleById.get(id);
      if (!box) continue;
      sorted.push(box);
      seen.add(id);
    }
    for (const box of visible) {
      if (seen.has(String(box.i))) continue;
      sorted.push(box);
      seen.add(String(box.i));
    }
  } else {
    sorted = [...visible].sort((a, b) => (a.top - b.top) || (a.left - b.left));
  }

  const placed = [];
  let cursorX = pad;
  let cursorY = pad;
  let rowHeight = 0;

  for (const box of sorted) {
    const width = Math.max(40, box.width);
    const height = Math.max(32, box.height);

    // Not enough leftover width on this row → wrap; next item starts a new row.
    if (cursorX > pad && cursorX + width > rowMaxWidth + 0.5) {
      cursorY += rowHeight + gap;
      cursorX = pad;
      rowHeight = 0;
    }

    placed.push({
      i: box.i,
      left: cursorX,
      top: cursorY,
      width,
      height,
    });

    cursorX += width + gap;
    rowHeight = Math.max(rowHeight, height);
  }

  return sanitizeNestedLayoutPx(placed);
}

export function cloneBoxBeside(sourceBox = {}, existing = []) {
  const src = normalizeBox(sourceBox);
  const candidate = normalizeBox({
    ...src,
    left: src.left + src.width + FLOAT_GAP,
    top: src.top,
  });
  const overlaps = (a, b) =>
    a.left < b.left + b.width
    && a.left + a.width > b.left
    && a.top < b.top + b.height
    && a.top + a.height > b.top;
  if (!existing.some((item) => overlaps(candidate, item))) return candidate;
  return placeNextBoxPx(existing, src);
}

/**
 * Clone inside a parent container: prefer below the source so the copy stays visible
 * (beside often lands outside overflow:hidden and looks like clone "did nothing").
 */
export function cloneBoxInContainer(sourceBox = {}, existing = [], containerWidth = 0) {
  const src = normalizeBox(sourceBox);
  const maxW = Math.max(40, Number(containerWidth) || 0);
  const overlaps = (a, b) =>
    a.left < b.left + b.width
    && a.left + a.width > b.left
    && a.top < b.top + b.height
    && a.top + a.height > b.top;

  const fitWidth = (box) => {
    if (!(maxW >= 40)) return box;
    const width = Math.min(Math.max(40, box.width), Math.max(40, maxW - 8));
    const left = Math.min(Math.max(0, box.left), Math.max(0, maxW - width));
    return normalizeBox({ ...box, left, width });
  };

  const below = fitWidth(normalizeBox({
    ...src,
    left: src.left,
    top: src.top + src.height + FLOAT_GAP,
  }));
  if (!existing.some((item) => overlaps(below, item))) return below;

  const beside = fitWidth(normalizeBox({
    ...src,
    left: src.left + src.width + FLOAT_GAP,
    top: src.top,
  }));
  if (beside.left + beside.width <= (maxW >= 40 ? maxW : Infinity)
    && !existing.some((item) => overlaps(beside, item))) {
    return beside;
  }

  return fitWidth(placeNextBoxPx(existing, src));
}

export function containerContentHeightPx(boxes = [], padding = 8) {
  if (!boxes.length) return 120;
  const maxBottom = boxes.reduce(
    (max, box) => Math.max(max, box.top + box.height),
    0,
  );
  return Math.max(120, maxBottom + padding * 2);
}

export function sanitizeNestedLayoutPx(items = []) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items
    .map((item) => {
      const id = String(item?.i ?? item?.id ?? "").trim();
      if (!id || id === "undefined" || id === "null") return null;
      return { i: id, ...normalizeBox(item) };
    })
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item.i)) return false;
      seen.add(item.i);
      return true;
    });
}

/** Keep widget id on the box — normalizeBox alone strips `i` and corrupts layout_px. */
export function boxWithId(id, raw = {}) {
  const key = String(id ?? raw?.i ?? raw?.id ?? "").trim();
  if (!key || key === "undefined" || key === "null") return null;
  return { i: key, ...normalizeBox(raw) };
}

/** Soft elevation presets available from Style → Shadow in the builder. */
export const DEFAULT_WIDGET_BOX_SHADOW = "0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.08)";
export const STRONG_WIDGET_BOX_SHADOW = "0 4px 14px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(15, 23, 42, 0.08)";

/** Build inline CSS object from saved widget style only (preview parity). */
export function savedStyleToCss(style = {}, { isContainer = false } = {}) {
  const s = style && typeof style === "object" ? style : {};
  const css = {};
  if (s.bg && !isContainer) css.backgroundColor = s.bg;
  if (isContainer && s.bg) css.backgroundColor = s.bg;
  if (s.color) css.color = s.color;
  if (Number.isFinite(Number(s.fontSize))) css.fontSize = `${Number(s.fontSize)}px`;
  if (s.fontFamily) css.fontFamily = s.fontFamily;
  if (Number.isFinite(Number(s.borderRadius))) css.borderRadius = `${Number(s.borderRadius)}px`;
  if (s.border) css.border = s.border;
  // Only apply shadow when user explicitly set it in Style panel (no default).
  if (s.boxShadow && s.boxShadow !== "none") {
    css.boxShadow = s.boxShadow;
  }
  const pad = Number.isFinite(Number(s.padding)) ? Number(s.padding) : null;
  if (pad != null) css.padding = `${pad}px`;
  if (Number.isFinite(Number(s.paddingTop))) css.paddingTop = `${Number(s.paddingTop)}px`;
  if (Number.isFinite(Number(s.paddingRight))) css.paddingRight = `${Number(s.paddingRight)}px`;
  if (Number.isFinite(Number(s.paddingBottom))) css.paddingBottom = `${Number(s.paddingBottom)}px`;
  if (Number.isFinite(Number(s.paddingLeft))) css.paddingLeft = `${Number(s.paddingLeft)}px`;
  return css;
}

export function boxToInlineStyle(box = {}) {
  const b = normalizeBox(box);
  return {
    position: "absolute",
    left: `${b.left}px`,
    top: `${b.top}px`,
    width: `${b.width}px`,
    height: `${b.height}px`,
    boxSizing: "border-box",
  };
}
