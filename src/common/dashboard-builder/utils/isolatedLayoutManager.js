/**
 * Isolated Layout Manager — Responsive Breakpoint Isolation + Role-Based Auto-Reflow
 *
 * Plug-in layer for DashboardBuilder. Does NOT mutate desktop layout when editing mobile,
 * and does NOT rewrite existing desktop coords on load/save.
 *
 * Storage contract (aligned with existing dashboard_json):
 * {
 *   version: 2,
 *   layout_px: [...],              // desktop floating (optional)
 *   layout_px_mobile: [...],       // mobile floating (optional; only when customized)
 *   canvas_width / canvas_width_mobile,
 *   widgets: [{
 *     id, layout: { i,x,y,w,h }, mobileLayout: { i,x,y,w,h },
 *     nestedLayout, mobileNestedLayout, deviceTarget, ...
 *   }]
 * }
 *
 * Prefer top-level arrays when available:
 *   desktopLayout / mobileLayout  (grid)
 *   layout_px / layout_px_mobile  (floating)
 */

import {
  hasCustomPhoneLayout,
  hasCustomTopLevelMobileLayout,
  packLayoutGaps,
  resolvePublishedDesktopLayout,
  resolvePublishedPhoneLayout,
  stackLayoutForPhone,
} from "./dashboardLayoutEngine";

export const DEVICE_DESKTOP = "desktop";
export const DEVICE_MOBILE = "mobile";
export const MOBILE_MAX_WIDTH_PX = 767;
export const DEFAULT_GRID_COLS = 12;

/** Compact grid item for persist / transport. */
export function sanitizeLayoutItem(raw = {}, id = "") {
  return {
    i: String(id || raw.i || ""),
    x: Number.isFinite(Number(raw.x)) ? Number(raw.x) : 0,
    y: Number.isFinite(Number(raw.y)) ? Number(raw.y) : 0,
    w: Math.max(1, Number.isFinite(Number(raw.w)) ? Number(raw.w) : 1),
    h: Math.max(1, Number.isFinite(Number(raw.h)) ? Number(raw.h) : 1),
  };
}

export function sanitizeLayoutArray(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && (item.i != null || item.id != null))
    .map((item) => sanitizeLayoutItem(item, item.i ?? item.id));
}

/**
 * Canonical isolated layout document shape for DB / API.
 * Keep desktop + mobile as sibling keys — never merge coords across devices.
 */
export function createIsolatedLayoutDocument({
  version = 2,
  desktopLayout = [],
  mobileLayout = [],
  layoutPx = [],
  layoutPxMobile = null,
  canvasWidth = null,
  canvasWidthMobile = null,
  mobileCustomized = false,
  widgets = [],
  meta = {},
} = {}) {
  const doc = {
    version,
    meta: meta && typeof meta === "object" ? { ...meta } : {},
    desktopLayout: sanitizeLayoutArray(desktopLayout),
    mobileLayout: sanitizeLayoutArray(mobileLayout),
    widgets: Array.isArray(widgets) ? widgets : [],
  };

  if (Array.isArray(layoutPx) && layoutPx.length) {
    doc.layout_px = layoutPx;
  }
  if (Number.isFinite(Number(canvasWidth)) && Number(canvasWidth) > 0) {
    doc.canvas_width = Math.round(Number(canvasWidth));
  }

  // Persist mobile floating coords ONLY when the designer customized phone layout.
  // Omitting layout_px_mobile keeps "auto stack from desktop" as the live fallback.
  if (mobileCustomized && Array.isArray(layoutPxMobile) && layoutPxMobile.length) {
    doc.layout_px_mobile = layoutPxMobile;
    if (Number.isFinite(Number(canvasWidthMobile)) && Number(canvasWidthMobile) > 0) {
      doc.canvas_width_mobile = Math.round(Number(canvasWidthMobile));
    }
  }

  return doc;
}

/** Normalize legacy / mixed payloads into the isolated document model. */
export function normalizeIsolatedLayoutState(raw = {}) {
  const widgets = Array.isArray(raw.widgets) ? raw.widgets : [];

  const desktopLayout = sanitizeLayoutArray(
    raw.desktopLayout
      || raw.layout
      || raw.layout_blueprint?.desktop
      || widgets.map((w, idx) => sanitizeLayoutItem(w.layout || {}, w.id || `w_${idx}`)),
  );

  const mobileFromDoc = raw.mobileLayout || raw.mobile_layout || raw.layout_blueprint?.mobile || [];
  const mobileFromWidgets = widgets
    .map((w) => (w.mobileLayout || w.mobile_layout
      ? sanitizeLayoutItem(w.mobileLayout || w.mobile_layout, w.id)
      : null))
    .filter(Boolean);

  const mobileLayout = sanitizeLayoutArray(
    mobileFromDoc.length ? mobileFromDoc : mobileFromWidgets,
  );

  const layoutPx = Array.isArray(raw.layout_px) ? raw.layout_px : [];
  const layoutPxMobile = Array.isArray(raw.layout_px_mobile) ? raw.layout_px_mobile : [];
  const mobileCustomized = Boolean(
    raw.mobileCustomized
      || layoutPxMobile.length > 0
      || hasCustomPhoneLayout(widgets, desktopLayout, mobileLayout),
  );

  return {
    version: Number(raw.version) || 2,
    desktopLayout,
    mobileLayout,
    layoutPx,
    layoutPxMobile,
    canvasWidth: raw.canvas_width ?? raw.canvasWidth ?? null,
    canvasWidthMobile: raw.canvas_width_mobile ?? raw.canvasWidthMobile ?? null,
    mobileCustomized,
    widgets,
    meta: raw.meta && typeof raw.meta === "object" ? raw.meta : {},
  };
}

export function detectDeviceType({
  previewMode = null,
  width = null,
  mobileMaxWidth = MOBILE_MAX_WIDTH_PX,
} = {}) {
  const preview = String(previewMode || "").trim().toLowerCase();
  if (preview === DEVICE_MOBILE || preview === "phone") return DEVICE_MOBILE;
  if (preview === DEVICE_DESKTOP || preview === "laptop") return DEVICE_DESKTOP;

  if (typeof width === "number" && Number.isFinite(width)) {
    return width <= mobileMaxWidth ? DEVICE_MOBILE : DEVICE_DESKTOP;
  }

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia(`(max-width: ${mobileMaxWidth}px)`).matches
      ? DEVICE_MOBILE
      : DEVICE_DESKTOP;
  }

  return DEVICE_DESKTOP;
}

export function isMobileDevice(device) {
  return String(device) === DEVICE_MOBILE;
}

/**
 * Auto-generate a clean single-column mobile layout from desktop coords.
 * Pure fallback — never writes back into desktopLayout.
 */
export function autoGenerateMobileFromDesktop(
  desktopLayout = [],
  widgets = [],
  cols = DEFAULT_GRID_COLS,
) {
  const safeDesktop = sanitizeLayoutArray(desktopLayout);
  if (!safeDesktop.length && widgets.length) {
    const seeded = widgets
      .filter((w) => !w.containerId && !w.sectionId)
      .map((w, idx) => sanitizeLayoutItem(w.layout || {}, w.id || `w_${idx}`));
    return stackLayoutForPhone(widgets, seeded, cols);
  }
  return stackLayoutForPhone(widgets, safeDesktop, cols);
}

/**
 * Resolve which layout array to render for the active device.
 * mobileLayout = customMobileLayout || autoGenerateMobileFromDesktop(desktopLayout)
 */
export function resolveActiveLayout({
  device = DEVICE_DESKTOP,
  desktopLayout = [],
  mobileLayout = [],
  widgets = [],
  cols = DEFAULT_GRID_COLS,
  mobileCustomized = null,
} = {}) {
  const desktop = sanitizeLayoutArray(desktopLayout);

  if (!isMobileDevice(device)) {
    return {
      device: DEVICE_DESKTOP,
      layout: desktop,
      source: "desktopLayout",
      isFallback: false,
    };
  }

  const mobile = sanitizeLayoutArray(mobileLayout);
  const customized = mobileCustomized == null
    ? hasCustomTopLevelMobileLayout(desktop, mobile)
    : Boolean(mobileCustomized);

  if (customized && mobile.length) {
    return {
      device: DEVICE_MOBILE,
      layout: mobile,
      source: "mobileLayout",
      isFallback: false,
    };
  }

  return {
    device: DEVICE_MOBILE,
    layout: autoGenerateMobileFromDesktop(desktop, widgets, cols),
    source: "autoGenerateMobileFromDesktop",
    isFallback: true,
  };
}

/**
 * Permission filter BEFORE grid render.
 * `canViewWidget(widget) => boolean` — inject your audience / module checks.
 * Containers with zero remaining children are dropped (no empty shells).
 */
export function filterWidgetsByPermission(widgets = [], canViewWidget = () => true) {
  const list = Array.isArray(widgets) ? widgets : [];
  const allowed = list.filter((widget) => {
    try {
      return canViewWidget(widget) !== false;
    } catch {
      return false;
    }
  });

  const allowedIds = new Set(allowed.map((w) => String(w.id)));
  const childrenByContainer = new Map();

  for (const widget of allowed) {
    const parentId = String(widget.containerId || widget.sectionId || "");
    if (!parentId) continue;
    if (!childrenByContainer.has(parentId)) childrenByContainer.set(parentId, []);
    childrenByContainer.get(parentId).push(widget);
  }

  return allowed.filter((widget) => {
    if (widget.rawType !== "container" && widget.type !== "container") return true;
    // Keep container if it still has at least one permitted child, or if it has no children recorded
    // (builder draft / empty shell while designing).
    const kids = childrenByContainer.get(String(widget.id));
    if (kids == null) {
      const hadChildren = list.some(
        (w) => String(w.containerId || w.sectionId || "") === String(widget.id),
      );
      return !hadChildren;
    }
    return kids.length > 0;
  }).filter((widget) => {
    // Nested child whose parent was removed by permission — drop orphan.
    const parentId = String(widget.containerId || widget.sectionId || "");
    if (!parentId) return true;
    return allowedIds.has(parentId);
  });
}

/**
 * Filter widgets by deviceTarget ("both" | "desktop" | "mobile") for the active surface.
 */
export function filterWidgetsByDeviceTarget(widgets = [], device = DEVICE_DESKTOP) {
  const mobile = isMobileDevice(device);
  return (widgets || []).filter((widget) => {
    const target = String(widget.deviceTarget || widget.device_target || "both").toLowerCase();
    if (target === "both" || !target) return true;
    if (target === "mobile") return mobile;
    if (target === "desktop") return !mobile;
    return true;
  });
}

/**
 * Restrict a layout array to visible widget ids, then vertically compact so
 * unauthorized removals leave no empty holes (preserves w/h, moves x/y only).
 */
export function filterAndCompactLayout({
  layout = [],
  visibleWidgets = [],
  cols = DEFAULT_GRID_COLS,
  fullLayoutBlueprint = null,
} = {}) {
  const visibleIds = new Set(
    (visibleWidgets || []).map((w) => String(w.id ?? w.i)),
  );
  const visibleItems = sanitizeLayoutArray(layout).filter((item) => visibleIds.has(String(item.i)));
  const blueprint = fullLayoutBlueprint?.length
    ? sanitizeLayoutArray(fullLayoutBlueprint)
    : null;
  return packLayoutGaps(visibleItems, cols, blueprint);
}

/**
 * Full published/live resolve: pick device layout → permission filter → compact gaps.
 * Reuses existing resolvePublished* engines so designer desktop coords stay intact
 * when nothing is hidden.
 */
export function resolveIsolatedRenderLayout({
  device = DEVICE_DESKTOP,
  widgets = [],
  desktopLayout = [],
  mobileLayout = [],
  layoutBlueprint = null,
  canViewWidget = () => true,
  cols = DEFAULT_GRID_COLS,
  applyDeviceTarget = false,
} = {}) {
  let visible = filterWidgetsByPermission(widgets, canViewWidget);
  if (applyDeviceTarget) {
    visible = filterWidgetsByDeviceTarget(visible, device);
  }

  const blueprintDesktop = layoutBlueprint?.desktop || null;
  const blueprintMobile = layoutBlueprint?.mobile || null;

  if (!isMobileDevice(device)) {
    return {
      device: DEVICE_DESKTOP,
      widgets: visible,
      layout: resolvePublishedDesktopLayout(
        visible,
        desktopLayout,
        cols,
        blueprintDesktop,
      ),
      source: "desktopLayout",
    };
  }

  return {
    device: DEVICE_MOBILE,
    widgets: visible,
    layout: resolvePublishedPhoneLayout(
      visible,
      mobileLayout,
      cols,
      blueprintMobile,
      desktopLayout,
    ),
    source: hasCustomTopLevelMobileLayout(desktopLayout, mobileLayout)
      ? "mobileLayout"
      : "autoGenerateMobileFromDesktop",
  };
}

/**
 * Isolation write gate — the single place drag/resize commits must go through.
 *
 * Desktop edits NEVER touch mobileLayout / layout_px_mobile.
 * Mobile edits NEVER touch desktopLayout / layout_px.
 * First intentional mobile edit marks mobileCustomized = true.
 */
export function commitLayoutChange({
  device = DEVICE_DESKTOP,
  nextLayout = [],
  desktopLayout = [],
  mobileLayout = [],
  mobileCustomized = false,
} = {}) {
  const sanitized = sanitizeLayoutArray(nextLayout);

  if (isMobileDevice(device)) {
    return {
      desktopLayout: sanitizeLayoutArray(desktopLayout), // untouched
      mobileLayout: sanitized,
      mobileCustomized: true,
      changedSurface: DEVICE_MOBILE,
    };
  }

  return {
    desktopLayout: sanitized,
    mobileLayout: sanitizeLayoutArray(mobileLayout), // untouched
    mobileCustomized: Boolean(mobileCustomized),
    changedSurface: DEVICE_DESKTOP,
  };
}

/**
 * Floating (layout_px) twin of commitLayoutChange — same isolation guarantees.
 */
export function commitLayoutPxChange({
  device = DEVICE_DESKTOP,
  nextLayoutPx = [],
  layoutPx = [],
  layoutPxMobile = [],
  mobileCustomized = false,
} = {}) {
  const next = Array.isArray(nextLayoutPx) ? nextLayoutPx : [];

  if (isMobileDevice(device)) {
    return {
      layoutPx: Array.isArray(layoutPx) ? layoutPx : [],
      layoutPxMobile: next,
      mobileCustomized: true,
      changedSurface: DEVICE_MOBILE,
    };
  }

  return {
    layoutPx: next,
    layoutPxMobile: Array.isArray(layoutPxMobile) ? layoutPxMobile : [],
    mobileCustomized: Boolean(mobileCustomized),
    changedSurface: DEVICE_DESKTOP,
  };
}

/**
 * Build persist payload fields without clobbering the opposite device.
 * Pass existing mobile arrays through unchanged when saving from desktop (and vice versa).
 */
export function buildPersistLayoutFields({
  device = DEVICE_DESKTOP,
  desktopLayout = [],
  mobileLayout = [],
  layoutPx = [],
  layoutPxMobile = [],
  mobileCustomized = false,
  canvasWidth = null,
  canvasWidthMobile = null,
} = {}) {
  // Always persist both grid arrays when present — isolation is about mutation, not omission.
  const fields = {
    desktopLayout: sanitizeLayoutArray(desktopLayout),
    mobileLayout: sanitizeLayoutArray(mobileLayout),
  };

  if (Array.isArray(layoutPx)) fields.layout_px = layoutPx;
  if (Number.isFinite(Number(canvasWidth))) fields.canvas_width = Math.round(Number(canvasWidth));

  if (mobileCustomized && Array.isArray(layoutPxMobile) && layoutPxMobile.length) {
    fields.layout_px_mobile = layoutPxMobile;
    if (Number.isFinite(Number(canvasWidthMobile))) {
      fields.canvas_width_mobile = Math.round(Number(canvasWidthMobile));
    }
  }

  // Annotate which surface produced this save (audit / debug only).
  fields._lastEditedDevice = isMobileDevice(device) ? DEVICE_MOBILE : DEVICE_DESKTOP;
  fields._mobileCustomized = Boolean(mobileCustomized);

  return fields;
}

/**
 * Seed mobile preview from desktop without marking customized.
 * Call when switching builder → Phone if no saved mobile layout yet.
 */
export function seedMobilePreviewFromDesktop({
  desktopLayout = [],
  mobileLayout = [],
  widgets = [],
  mobileCustomized = false,
  cols = DEFAULT_GRID_COLS,
} = {}) {
  if (mobileCustomized && sanitizeLayoutArray(mobileLayout).length) {
    return {
      mobileLayout: sanitizeLayoutArray(mobileLayout),
      mobileCustomized: true,
      seeded: false,
    };
  }

  return {
    mobileLayout: autoGenerateMobileFromDesktop(desktopLayout, widgets, cols),
    mobileCustomized: false,
    seeded: true,
  };
}
