/** Pixel-based floating layout — no grid columns in builder. */

export const FLOAT_GAP = 12;
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
  if (rawType === "table" || rawType === "graph") return { ...DEFAULT_TABLE_BOX };
  if (rawType === "heading") return { ...DEFAULT_HEADING_BOX };
  return { ...DEFAULT_KPI_BOX };
}

export function defaultTopLevelBoxForType(rawType = "kpi", containerPreset = "full", canvasWidth = 1200) {
  const pad = 12;
  const maxW = Math.max(160, Math.min(Number(canvasWidth) || 1200, 1600) - pad * 2);
  if (rawType === "container" || rawType === "section") {
    const width = containerPreset === "half"
      ? Math.max(200, Math.floor((maxW - FLOAT_GAP) / 2))
      : Math.min(720, maxW);
    return { left: pad, top: pad, width, height: DEFAULT_TOP_CONTAINER_BOX.height };
  }
  if (rawType === "table" || rawType === "graph") {
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

/** Ensure every top-level widget has a pixel box (layout_px + style.boxPx fallback). */
export function resolveTopLevelBoxes(topLevelWidgets = [], layoutPx = []) {
  const byId = new Map(
    sanitizeNestedLayoutPx(layoutPx).map((item) => [String(item.i), normalizeBox(item)]),
  );
  const placed = [];
  return topLevelWidgets.map((widget, idx) => {
    const id = String(widget.id);
    const matched = byId.get(id);
    if (matched) {
      const box = { i: id, ...matched };
      placed.push(box);
      return box;
    }
    const fromStyle = widget.style?.boxPx;
    if (fromStyle && Number.isFinite(Number(fromStyle.width))) {
      const box = { i: id, ...normalizeBox(fromStyle) };
      placed.push(box);
      return box;
    }
    // Never default-stack on top of existing widgets (hides tables under containers on live).
    const box = { i: id, ...placeNextBoxPx(placed, readWidgetBoxPx(widget, idx)) };
    placed.push(box);
    return box;
  });
}

export function scaleLayoutPx(items = [], fromWidth, toWidth) {
  const from = Number(fromWidth);
  const to = Number(toWidth);
  const normalized = sanitizeNestedLayoutPx(items);
  if (!normalized.length || !Number.isFinite(from) || !Number.isFinite(to) || from < 200 || to < 200) {
    return normalized;
  }
  if (Math.abs(from - to) < 8) return normalized;
  const s = to / from;
  return normalized.map((item) => ({
    i: item.i,
    left: Math.max(0, Math.round(item.left * s)),
    top: Math.max(0, Math.round(item.top * s)),
    width: Math.max(40, Math.round(item.width * s)),
    height: Math.max(32, Math.round(item.height * s)),
  }));
}

export function layoutPxFingerprint(items = []) {
  return sanitizeNestedLayoutPx(items)
    .map((item) => `${item.i}:${item.left},${item.top},${item.width},${item.height}`)
    .join("|");
}

/** Merge layout_px with per-widget style.boxPx so publish never drops moved positions.
 * Per-widget boxPx wins when present (stamped on publish) so live matches builder. */
export function mergeLayoutPxFromWidgets(layoutPx = [], widgets = []) {
  const byId = new Map(
    sanitizeNestedLayoutPx(layoutPx).map((item) => [String(item.i), normalizeBox(item)]),
  );
  (widgets || []).forEach((widget) => {
    if (widget?.containerId || widget?.sectionId) return;
    const id = String(widget.id);
    const fromStyle = widget.style?.boxPx;
    if (fromStyle && Number.isFinite(Number(fromStyle.width))) {
      byId.set(id, normalizeBox(fromStyle));
      return;
    }
    if (!byId.has(id)) {
      byId.set(id, normalizeBox(readWidgetBoxPx(widget, byId.size)));
    }
  });
  return sanitizeNestedLayoutPx(
    [...byId.entries()].map(([i, box]) => ({ i, ...box })),
  );
}

/** Shrink nested boxes so they stay inside a parent width (prevents live clipping). */
export function fitNestedLayoutPxToWidth(items = [], parentWidth = 0, pad = 8) {
  const width = Math.max(40, Number(parentWidth) || 0);
  if (!width) return sanitizeNestedLayoutPx(items);
  const maxInner = Math.max(40, width - pad * 2);
  return sanitizeNestedLayoutPx(items).map((item) => {
    let left = Math.max(0, item.left);
    let w = Math.max(40, item.width);
    if (left + w > maxInner) {
      if (w > maxInner) {
        w = maxInner;
        left = 0;
      } else {
        left = Math.max(0, maxInner - w);
      }
    }
    return { ...item, left, width: w };
  });
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

export function placeNextBoxPx(existing = [], nextBox = DEFAULT_KPI_BOX) {
  const box = normalizeBox(nextBox);
  const pad = 12;
  if (!existing.length) return { ...box, left: pad, top: pad };
  // Always place new widgets below current content so the canvas grows downward.
  const maxBottom = existing.reduce((max, item) => Math.max(max, item.top + item.height), 0);
  return { ...box, left: pad, top: maxBottom + FLOAT_GAP };
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
