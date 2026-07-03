"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import { Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Copy, CloudOff, GripVertical, Layout, Pencil, Plus, Redo2, Trash2, Undo2, UploadCloud, X } from "lucide-react";
import { useSelector } from "react-redux";
import { api } from "@/core/api/apiClient";
import { CORE_ENDPOINTS } from "@/core/api/endpoints";
import WidgetRenderer from "./WidgetRenderer";
import PropertyPanel from "./PropertyPanel";
import DashboardAudienceUserSelect from "./DashboardAudienceUserSelect";
import DashboardHome from "@/features/shared/dashboard/components/DashboardHome";
import { cloneDashboardToUsers, createWidget, deleteDashboardConfig, deleteWidget, getDashboardWidgets, listDashboardConfigs, listWidgets, previewWidget, publishDashboardConfig, saveDashboardDraft, unpublishDashboardConfig, updateWidget as updateWidgetApi } from "../services/dashboardApi";
import { useEscapeKey } from "@/core/hooks/useEscapeKey";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { filterAppNavPagesByAccess, getDefaultPageKeyForApp } from "../utils/appNavPages";
import { canFilterDashboardByUser } from "../utils/dashboardFilterAccess";

const typeToDisplayType = {
  kpi: "kpi",
  count: "kpi",
  sum: "kpi",
  table: "table",
  graph: "bar",
  heading: "heading",
  section: "section",
};

const requiresDataQuery = (rawType) => ["kpi", "table", "graph", "count", "sum"].includes(String(rawType));
const resolveApiType = (widget) => (widget.rawType === "kpi" ? "count" : widget.rawType || "table");

function defaultWidgetStyle(rawType = "table") {
  const shared = {
    color: "#3b82f6",
    bg: "#ffffff",
    borderRadius: 6,
    fontFamily: "inherit",
    margin: 0,
    contentAlign: "center",
    emptyTextPosition: "center",
    kpiLabelPosition: "bottom",
  };
  if (rawType === "kpi") {
    return { ...shared, fontSize: 26, kpiLabelFontSize: 10, padding: 6 };
  }
  if (rawType === "heading") {
    return { ...shared, color: "#0f172a", fontSize: 16, padding: 2 };
  }
  return { ...shared, fontSize: 10, padding: 8 };
}

function mergeWidgetStyle(rawType, chartConfig = {}) {
  const defaults = defaultWidgetStyle(rawType);
  const cfg = chartConfig && typeof chartConfig === "object" ? chartConfig : {};
  return {
    ...defaults,
    color: cfg.color ?? defaults.color,
    bg: cfg.bg ?? defaults.bg,
    fontSize: cfg.fontSize ?? defaults.fontSize,
    borderRadius: cfg.borderRadius ?? defaults.borderRadius,
    contentAlign: cfg.contentAlign ?? defaults.contentAlign,
    fontFamily: cfg.fontFamily ?? defaults.fontFamily,
    padding: cfg.padding ?? defaults.padding,
    margin: cfg.margin ?? defaults.margin,
    emptyTextPosition: cfg.emptyTextPosition ?? defaults.emptyTextPosition,
    kpiLabelPosition: cfg.kpiLabelPosition ?? defaults.kpiLabelPosition,
    kpiLabelFontSize: cfg.kpiLabelFontSize ?? defaults.kpiLabelFontSize,
  };
}

function chartConfigFromWidgetStyle(widget = {}) {
  const rawType = widget.rawType || "table";
  const defaults = defaultWidgetStyle(rawType);
  return {
    chart_type: widget.rawType === "graph" ? widget.type : undefined,
    color: widget.style?.color,
    bg: widget.style?.bg,
    fontSize: widget.style?.fontSize,
    borderRadius: widget.style?.borderRadius,
    fontFamily: widget.style?.fontFamily || "inherit",
    padding: widget.style?.padding ?? defaults.padding,
    margin: widget.style?.margin ?? defaults.margin,
    data_source: widget.dataSource || "ims_postgresql",
    erp_filter: widget.erpFilter && typeof widget.erpFilter === "object" ? widget.erpFilter : {},
    section_id: widget.sectionId || null,
    contentAlign: widget.style?.contentAlign || "center",
    emptyTextPosition: widget.style?.emptyTextPosition || "center",
    kpiLabelPosition: widget.style?.kpiLabelPosition || "bottom",
    kpiLabelFontSize: widget.style?.kpiLabelFontSize ?? defaults.kpiLabelFontSize,
    emptyText: widget.emptyText || "Click edit and add query",
  };
}
const BUILDER_WIDGET_TYPES = ["kpi", "table", "graph", "heading"];
const DASHBOARD_APP_OPTIONS = [
  { value: "home", label: "Home Dashboard" },
  { value: "ims", label: "IMS Dashboard" },
  { value: "task", label: "Task Dashboard" },
  { value: "settings", label: "Admin Console Dashboard" },
];
const DASHBOARD_STORAGE_PAGE_KEY = "default";
const DB_SOURCE_OPTIONS = [
  { value: "ims_postgresql", label: "IMS (PostgreSQL)" },
  { value: "erp_mssql", label: "ERP (MSSQL External)" },
];

const compactLayoutForStorage = (rawLayout = {}, widgetId = "") => ({
  i: String(widgetId || rawLayout.i || ""),
  x: Number.isFinite(Number(rawLayout.x)) ? Number(rawLayout.x) : 0,
  y: Number.isFinite(Number(rawLayout.y)) ? Number(rawLayout.y) : 0,
  w: Math.max(1, Number.isFinite(Number(rawLayout.w)) ? Number(rawLayout.w) : 1),
  h: Math.max(1, Number.isFinite(Number(rawLayout.h)) ? Number(rawLayout.h) : 1),
});

const normalizeWidgetForDashboardJson = (widget = {}, resolvedLayout = {}) => ({
  id: widget.id,
  rawType: widget.rawType || "table",
  type: widget.type || "table",
  title: widget.title || "",
  description: widget.description || "",
  query: widget.query || "",
  dataSource: widget.dataSource || "ims_postgresql",
  erpFilter: widget.erpFilter && typeof widget.erpFilter === "object" ? widget.erpFilter : {},
  emptyText: widget.emptyText || "Click edit and add query",
  sectionId: widget.sectionId || null,
  style: widget.style && typeof widget.style === "object" ? widget.style : {},
  layout: compactLayoutForStorage(resolvedLayout, widget.id),
  isActive: widget.is_active !== false,
  targetPageKey: widget.targetPageKey || "dashboard",
  targetPageModule: widget.targetPageModule || null,
});
const GRID_COLS = 12;
const GRID_ROW_HEIGHT = 64;
const GRID_GAP_X = 12;
const GRID_GAP_Y = 12;
const BUILDER_PANEL_WIDTH = 300;
const BUILDER_BREAKPOINTS = { lg: 0 };
const BUILDER_SELECT_CLASS =
  "h-7 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 outline-none focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15 transition-shadow";
const BUILDER_COLS_MAP = { lg: GRID_COLS };
const HISTORY_LIMIT = 50;
const VIEW_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const VIEW_COLS_MAP = { lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 };

function buildStateFingerprint(widgets = [], layout = []) {
  const normalized = widgets.map((widget) => {
    const matchedLayout = layout.find((item) => String(item.i) === String(widget.id)) || widget.layout || {};
    return {
      id: String(widget.id),
      title: String(widget.title || ""),
      description: String(widget.description || ""),
      rawType: String(widget.rawType || ""),
      type: String(widget.type || ""),
      query: String(widget.query || ""),
      dataSource: String(widget.dataSource || ""),
      audienceScope: String(widget.audienceScope || "global"),
      targetUserIds: Array.isArray(widget.targetUserIds) ? widget.targetUserIds : [],
      targetPageKey: String(widget.targetPageKey || "dashboard"),
      targetPageModule: widget.targetPageModule || null,
      emptyText: String(widget.emptyText || ""),
      style: widget.style || {},
      erpFilter: widget.erpFilter || {},
      layout: {
        x: Number(matchedLayout.x) || 0,
        y: Number(matchedLayout.y) || 0,
        w: Number(matchedLayout.w) || 1,
        h: Number(matchedLayout.h) || 1,
      },
    };
  });
  return JSON.stringify(normalized);
}

function cloneBuilderSnapshot(widgetsState = [], layoutState = []) {
  const widgets = JSON.parse(JSON.stringify(widgetsState));
  const layout = JSON.parse(JSON.stringify(layoutState));
  return {
    widgets,
    layout,
    fingerprint: buildStateFingerprint(widgets, layout),
  };
}

function findCloneLayoutSlot(layout = [], sourceLayout = {}) {
  const width = Math.max(1, Number(sourceLayout.w) || 3);
  const height = Math.max(1, Number(sourceLayout.h) || 2);
  let candidateY = Math.max(0, Number(sourceLayout.y) || 0);
  let candidateX = Math.min(GRID_COLS - width, (Number(sourceLayout.x) || 0) + 1);

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (candidateX + width > GRID_COLS) {
      candidateX = 0;
      candidateY += 1;
    }
    const collision = layout.some((item) => {
      const ix = Number(item.x) || 0;
      const iy = Number(item.y) || 0;
      const iw = Number(item.w) || 1;
      const ih = Number(item.h) || 1;
      return !(
        candidateX + width <= ix
        || candidateX >= ix + iw
        || candidateY + height <= iy
        || candidateY >= ih + ih
      );
    });
    if (!collision) {
      return { x: candidateX, y: candidateY, w: width, h: height };
    }
    candidateX += 1;
  }

  const maxY = layout.reduce((acc, item) => Math.max(acc, (Number(item.y) || 0) + (Number(item.h) || 1)), 0);
  return { x: 0, y: maxY, w: width, h: height };
}

const clampLayoutInBounds = (layouts = [], cols = GRID_COLS) =>
  (layouts || []).map((item, idx) => {
    const normalized = normalizeLayoutItem(item, idx, item?.i || item?.id || `layout_${idx}`);
    const width = Math.max(1, Math.min(cols, Number(normalized.w) || 1));
    const x = Math.max(0, Math.min(cols - width, Number(normalized.x) || 0));
    return { ...normalized, x, w: width };
  });

/** Live view: pack each row left (remaining cards shift forward) and stack rows with no empty Y gaps. */
const compactLayoutForLiveView = (layouts = []) => {
  if (!layouts.length) return layouts;

  const rowMap = new Map();
  for (const item of layouts) {
    const rowY = Number(item.y) || 0;
    if (!rowMap.has(rowY)) rowMap.set(rowY, []);
    rowMap.get(rowY).push(item);
  }

  const placed = [];
  let nextY = 0;
  for (const rowY of [...rowMap.keys()].sort((a, b) => a - b)) {
    const rowItems = [...rowMap.get(rowY)].sort(
      (a, b) => (Number(a.x) || 0) - (Number(b.x) || 0),
    );
    const rowHeight = Math.max(...rowItems.map((item) => Math.max(1, Number(item.h) || 1)));
    let nextX = 0;
    for (const item of rowItems) {
      const width = Math.max(1, Number(item.w) || 1);
      placed.push({ ...item, x: nextX, y: nextY });
      nextX += width;
    }
    nextY += rowHeight;
  }
  return placed;
};

const scaleLayoutForCols = (layouts = [], targetCols = GRID_COLS, sourceCols = GRID_COLS) => {
  const base = clampLayoutInBounds(layouts, sourceCols);
  if (targetCols >= sourceCols) {
    return base.map((item, idx) => normalizeLayoutItem(item, idx, item.i, { lock: true }));
  }
  return clampLayoutInBounds(
    base.map((item, idx) => {
      const sourceW = Math.max(1, Number(item.w) || 1);
      const sourceX = Math.max(0, Number(item.x) || 0);
      const scaledW = Math.max(1, Math.min(targetCols, Math.round((sourceW / sourceCols) * targetCols)));
      const scaledX = Math.max(0, Math.min(targetCols - scaledW, Math.round((sourceX / sourceCols) * targetCols)));
      return normalizeLayoutItem({ ...item, x: scaledX, w: scaledW }, idx, item.i, { lock: true });
    }),
    targetCols,
  );
};

/** Phone/tablet: one card per row, full width, same top-to-bottom order as builder. */
const stackLayoutForMobile = (layouts = [], cols = GRID_COLS) => {
  const sorted = [...(layouts || [])].sort((a, b) => {
    const yDiff = (Number(a.y) || 0) - (Number(b.y) || 0);
    if (yDiff !== 0) return yDiff;
    return (Number(a.x) || 0) - (Number(b.x) || 0);
  });
  let y = 0;
  return sorted.map((item, idx) => {
    const desktopH = Math.max(1, Number(item.h) || 2);
    const h = desktopH <= 1 ? 1 : Math.max(2, Math.min(desktopH, 3));
    const next = normalizeLayoutItem({ ...item, x: 0, w: cols, y, h }, idx, item.i, { lock: true });
    y += h;
    return next;
  });
};

const buildResponsiveReadOnlyLayouts = (layout = []) => {
  const desktop = layout.map((item, idx) => normalizeLayoutItem(item, idx, item.i, { lock: true }));
  const mobile = stackLayoutForMobile(layout, GRID_COLS);
  return {
    lg: desktop,
    md: desktop,
    sm: mobile,
    xs: mobile,
    xxs: mobile,
  };
};

const buildDefaultLayout = (idx = 0) => ({
  x: (idx * 2) % 12,
  y: idx * 2,
  w: 3,
  h: 2,
});

const buildInitialLayoutForType = (rawType, idx, id) => {
  const base = normalizeLayoutItem({}, idx, id);
  if (rawType === "kpi") {
    return normalizeLayoutItem({ ...base, w: 3, h: 2 }, idx, id);
  }
  if (rawType === "table") {
    return normalizeLayoutItem({ ...base, w: 12, h: 4 }, idx, id);
  }
  if (rawType === "graph") {
    return normalizeLayoutItem({ ...base, w: 12, h: 4 }, idx, id);
  }
  if (rawType === "heading") {
    return normalizeLayoutItem({ ...base, w: 12, h: 1 }, idx, id);
  }
  return base;
};

const normalizeLayoutItem = (rawLayout = {}, idx = 0, id = "", { lock = false } = {}) => {
  const fallback = buildDefaultLayout(idx);
  const hasFiniteNumber = (value) =>
    value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const shouldLock = Boolean(lock);
  const normalized = {
    i: String(id || rawLayout.i || `tmp_${Date.now()}`),
    x: hasFiniteNumber(rawLayout.x) ? Number(rawLayout.x) : fallback.x,
    y: hasFiniteNumber(rawLayout.y) ? Number(rawLayout.y) : fallback.y,
    w: hasFiniteNumber(rawLayout.w) ? Math.max(1, Number(rawLayout.w)) : fallback.w,
    h: hasFiniteNumber(rawLayout.h) ? Math.max(1, Number(rawLayout.h)) : fallback.h,
    minW: 1,
    minH: 1,
    static: shouldLock,
    isResizable: !shouldLock,
    isDraggable: !shouldLock,
  };
  return normalized;
};

const enforceLayoutByType = (rawType, layout = {}) => {
  const next = { ...(layout || {}) };
  return next;
};

export default function DashboardBuilder({
  readOnly = false,
  embedMode = false,
  appKey = "ims",
  pageKey = "default",
  emptyTitle = "Dashboard",
}) {
  const role = useSelector((state) => state.auth.role);
  const user = useSelector((state) => state.auth.user);
  const canAccess = useCanAccess();
  const canFilterByUser = useMemo(() => canFilterDashboardByUser(role, user), [role, user]);
  const searchParams = useSearchParams();
  const canvasContainerRef = useRef(null);
  const cloneButtonRef = useRef(null);
  const savedFingerprintRef = useRef("");
  const pendingActionRef = useRef(null);
  const widgetsRef = useRef([]);
  const historyPastRef = useRef([]);
  const historyFutureRef = useRef([]);
  const historyApplyingRef = useRef(false);
  const historyGroupActiveRef = useRef(false);
  const historyGroupTimerRef = useRef(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [clonePanelPos, setClonePanelPos] = useState({ top: 0, right: 16, maxHeight: 520 });
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const [widgets, setWidgets] = useState([]);
  const [layout, setLayout] = useState([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const layoutRef = useRef([]);
  const [targetAppKey, setTargetAppKey] = useState(String(appKey || "ims").toLowerCase());
  const [selectedWidgetId, setSelectedWidgetId] = useState(null);
  const [panelWidgetSnapshot, setPanelWidgetSnapshot] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [userOptions, setUserOptions] = useState([]);
  const [dashboardOptions, setDashboardOptions] = useState([
    { value: "default", label: "Default", scope: "global", targetUserIds: [] },
  ]);
  const [selectedDashboardKey, setSelectedDashboardKey] = useState("default");
  const [cloneName, setCloneName] = useState("");
  const [showClonePanel, setShowClonePanel] = useState(false);
  const [selectedAudienceUserIds, setSelectedAudienceUserIds] = useState([]);
  const [cloneAudienceUserIds, setCloneAudienceUserIds] = useState([]);
  const filters = useMemo(() => {
    const today = dayjs().format("YYYY-MM-DD");
    const urlUserId = String(searchParams?.get("df_user") || "").trim();
    return {
      fromDate: String(searchParams?.get("df_from") || today).trim(),
      toDate: String(searchParams?.get("df_to") || today).trim(),
      userId: canFilterByUser ? urlUserId : "",
    };
  }, [searchParams, canFilterByUser]);
  const filterRefreshToken = String(searchParams?.get("df_r") || "");
  // Start busy=true so dashboard never briefly flashes DashboardHome before data arrives
  const [busy, setBusy] = useState(true);
  useEscapeKey(() => setSelectedWidgetId(null), !readOnly && Boolean(selectedWidgetId) && !showClonePanel);
  useEscapeKey(() => setShowClonePanel(false), !readOnly && showClonePanel);

  const closeClonePanel = () => {
    setShowClonePanel(false);
  };

  const openClonePanel = () => {
    setCloneAudienceUserIds([]);
    setShowClonePanel(true);
  };

  const updateClonePanelPosition = useCallback(() => {
    const button = cloneButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const gap = 8;
    const panelHeightEstimate = 420;
    const spaceBelow = window.innerHeight - rect.bottom - gap - 16;
    const spaceAbove = rect.top - gap - 16;
    const openBelow = spaceBelow >= 240 || spaceBelow >= spaceAbove;
    const top = openBelow
      ? rect.bottom + gap
      : Math.max(16, rect.top - gap - Math.min(panelHeightEstimate, spaceAbove));
    const maxHeight = Math.max(180, openBelow ? spaceBelow : spaceAbove);
    setClonePanelPos({
      top,
      right: Math.max(12, window.innerWidth - rect.right),
      maxHeight: Math.min(520, maxHeight),
    });
  }, []);

  useLayoutEffect(() => {
    if (!showClonePanel) return undefined;
    updateClonePanelPosition();
    window.addEventListener("resize", updateClonePanelPosition);
    window.addEventListener("scroll", updateClonePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updateClonePanelPosition);
      window.removeEventListener("scroll", updateClonePanelPosition, true);
    };
  }, [showClonePanel, updateClonePanelPosition, widgets.length]);

  const captureSavedFingerprint = useCallback((nextWidgets = [], nextLayout = []) => {
    savedFingerprintRef.current = buildStateFingerprint(nextWidgets, nextLayout);
  }, []);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  const refreshHistoryFlags = useCallback(() => {
    setHistoryTick((tick) => tick + 1);
  }, []);

  const resetHistory = useCallback(() => {
    historyPastRef.current = [];
    historyFutureRef.current = [];
    historyGroupActiveRef.current = false;
    clearTimeout(historyGroupTimerRef.current);
    refreshHistoryFlags();
  }, [refreshHistoryFlags]);

  const applyHistorySnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    historyApplyingRef.current = true;
    const nextLayout = (snapshot.layout || []).map((item, idx) =>
      normalizeLayoutItem(item, idx, item.i || item.id),
    );
    layoutRef.current = nextLayout;
    setWidgets(snapshot.widgets || []);
    setLayout(nextLayout);
    setSelectedWidgetId((prev) => {
      if (!prev) return null;
      return (snapshot.widgets || []).some((w) => String(w.id) === String(prev)) ? prev : null;
    });
    window.setTimeout(() => {
      historyApplyingRef.current = false;
    }, 0);
  }, []);

  const captureHistoryBeforeChange = useCallback(() => {
    if (readOnly || busy || historyApplyingRef.current) return;
    const snapshot = cloneBuilderSnapshot(
      widgetsRef.current,
      layoutRef.current?.length ? layoutRef.current : layout,
    );
    const past = historyPastRef.current;
    if (past.length && past[past.length - 1].fingerprint === snapshot.fingerprint) return;
    historyPastRef.current = [...past.slice(-(HISTORY_LIMIT - 1)), snapshot];
    historyFutureRef.current = [];
    refreshHistoryFlags();
  }, [readOnly, busy, layout, refreshHistoryFlags]);

  const markHistoryGroupedEdit = useCallback(() => {
    if (!historyGroupActiveRef.current) {
      captureHistoryBeforeChange();
      historyGroupActiveRef.current = true;
    }
    clearTimeout(historyGroupTimerRef.current);
    historyGroupTimerRef.current = window.setTimeout(() => {
      historyGroupActiveRef.current = false;
    }, 700);
  }, [captureHistoryBeforeChange]);

  const handleUndo = useCallback(() => {
    if (readOnly || busy || historyApplyingRef.current) return;
    const past = historyPastRef.current;
    if (!past.length) return;
    const current = cloneBuilderSnapshot(
      widgetsRef.current,
      layoutRef.current?.length ? layoutRef.current : layout,
    );
    const previous = past[past.length - 1];
    historyPastRef.current = past.slice(0, -1);
    historyFutureRef.current = [current, ...historyFutureRef.current].slice(0, HISTORY_LIMIT);
    applyHistorySnapshot(previous);
    refreshHistoryFlags();
  }, [readOnly, busy, layout, applyHistorySnapshot, refreshHistoryFlags]);

  const handleRedo = useCallback(() => {
    if (readOnly || busy || historyApplyingRef.current) return;
    const future = historyFutureRef.current;
    if (!future.length) return;
    const current = cloneBuilderSnapshot(
      widgetsRef.current,
      layoutRef.current?.length ? layoutRef.current : layout,
    );
    const next = future[0];
    historyFutureRef.current = future.slice(1);
    historyPastRef.current = [...historyPastRef.current, current].slice(-HISTORY_LIMIT);
    applyHistorySnapshot(next);
    refreshHistoryFlags();
  }, [readOnly, busy, layout, applyHistorySnapshot, refreshHistoryFlags]);

  const canUndo = useMemo(() => historyPastRef.current.length > 0, [historyTick]);
  const canRedo = useMemo(() => historyFutureRef.current.length > 0, [historyTick]);

  useEffect(() => {
    if (readOnly) return undefined;
    const onKeyDown = (event) => {
      const target = event.target;
      const tag = String(target?.tagName || "").toUpperCase();
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target?.isContentEditable);
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        if (isEditable) return;
        event.preventDefault();
        handleUndo();
        return;
      }
      if (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) {
        if (isEditable) return;
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readOnly, handleUndo, handleRedo]);

  const isDirty = useMemo(() => {
    if (readOnly || busy) return false;
    return buildStateFingerprint(widgets, layout) !== savedFingerprintRef.current;
  }, [widgets, layout, readOnly, busy]);

  const runPendingAction = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setShowUnsavedModal(false);
    if (typeof action === "function") action();
  }, []);

  const requestUnsavedGuard = useCallback((action) => {
    if (!action) return;
    if (!isDirty) {
      action();
      return;
    }
    pendingActionRef.current = action;
    setShowUnsavedModal(true);
  }, [isDirty]);

  useEffect(() => {
    if (readOnly || !isDirty) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [readOnly, isDirty]);

  useEffect(() => {
    if (readOnly || !isDirty) return undefined;
    const handleDocumentClick = (event) => {
      const anchor = event.target.closest("a[href]");
      if (!anchor || anchor.target === "_blank") return;
      const href = String(anchor.getAttribute("href") || "").trim();
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      if (href === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      pendingActionRef.current = () => {
        window.location.href = href;
      };
      setShowUnsavedModal(true);
    };
    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [readOnly, isDirty]);

  const pageOptions = useMemo(
    () => filterAppNavPagesByAccess(targetAppKey, canAccess, role),
    [targetAppKey, canAccess, role],
  );

  const resolvedPageKey = readOnly
    ? String(pageKey || "dashboard").toLowerCase()
    : DASHBOARD_STORAGE_PAGE_KEY;

  useEffect(() => {
    const node = canvasContainerRef.current;
    if (!node) return undefined;

    const updateWidth = () => {
      let measured = Math.max(0, node.clientWidth || 0);
      if (measured < 200) {
        measured = Math.max(measured, node.getBoundingClientRect?.().width || 0);
        let parent = node.parentElement;
        while (parent && measured < 200) {
          measured = Math.max(measured, parent.clientWidth || 0);
          parent = parent.parentElement;
        }
      }
      if (readOnly && measured < 200 && typeof window !== "undefined") {
        measured = Math.max(measured, window.innerWidth - 280);
      }
      setContainerWidth(measured);
    };

    updateWidth();
    const frameId = window.requestAnimationFrame(updateWidth);

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(node);
    if (node.parentElement) {
      observer.observe(node.parentElement);
    }

    window.addEventListener("resize", updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
      window.cancelAnimationFrame(frameId);
    };
  }, [readOnly, selectedWidgetId, busy, widgets.length]);

  const mapWidgetRow = (row, idx) => {
    const rawType = row.type === "count" || row.type === "sum" ? "kpi" : row.type;
    return {
      ...row,
      rawType,
      metricType: row.type === "sum" ? "sum" : "count",
      type:
        row.type === "graph"
          ? row?.chart_config?.chart_type || "bar"
          : typeToDisplayType[row.type] || "table",
      query: row.query || "",
      erpFilter: row?.chart_config?.erp_filter || {},
      previewData: null,
      previewError: null,
      style: mergeWidgetStyle(rawType, row?.chart_config),
      emptyText: row?.chart_config?.emptyText || "Click edit and add query",
      dataSource: row?.chart_config?.data_source || "ims_postgresql",
      audienceScope: row?.audience_scope || "global",
      targetUserIds: Array.isArray(row?.target_user_ids) ? row.target_user_ids : [],
      sectionId: row?.chart_config?.section_id ?? null,
      targetPageKey: row?.target_page_key || row?.targetPageKey || "dashboard",
      targetPageModule: row?.target_page_module || row?.targetPageModule || null,
      layout: normalizeLayoutItem(
        enforceLayoutByType(rawType, row.layout && typeof row.layout === "object" ? row.layout : {}),
        idx,
        row.id,
      ),
    };
  };

  const loadWidgets = async (overrideDashboardKey) => {
    try {
      setBusy(true);
      setLoadError(null);
      const resolvedAppKey = String((readOnly ? appKey : targetAppKey) || "ims").toLowerCase();
      const resolvedDashboardKey = String(overrideDashboardKey || selectedDashboardKey || "default").toLowerCase();
      const apiPageKey = readOnly ? resolvedPageKey : DASHBOARD_STORAGE_PAGE_KEY;
      const res = readOnly
        ? await getDashboardWidgets(resolvedAppKey, apiPageKey, filters, resolvedDashboardKey)
        : await listWidgets(resolvedAppKey, apiPageKey, resolvedDashboardKey);
      const rows = res?.data || [];
      let mapped = rows.map((row, idx) => mapWidgetRow(row, idx));

      // Builder should reopen with live data, not blank "No Data Found" cards.
      if (!readOnly) {
        const previewResults = await Promise.all(
          mapped.map(async (widget) => {
            if (!requiresDataQuery(widget.rawType) || !String(widget.query || "").trim()) {
              return { id: String(widget.id), data: null, error: null };
            }
            try {
              const response = await previewWidget(widget.query, {
                dbSource: widget.dataSource || "ims_postgresql",
                filters,
                erpFilter: widget.erpFilter || {},
              });
              return { id: String(widget.id), data: response?.data || [], error: null };
            } catch (error) {
              return { id: String(widget.id), data: [], error: error?.message || "Preview failed." };
            }
          }),
        );
        const previewById = new Map(previewResults.map((item) => [item.id, item]));
        mapped = mapped.map((widget) => {
          const preview = previewById.get(String(widget.id));
          if (!preview) return widget;
          return {
            ...widget,
            previewData: preview.data,
            previewError: preview.error,
          };
        });
      }
      if (readOnly) {
        mapped = mapped.map((widget) => ({
          ...widget,
          previewData: widget.data ?? widget.previewData ?? [],
          previewError: widget.error ?? widget.previewError ?? null,
        }));
      }
      setWidgets(mapped);
      const nextLayout = mapped.map((w, idx) => normalizeLayoutItem(w.layout || {}, idx, w.id));
      layoutRef.current = nextLayout;
      setLayout(nextLayout);
      if (!readOnly) {
        resetHistory();
        captureSavedFingerprint(mapped, nextLayout);
        const hasCurrentSelection = mapped.some((w) => String(w.id) === String(selectedWidgetId));
        if (hasCurrentSelection) return;
        if (mapped.length > 0) {
          setSelectedWidgetId(mapped[0].id);
        }
      }
    } catch (err) {
      setLoadError(err?.message || "Failed to load dashboard.");
    } finally {
      setBusy(false);
    }
  };

  const visibleWidgets = useMemo(() => widgets.filter((w) => w.rawType !== "section"), [widgets]);

  const visibleLayout = useMemo(() => {
    const ids = new Set(visibleWidgets.map((w) => String(w.id)));
    return layout.filter((l) => ids.has(String(l.i)));
  }, [layout, visibleWidgets]);

  const selectedDashboardOption = dashboardOptions.find((option) => option.value === selectedDashboardKey) || null;
  const selectedDashboardLabel = selectedDashboardOption?.label || "Default";
  const selectedDashboardPublished = selectedDashboardOption?.published === true;
  const isNonDefaultDashboard = selectedDashboardKey !== "default";
  const isCanvasLocked = readOnly;
  const hasSpecificUsers = selectedAudienceUserIds.length > 0;

  const dashboardTargetUsersForSave = useMemo(() => {
    if (selectedDashboardKey === "default") return [];
    const fromUi = selectedAudienceUserIds.map(Number).filter(Number.isFinite);
    if (fromUi.length) return fromUi;
    if (selectedDashboardOption?.scope === "users") {
      const fromOption = Array.isArray(selectedDashboardOption.targetUserIds)
        ? selectedDashboardOption.targetUserIds.map(Number).filter(Number.isFinite)
        : [];
      if (fromOption.length) return fromOption;
    }
    return [];
  }, [selectedDashboardKey, selectedDashboardOption, selectedAudienceUserIds]);

  const dashboardScopeForSave = useMemo(() => {
    if (selectedDashboardKey === "default") return "global";
    if (dashboardTargetUsersForSave.length) return "users";
    if (selectedDashboardOption?.scope === "users") return "users";
    return "global";
  }, [selectedDashboardKey, selectedDashboardOption, dashboardTargetUsersForSave.length]);

  const renderedLayout = useMemo(() => {
    const source = readOnly ? clampLayoutInBounds(visibleLayout, GRID_COLS) : visibleLayout;
    const normalized = source.map((item, idx) => {
      if (!isCanvasLocked) {
        return normalizeLayoutItem(item, idx, item.i || item.id);
      }
      return normalizeLayoutItem(item, idx, item.i || item.id, { lock: true });
    });
    return readOnly ? compactLayoutForLiveView(normalized) : normalized;
  }, [visibleLayout, readOnly, isCanvasLocked]);

  const renderedLayouts = useMemo(() => {
    const locked = renderedLayout.map((item, idx) =>
      normalizeLayoutItem(item, idx, item.i || item.id, { lock: readOnly }),
    );
    if (readOnly) {
      return buildResponsiveReadOnlyLayouts(locked);
    }
    return { lg: locked.map((item, idx) => normalizeLayoutItem(item, idx, item.i || item.id, {})) };
  }, [renderedLayout, readOnly]);

  const activeBreakpoints = readOnly ? VIEW_BREAKPOINTS : BUILDER_BREAKPOINTS;
  const activeColsMap = readOnly ? VIEW_COLS_MAP : BUILDER_COLS_MAP;

  useEffect(() => {
    setTargetAppKey(String(appKey || "ims").toLowerCase());
  }, [appKey]);

  useEffect(() => {
    const loadDashboardOptions = async () => {
      if (readOnly) return;
      try {
        const response = await listDashboardConfigs({ appKey: targetAppKey, pageKey: DASHBOARD_STORAGE_PAGE_KEY });
        const rows = Array.isArray(response?.data) ? response.data : [];
        const normalized = rows.length
          ? rows.map((row) => ({
            value: String(row.dashboard_key || "default"),
            label: String(row.dashboard_name || row.dashboard_key || "Dashboard"),
            scope: String(row.scope || "global"),
            targetUserIds: Array.isArray(row.target_user_ids) ? row.target_user_ids : [],
            published: row.published === true,
          }))
          : [{ value: "default", label: "Default", scope: "global", targetUserIds: [], published: false }];
        const dedup = new Map();
        normalized.forEach((row) => {
          if (!dedup.has(row.value)) dedup.set(row.value, row);
        });
        const options = Array.from(dedup.values());
        setDashboardOptions(options);
        setSelectedDashboardKey((current) =>
          options.some((opt) => opt.value === current) ? current : (options[0]?.value || "default"),
        );
      } catch (_error) {
        setDashboardOptions([{ value: "default", label: "Default", scope: "global", targetUserIds: [], published: false }]);
        setSelectedDashboardKey("default");
      }
    };
    loadDashboardOptions();
  }, [readOnly, targetAppKey]);

  const refreshDashboardOptions = async () => {
    if (readOnly) return;
    try {
      const response = await listDashboardConfigs({ appKey: targetAppKey, pageKey: DASHBOARD_STORAGE_PAGE_KEY });
      const rows = Array.isArray(response?.data) ? response.data : [];
      const normalized = rows.length
        ? rows.map((row) => ({
          value: String(row.dashboard_key || "default"),
          label: String(row.dashboard_name || row.dashboard_key || "Dashboard"),
          scope: String(row.scope || "global"),
          targetUserIds: Array.isArray(row.target_user_ids) ? row.target_user_ids : [],
          published: row.published === true,
        }))
        : [{ value: "default", label: "Default", scope: "global", targetUserIds: [], published: false }];
      const dedup = new Map();
      normalized.forEach((row) => {
        if (!dedup.has(row.value)) dedup.set(row.value, row);
      });
      setDashboardOptions(Array.from(dedup.values()));
    } catch (_error) {
      // Keep existing options on refresh failure.
    }
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await api(CORE_ENDPOINTS.USERS.LIST, {
          method: "POST",
          body: { page: 1, limit: 5000, filters: { status: "active" } },
        });
        const rows = Array.isArray(response?.data) ? response.data : [];
        setUserOptions(
          rows.map((row) => ({
            value: String(row.id),
            label: row.name || row.username || `User ${row.id}`,
          })),
        );
      } catch (_error) {
        setUserOptions([]);
      }
    };
    loadUsers();
  }, []);

  useEffect(() => {
    if (!showClonePanel || userOptions.length > 0) return;
    const reloadUsers = async () => {
      try {
        const response = await api(CORE_ENDPOINTS.USERS.LIST, {
          method: "POST",
          body: { page: 1, limit: 5000, filters: { status: "active" } },
        });
        const rows = Array.isArray(response?.data) ? response.data : [];
        setUserOptions(
          rows.map((row) => ({
            value: String(row.id),
            label: row.name || row.username || `User ${row.id}`,
          })),
        );
      } catch (_error) {
        setUserOptions([]);
      }
    };
    reloadUsers();
  }, [showClonePanel, userOptions.length]);

  useEffect(() => {
    loadWidgets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, appKey, pageKey, targetAppKey, resolvedPageKey, selectedDashboardKey, filters.fromDate, filters.toDate, filters.userId, filterRefreshToken]);

  const selectedWidget = widgets.find((w) => String(w.id) === String(selectedWidgetId));
  const panelWidget = selectedWidget || (busy ? panelWidgetSnapshot : null);

  useEffect(() => {
    if (selectedDashboardKey === "default") {
      setSelectedAudienceUserIds([]);
      return;
    }
    if (!selectedDashboardOption) return;
    if (selectedDashboardOption.scope === "users") {
      setSelectedAudienceUserIds(
        Array.isArray(selectedDashboardOption.targetUserIds)
          ? selectedDashboardOption.targetUserIds.map(Number).filter(Number.isFinite)
          : [],
      );
      return;
    }
    setSelectedAudienceUserIds([]);
  }, [selectedDashboardKey, selectedDashboardOption]);

  const handleBuilderAppChange = (nextAppKey) => {
    const normalizedAppKey = String(nextAppKey || "ims").toLowerCase();
    requestUnsavedGuard(() => {
      setTargetAppKey(normalizedAppKey);
      setSelectedDashboardKey("default");
      setSelectedAudienceUserIds([]);
      setSelectedWidgetId(null);
    });
  };
  const selectedLayout = selectedWidget
    ? layout.find((l) => String(l.i) === String(selectedWidget.id)) || selectedWidget.layout || null
    : null;
  // Canvas fills the actual measured container width.
  // Panel is a flex sibling so containerWidth already excludes it.
  // Grid w/h are proportional (out of 12 cols) so layouts look consistent.
  const measuredCanvasWidth = Math.max(0, containerWidth || 0);
  const canvasWidth = useMemo(() => {
    if (measuredCanvasWidth >= 200) return measuredCanvasWidth;
    if (readOnly && typeof window !== "undefined") {
      return Math.max(measuredCanvasWidth, window.innerWidth - 280);
    }
    return Math.max(320, measuredCanvasWidth);
  }, [measuredCanvasWidth, readOnly]);
  const gridReady = canvasWidth >= 200;

  useLayoutEffect(() => {
    if (!readOnly || busy) return;
    const node = canvasContainerRef.current;
    if (!node) return;
    const measured = Math.max(node.clientWidth || 0, node.getBoundingClientRect?.().width || 0);
    if (measured >= 200) {
      setContainerWidth(measured);
    }
  }, [readOnly, busy, widgets.length]);

  const colWidth = Math.max(20, (Math.max(0, canvasWidth - GRID_GAP_X * (GRID_COLS - 1))) / GRID_COLS);
  const widthPx = selectedLayout
    ? Math.round((selectedLayout.w || 1) * colWidth + Math.max(0, (selectedLayout.w || 1) - 1) * GRID_GAP_X)
    : 0;
  const heightPx = selectedLayout
    ? Math.round(
        (selectedLayout.h || 1) * GRID_ROW_HEIGHT + Math.max(0, (selectedLayout.h || 1) - 1) * GRID_GAP_Y,
      )
    : 0;

  const clamp = (num, min, max) => Math.min(max, Math.max(min, num));
  const pixelToGridW = (px) =>
    clamp(Math.round((Math.max(1, Number(px)) + GRID_GAP_X) / (colWidth + GRID_GAP_X)), 1, GRID_COLS);
  const pixelToGridH = (px) =>
    clamp(
      Math.round((Math.max(1, Number(px)) + GRID_GAP_Y) / (GRID_ROW_HEIGHT + GRID_GAP_Y)),
      1,
      30,
    );

  const handlePixelSizeChange = ({ widthPx: nextWidthPx, heightPx: nextHeightPx }) => {
    if (isCanvasLocked || !selectedWidget) return;
    captureHistoryBeforeChange();
    const current = selectedLayout
      ? normalizeLayoutItem(selectedLayout, 0, selectedWidget.id)
      : normalizeLayoutItem({}, 0, selectedWidget.id);
    const next = normalizeLayoutItem(
      {
        ...current,
        w: nextWidthPx != null ? pixelToGridW(nextWidthPx) : current.w,
        h: nextHeightPx != null ? pixelToGridH(nextHeightPx) : current.h,
      },
      0,
      selectedWidget.id,
    );
    updateWidgetLocal({ ...selectedWidget, layout: next });
  };

  const normalizedRole = String(role || "").toLowerCase().trim();

  useEffect(() => {
    if (selectedWidget) {
      setPanelWidgetSnapshot(selectedWidget);
    }
  }, [selectedWidget]);
  if (!readOnly && normalizedRole !== "super_admin" && normalizedRole !== "super admin") {
    return (
      <div className="h-full min-h-0 flex items-center justify-center bg-[#f8fafc]">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center max-w-md">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Access Restricted</h2>
          <p className="text-xs text-slate-500 mt-2">Widget Builder is available only for Super Admin.</p>
        </div>
      </div>
    );
  }

  // Show loading spinner while fetching on dashboard
  if (readOnly && busy) {
    return (
      <div className="h-full min-h-0 flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error if dashboard data failed to load
  if (readOnly && loadError) {
    return (
      <div className="h-full min-h-0 flex items-center justify-center bg-[#f8fafc]">
        <div className="bg-white border border-rose-200 rounded-xl shadow-sm p-8 text-center max-w-md">
          <h2 className="text-sm font-bold text-rose-700 uppercase tracking-widest mb-2">Failed to Load</h2>
          <p className="text-xs text-slate-500">{loadError}</p>
          <button
            onClick={loadWidgets}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // In normal dashboard view, if no published/accessible widgets,
  // show legacy welcome screen directly (no builder header/title area).
  if (readOnly && !embedMode && !busy && visibleWidgets.length === 0) {
    return <DashboardHome title={emptyTitle} />;
  }

  if (readOnly && embedMode && !busy && visibleWidgets.length === 0) {
    return null;
  }

  const addWidget = (rawType) => {
    captureHistoryBeforeChange();
    const id = `tmp_${Date.now()}`;
    const type = rawType === "graph" ? "bar" : typeToDisplayType[rawType] || "table";
    const temp = {
      id,
      rawType,
      type,
      title: "",
      description: "",
      query: "",
      dataSource: "ims_postgresql",
      audienceScope: "global",
      targetUserIds: [],
      sectionId: null,
      style: defaultWidgetStyle(rawType),
      emptyText: "Click edit and add query",
      previewData: null,
      previewError: null,
      is_active: true,
      targetPageKey: getDefaultPageKeyForApp(targetAppKey, canAccess, role),
      targetPageModule: null,
    };

    setWidgets((prev) => [...prev, temp]);
    if (rawType === "heading") {
      const anchor = layout.find((l) => String(l.i) === String(selectedWidgetId));
      if (anchor && Number.isFinite(Number(anchor.y))) {
        setLayout((prev) => {
          const headingLayout = buildInitialLayoutForType(rawType, prev.length, id);
          const insertY = Number(anchor.y);
          const shifted = prev.map((l) => {
            if (Number(l.y) >= insertY) return { ...l, y: Number(l.y) + headingLayout.h };
            return l;
          });
          const next = [...shifted, { ...headingLayout, x: 0, y: insertY }];
          layoutRef.current = next;
          return next;
        });
        setSelectedWidgetId(id);
        return;
      }
    }
    setLayout((prev) => {
      const next = [...prev, buildInitialLayoutForType(rawType, prev.length, id)];
      layoutRef.current = next;
      return next;
    });
    setSelectedWidgetId(id);
  };

  const syncLayoutFromCanvas = (sourceLayout = []) => {
    if (isCanvasLocked) return;
    const normalizedNext = sourceLayout.map((l, idx) => normalizeLayoutItem(l, idx, l.i));
    layoutRef.current = normalizedNext;
    setLayout(normalizedNext);
    setWidgets((prev) =>
      prev.map((w) => {
        const matched = normalizedNext.find((l) => String(l.i) === String(w.id));
        return matched ? { ...w, layout: matched } : w;
      }),
    );
  };

  const handleDragStop = (nextLayout) => {
    captureHistoryBeforeChange();
    syncLayoutFromCanvas(nextLayout || []);
  };

  const handleResizeStop = (nextLayout) => {
    captureHistoryBeforeChange();
    syncLayoutFromCanvas(nextLayout || []);
  };

  const updateWidgetLocal = (updatedWidget) => {
    if (!updatedWidget) {
      captureHistoryBeforeChange();
      setWidgets((prev) => prev.filter((w) => String(w.id) !== String(selectedWidgetId)));
      setLayout((prev) => {
        const next = prev.filter((l) => String(l.i) !== String(selectedWidgetId));
        layoutRef.current = next;
        return next;
      });
      setSelectedWidgetId(null);
      return;
    }
    markHistoryGroupedEdit();
    setWidgets((prev) => prev.map((w) => (String(w.id) === String(updatedWidget.id) ? updatedWidget : w)));
    if (updatedWidget.layout) {
      setLayout((prev) => {
        const next = prev.map((l, idx) =>
          String(l.i) === String(updatedWidget.id)
            ? normalizeLayoutItem({ ...l, ...updatedWidget.layout }, idx, updatedWidget.id)
            : l,
        );
        layoutRef.current = next;
        return next;
      });
    }
  };

  const handlePreview = async (widget) => {
    try {
      if (!requiresDataQuery(widget.rawType)) {
        setWidgets((prev) =>
          prev.map((w) => (String(w.id) === String(widget.id) ? { ...w, previewData: [], previewError: null } : w)),
        );
        return;
      }
      setBusy(true);
      const res = await previewWidget(widget.query, {
        dbSource: widget.dataSource || "ims_postgresql",
        filters,
        erpFilter: widget.erpFilter || {},
      });
      setWidgets((prev) =>
        prev.map((w) =>
          String(w.id) === String(widget.id)
            ? { ...w, previewData: res?.data || [], previewError: null }
            : w,
        ),
      );
    } catch (err) {
      setWidgets((prev) =>
        prev.map((w) =>
          String(w.id) === String(widget.id)
            ? { ...w, previewData: [], previewError: err.message || "Preview failed." }
            : w,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveWidget = async (widget, options = {}) => {
    const liveLayout = layoutRef.current?.length ? layoutRef.current : layout;
    const currentLayout =
      liveLayout.find((l) => String(l.i) === String(widget.id)) || normalizeLayoutItem({}, 0, widget.id);
    const withPixelSize = normalizeLayoutItem(
      {
        ...currentLayout,
        w: options?.widthPx != null ? pixelToGridW(options.widthPx) : currentLayout.w,
        h: options?.heightPx != null ? pixelToGridH(options.heightPx) : currentLayout.h,
      },
      0,
      widget.id,
    );
    const resolvedLayout = normalizeLayoutItem(
      enforceLayoutByType(widget.rawType, withPixelSize),
      0,
      widget.id,
    );
    const payload = {
      title: widget.title,
      description: widget.description || "",
      type: resolveApiType(widget),
      query: requiresDataQuery(widget.rawType) ? widget.query || "" : "",
      audience_scope: widget.audienceScope || "global",
      target_user_ids: Array.isArray(widget.targetUserIds) ? widget.targetUserIds : [],
      chart_config: chartConfigFromWidgetStyle(widget),
      app_key: targetAppKey,
      page_key: DASHBOARD_STORAGE_PAGE_KEY,
      target_page_key: widget.targetPageKey || "dashboard",
      target_page_module: widget.targetPageModule || null,
      dashboard_key: selectedDashboardKey,
      dashboard_name: selectedDashboardLabel,
      dashboard_scope: dashboardScopeForSave,
      dashboard_target_user_ids: dashboardTargetUsersForSave,
      layout: resolvedLayout,
      is_active: widget.is_active !== false,
      is_published: false,
    };

    try {
      setBusy(true);
      setLayout((prev) => {
        const next = prev.map((l, idx) =>
          String(l.i) === String(widget.id) ? normalizeLayoutItem({ ...l, ...resolvedLayout }, idx, widget.id) : l,
        );
        layoutRef.current = next;
        return next;
      });
      const isTemp = String(widget.id).startsWith("tmp_");
      const res = isTemp ? await createWidget(payload) : await updateWidgetApi(widget.id, payload);
      const saved = res?.data;
      if (!saved) return;

      setWidgets((prev) =>
        prev.map((w) =>
          String(w.id) === String(widget.id)
            ? {
                ...w,
                ...saved,
                id: saved.id,
                rawType: saved.type === "count" || saved.type === "sum" ? "kpi" : saved.type,
                metricType: saved.type === "sum" ? "sum" : "count",
                type:
                  saved.type === "graph"
                    ? saved?.chart_config?.chart_type || "bar"
                    : typeToDisplayType[saved.type] || "table",
                query: saved.query || "",
                erpFilter: saved?.chart_config?.erp_filter || {},
                emptyText: saved?.chart_config?.emptyText || "Click edit and add query",
                dataSource: saved?.chart_config?.data_source || "ims_postgresql",
                audienceScope: saved?.audience_scope || "global",
                targetUserIds: Array.isArray(saved?.target_user_ids) ? saved.target_user_ids : [],
                sectionId: saved?.chart_config?.section_id ?? null,
                targetPageKey: saved?.target_page_key || widget.targetPageKey || "dashboard",
                targetPageModule: saved?.target_page_module || widget.targetPageModule || null,
                style: mergeWidgetStyle(
                  saved.type === "count" || saved.type === "sum" ? "kpi" : saved.type,
                  saved?.chart_config,
                ),
              }
            : w,
        ),
      );
      setLayout((prev) => {
        const next = prev.map((l, idx) =>
          String(l.i) === String(widget.id) ? normalizeLayoutItem(l, idx, saved.id) : l,
        );
        layoutRef.current = next;
        return next;
      });
      setSelectedWidgetId(saved.id);
    } catch (err) {
      alert(err.message || "Failed to save widget.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteWidget = async (widget) => {
    if (!widget) return;
    captureHistoryBeforeChange();
    try {
      setBusy(true);
      const isTemp = String(widget.id).startsWith("tmp_");
      if (!isTemp) await deleteWidget(widget.id, {
        appKey: targetAppKey,
        pageKey: DASHBOARD_STORAGE_PAGE_KEY,
        dashboardKey: selectedDashboardKey,
      });
      setWidgets((prev) => prev.filter((w) => String(w.id) !== String(widget.id)));
      setLayout((prev) => {
        const next = prev.filter((l) => String(l.i) !== String(widget.id));
        layoutRef.current = next;
        return next;
      });
      setSelectedWidgetId(null);
    } catch (err) {
      alert(err.message || "Failed to delete widget.");
    } finally {
      setBusy(false);
    }
  };

  const buildDashboardJsonPayload = () => {
    const liveLayout = layoutRef.current?.length ? layoutRef.current : layout;
    const publishLayout = liveLayout.map((item, idx) => ({
      ...(item || {}),
      i: String(item?.i || item?.id || `layout_${idx}`),
    }));
    const dashboardWidgets = widgets.map((widget) => {
      const currentLayout =
        publishLayout.find((l) => String(l.i) === String(widget.id)) || normalizeLayoutItem({}, 0, widget.id);
      const resolvedLayout = normalizeLayoutItem(
        enforceLayoutByType(widget.rawType, currentLayout),
        0,
        widget.id,
      );
      return normalizeWidgetForDashboardJson(widget, resolvedLayout);
    });
    return {
      publishLayout,
      dashboardJson: {
        version: 1,
        appKey: targetAppKey,
        pageKey: DASHBOARD_STORAGE_PAGE_KEY,
        widgets: dashboardWidgets,
      },
    };
  };

  const handleSaveAllDraft = async () => {
    if (widgets.length === 0) return false;
    try {
      setBusy(true);
      const { publishLayout, dashboardJson } = buildDashboardJsonPayload();
      await saveDashboardDraft({
        appKey: targetAppKey,
        pageKey: DASHBOARD_STORAGE_PAGE_KEY,
        dashboardKey: selectedDashboardKey,
        dashboardName: selectedDashboardLabel,
        scope: dashboardScopeForSave,
        targetUserIds: dashboardTargetUsersForSave,
        dashboardJson,
      });
      layoutRef.current = publishLayout;
      setLayout(publishLayout);
      await loadWidgets();
      return true;
    } catch (err) {
      alert(err.message || "Failed to save dashboard draft.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleDiscardChanges = async () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setShowUnsavedModal(false);
    await loadWidgets();
    setSelectedWidgetId(null);
    if (typeof action === "function") action();
  };

  const handleUnsavedSave = async () => {
    const saved = await handleSaveAllDraft();
    if (saved) runPendingAction();
  };

  const handlePublishAll = async () => {
    if (widgets.length === 0) return;
    try {
      setBusy(true);
      const { publishLayout, dashboardJson } = buildDashboardJsonPayload();

      await publishDashboardConfig({
        appKey: targetAppKey,
        pageKey: DASHBOARD_STORAGE_PAGE_KEY,
        dashboardKey: selectedDashboardKey,
        dashboardName: selectedDashboardLabel,
        scope: dashboardScopeForSave,
        targetUserIds: dashboardTargetUsersForSave,
        dashboardJson,
      });

      layoutRef.current = publishLayout;
      setLayout(publishLayout);
      await refreshDashboardOptions();
      await loadWidgets();
      alert("Dashboard published successfully!");
    } catch (err) {
      alert(err.message || "Failed to publish dashboard.");
    } finally {
      setBusy(false);
    }
  };

  const handleUnpublishAll = async () => {
    if (!selectedDashboardPublished) return;
    if (!window.confirm("Unpublish this dashboard? Live users will no longer see these widgets.")) return;
    try {
      setBusy(true);
      await unpublishDashboardConfig({
        appKey: targetAppKey,
        pageKey: DASHBOARD_STORAGE_PAGE_KEY,
        dashboardKey: selectedDashboardKey,
      });
      await refreshDashboardOptions();
      alert("Dashboard unpublished.");
    } catch (err) {
      alert(err.message || "Failed to unpublish dashboard.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCloneDashboard = async () => {
    if (!isNonDefaultDashboard) return;
    const label = selectedDashboardLabel || selectedDashboardKey;
    const confirmMessage = isDirty
      ? `Delete clone dashboard "${label}"? Unsaved changes will be lost. Assigned users will see the Default dashboard instead.`
      : `Delete clone dashboard "${label}"? Assigned users will see the Default dashboard instead.`;
    if (!window.confirm(confirmMessage)) return;
    try {
      setBusy(true);
      await deleteDashboardConfig({
        appKey: targetAppKey,
        pageKey: DASHBOARD_STORAGE_PAGE_KEY,
        dashboardKey: selectedDashboardKey,
      });
      await refreshDashboardOptions();
      setSelectedDashboardKey("default");
      setSelectedAudienceUserIds([]);
      setSelectedWidgetId(null);
      await loadWidgets("default");
      alert("Clone dashboard deleted.");
    } catch (err) {
      alert(err.message || "Failed to delete clone dashboard.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCloneDashboard = async () => {
    try {
      if (!String(cloneName || "").trim()) {
        alert("Enter dashboard name.");
        return;
      }
      if (widgets.length === 0) {
        alert("Add at least one widget before creating a clone.");
        return;
      }
      const normalizedDashboardKey = String(cloneName)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "") || `clone_${Date.now()}`;
      if (normalizedDashboardKey === "default") {
        alert('Clone name cannot be "default". Please use a different name.');
        return;
      }

      const cloneForAll = !cloneAudienceUserIds.length;
      const cloneUserIds = cloneForAll
        ? userOptions.map((option) => Number(option.value)).filter(Number.isFinite)
        : cloneAudienceUserIds;

      if (!cloneForAll && !cloneUserIds.length) {
        alert("Select at least one user for this clone.");
        return;
      }
      if (cloneForAll && !cloneUserIds.length) {
        alert("User list is not loaded yet. Wait a moment and try again, or select specific users.");
        return;
      }

      setBusy(true);
      const { dashboardJson } = buildDashboardJsonPayload();

      await cloneDashboardToUsers({
        appKey: targetAppKey,
        pageKey: DASHBOARD_STORAGE_PAGE_KEY,
        sourceDashboardKey: selectedDashboardKey,
        dashboardKey: normalizedDashboardKey,
        dashboardName: cloneName,
        userIds: cloneUserIds,
        cloneForAll,
        dashboardJson,
      });
      const refreshed = await listDashboardConfigs({ appKey: targetAppKey, pageKey: DASHBOARD_STORAGE_PAGE_KEY });
      const rows = Array.isArray(refreshed?.data) ? refreshed.data : [];
      const options = rows.length
        ? rows.map((row) => ({
          value: String(row.dashboard_key || "default"),
          label: String(row.dashboard_name || "Dashboard"),
          scope: String(row.scope || "global"),
          targetUserIds: Array.isArray(row.target_user_ids) ? row.target_user_ids : [],
          published: row.published === true,
        }))
        : [{ value: "default", label: "Default", scope: "global", targetUserIds: [], published: false }];
      setDashboardOptions(options);
      setSelectedDashboardKey(normalizedDashboardKey);
      setSelectedAudienceUserIds(cloneUserIds.map(Number).filter(Number.isFinite));
      setShowClonePanel(false);
      setCloneName("");
      setCloneAudienceUserIds([]);
      await loadWidgets(normalizedDashboardKey);
      alert("Clone dashboard created.");
    } catch (error) {
      alert(error?.message || "Failed to create clone dashboard.");
    } finally {
      setBusy(false);
    }
  };

  const handleCloneWidget = async (widget) => {
    if (!widget) return;
    captureHistoryBeforeChange();

    const sourceLayout =
      layout.find((l) => String(l.i) === String(widget.id)) ||
      normalizeLayoutItem({}, layout.length, widget.id);
    const slot = findCloneLayoutSlot(layout, sourceLayout);
    const clonedLayout = {
      ...normalizeLayoutItem(sourceLayout, layout.length, widget.id),
      ...slot,
    };

    const isTemp = String(widget.id).startsWith("tmp_");
    if (isTemp) {
      const localId = `tmp_${Date.now()}`;
      const clonedLocal = {
        ...widget,
        id: localId,
        title: `${widget.title || "Widget"} Copy`,
      };
      setWidgets((prev) => [...prev, clonedLocal]);
      setLayout((prev) => {
        const next = [...prev, normalizeLayoutItem(clonedLayout, prev.length, localId)];
        layoutRef.current = next;
        return next;
      });
      setSelectedWidgetId(localId);
      return;
    }

    const payload = {
      title: `${widget.title || "Widget"} Copy`,
      description: widget.description || "",
      type: resolveApiType(widget),
      query: requiresDataQuery(widget.rawType) ? widget.query || "" : "",
      audience_scope: widget.audienceScope || "global",
      target_user_ids: Array.isArray(widget.targetUserIds) ? widget.targetUserIds : [],
      chart_config: chartConfigFromWidgetStyle(widget),
      app_key: targetAppKey,
      page_key: DASHBOARD_STORAGE_PAGE_KEY,
      target_page_key: widget.targetPageKey || "dashboard",
      target_page_module: widget.targetPageModule || null,
      dashboard_key: selectedDashboardKey,
      dashboard_name: selectedDashboardLabel,
      dashboard_scope: dashboardScopeForSave,
      dashboard_target_user_ids: dashboardTargetUsersForSave,
      layout: normalizeLayoutItem(enforceLayoutByType(widget.rawType, clonedLayout), layout.length, widget.id),
      is_active: widget.is_active !== false,
      is_published: false,
    };

    try {
      setBusy(true);
      const res = await createWidget(payload);
      const saved = res?.data;
      if (!saved) return;

      const mapped = {
        ...saved,
        rawType: saved.type === "count" || saved.type === "sum" ? "kpi" : saved.type,
        metricType: saved.type === "sum" ? "sum" : "count",
        type: saved.type === "graph" ? saved?.chart_config?.chart_type || "bar" : typeToDisplayType[saved.type] || "table",
        query: saved.query || "",
        erpFilter: saved?.chart_config?.erp_filter || {},
        emptyText: saved?.chart_config?.emptyText || "Click edit and add query",
        dataSource: saved?.chart_config?.data_source || "ims_postgresql",
        audienceScope: saved?.audience_scope || "global",
        targetUserIds: Array.isArray(saved?.target_user_ids) ? saved.target_user_ids : [],
        sectionId: saved?.chart_config?.section_id ?? null,
        previewData: null,
        previewError: null,
        style: mergeWidgetStyle(saved.type === "count" || saved.type === "sum" ? "kpi" : saved.type, saved?.chart_config),
      };

      setWidgets((prev) => [...prev, mapped]);
      setLayout((prev) => {
        const next = [...prev, normalizeLayoutItem(clonedLayout, prev.length, saved.id)];
        layoutRef.current = next;
        return next;
      });
      setSelectedWidgetId(saved.id);
    } catch (err) {
      alert(err.message || "Failed to clone widget.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`relative flex flex-row ${embedMode ? "min-h-0" : "flex-1 h-full min-h-0 w-full"} bg-[#f8fafc] overflow-hidden font-sans`}>
      {/* ── MAIN: header + canvas ── */}
      <div className={`${embedMode ? "w-full" : "flex-1"} flex flex-col overflow-hidden min-w-0`}>
        {!readOnly && (
          <div className="h-11 bg-white border-b border-slate-200 shrink-0 z-20 shadow-sm flex min-w-0">
            <div className="builder-toolbar flex-1 min-w-0 flex items-center gap-2 px-2 lg:px-3 overflow-x-auto overflow-y-hidden">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
                  <Layout className="text-white" size={14} />
                </div>
                <span className="hidden xl:inline text-[10px] font-bold text-slate-700 uppercase tracking-wide whitespace-nowrap">
                  Builder
                </span>
              </div>

              <div className="w-px h-5 bg-slate-200 shrink-0" />

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                    App
                  </label>
                  <select
                    value={targetAppKey}
                    onChange={(e) => handleBuilderAppChange(e.target.value)}
                    className={`${BUILDER_SELECT_CLASS} min-w-[118px] max-w-[140px]`}
                  >
                    {DASHBOARD_APP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                    Dashboard
                  </label>
                  <select
                    value={selectedDashboardKey}
                    onChange={(e) => {
                      const nextKey = e.target.value;
                      requestUnsavedGuard(() => {
                        setSelectedDashboardKey(nextKey);
                        setSelectedWidgetId(null);
                      });
                    }}
                    className={`${BUILDER_SELECT_CLASS} min-w-[96px] max-w-[128px]`}
                  >
                    {dashboardOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {isNonDefaultDashboard && (
                  <DashboardAudienceUserSelect
                    selectedUserIds={selectedAudienceUserIds}
                    onSelectedUserIdsChange={setSelectedAudienceUserIds}
                    userOptions={userOptions}
                    compact
                  />
                )}
              </div>
            </div>

            <div className="builder-toolbar-actions shrink-0 flex items-center gap-1 px-2 border-l border-slate-100 overflow-x-auto overflow-y-hidden max-w-[min(100vw,720px)] sm:max-w-none">
              {isDirty && (
                <span
                  className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-700 whitespace-nowrap"
                  title="Unsaved changes"
                >
                  Unsaved
                </span>
              )}
              <button
                type="button"
                onClick={handleUndo}
                disabled={busy || !canUndo}
                title="Undo (Ctrl+Z)"
                className="h-7 w-7 grid place-items-center rounded-md border border-slate-300 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all shrink-0"
              >
                <Undo2 size={12} />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={busy || !canRedo}
                title="Redo (Ctrl+Y)"
                className="h-7 w-7 grid place-items-center rounded-md border border-slate-300 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all shrink-0"
              >
                <Redo2 size={12} />
              </button>
              <button
                ref={cloneButtonRef}
                type="button"
                onClick={() => (showClonePanel ? closeClonePanel() : openClonePanel())}
                title="Clone Dashboard"
                className={`h-7 px-2 rounded-md text-[9px] font-bold uppercase tracking-wide border whitespace-nowrap transition-all shrink-0 ${
                  showClonePanel
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Copy size={10} className="inline mr-0.5" />
                <span className="hidden md:inline">Clone</span>
              </button>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 shrink-0">
                {BUILDER_WIDGET_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addWidget(t)}
                    title={`Add ${t}`}
                    className="h-6 px-1.5 rounded text-[9px] font-bold uppercase tracking-tight text-slate-600 hover:text-blue-600 hover:bg-white transition-all whitespace-nowrap"
                  >
                    <Plus size={10} className="inline" />
                    <span className="hidden lg:inline ml-0.5">{t}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleSaveAllDraft}
                disabled={busy || widgets.length === 0 || !isDirty}
                title="Save Draft"
                className="h-7 px-2 rounded-md text-[9px] font-bold uppercase tracking-wide bg-white border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all whitespace-nowrap shrink-0"
              >
                <span className="hidden sm:inline">Save </span>Draft
              </button>
              <button
                type="button"
                onClick={handlePublishAll}
                disabled={busy || widgets.length === 0}
                title={selectedDashboardPublished ? "Republish" : "Publish"}
                className="h-7 px-2 rounded-md text-[9px] font-bold uppercase tracking-wide bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all whitespace-nowrap shrink-0"
              >
                <UploadCloud size={10} className="inline mr-0.5" />
                {selectedDashboardPublished ? "Republish" : "Publish"}
              </button>
              <button
                type="button"
                onClick={handleUnpublishAll}
                disabled={busy || !selectedDashboardPublished}
                title="Unpublish"
                className="h-7 px-2 rounded-md text-[9px] font-bold uppercase tracking-wide bg-white border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all whitespace-nowrap shrink-0"
              >
                <CloudOff size={10} className="inline mr-0.5" />
                <span className="hidden md:inline">Unpublish</span>
              </button>
              {isNonDefaultDashboard && (
                <button
                  type="button"
                  onClick={handleDeleteCloneDashboard}
                  disabled={busy}
                  title="Delete Clone"
                  className="h-7 px-2 rounded-md text-[9px] font-bold uppercase tracking-wide bg-white border border-rose-200 text-rose-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rose-50 transition-all whitespace-nowrap shrink-0"
                >
                  <Trash2 size={10} className="inline mr-0.5" />
                  <span className="hidden md:inline">Delete</span>
                </button>
              )}
            </div>
          </div>
        )}

        {!readOnly && showClonePanel && (
          <>
            <button
              type="button"
              aria-label="Close clone panel"
              className="fixed inset-0 z-[90] cursor-default bg-slate-900/10"
              onClick={closeClonePanel}
            />
            <div
              className="fixed z-[100] w-80 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl p-3 space-y-3"
              style={{
                top: clonePanelPos.top,
                right: clonePanelPos.right,
                maxHeight: clonePanelPos.maxHeight,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Create Clone Dashboard</p>
                  <p className="mt-1 text-[9px] text-slate-400 leading-relaxed">
                    Current dashboard widgets will be copied to the selected users.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeClonePanel}
                  className="h-6 w-6 shrink-0 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center"
                  title="Close"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Widgets to clone ({visibleWidgets.length})
                </p>
                {visibleWidgets.length === 0 ? (
                  <p className="text-[10px] text-slate-400">No widgets on this dashboard.</p>
                ) : (
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {visibleWidgets.map((widget, idx) => (
                      <li
                        key={`clone-widget-${widget.id}`}
                        className="flex items-center gap-2 text-[10px] text-slate-600"
                      >
                        <span className="shrink-0 font-bold text-slate-400">{idx + 1}.</span>
                        <span className="truncate font-semibold">
                          {widget.title?.trim() || `Widget ${idx + 1}`}
                        </span>
                        <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400 border border-slate-200">
                          {widget.rawType || widget.type || "widget"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <input
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="Dashboard name"
                className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold"
              />
              <DashboardAudienceUserSelect
                selectedUserIds={cloneAudienceUserIds}
                onSelectedUserIdsChange={setCloneAudienceUserIds}
                userOptions={userOptions}
                className="flex-col items-stretch !gap-1.5 [&>div:last-child]:w-full"
              />
              <p className="text-[9px] text-slate-400 leading-relaxed">
                Leave users as All Users for everyone, or search and pick specific users.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeClonePanel}
                  className="flex-1 rounded-md border border-slate-200 bg-white py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCloneDashboard}
                  disabled={busy}
                  className="flex-1 bg-blue-600 text-white rounded-md py-1.5 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-blue-700"
                >
                  Save Clone
                </button>
              </div>
            </div>
          </>
        )}

        {!readOnly && widgets.length > 0 && (
          <div className="widgets-strip h-9 bg-white border-b border-slate-100 px-3 flex items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
              Widgets ({widgets.length})
            </span>
            {widgets.map((w, idx) => (
              <button
                key={`switch-${w.id}`}
                type="button"
                onClick={() => setSelectedWidgetId(w.id)}
                title={w.title?.trim() || `Widget ${idx + 1}`}
                className={`shrink-0 max-w-[170px] px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                  String(selectedWidgetId) === String(w.id)
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="block truncate">{w.title?.trim() || `Widget ${idx + 1}`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Canvas — fills available width, measured by containerRef */}
        <div
          ref={canvasContainerRef}
          className={`relative z-0 ${embedMode ? "max-h-[480px]" : "flex-1"} overflow-y-auto overflow-x-hidden custom-scrollbar ${
            readOnly
              ? "bg-[#f8fafc] px-2 sm:px-3 py-2 sm:py-3"
              : "bg-[#f8fafc] bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:18px_18px] px-1 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 "
          }`}
        >
          <div
            style={readOnly ? undefined : { minHeight: "100%" }}
            className="w-full"
            onClick={() => {
              if (!readOnly && !isCanvasLocked) {
                setSelectedWidgetId(null);
              }
            }}
          >
            {gridReady ? (
            <Responsive
              className={`layout ${readOnly ? "dashboard-view-grid" : "dashboard-builder-grid"}`}
              width={canvasWidth}
              layouts={renderedLayouts}
              breakpoints={activeBreakpoints}
              cols={activeColsMap}
              rowHeight={GRID_ROW_HEIGHT}
              onDragStop={!isCanvasLocked ? handleDragStop : undefined}
              onResizeStop={!isCanvasLocked ? handleResizeStop : undefined}
              compactType={null}
              preventCollision={false}
              draggableHandle={isCanvasLocked ? undefined : ".widget-drag-handle"}
              isDraggable={!isCanvasLocked}
              isResizable={!isCanvasLocked}
              resizeHandles={!isCanvasLocked ? ["s", "w", "e", "n", "sw", "nw", "se", "ne"] : []}
              margin={[GRID_GAP_X, GRID_GAP_Y]}
              containerPadding={[0, 0]}
            >
              {visibleWidgets.map((widget) => (
                <div
                  key={String(widget.id)}
                  className={`group relative h-full w-full transition-all duration-150 ${String(selectedWidgetId) === String(widget.id) ? "z-20" : "z-10"}`}
                  onMouseDown={(e) => {
                    if (isCanvasLocked || showClonePanel) return;
                    if (e.target.closest(".widget-drag-handle, button, a, input, select, textarea, .react-resizable-handle")) return;
                    e.stopPropagation();
                    setSelectedWidgetId(widget.id);
                  }}
                  onClick={(e) => {
                    if (isCanvasLocked || showClonePanel) return;
                    e.stopPropagation();
                    setSelectedWidgetId(widget.id);
                  }}
                >
                  {!isCanvasLocked && String(selectedWidgetId) === String(widget.id) && (
                    <div className="absolute -inset-2 border-2 border-blue-500 rounded-[12px] pointer-events-none z-0" />
                  )}
                  {!isCanvasLocked && String(selectedWidgetId) === String(widget.id) && (
                    <div className="absolute top-2 right-2 z-40 flex items-center gap-1 bg-white border border-slate-200 rounded-md shadow-sm p-1">
                      <button
                        type="button"
                        className="h-6 w-6 grid place-items-center rounded hover:bg-slate-100 text-slate-600"
                        title="Modify"
                        onClick={(e) => { e.stopPropagation(); setSelectedWidgetId(widget.id); }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        className="h-6 w-6 grid place-items-center rounded hover:bg-slate-100 text-slate-600"
                        title="Clone"
                        onClick={(e) => { e.stopPropagation(); handleCloneWidget(widget); }}
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        type="button"
                        className="h-6 w-6 grid place-items-center rounded hover:bg-rose-50 text-rose-500"
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); handleDeleteWidget(widget); }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                  {!isCanvasLocked && (
                    <div className="widget-drag-handle absolute top-2 left-2 h-6 px-2 cursor-move opacity-0 group-hover:opacity-100 bg-white shadow border border-slate-100 rounded-md flex items-center justify-center z-30 transition-all">
                      <GripVertical size={14} className="text-slate-400" />
                    </div>
                  )}
                  <WidgetRenderer widget={widget} readOnly={readOnly} />
                </div>
              ))}
            </Responsive>
            ) : (
              <div className="w-full min-h-[240px]" aria-hidden />
            )}
          </div>

          {visibleWidgets.length === 0 && !busy && !readOnly && (
            <div className="h-full flex items-center justify-center">
              <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-center">
                <div className="w-14 h-14 bg-slate-50 rounded-xl mx-auto mb-4 flex items-center justify-center">
                  <Layout size={24} className="text-slate-400" />
                </div>
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">No Widgets Yet</h2>
                <p className="text-xs text-slate-500 mb-4">Start by creating your first widget.</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {BUILDER_WIDGET_TYPES.map((t) => (
                    <button
                      key={`empty-${t}`}
                      onClick={() => addWidget(t)}
                      className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-tight bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                    >
                      <Plus size={11} className="inline mr-1" />
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!readOnly && panelWidget && (
        <div
          className="w-[280px] xl:w-[300px] shrink-0 border-l border-slate-200 h-full min-h-0 overflow-y-auto overflow-x-hidden bg-white z-40 shadow-xl"
          style={{ maxWidth: BUILDER_PANEL_WIDTH }}
        >
          <PropertyPanel
            selectedWidget={panelWidget}
            onUpdate={updateWidgetLocal}
            onPreview={handlePreview}
            onSave={handleSaveWidget}
            onDelete={handleDeleteWidget}
            onPixelSizeChange={handlePixelSizeChange}
            appKey={targetAppKey}
            pageOptions={pageOptions}
            dbSourceOptions={DB_SOURCE_OPTIONS}
            widthPx={widthPx}
            heightPx={heightPx}
            onClose={() => {
              setSelectedWidgetId(null);
              setPanelWidgetSnapshot(null);
            }}
            busy={busy}
          />
        </div>
      )}

      {!readOnly && showUnsavedModal && (
        <>
          <button
            type="button"
            aria-label="Close unsaved changes dialog"
            className="fixed inset-0 z-[110] bg-slate-900/30"
            onClick={() => {
              pendingActionRef.current = null;
              setShowUnsavedModal(false);
            }}
          />
          <div className="fixed left-1/2 top-1/2 z-[120] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <p className="text-sm font-bold text-slate-800">Unsaved dashboard changes</p>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Save draft to keep your work in database (without publishing), discard to revert, or stay on this page.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleUnsavedSave}
                disabled={busy}
                className="flex-1 min-w-[100px] rounded-md bg-blue-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={busy}
                className="flex-1 min-w-[100px] rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-rose-600 hover:bg-rose-100 disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingActionRef.current = null;
                  setShowUnsavedModal(false);
                }}
                className="flex-1 min-w-[100px] rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50"
              >
                Stay
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        .react-grid-placeholder {
          background: rgba(59, 130, 246, 0.1) !important;
          border-radius: 6px !important;
          opacity: 0.5 !important;
        }
        .react-grid-item {
          box-sizing: border-box !important;
        }
        .dashboard-builder-grid .react-grid-item {
          overflow: visible !important;
        }
        .dashboard-builder-grid .react-grid-item > .react-resizable-handle {
          opacity: 0;
          transition: opacity 0.15s ease;
          z-index: 50;
          background: rgba(59, 130, 246, 0.35);
          border-radius: 2px;
        }
        .dashboard-builder-grid .react-grid-item:hover > .react-resizable-handle,
        .dashboard-builder-grid .react-grid-item.resizing > .react-resizable-handle {
          opacity: 1;
        }
        .dashboard-builder-grid .react-resizable-handle-se {
          right: 0 !important;
          bottom: 0 !important;
          width: 14px !important;
          height: 14px !important;
          cursor: se-resize !important;
        }
        .dashboard-builder-grid .react-resizable-handle-sw {
          left: 0 !important;
          bottom: 0 !important;
          width: 14px !important;
          height: 14px !important;
          cursor: sw-resize !important;
        }
        .dashboard-builder-grid .react-resizable-handle-ne {
          right: 0 !important;
          top: 0 !important;
          width: 14px !important;
          height: 14px !important;
          cursor: ne-resize !important;
        }
        .dashboard-builder-grid .react-resizable-handle-nw {
          left: 0 !important;
          top: 0 !important;
          width: 14px !important;
          height: 14px !important;
          cursor: nw-resize !important;
        }
        .dashboard-builder-grid .react-resizable-handle-n,
        .dashboard-builder-grid .react-resizable-handle-s {
          left: 50% !important;
          margin-left: -7px !important;
          width: 14px !important;
          height: 8px !important;
        }
        .dashboard-builder-grid .react-resizable-handle-n {
          top: 0 !important;
          cursor: n-resize !important;
        }
        .dashboard-builder-grid .react-resizable-handle-s {
          bottom: 0 !important;
          cursor: s-resize !important;
        }
        .dashboard-builder-grid .react-resizable-handle-e,
        .dashboard-builder-grid .react-resizable-handle-w {
          top: 50% !important;
          margin-top: -7px !important;
          width: 8px !important;
          height: 14px !important;
        }
        .dashboard-builder-grid .react-resizable-handle-e {
          right: 0 !important;
          cursor: e-resize !important;
        }
        .dashboard-builder-grid .react-resizable-handle-w {
          left: 0 !important;
          cursor: w-resize !important;
        }
        .dashboard-view-grid .react-resizable-handle {
          display: none !important;
          pointer-events: none !important;
        }
        .dashboard-view-grid {
          width: 100% !important;
        }
        .dashboard-view-grid .react-grid-layout {
          width: 100% !important;
        }
        .dashboard-view-grid .react-grid-item {
          cursor: default !important;
          display: flex !important;
        }
        .dashboard-view-grid .react-grid-item > div {
          width: 100%;
          height: 100%;
        }
        .dashboard-view-grid .react-grid-item.react-draggable-dragging {
          transform: none !important;
        }
        @media (max-width: 768px) {
          .dashboard-view-grid .react-grid-item {
            min-height: 0 !important;
          }
          .dashboard-view-grid .react-grid-item > div {
            min-height: 100%;
          }
        }
        .builder-toolbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .builder-toolbar::-webkit-scrollbar,
        .builder-toolbar-actions::-webkit-scrollbar {
          display: none;
        }
        .builder-toolbar-actions {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .widgets-strip {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .widgets-strip::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

