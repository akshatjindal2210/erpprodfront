import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEVICE_DESKTOP,
  DEVICE_MOBILE,
  MOBILE_MAX_WIDTH_PX,
  buildPersistLayoutFields,
  commitLayoutChange,
  commitLayoutPxChange,
  detectDeviceType,
  filterAndCompactLayout,
  filterWidgetsByDeviceTarget,
  filterWidgetsByPermission,
  isMobileDevice,
  normalizeIsolatedLayoutState,
  resolveActiveLayout,
  resolveIsolatedRenderLayout,
  seedMobilePreviewFromDesktop,
} from "../utils/isolatedLayoutManager";

/**
 * useIsolatedLayoutManager
 *
 * Thin React wrapper around isolatedLayoutManager helpers.
 * Owns preview device mode + derived active layout. Does not replace
 * DashboardBuilder widget/state stores — wrap or sync with existing refs.
 *
 * @example
 * const layoutMgr = useIsolatedLayoutManager({
 *   widgets,
 *   desktopLayout: layout,
 *   mobileLayout,
 *   layoutBlueprint,
 *   canViewWidget: (w) => w._canView !== false,
 *   mode: "builder", // or "live"
 *   builderDeviceMode, // controlled preview from existing Laptop/Phone toggle
 *   onBuilderDeviceModeChange: setBuilderDeviceMode,
 * });
 *
 * // On drag stop:
 * const next = layoutMgr.commitGridChange(nextItems);
 * setLayout(next.desktopLayout);
 * setMobileLayout(next.mobileLayout);
 */
export function useIsolatedLayoutManager({
  widgets = [],
  desktopLayout = [],
  mobileLayout = [],
  layoutPx = [],
  layoutPxMobile = [],
  layoutBlueprint = null,
  mobileCustomized: mobileCustomizedProp = null,
  canViewWidget = () => true,
  applyDeviceTarget = false,
  cols = 12,
  mode = "builder", // "builder" | "live"
  builderDeviceMode = null,
  onBuilderDeviceModeChange = null,
  mobileMaxWidth = MOBILE_MAX_WIDTH_PX,
} = {}) {
  const [liveDevice, setLiveDevice] = useState(DEVICE_DESKTOP);
  const [internalPreview, setInternalPreview] = useState(DEVICE_DESKTOP);
  const [mobileCustomizedLocal, setMobileCustomizedLocal] = useState(
    () => Boolean(mobileCustomizedProp),
  );

  const mobileCustomized = mobileCustomizedProp == null
    ? mobileCustomizedLocal
    : Boolean(mobileCustomizedProp);

  const setMobileCustomized = useCallback((value) => {
    setMobileCustomizedLocal(Boolean(value));
  }, []);

  // Live viewport detection (published dashboard only).
  useEffect(() => {
    if (mode !== "live" || typeof window === "undefined") return undefined;
    const mq = window.matchMedia(`(max-width: ${mobileMaxWidth}px)`);
    const apply = () => setLiveDevice(mq.matches ? DEVICE_MOBILE : DEVICE_DESKTOP);
    apply();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, [mode, mobileMaxWidth]);

  const previewMode = builderDeviceMode != null ? builderDeviceMode : internalPreview;

  const setPreviewMode = useCallback((next) => {
    const device = detectDeviceType({ previewMode: next });
    if (typeof onBuilderDeviceModeChange === "function") {
      onBuilderDeviceModeChange(device);
    } else {
      setInternalPreview(device);
    }
  }, [onBuilderDeviceModeChange]);

  const activeDevice = mode === "live"
    ? liveDevice
    : detectDeviceType({ previewMode });

  const visibleWidgets = useMemo(() => {
    let next = filterWidgetsByPermission(widgets, canViewWidget);
    if (applyDeviceTarget) {
      next = filterWidgetsByDeviceTarget(next, activeDevice);
    }
    return next;
  }, [widgets, canViewWidget, applyDeviceTarget, activeDevice]);

  const activeResolved = useMemo(
    () => resolveActiveLayout({
      device: activeDevice,
      desktopLayout,
      mobileLayout,
      widgets: visibleWidgets,
      cols,
      mobileCustomized,
    }),
    [activeDevice, desktopLayout, mobileLayout, visibleWidgets, cols, mobileCustomized],
  );

  const renderBundle = useMemo(
    () => resolveIsolatedRenderLayout({
      device: activeDevice,
      widgets,
      desktopLayout,
      mobileLayout,
      layoutBlueprint,
      canViewWidget,
      cols,
      applyDeviceTarget,
    }),
    [
      activeDevice,
      widgets,
      desktopLayout,
      mobileLayout,
      layoutBlueprint,
      canViewWidget,
      cols,
      applyDeviceTarget,
    ],
  );

  const commitGridChange = useCallback((nextLayout) => {
    const result = commitLayoutChange({
      device: activeDevice,
      nextLayout,
      desktopLayout,
      mobileLayout,
      mobileCustomized,
    });
    if (result.changedSurface === DEVICE_MOBILE) {
      setMobileCustomized(true);
    }
    return result;
  }, [activeDevice, desktopLayout, mobileLayout, mobileCustomized, setMobileCustomized]);

  const commitPxChange = useCallback((nextLayoutPx) => {
    const result = commitLayoutPxChange({
      device: activeDevice,
      nextLayoutPx,
      layoutPx,
      layoutPxMobile,
      mobileCustomized,
    });
    if (result.changedSurface === DEVICE_MOBILE) {
      setMobileCustomized(true);
    }
    return result;
  }, [activeDevice, layoutPx, layoutPxMobile, mobileCustomized, setMobileCustomized]);

  const seedMobileIfNeeded = useCallback(() => {
    return seedMobilePreviewFromDesktop({
      desktopLayout,
      mobileLayout,
      widgets: visibleWidgets,
      mobileCustomized,
      cols,
    });
  }, [desktopLayout, mobileLayout, visibleWidgets, mobileCustomized, cols]);

  const switchToMobile = useCallback(() => {
    const seeded = seedMobileIfNeeded();
    setPreviewMode(DEVICE_MOBILE);
    return seeded;
  }, [seedMobileIfNeeded, setPreviewMode]);

  const switchToDesktop = useCallback(() => {
    setPreviewMode(DEVICE_DESKTOP);
  }, [setPreviewMode]);

  const buildPersistFields = useCallback(() => buildPersistLayoutFields({
    device: activeDevice,
    desktopLayout,
    mobileLayout,
    layoutPx,
    layoutPxMobile,
    mobileCustomized,
  }), [
    activeDevice,
    desktopLayout,
    mobileLayout,
    layoutPx,
    layoutPxMobile,
    mobileCustomized,
  ]);

  const compactVisible = useCallback(
    (layout, blueprint = null) => filterAndCompactLayout({
      layout,
      visibleWidgets,
      cols,
      fullLayoutBlueprint: blueprint,
    }),
    [visibleWidgets, cols],
  );

  // Keep a stable ref for imperative callers (drag handlers) without stale closures.
  const apiRef = useRef({});
  apiRef.current = {
    activeDevice,
    isMobile: isMobileDevice(activeDevice),
    activeLayout: activeResolved.layout,
    activeSource: activeResolved.source,
    isFallback: activeResolved.isFallback,
    visibleWidgets,
    renderLayout: renderBundle.layout,
    renderWidgets: renderBundle.widgets,
    mobileCustomized,
    commitGridChange,
    commitPxChange,
    seedMobileIfNeeded,
    switchToMobile,
    switchToDesktop,
    buildPersistFields,
    compactVisible,
  };

  return {
    DEVICE_DESKTOP,
    DEVICE_MOBILE,
    activeDevice,
    isMobile: isMobileDevice(activeDevice),
    previewMode,
    setPreviewMode,
    switchToMobile,
    switchToDesktop,
    activeLayout: activeResolved.layout,
    activeSource: activeResolved.source,
    isFallback: Boolean(activeResolved.isFallback),
    visibleWidgets,
    renderLayout: renderBundle.layout,
    renderWidgets: renderBundle.widgets,
    mobileCustomized,
    setMobileCustomized,
    commitGridChange,
    commitPxChange,
    seedMobileIfNeeded,
    buildPersistFields,
    compactVisible,
    normalizeState: normalizeIsolatedLayoutState,
    apiRef,
  };
}

export default useIsolatedLayoutManager;
