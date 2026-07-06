"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import GridLayout, { Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Copy, CloudOff, GripVertical, Layout, Monitor, Pencil, Plus, Redo2, Smartphone, Trash2, Undo2, UploadCloud, X } from "lucide-react";
import { useSelector } from "react-redux";
import { api } from "@/core/api/apiClient";
import { CORE_ENDPOINTS } from "@/core/api/endpoints";
import WidgetRenderer from "./WidgetRenderer";
import WidgetBuilderPanel from "./WidgetBuilderPanel";
import { buildCanvasWidgetsWithContainers, buildPhoneCanvasWidgets, applyDesktopContainerLayout, hasCustomMobileNestedLayout, hasCustomPhoneLayout, hasCustomTopLevelMobileLayout, hydrateContainerNestedLayouts, nestedLayoutToGridHeight, normalizeContainerLayoutItem, phoneContainerAutoGridHeight, repackLayoutItems, resolveContainerGridHeight, resolveContainerPreset, resolvePhoneTopLevelLayout, stackLayoutForPhone, stackNestedLayoutForPhone, syncAllContainerHeights } from "../utils/dashboardLayoutEngine";
import DashboardAudienceUserSelect from "./DashboardAudienceUserSelect";
import DashboardHome from "@/features/shared/dashboard/components/DashboardHome";
import { cloneDashboardToUsers, createWidget, deleteDashboardConfig, deleteWidget, getDashboardWidgets, listDashboardConfigs, listWidgets, previewWidget, publishDashboardConfig, renameDashboardConfig, saveDashboardDraft, unpublishDashboardConfig, updateWidget as updateWidgetApi } from "../services/dashboardApi";
import { useEscapeKey } from "@/core/hooks/useEscapeKey";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { filterAppNavPagesByAccess, getDefaultPageKeyForApp } from "../utils/appNavPages";
import { canFilterDashboardByUser } from "../utils/dashboardFilterAccess";
import { isConfiguredWidgetQuery } from "../utils/widgetQuery.js";

const typeToDisplayType = {
  kpi: "kpi",
  count: "kpi",
  sum: "kpi",
  table: "table",
  graph: "bar",
  heading: "heading",
  section: "container",
  container: "container",
};

const requiresDataQuery = (rawType) => ["kpi", "table", "graph", "count", "sum"].includes(String(rawType));
const resolveApiType = (widget) => {
  if (widget.rawType === "kpi") return "count";
  if (widget.rawType === "container") return "section";
  return widget.rawType || "table";
};
const isTopLevelCanvasWidget = (widget = {}) => !widget.containerId && !widget.sectionId;

const getContainerNestedSource = (container, allWidgets = []) => {
  if (!container) return [];
  const containerId = String(container.id);
  const children = allWidgets.filter(
    (child) => String(child.containerId || child.sectionId) === containerId,
  );
  let nested = Array.isArray(container.nestedLayout) ? [...container.nestedLayout] : [];
  children.forEach((child, idx) => {
    const childId = String(child.id);
    if (!nested.some((item) => String(item.i) === childId)) {
      nested.push(
        normalizeLayoutItem(
          child.layout || buildInitialNestedLayoutForType(child.rawType, idx, child.id),
          idx,
          child.id,
        ),
      );
    }
  });
  return nested;
};

const getContainerNestedMobileSource = (container, allWidgets = []) => {
  if (!container) return [];
  const containerId = String(container.id);
  const children = allWidgets.filter(
    (child) => String(child.containerId || child.sectionId) === containerId,
  );
  const desktopNested = getContainerNestedSource(container, allWidgets);
  let nested = hasCustomMobileNestedLayout(desktopNested, container.mobileNestedLayout || [])
    ? [...(container.mobileNestedLayout || [])]
    : stackNestedLayoutForPhone(desktopNested);
  children.forEach((child, idx) => {
    const childId = String(child.id);
    if (!nested.some((item) => String(item.i) === childId)) {
      nested.push(
        normalizeLayoutItem(
          child.mobileLayout || child.layout || buildInitialNestedLayoutForType(child.rawType, idx, child.id),
          idx,
          child.id,
        ),
      );
    }
  });
  return nested;
};

const findContainerDropTarget = (draggedLayout, nextLayout, containers = []) => {
  if (!draggedLayout) return null;
  const dx = Number(draggedLayout.x) || 0;
  const dy = Number(draggedLayout.y) || 0;
  const dw = Math.max(1, Number(draggedLayout.w) || 1);
  const dh = Math.max(1, Number(draggedLayout.h) || 1);
  let bestId = null;
  let bestOverlap = 0;

  for (const container of containers) {
    const containerLayout = nextLayout.find((item) => String(item.i) === String(container.id));
    if (!containerLayout) continue;
    const cx = Number(containerLayout.x) || 0;
    const cy = Number(containerLayout.y) || 0;
    const cw = Math.max(1, Number(containerLayout.w) || 1);
    const ch = Math.max(1, Number(containerLayout.h) || 1);
    const overlapW = Math.max(0, Math.min(dx + dw, cx + cw) - Math.max(dx, cx));
    const overlapH = Math.max(0, Math.min(dy + dh, cy + ch) - Math.max(dy, cy));
    const overlap = overlapW * overlapH;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestId = container.id;
    }
  }
  return bestOverlap > 0 ? bestId : null;
};

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
  if (rawType === "container") {
    return { ...shared, bg: "#f1f5f9", color: "#334155", fontSize: 12, padding: 12, borderRadius: 10 };
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
    section_id: widget.containerId || widget.sectionId || null,
    container_preset: widget.containerPreset || "full",
    nested_layout: Array.isArray(widget.nestedLayout) ? widget.nestedLayout : [],
    mobile_nested_layout: Array.isArray(widget.mobileNestedLayout) ? widget.mobileNestedLayout : [],
    mobile_padding_left: widget.mobilePaddingLeft ?? widget.style?.mobilePaddingLeft ?? 8,
    mobile_padding_right: widget.mobilePaddingRight ?? widget.style?.mobilePaddingRight ?? 8,
    mobile_padding_top: widget.mobilePaddingTop ?? widget.style?.mobilePaddingTop ?? 8,
    mobile_padding_bottom: widget.mobilePaddingBottom ?? widget.style?.mobilePaddingBottom ?? 8,
    contentAlign: widget.style?.contentAlign || "center",
    emptyTextPosition: widget.style?.emptyTextPosition || "center",
    kpiLabelPosition: widget.style?.kpiLabelPosition || "bottom",
    kpiLabelFontSize: widget.style?.kpiLabelFontSize ?? defaults.kpiLabelFontSize,
    emptyText: widget.emptyText || "Click edit and add query",
  };
}
const BUILDER_WIDGET_TYPES = ["kpi", "table", "graph", "heading", "container"];

const widgetStripLabel = (widget, idx) => {
  const custom = String(widget.title || "").trim();
  if (custom) return custom;
  const typeLabel = {
    container: "Container",
    kpi: "KPI",
    table: "Table",
    graph: "Graph",
    heading: "Heading",
  }[widget.rawType] || "Widget";
  return `${typeLabel} ${idx + 1}`;
};

const DASHBOARD_APP_OPTIONS = [
  { value: "home", label: "Home Dashboard" },
  { value: "ims", label: "IMS Dashboard" },
  { value: "task", label: "Task Dashboard" },
  { value: "settings", label: "Admin Console Dashboard" },
];
const DASHBOARD_STORAGE_PAGE_KEY = "default";

const normalizeDashboardOptionKey = (rawValue = "default") =>
  String(rawValue || "default")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || "default";

const buildDashboardOptions = (rows = []) => {
  const source = Array.isArray(rows) ? rows : [];
  const normalized = source.length
    ? source.map((row) => {
      const value = normalizeDashboardOptionKey(row.dashboard_key);
      return {
        value,
        label: value === "default"
          ? "Default"
          : String(row.dashboard_name || row.dashboard_key || "Dashboard").trim() || value,
        scope: String(row.scope || "global"),
        targetUserIds: Array.isArray(row.target_user_ids) ? row.target_user_ids : [],
        defaultForUserIds: Array.isArray(row.default_for_user_ids) ? row.default_for_user_ids : [],
        published: row.published === true,
      };
    })
    : [{ value: "default", label: "Default", scope: "global", targetUserIds: [], defaultForUserIds: [], published: false }];

  const dedup = new Map();
  normalized.forEach((row) => {
    if (!dedup.has(row.value)) dedup.set(row.value, row);
  });

  return Array.from(dedup.values()).sort((a, b) => {
    if (a.value === "default") return -1;
    if (b.value === "default") return 1;
    return a.label.localeCompare(b.label);
  });
};

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
  sectionId: widget.containerId || widget.sectionId || null,
  containerId: widget.containerId || widget.sectionId || null,
  containerPreset: resolveContainerPreset(widget, resolvedLayout),
  nestedLayout: Array.isArray(widget.nestedLayout) ? widget.nestedLayout : [],
  mobileNestedLayout: Array.isArray(widget.mobileNestedLayout) ? widget.mobileNestedLayout : [],
  mobilePaddingLeft: widget.mobilePaddingLeft ?? 8,
  mobilePaddingRight: widget.mobilePaddingRight ?? 8,
  mobilePaddingTop: widget.mobilePaddingTop ?? 8,
  mobilePaddingBottom: widget.mobilePaddingBottom ?? 8,
  style: widget.style && typeof widget.style === "object" ? widget.style : {},
  layout: compactLayoutForStorage(resolvedLayout, widget.id),
  mobileLayout: compactLayoutForStorage(
    widget.mobileLayout || resolvedLayout,
    widget.id,
  ),
  deviceTarget: normalizeWidgetDeviceTarget(widget.deviceTarget),
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
const BUILDER_DEVICE_DESKTOP = "desktop";
const BUILDER_DEVICE_MOBILE = "mobile";
const PHONE_BUILDER_WIDTH = 390;

function normalizeDeviceTargetValue(rawValue = "") {
  const value = String(rawValue || "").trim().toLowerCase();
  if (value === "mobile") return "mobile";
  if (value === "desktop") return "desktop";
  return "both";
}

function hasCustomMobileLayout(desktopLayout = [], mobileLayout = [], widgets = []) {
  return hasCustomPhoneLayout(widgets, desktopLayout, mobileLayout);
}

function initMobileLayoutFromDesktop(widgets = [], desktopLayout = []) {
  const widgetIds = new Set(
    widgets.filter((widget) => isTopLevelCanvasWidget(widget)).map((widget) => String(widget.id)),
  );
  const desktopItems = desktopLayout
    .filter((item) => widgetIds.has(String(item.i)))
    .map((item, idx) => normalizeLayoutItem(item, idx, item.i));
  return stackLayoutForPhone(widgets, desktopItems, GRID_COLS).map((item, idx) =>
    normalizeLayoutItem(item, idx, item.i),
  );
}

function mergeMobileLayoutFromDesktop(widgets = [], desktopLayout = [], mobileLayout = []) {
  const widgetIds = widgets
    .filter((widget) => isTopLevelCanvasWidget(widget))
    .map((widget) => String(widget.id));

  if (!mobileLayout.length) {
    return initMobileLayoutFromDesktop(widgets, desktopLayout);
  }

  const existing = mobileLayout
    .filter((item) => widgetIds.includes(String(item.i)))
    .map((item, idx) => normalizeLayoutItem(item, idx, item.i));
  const missingIds = widgetIds.filter((id) => !existing.some((item) => String(item.i) === id));
  if (!missingIds.length) return existing;

  const yOffset = existing.reduce(
    (max, item) => Math.max(max, (Number(item.y) || 0) + (Number(item.h) || 1)),
    0,
  );
  const missingDesktop = missingIds.map((id) => {
    const desktopItem = desktopLayout.find((item) => String(item.i) === id);
    const widget = widgets.find((entry) => String(entry.id) === id);
    return normalizeLayoutItem(desktopItem || widget?.layout || {}, 0, id);
  });
  const stackedMissing = stackLayoutForPhone(widgets, missingDesktop, GRID_COLS).map((item, idx) =>
    normalizeLayoutItem({ ...item, y: (Number(item.y) || 0) + yOffset }, idx, item.i),
  );
  return [...existing, ...stackedMissing];
}

function resolveMobileDisplayLayout(widgets = [], desktopLayout = [], mobileLayout = []) {
  return resolvePhoneTopLevelLayout(widgets, desktopLayout, mobileLayout, GRID_COLS).map((item, idx) =>
    normalizeLayoutItem(item, idx, item.i, { lock: true }),
  );
}

function normalizeWidgetDeviceTarget(rawValue = "") {
  const value = normalizeDeviceTargetValue(rawValue);
  if (value === BUILDER_DEVICE_DESKTOP || value === BUILDER_DEVICE_MOBILE) return "both";
  return value;
}

function buildStateFingerprint(widgets = [], layout = [], mobileLayout = []) {
  const normalized = widgets.map((widget) => {
    const matchedLayout = layout.find((item) => String(item.i) === String(widget.id)) || widget.layout || {};
    const matchedMobileLayout =
      mobileLayout.find((item) => String(item.i) === String(widget.id)) || widget.mobileLayout || widget.layout || {};
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
      deviceTarget: normalizeWidgetDeviceTarget(widget.deviceTarget),
      emptyText: String(widget.emptyText || ""),
      style: widget.style || {},
      erpFilter: widget.erpFilter || {},
      layout: {
        x: Number(matchedLayout.x) || 0,
        y: Number(matchedLayout.y) || 0,
        w: Number(matchedLayout.w) || 1,
        h: Number(matchedLayout.h) || 1,
      },
      mobileLayout: {
        x: Number(matchedMobileLayout.x) || 0,
        y: Number(matchedMobileLayout.y) || 0,
        w: Number(matchedMobileLayout.w) || 1,
        h: Number(matchedMobileLayout.h) || 1,
      },
    };
  });
  return JSON.stringify(normalized);
}

function cloneBuilderSnapshot(widgetsState = [], layoutState = [], mobileLayoutState = []) {
  const widgets = JSON.parse(JSON.stringify(widgetsState));
  const layout = JSON.parse(JSON.stringify(layoutState));
  const mobileLayout = JSON.parse(JSON.stringify(mobileLayoutState));
  return {
    widgets,
    layout,
    mobileLayout,
    fingerprint: buildStateFingerprint(widgets, layout, mobileLayout),
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

/** @deprecated use stackLayoutForPhone from dashboardLayoutEngine */
const stackLayoutForMobile = (layouts = [], widgets = [], cols = GRID_COLS) =>
  stackLayoutForPhone(widgets, layouts, cols).map((item, idx) =>
    normalizeLayoutItem(item, idx, item.i, { lock: true }),
  );

const buildDefaultLayout = (idx = 0) => ({
  x: (idx * 2) % 12,
  y: idx * 2,
  w: 3,
  h: 2,
});

const buildInitialLayoutForType = (rawType, idx, id, containerPreset = "full") => {
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
  if (rawType === "container") {
    const containerLayout = normalizeContainerLayoutItem({ containerPreset }, { w: containerPreset === "half" ? 6 : 12 });
    return normalizeLayoutItem({ ...base, x: containerLayout.x, w: containerLayout.w, h: 5 }, idx, id);
  }
  return base;
};

const buildInitialNestedLayoutForType = (rawType, idx, id) => {
  const base = normalizeLayoutItem({}, idx, id);
  if (rawType === "kpi") return normalizeLayoutItem({ ...base, w: 4, h: 2 }, idx, id);
  if (rawType === "table") return normalizeLayoutItem({ ...base, w: 12, h: 3 }, idx, id);
  if (rawType === "graph") return normalizeLayoutItem({ ...base, w: 12, h: 3 }, idx, id);
  if (rawType === "heading") return normalizeLayoutItem({ ...base, w: 12, h: 1 }, idx, id);
  return normalizeLayoutItem({ ...base, w: 4, h: 2 }, idx, id);
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
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [builderNotice, setBuilderNotice] = useState(null);
  const publishingRef = useRef(false);
  const [propertyPanelOpen, setPropertyPanelOpen] = useState(true);
  const [propertyPanelDock, setPropertyPanelDock] = useState("fixed");

  const [widgets, setWidgets] = useState([]);
  const [layout, setLayout] = useState([]);
  const [mobileLayout, setMobileLayout] = useState([]);
  const [builderDeviceMode, setBuilderDeviceMode] = useState(BUILDER_DEVICE_DESKTOP);
  const [containerWidth, setContainerWidth] = useState(0);
  const layoutRef = useRef([]);
  const mobileLayoutRef = useRef([]);
  const manualSizedWidgetIdsRef = useRef(new Set());
  const draggingWidgetRef = useRef(null);
  const [draggingWidgetId, setDraggingWidgetId] = useState(null);
  const [isPhoneView, setIsPhoneView] = useState(false);
  const isPhoneBuilderMode = !readOnly && builderDeviceMode === BUILDER_DEVICE_MOBILE;
  const isPhonePreviewFrame = isPhoneBuilderMode;
  const isPhoneLayoutView = isPhonePreviewFrame;
  const isPhoneLayoutMode = isPhoneBuilderMode || isPhoneView;
  const [targetAppKey, setTargetAppKey] = useState(String(appKey || "ims").toLowerCase());
  const [selectedWidgetId, setSelectedWidgetId] = useState(null);
  const [panelWidgetSnapshot, setPanelWidgetSnapshot] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [userOptions, setUserOptions] = useState([]);
  const [dashboardOptions, setDashboardOptions] = useState([
    { value: "default", label: "Default", scope: "global", targetUserIds: [], defaultForUserIds: [] },
  ]);
  const [selectedDashboardKey, setSelectedDashboardKey] = useState("default");
  const [cloneName, setCloneName] = useState("");
  const [showClonePanel, setShowClonePanel] = useState(false);
  const [selectedAudienceUserIds, setSelectedAudienceUserIds] = useState([]);
  const [cloneAudienceUserIds, setCloneAudienceUserIds] = useState([]);
  const [cloneAsDefaultForUsers, setCloneAsDefaultForUsers] = useState(false);
  const [dashboardEditName, setDashboardEditName] = useState("");
  const [defaultForAssignedUsers, setDefaultForAssignedUsers] = useState([]);
  const filters = useMemo(() => {
    const today = dayjs().format("YYYY-MM-DD");
    const urlUserId = String(searchParams?.get("df_user") || "").trim();
    return {
      fromDate: String(searchParams?.get("df_from") || today).trim(),
      toDate: String(searchParams?.get("df_to") || today).trim(),
      userId: canFilterByUser ? urlUserId : "",
    };
  }, [searchParams, canFilterByUser]);
  const runtimeDashboardKey = useMemo(() => {
    if (!readOnly) return selectedDashboardKey;
    const fromUrl = String(searchParams?.get("df_dash") || "").trim().toLowerCase();
    return fromUrl || "default";
  }, [readOnly, selectedDashboardKey, searchParams]);
  const filterRefreshToken = String(searchParams?.get("df_r") || "");
  // Start busy=true so dashboard never briefly flashes DashboardHome before data arrives
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    if (!builderNotice) return undefined;
    const id = window.setTimeout(() => setBuilderNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [builderNotice]);

  const showBuilderNotice = useCallback((type, message) => {
    if (!message) return;
    setBuilderNotice({ type, message: String(message) });
  }, []);
  useEscapeKey(() => setSelectedWidgetId(null), !readOnly && Boolean(selectedWidgetId) && !showClonePanel);
  useEscapeKey(() => setShowClonePanel(false), !readOnly && showClonePanel);

  const closeClonePanel = () => {
    setShowClonePanel(false);
  };

  const openClonePanel = () => {
    setCloneAudienceUserIds([]);
    setCloneAsDefaultForUsers(false);
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

  const captureSavedFingerprint = useCallback((nextWidgets = [], nextLayout = [], nextMobileLayout = []) => {
    savedFingerprintRef.current = buildStateFingerprint(nextWidgets, nextLayout, nextMobileLayout);
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
    const nextMobileLayout = (snapshot.mobileLayout || []).map((item, idx) =>
      normalizeLayoutItem(item, idx, item.i || item.id),
    );
    layoutRef.current = nextLayout;
    mobileLayoutRef.current = nextMobileLayout;
    setWidgets(snapshot.widgets || []);
    setLayout(nextLayout);
    setMobileLayout(nextMobileLayout);
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
      mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout,
    );
    const past = historyPastRef.current;
    if (past.length && past[past.length - 1].fingerprint === snapshot.fingerprint) return;
    historyPastRef.current = [...past.slice(-(HISTORY_LIMIT - 1)), snapshot];
    historyFutureRef.current = [];
    refreshHistoryFlags();
  }, [readOnly, busy, layout, mobileLayout, refreshHistoryFlags]);

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
      mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout,
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
      mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout,
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
    return buildStateFingerprint(widgets, layout, mobileLayout) !== savedFingerprintRef.current;
  }, [widgets, layout, mobileLayout, readOnly, busy]);

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
      const measured = Math.max(
        0,
        Math.floor(node.getBoundingClientRect?.().width || node.clientWidth || 0),
      );
      setContainerWidth((prev) => (Math.abs(prev - measured) <= 1 ? prev : measured));
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(updateWidth);
    });
    observer.observe(node);

    window.addEventListener("resize", updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [readOnly, selectedWidgetId, busy, widgets.length, isPhoneView]);

  useLayoutEffect(() => {
    if (!readOnly || isPhoneView || busy) return undefined;
    const node = canvasContainerRef.current;
    if (!node) return undefined;
    const measure = () => {
      const width = Math.max(0, Math.floor(node.getBoundingClientRect?.().width || node.clientWidth || 0));
      if (width >= 200) {
        setContainerWidth((prev) => (Math.abs(prev - width) <= 1 ? prev : width));
      }
    };
    measure();
    const raf = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(raf);
  }, [readOnly, isPhoneView, busy, widgets.length]);

  useEffect(() => {
    if (!readOnly || typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsPhoneView(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [readOnly]);

  const mapWidgetRow = (row, idx) => {
    const rawType =
      row.type === "section"
        ? "container"
        : row.type === "count" || row.type === "sum"
          ? "kpi"
          : row.type;
    const chartConfig = row?.chart_config && typeof row.chart_config === "object" ? row.chart_config : {};
    const loadedTitle = String(row.title || "").trim();
    const normalizedTitle =
      rawType === "container" && (loadedTitle === "Widget" || loadedTitle === "Section")
        ? ""
        : loadedTitle;
    return {
      ...row,
      title: normalizedTitle,
      rawType,
      metricType: row.type === "sum" ? "sum" : "count",
      type:
        rawType === "container"
          ? "container"
          : row.type === "graph"
            ? chartConfig.chart_type || "bar"
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
      sectionId: chartConfig.section_id ?? null,
      containerId: chartConfig.section_id ?? null,
      containerPreset: resolveContainerPreset(
        { containerPreset: chartConfig.container_preset },
        row.layout && typeof row.layout === "object" ? row.layout : {},
      ),
      nestedLayout: Array.isArray(chartConfig.nested_layout) ? chartConfig.nested_layout : [],
      mobileNestedLayout: Array.isArray(chartConfig.mobile_nested_layout) ? chartConfig.mobile_nested_layout : [],
      mobilePaddingLeft: chartConfig.mobile_padding_left ?? 8,
      mobilePaddingRight: chartConfig.mobile_padding_right ?? 8,
      mobilePaddingTop: chartConfig.mobile_padding_top ?? 8,
      mobilePaddingBottom: chartConfig.mobile_padding_bottom ?? 8,
      targetPageKey: row?.target_page_key || row?.targetPageKey || "dashboard",
      targetPageModule: row?.target_page_module || row?.targetPageModule || null,
      deviceTarget: normalizeWidgetDeviceTarget(row?.device_target || row?.deviceTarget),
      layout: normalizeLayoutItem(
        enforceLayoutByType(rawType, row.layout && typeof row.layout === "object" ? row.layout : {}),
        idx,
        row.id,
      ),
      mobileLayout: normalizeLayoutItem(
        enforceLayoutByType(
          rawType,
          row.mobile_layout || row.mobileLayout || row.layout || {},
        ),
        idx,
        row.id,
      ),
    };
  };

  const loadWidgets = async (overrideDashboardKey) => {
    const resolvedAppKey = String((readOnly ? appKey : targetAppKey) || "ims").toLowerCase();
    if (readOnly && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("erp-dashboard-sync-start", { detail: { appKey: resolvedAppKey } }),
      );
    }
    try {
      setBusy(true);
      setLoadError(null);
      const resolvedDashboardKey = String(
        readOnly ? runtimeDashboardKey : (overrideDashboardKey || selectedDashboardKey || "default"),
      ).toLowerCase();
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
            if (!requiresDataQuery(widget.rawType) || !isConfiguredWidgetQuery(widget.query)) {
              return { id: String(widget.id), data: null, error: null };
            }
            try {
              const response = await previewWidget(widget.query, {
                dbSource: widget.dataSource || "ims_postgresql",
                filters,
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
      const hydrated = hydrateContainerNestedLayouts(mapped);
      const topLevel = hydrated.filter((widget) => isTopLevelCanvasWidget(widget));
      const nextLayout = topLevel.map((w, idx) => {
        const source = w.layout || {};
        if (w.rawType === "container") {
          const nested = w.nestedLayout || [];
          const hasHeader = Boolean(String(w.title || "").trim() || String(w.description || "").trim());
          const autoH = nestedLayoutToGridHeight(nested, {
            minRows: 1,
            headerRows: hasHeader ? 1 : 0,
            bufferRows: 0,
            paddingPx: (Number(w.style?.padding) || 12) * 2,
          });
          const containerLayout = applyDesktopContainerLayout(w, source);
          return normalizeLayoutItem(
            {
              ...source,
              x: containerLayout.x,
              w: containerLayout.w,
              h: Math.max(1, Number(source.h) || autoH),
            },
            idx,
            w.id,
          );
        }
        return normalizeLayoutItem(source, idx, w.id);
      });
      const nextMobileLayout = topLevel.map((w, idx) => {
        const source = w.mobileLayout || w.layout || {};
        if (w.rawType === "container") {
          const autoH = phoneContainerAutoGridHeight(w);
          const savedH = Math.max(1, Number(source.h) || autoH);
          return normalizeLayoutItem(
            { ...source, x: 0, w: 12, h: savedH },
            idx,
            w.id,
          );
        }
        return normalizeLayoutItem({ ...source, x: 0, w: 12 }, idx, w.id);
      });
      setWidgets(hydrated);
      layoutRef.current = nextLayout;
      mobileLayoutRef.current = nextMobileLayout;
      setLayout(nextLayout);
      setMobileLayout(nextMobileLayout);
      if (!readOnly) {
        resetHistory();
        captureSavedFingerprint(mapped, nextLayout, nextMobileLayout);
        const hasCurrentSelection = mapped.some((w) => String(w.id) === String(selectedWidgetId));
        if (hasCurrentSelection) return;
        if (mapped.length > 0) {
          setSelectedWidgetId(mapped[0].id);
        }
      }
      if (readOnly && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("erp-dashboard-sync", {
            detail: { appKey: resolvedAppKey, syncedAt: Date.now() },
          }),
        );
      }
    } catch (err) {
      setLoadError(err?.message || "Failed to load dashboard.");
      if (readOnly && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("erp-dashboard-sync-error", { detail: { appKey: resolvedAppKey } }),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const visibleWidgets = useMemo(
    () => widgets.filter((widget) => isTopLevelCanvasWidget(widget)),
    [widgets],
  );

  const canvasWidgets = useMemo(() => {
    const hydrated = hydrateContainerNestedLayouts(widgets);
    if (readOnly && isPhoneView) {
      return buildPhoneCanvasWidgets(hydrated);
    }
    if (readOnly) {
      return buildCanvasWidgetsWithContainers(hydrated);
    }
    const built = buildCanvasWidgetsWithContainers(hydrated);
    if (!isPhoneBuilderMode) return built;
    return buildPhoneCanvasWidgets(hydrated);
  }, [widgets, readOnly, isPhoneBuilderMode, isPhoneView]);

  const movableWidgetsForContainer = useMemo(() => {
    if (!selectedWidgetId) return [];
    const selected = widgets.find((widget) => String(widget.id) === String(selectedWidgetId));
    if (!selected || selected.rawType !== "container") return [];
    return widgets.filter(
      (widget) =>
        isTopLevelCanvasWidget(widget)
        && widget.rawType !== "container"
        && String(widget.id) !== String(selectedWidgetId),
    );
  }, [widgets, selectedWidgetId]);

  const dropTargetContainerIds = useMemo(() => {
    if (!draggingWidgetId) return new Set();
    const dragged = widgets.find((entry) => String(entry.id) === String(draggingWidgetId));
    if (!dragged || !isTopLevelCanvasWidget(dragged) || dragged.rawType === "container") {
      return new Set();
    }
    return new Set(
      widgets
        .filter((entry) => entry.rawType === "container" && isTopLevelCanvasWidget(entry))
        .map((entry) => String(entry.id)),
    );
  }, [draggingWidgetId, widgets]);

  const builderCanvasLayout = isPhoneBuilderMode ? mobileLayout : layout;

  const visibleLayout = useMemo(() => {
    const ids = new Set(visibleWidgets.map((w) => String(w.id)));
    const source = builderCanvasLayout.filter((l) => ids.has(String(l.i)));
    if (isPhoneBuilderMode) return source;
    return source.map((item) => {
      const widget = widgets.find((entry) => String(entry.id) === String(item.i));
      if (widget?.rawType === "container") {
        return applyDesktopContainerLayout(widget, item);
      }
      return item;
    });
  }, [builderCanvasLayout, visibleWidgets, isPhoneBuilderMode, widgets]);

  const selectedDashboardOption = dashboardOptions.find((option) => option.value === selectedDashboardKey) || null;
  const selectedDashboardLabel = selectedDashboardOption?.label || "Default";
  const selectedDashboardPublished = selectedDashboardOption?.published === true;
  const isNonDefaultDashboard = selectedDashboardKey !== "default";
  const dashboardNameForSave = isNonDefaultDashboard
    ? String(dashboardEditName || selectedDashboardLabel || selectedDashboardKey).trim() || selectedDashboardKey
    : "Default";
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

  const defaultForUsersForSave = useMemo(() => {
    if (selectedDashboardKey === "default") return [];
    return defaultForAssignedUsers
      .map(Number)
      .filter((id) => Number.isFinite(id) && dashboardTargetUsersForSave.includes(id));
  }, [selectedDashboardKey, defaultForAssignedUsers, dashboardTargetUsersForSave]);

  const isDefaultForAssignedUsers =
    defaultForUsersForSave.length > 0 &&
    dashboardTargetUsersForSave.length > 0 &&
    dashboardTargetUsersForSave.every((id) => defaultForUsersForSave.includes(id));

  const renderedLayout = useMemo(() => {
    const source = readOnly ? clampLayoutInBounds(visibleLayout, GRID_COLS) : visibleLayout;
    const normalized = source.map((item, idx) => {
      if (!isCanvasLocked) {
        return normalizeLayoutItem(item, idx, item.i || item.id);
      }
      return normalizeLayoutItem(item, idx, item.i || item.id, { lock: true });
    });
    return normalized;
  }, [visibleLayout, readOnly, isCanvasLocked]);

  const readOnlyDesktopLayout = useMemo(() => {
    if (!readOnly) return [];
    const hydrated = hydrateContainerNestedLayouts(widgets);
    const ids = new Set(visibleWidgets.map((w) => String(w.id)));
    const liveLayout = layoutRef.current?.length ? layoutRef.current : layout;
    return clampLayoutInBounds(
      liveLayout.filter((item) => ids.has(String(item.i))),
      GRID_COLS,
    ).map((item, idx) => {
      const widget = hydrated.find((entry) => String(entry.id) === String(item.i));
      if (widget?.rawType === "container") {
        const resolved = applyDesktopContainerLayout(widget, item);
        return normalizeLayoutItem(resolved, idx, item.i, { lock: true });
      }
      return normalizeLayoutItem(item, idx, item.i, { lock: true });
    });
  }, [readOnly, widgets, layout, mobileLayout, visibleWidgets]);

  const readOnlyPhoneLayout = useMemo(() => {
    if (!readOnly) return [];
    const ids = new Set(visibleWidgets.map((w) => String(w.id)));
    const liveMobile = mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout;
    return clampLayoutInBounds(
      liveMobile.filter((item) => ids.has(String(item.i))),
      GRID_COLS,
    ).map((item, idx) => normalizeLayoutItem(item, idx, item.i, { lock: true }));
  }, [readOnly, widgets, layout, mobileLayout, visibleWidgets]);

  const activeReadOnlyLayout = useMemo(() => {
    if (!readOnly) return [];
    return isPhoneView ? readOnlyPhoneLayout : readOnlyDesktopLayout;
  }, [readOnly, isPhoneView, readOnlyPhoneLayout, readOnlyDesktopLayout]);

  const renderedLayouts = useMemo(() => {
    const locked = renderedLayout.map((item, idx) =>
      normalizeLayoutItem(item, idx, item.i || item.id, { lock: readOnly }),
    );
    if (readOnly) {
      return { lg: activeReadOnlyLayout };
    }
    if (isPhoneBuilderMode) {
      return { lg: locked.map((item, idx) => normalizeLayoutItem(item, idx, item.i || item.id, {})) };
    }
    return { lg: locked.map((item, idx) => normalizeLayoutItem(item, idx, item.i || item.id, {})) };
  }, [renderedLayout, readOnly, widgets, layout, mobileLayout, isPhoneBuilderMode, activeReadOnlyLayout]);

  const activeBreakpoints = readOnly ? { lg: 0 } : BUILDER_BREAKPOINTS;
  const activeColsMap = readOnly ? { lg: GRID_COLS } : BUILDER_COLS_MAP;

  useEffect(() => {
    if (readOnly || busy) return;
    const synced = syncAllContainerHeights(
      widgets,
      layoutRef.current?.length ? layoutRef.current : layout,
      mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout,
      {
        preserveMobileContainerHeights: isPhoneBuilderMode,
        syncSurface: isPhoneBuilderMode ? "mobile" : "desktop",
        manualSizedContainerIds: manualSizedWidgetIdsRef.current,
      },
    );
    if (!isPhoneBuilderMode) {
      const layoutJson = JSON.stringify(synced.layout);
      const currentJson = JSON.stringify(layoutRef.current?.length ? layoutRef.current : layout);
      if (layoutJson !== currentJson) {
        layoutRef.current = synced.layout;
        setLayout(synced.layout);
      }
      return;
    }
    const mobileJson = JSON.stringify(synced.mobileLayout);
    const currentMobileJson = JSON.stringify(mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout);
    if (mobileJson !== currentMobileJson) {
      mobileLayoutRef.current = synced.mobileLayout;
      setMobileLayout(synced.mobileLayout);
    }
  }, [widgets, readOnly, busy, isPhoneBuilderMode]);

  useEffect(() => {
    const loadDashboardOptions = async () => {
      if (readOnly) return;
      try {
        const response = await listDashboardConfigs({ appKey: targetAppKey, pageKey: DASHBOARD_STORAGE_PAGE_KEY });
        const rows = Array.isArray(response?.data) ? response.data : [];
        const options = buildDashboardOptions(rows);
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
      setDashboardOptions(buildDashboardOptions(rows));
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
  }, [readOnly, appKey, pageKey, targetAppKey, resolvedPageKey, selectedDashboardKey, runtimeDashboardKey, filters.fromDate, filters.toDate, filters.userId, filterRefreshToken]);

  const selectedWidget = widgets.find((w) => String(w.id) === String(selectedWidgetId));
  const panelWidget = selectedWidget || (busy ? panelWidgetSnapshot : null);

  useEffect(() => {
    setTargetAppKey(String(appKey || "ims").toLowerCase());
  }, [appKey]);

  useEffect(() => {
    if (selectedDashboardKey === "default") {
      setSelectedAudienceUserIds([]);
      setDefaultForAssignedUsers([]);
      setDashboardEditName("");
      return;
    }
    if (!selectedDashboardOption) return;
    setDashboardEditName(selectedDashboardOption.label || "");
    if (selectedDashboardOption.scope === "users") {
      const assignedUsers = Array.isArray(selectedDashboardOption.targetUserIds)
        ? selectedDashboardOption.targetUserIds.map(Number).filter(Number.isFinite)
        : [];
      setSelectedAudienceUserIds(assignedUsers);
      const defaultUsers = Array.isArray(selectedDashboardOption.defaultForUserIds)
        ? selectedDashboardOption.defaultForUserIds.map(Number).filter(Number.isFinite)
        : [];
      setDefaultForAssignedUsers(defaultUsers.filter((id) => assignedUsers.includes(id)));
      return;
    }
    setSelectedAudienceUserIds([]);
    setDefaultForAssignedUsers([]);
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
    ? (() => {
        if (selectedWidget.containerId) {
          const parent = widgets.find((entry) => String(entry.id) === String(selectedWidget.containerId));
          const nestedSource = isPhoneBuilderMode
            ? (parent?.mobileNestedLayout?.length ? parent.mobileNestedLayout : parent?.nestedLayout)
            : (parent?.nestedLayout || []);
          const matched = (nestedSource || []).find((item) => String(item.i) === String(selectedWidget.id));
          return matched
            ? normalizeLayoutItem(matched, 0, selectedWidget.id)
            : (selectedWidget.layout || null);
        }
        const canvasItem = builderCanvasLayout.find((l) => String(l.i) === String(selectedWidget.id));
        return canvasItem
          ? normalizeLayoutItem(canvasItem, 0, selectedWidget.id)
          : (isPhoneBuilderMode
            ? (selectedWidget.mobileLayout || selectedWidget.layout || null)
            : (selectedWidget.layout || null));
      })()
    : null;
  // Canvas fills the actual measured container width.
  // Panel is a flex sibling so containerWidth already excludes it.
  // Grid w/h are proportional (out of 12 cols) so layouts look consistent.
  const measuredCanvasWidth = Math.max(0, containerWidth || 0);
  const isReadOnlyDesktop = readOnly && !isPhoneView;
  const canvasWidth = useMemo(() => {
    if (isPhonePreviewFrame) return PHONE_BUILDER_WIDTH;
    if (isReadOnlyDesktop) {
      return measuredCanvasWidth >= 200 ? measuredCanvasWidth : 0;
    }
    if (measuredCanvasWidth >= 200) return measuredCanvasWidth;
    return Math.max(320, measuredCanvasWidth);
  }, [measuredCanvasWidth, isPhonePreviewFrame, isReadOnlyDesktop]);
  const gridReady = canvasWidth >= 200;

  const colWidth = Math.max(20, (Math.max(0, canvasWidth - GRID_GAP_X * (GRID_COLS - 1))) / GRID_COLS);
  const nestedColWidth = Math.max(16, (Math.max(0, canvasWidth - 8 * 11)) / 12);
  const activeColWidth = selectedWidget?.containerId ? nestedColWidth : colWidth;
  const activeRowHeight = selectedWidget?.containerId ? 48 : GRID_ROW_HEIGHT;
  const activeGapX = selectedWidget?.containerId ? 8 : GRID_GAP_X;
  const activeGapY = selectedWidget?.containerId ? 8 : GRID_GAP_Y;
  const minLayoutWidthPx = Math.max(16, Math.round(activeColWidth));
  const minLayoutHeightPx = Math.max(16, Math.round(activeRowHeight));
  const widthPx = selectedLayout
    ? Math.round((selectedLayout.w || 1) * activeColWidth + Math.max(0, (selectedLayout.w || 1) - 1) * activeGapX)
    : 0;
  const heightPx = selectedLayout
    ? Math.round(
        (selectedLayout.h || 1) * activeRowHeight + Math.max(0, (selectedLayout.h || 1) - 1) * activeGapY,
      )
    : 0;

  const clamp = (num, min, max) => Math.min(max, Math.max(min, num));
  const pixelToGridW = (px) =>
    clamp(
      Math.round((Math.max(minLayoutWidthPx, Number(px) || minLayoutWidthPx) + activeGapX) / (activeColWidth + activeGapX)),
      1,
      selectedWidget?.containerId ? 12 : GRID_COLS,
    );
  const pixelToGridH = (px) =>
    clamp(
      Math.round((Math.max(minLayoutHeightPx, Number(px) || minLayoutHeightPx) + activeGapY) / (activeRowHeight + activeGapY)),
      1,
      30,
    );

  const handlePixelSizeChange = ({ widthPx: nextWidthPx, heightPx: nextHeightPx }) => {
    if (isCanvasLocked || !selectedWidget) return;
    if (nextWidthPx == null && nextHeightPx == null) return;
    captureHistoryBeforeChange();
    manualSizedWidgetIdsRef.current.add(String(selectedWidget.id));

    const current = selectedLayout
      ? normalizeLayoutItem(selectedLayout, 0, selectedWidget.id)
      : normalizeLayoutItem({}, 0, selectedWidget.id);
    const nextW = nextWidthPx != null ? pixelToGridW(nextWidthPx) : current.w;
    const nextH = nextHeightPx != null ? pixelToGridH(nextHeightPx) : current.h;
    const next = normalizeLayoutItem(
      {
        ...current,
        w: nextW,
        h: nextH,
      },
      0,
      selectedWidget.id,
    );

    const applyTopLevelLayout = (layoutItem) => {
      const applyLayout = (prev) => {
        const updated = prev.map((l, idx) =>
          String(l.i) === String(selectedWidget.id)
            ? normalizeLayoutItem({ ...l, ...layoutItem }, idx, selectedWidget.id)
            : l,
        );
        if (isPhoneBuilderMode) {
          mobileLayoutRef.current = updated;
        } else {
          layoutRef.current = updated;
        }
        return updated;
      };
      if (isPhoneBuilderMode) {
        setMobileLayout(applyLayout);
      } else {
        setLayout(applyLayout);
      }
    };

    if (selectedWidget.containerId) {
      const parentId = String(selectedWidget.containerId);
      let nextNested = null;
      let nextMobileNested = null;
      setWidgets((prev) =>
        prev.map((widget) => {
          if (String(widget.id) === String(selectedWidget.id)) {
            return {
              ...widget,
              layout: isPhoneBuilderMode ? widget.layout : next,
              mobileLayout: isPhoneBuilderMode ? next : widget.mobileLayout,
            };
          }
          if (String(widget.id) === parentId) {
            const patchNested = (items = []) =>
              items.map((item, idx) =>
                String(item.i) === String(selectedWidget.id)
                  ? normalizeLayoutItem({ ...item, ...next }, idx, selectedWidget.id)
                  : item,
              );
            if (isPhoneBuilderMode) {
              nextMobileNested = patchNested(widget.mobileNestedLayout);
              return { ...widget, mobileNestedLayout: nextMobileNested };
            }
            nextNested = patchNested(widget.nestedLayout);
            return { ...widget, nestedLayout: nextNested };
          }
          return widget;
        }),
      );
      syncContainerMainLayout(
        parentId,
        isPhoneBuilderMode ? undefined : nextNested,
        isPhoneBuilderMode ? nextMobileNested : undefined,
      );
      return;
    }

    if (selectedWidget.rawType === "container") {
      manualSizedWidgetIdsRef.current.add(String(selectedWidget.id));
      const inferredPreset = nextW <= 6 ? "half" : "full";
      const containerLayout = isPhoneBuilderMode
        ? { x: 0, w: Math.min(12, Math.max(1, nextW)) }
        : normalizeContainerLayoutItem(
          { ...selectedWidget, containerPreset: inferredPreset },
          { ...next, w: inferredPreset === "half" ? 6 : 12 },
        );
      const resolved = normalizeLayoutItem(
        {
          ...next,
          x: isPhoneBuilderMode ? 0 : containerLayout.x,
          w: isPhoneBuilderMode ? Math.min(12, Math.max(1, nextW)) : containerLayout.w,
          h: nextH,
        },
        0,
        selectedWidget.id,
      );
      applyTopLevelLayout(resolved);
      setWidgets((prev) =>
        prev.map((w) =>
          String(w.id) === String(selectedWidget.id)
            ? {
              ...w,
              containerPreset: inferredPreset,
              layout: isPhoneBuilderMode ? w.layout : resolved,
              mobileLayout: isPhoneBuilderMode ? resolved : w.mobileLayout,
            }
            : w,
        ),
      );
      return;
    }

    if (isPhoneBuilderMode) {
      applyTopLevelLayout(next);
      setWidgets((prev) =>
        prev.map((w) =>
          String(w.id) === String(selectedWidget.id)
            ? { ...w, mobileLayout: next }
            : w,
        ),
      );
      return;
    }

    applyTopLevelLayout(next);
    setWidgets((prev) =>
      prev.map((w) =>
        String(w.id) === String(selectedWidget.id)
          ? { ...w, layout: next }
          : w,
      ),
    );
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
  if (readOnly && !embedMode && !busy && canvasWidgets.length === 0) {
    return <DashboardHome title={emptyTitle} />;
  }

  if (readOnly && embedMode && !busy && canvasWidgets.length === 0) {
    return null;
  }

  const addWidget = (rawType, options = {}) => {
    const { containerId = null, containerPreset = "full" } = options;
    if (containerId) {
      addWidgetInContainer(containerId, rawType);
      return;
    }
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
      containerId: null,
      containerPreset: rawType === "container" ? containerPreset : "full",
      nestedLayout: rawType === "container" ? [] : undefined,
      mobileNestedLayout: rawType === "container" ? [] : undefined,
      deviceTarget: "both",
      style: defaultWidgetStyle(rawType),
      emptyText: "Click edit and add query",
      previewData: null,
      previewError: null,
      is_active: true,
      targetPageKey: getDefaultPageKeyForApp(targetAppKey, canAccess, role),
      targetPageModule: null,
    };

    setWidgets((prev) => [...prev, temp]);
    if (isPhoneBuilderMode) {
      setMobileLayout((prev) => {
        const maxY = prev.reduce(
          (acc, item) => Math.max(acc, (Number(item.y) || 0) + (Number(item.h) || 1)),
          0,
        );
        let h = rawType === "heading" ? 1 : 2;
        if (rawType === "container") h = 5;
        if (rawType === "table" || rawType === "graph") h = 4;
        const nextItem = normalizeLayoutItem({ x: 0, y: maxY, w: GRID_COLS, h }, prev.length, id);
        const next = [...prev, nextItem];
        mobileLayoutRef.current = next;
        return next;
      });
      setSelectedWidgetId(id);
      setPropertyPanelOpen(true);
      return;
    }
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
      const next = [...prev, buildInitialLayoutForType(rawType, prev.length, id, containerPreset)];
      layoutRef.current = next;
      return next;
    });
    setSelectedWidgetId(id);
    setPropertyPanelOpen(true);
  };

  const syncContainerMainLayout = (containerId, nestedLayoutOverride = null, mobileNestedOverride = null) => {
    if (manualSizedWidgetIdsRef.current.has(String(containerId))) return;
    const container = widgets.find((widget) => String(widget.id) === String(containerId));
    if (!container) return;
    const nested = nestedLayoutOverride || container.nestedLayout || [];
    const mobileNested = mobileNestedOverride || container.mobileNestedLayout || nested;
    const autoH = nestedLayoutToGridHeight(nested);
    const autoMobileH = nestedLayoutToGridHeight(mobileNested, {
      minRows: 2,
      headerRows: 0,
      bufferRows: 0,
      paddingPx: 24,
    });
    if (!isPhoneBuilderMode) {
      setLayout((prev) => {
        const next = prev.map((item, idx) =>
          String(item.i) === String(containerId)
            ? normalizeLayoutItem(
                { ...item, h: resolveContainerGridHeight(autoH, item.h) },
                idx,
                containerId,
              )
            : item,
        );
        layoutRef.current = next;
        return next;
      });
      return;
    }
    setMobileLayout((prev) => {
      const next = prev.map((item, idx) => {
        if (String(item.i) !== String(containerId)) return item;
        const resolvedH = mobileNestedOverride
          ? Math.max(Number(item.h) || 1, autoMobileH)
          : Math.max(1, Number(item.h) || 1);
        return normalizeLayoutItem(
          {
            ...item,
            h: resolvedH,
          },
          idx,
          containerId,
        );
      });
      mobileLayoutRef.current = next;
      return next;
    });
  };

  const addWidgetInContainer = (containerId, rawType) => {
    captureHistoryBeforeChange();
    const id = `tmp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const type = rawType === "graph" ? "bar" : typeToDisplayType[rawType] || "table";
    let patch = null;

    setWidgets((prev) => {
      const container = prev.find((widget) => String(widget.id) === String(containerId));
      if (!container) return prev;

      if (isPhoneBuilderMode) {
        const mobileNestedSource = getContainerNestedMobileSource(container, prev);
        const maxY = mobileNestedSource.reduce(
          (acc, item) => Math.max(acc, (Number(item.y) || 0) + (Number(item.h) || 1)),
          0,
        );
        const mobileNestedItem = normalizeLayoutItem(
          {
            ...buildInitialNestedLayoutForType(rawType, mobileNestedSource.length, id),
            x: 0,
            w: 12,
            y: maxY,
          },
          mobileNestedSource.length,
          id,
        );
        const nextMobileNested = [...mobileNestedSource, mobileNestedItem];
        patch = { nextNested: null, nextMobileNested };

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
          sectionId: containerId,
          containerId,
          deviceTarget: "both",
          style: defaultWidgetStyle(rawType),
          emptyText: "Click edit and add query",
          previewData: null,
          previewError: null,
          is_active: true,
          targetPageKey: getDefaultPageKeyForApp(targetAppKey, canAccess, role),
          targetPageModule: null,
          mobileLayout: mobileNestedItem,
        };

        return [
          ...prev.map((widget) => {
            if (String(widget.id) !== String(containerId)) return widget;
            return {
              ...widget,
              mobileNestedLayout: nextMobileNested,
            };
          }),
          temp,
        ];
      }

      const nestedSource = getContainerNestedSource(container, prev);
      const mobileNestedSource = getContainerNestedMobileSource(container, prev);
      const maxY = nestedSource.reduce(
        (acc, item) => Math.max(acc, (Number(item.y) || 0) + (Number(item.h) || 1)),
        0,
      );
      const nestedItem = normalizeLayoutItem(
        buildInitialNestedLayoutForType(rawType, nestedSource.length, id),
        nestedSource.length,
        id,
      );
      nestedItem.y = maxY;
      const mobileNestedItem = normalizeLayoutItem(
        { ...nestedItem, w: Math.min(12, Number(nestedItem.w) || 12) },
        mobileNestedSource.length,
        id,
      );
      mobileNestedItem.y = maxY;

      const nextNested = [...nestedSource, nestedItem];
      const nextMobileNested = [...mobileNestedSource, mobileNestedItem];
      patch = { nextNested, nextMobileNested };

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
        sectionId: containerId,
        containerId,
        deviceTarget: "both",
        style: defaultWidgetStyle(rawType),
        emptyText: "Click edit and add query",
        previewData: null,
        previewError: null,
        is_active: true,
        targetPageKey: getDefaultPageKeyForApp(targetAppKey, canAccess, role),
        targetPageModule: null,
        layout: nestedItem,
        mobileLayout: mobileNestedItem,
      };

      return [
        ...prev.map((widget) => {
          if (String(widget.id) !== String(containerId)) return widget;
          return {
            ...widget,
            nestedLayout: nextNested,
            mobileNestedLayout: nextMobileNested,
          };
        }),
        temp,
      ];
    });

    if (patch) {
      syncContainerMainLayout(
        containerId,
        isPhoneBuilderMode ? undefined : patch.nextNested,
        isPhoneBuilderMode ? patch.nextMobileNested : undefined,
      );
      setSelectedWidgetId(id);
      setPropertyPanelOpen(true);
    }
  };

  const moveWidgetIntoContainer = (containerId, widgetId, layoutSnapshot = null, mobileLayoutSnapshot = null) => {
    if (String(containerId) === String(widgetId)) return;

    captureHistoryBeforeChange();
    let patch = null;

    setWidgets((prev) => {
      const widget = prev.find((entry) => String(entry.id) === String(widgetId));
      const container = prev.find((entry) => String(entry.id) === String(containerId));
      if (!widget || !container || widget.rawType === "container") return prev;
      if (!isTopLevelCanvasWidget(widget)) return prev;

      const nestedSource = getContainerNestedSource(container, prev);
      const mobileNestedSource = getContainerNestedMobileSource(container, prev);
      const maxY = nestedSource.reduce(
        (acc, item) => Math.max(acc, (Number(item.y) || 0) + (Number(item.h) || 1)),
        0,
      );
      const sourceLayout =
        layoutSnapshot?.find((item) => String(item.i) === String(widgetId))
        || layout.find((item) => String(item.i) === String(widgetId))
        || widget.layout
        || buildInitialNestedLayoutForType(widget.rawType, nestedSource.length, widgetId);
      const nestedItem = normalizeLayoutItem(
        {
          ...sourceLayout,
          x: 0,
          y: maxY,
          w: Math.min(12, Math.max(1, Number(sourceLayout.w) || 4)),
        },
        nestedSource.length,
        widgetId,
      );
      const mobileNestedItem = normalizeLayoutItem(
        { ...nestedItem, x: 0, w: 12, y: maxY },
        mobileNestedSource.length,
        widgetId,
      );
      const nextNested = [...nestedSource, nestedItem];
      const nextMobileNested = [...mobileNestedSource, mobileNestedItem];
      patch = { nextNested, nextMobileNested };

      return prev.map((entry) => {
        if (String(entry.id) === String(widgetId)) {
          return {
            ...entry,
            containerId,
            sectionId: containerId,
            layout: nestedItem,
            mobileLayout: mobileNestedItem,
          };
        }
        if (String(entry.id) === String(containerId)) {
          return {
            ...entry,
            nestedLayout: nextNested,
            mobileNestedLayout: nextMobileNested,
          };
        }
        return entry;
      });
    });

    if (!patch) return;

    setLayout((prev) => {
      const source = layoutSnapshot || prev;
      const next = source.filter((item) => String(item.i) !== String(widgetId));
      layoutRef.current = next;
      return next;
    });
    setMobileLayout((prev) => {
      const source = mobileLayoutSnapshot || prev;
      const next = source.filter((item) => String(item.i) !== String(widgetId));
      mobileLayoutRef.current = next;
      return next;
    });
    syncContainerMainLayout(containerId, patch.nextNested, patch.nextMobileNested);
    setSelectedWidgetId(widgetId);
    setPropertyPanelOpen(true);
  };

  const cloneWidgetInContainer = (containerId, widget) => {
    if (!widget || !containerId) return;
    captureHistoryBeforeChange();
    const newId = `tmp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    let patch = null;

    setWidgets((prev) => {
      const container = prev.find((entry) => String(entry.id) === String(containerId));
      if (!container) return prev;

      if (isPhoneBuilderMode) {
        const mobileNestedSource = getContainerNestedMobileSource(container, prev);
        const sourceLayout = widget.mobileLayout
          || widget.layout
          || buildInitialNestedLayoutForType(widget.rawType, mobileNestedSource.length, widget.id);
        const slot = findCloneLayoutSlot(mobileNestedSource, sourceLayout);
        const mobileNestedItem = normalizeLayoutItem(
          { ...sourceLayout, ...slot, x: 0, w: 12 },
          mobileNestedSource.length,
          newId,
        );
        const nextMobileNested = [...mobileNestedSource, mobileNestedItem];
        patch = { nextNested: null, nextMobileNested };

        const cloned = {
          ...widget,
          id: newId,
          title: `${String(widget.title || "").trim() || widget.rawType || "Widget"} Copy`,
          containerId,
          sectionId: containerId,
          mobileLayout: mobileNestedItem,
          previewData: null,
          previewError: null,
          deviceTarget: "both",
        };

        return [
          ...prev.map((entry) => {
            if (String(entry.id) !== String(containerId)) return entry;
            return {
              ...entry,
              mobileNestedLayout: nextMobileNested,
            };
          }),
          cloned,
        ];
      }

      const nestedSource = getContainerNestedSource(container, prev);
      const mobileNestedSource = getContainerNestedMobileSource(container, prev);
      const sourceLayout = widget.layout || buildInitialNestedLayoutForType(widget.rawType, nestedSource.length, widget.id);
      const slot = findCloneLayoutSlot(nestedSource, sourceLayout);
      const nestedItem = normalizeLayoutItem({ ...sourceLayout, ...slot }, nestedSource.length, newId);
      const mobileNestedItem = normalizeLayoutItem(
        { ...(widget.mobileLayout || sourceLayout), ...slot, w: Math.min(12, Number(slot.w) || 12) },
        mobileNestedSource.length,
        newId,
      );
      const nextNested = [...nestedSource, nestedItem];
      const nextMobileNested = [...mobileNestedSource, mobileNestedItem];
      patch = { nextNested, nextMobileNested };

      const cloned = {
        ...widget,
        id: newId,
        title: `${String(widget.title || "").trim() || widget.rawType || "Widget"} Copy`,
        containerId,
        sectionId: containerId,
        layout: nestedItem,
        mobileLayout: mobileNestedItem,
        previewData: null,
        previewError: null,
        deviceTarget: "both",
      };

      return [
        ...prev.map((entry) => {
          if (String(entry.id) !== String(containerId)) return entry;
          return {
            ...entry,
            nestedLayout: nextNested,
            mobileNestedLayout: nextMobileNested,
          };
        }),
        cloned,
      ];
    });

    if (patch) {
      syncContainerMainLayout(
        containerId,
        isPhoneBuilderMode ? undefined : patch.nextNested,
        isPhoneBuilderMode ? patch.nextMobileNested : undefined,
      );
      setSelectedWidgetId(newId);
      setPropertyPanelOpen(true);
    }
  };

  const handleNestedLayoutChange = (containerId, nextLayout, isMobile = false) => {
    if (isCanvasLocked) return;
    captureHistoryBeforeChange();
    manualSizedWidgetIdsRef.current.delete(String(containerId));
    const normalized = (nextLayout || []).map((item, idx) => normalizeLayoutItem(item, idx, item.i));
    setWidgets((prev) =>
      prev.map((widget) => {
        if (String(widget.id) !== String(containerId)) return widget;
        return isMobile
          ? { ...widget, mobileNestedLayout: normalized }
          : { ...widget, nestedLayout: normalized };
      }),
    );
    setWidgets((prev) =>
      prev.map((widget) => {
        if (String(widget.containerId) !== String(containerId)) return widget;
        const matched = normalized.find((item) => String(item.i) === String(widget.id));
        return matched
          ? (isMobile
            ? { ...widget, mobileLayout: matched }
            : { ...widget, layout: matched })
          : widget;
      }),
    );
    if (isMobile) {
      const container = widgets.find((widget) => String(widget.id) === String(containerId));
      syncContainerMainLayout(containerId, container?.nestedLayout || [], normalized);
    } else {
      syncContainerMainLayout(containerId, normalized, undefined);
    }
  };

  const syncLayoutFromCanvas = (sourceLayout = []) => {
    if (isCanvasLocked) return;
    const normalizedNext = sourceLayout.map((l, idx) => normalizeLayoutItem(l, idx, l.i));
    if (isPhoneBuilderMode) {
      mobileLayoutRef.current = normalizedNext;
      setMobileLayout(normalizedNext);
      setWidgets((prev) =>
        prev.map((w) => {
          const matched = normalizedNext.find((l) => String(l.i) === String(w.id));
          return matched ? { ...w, mobileLayout: matched } : w;
        }),
      );
      return;
    }
    layoutRef.current = normalizedNext;
    setLayout(normalizedNext);
    setWidgets((prev) =>
      prev.map((w) => {
        const matched = normalizedNext.find((l) => String(l.i) === String(w.id));
        return matched ? { ...w, layout: matched } : w;
      }),
    );
  };

  const handleDragStart = (_layout, oldItem) => {
    if (isCanvasLocked) return;
    const id = oldItem?.i ? String(oldItem.i) : null;
    draggingWidgetRef.current = id;
    setDraggingWidgetId(id);
  };

  const handleDragStop = (nextLayout) => {
    const draggedId = draggingWidgetRef.current;
    draggingWidgetRef.current = null;
    setDraggingWidgetId(null);

    const normalizedNext = (nextLayout || []).map((l, idx) => normalizeLayoutItem(l, idx, l.i));
    if (!draggedId || isPhoneBuilderMode) {
      captureHistoryBeforeChange();
      syncLayoutFromCanvas(normalizedNext);
      return;
    }

    const draggedWidget = widgets.find((entry) => String(entry.id) === String(draggedId));
    if (
      !draggedWidget
      || !isTopLevelCanvasWidget(draggedWidget)
      || draggedWidget.rawType === "container"
    ) {
      captureHistoryBeforeChange();
      syncLayoutFromCanvas(normalizedNext);
      return;
    }

    const draggedLayout = normalizedNext.find((item) => String(item.i) === String(draggedId));
    const containers = widgets.filter(
      (entry) => entry.rawType === "container" && isTopLevelCanvasWidget(entry),
    );
    const targetContainerId = findContainerDropTarget(draggedLayout, normalizedNext, containers);

    if (targetContainerId) {
      moveWidgetIntoContainer(
        targetContainerId,
        draggedId,
        normalizedNext,
        mobileLayoutRef.current,
      );
      return;
    }

    captureHistoryBeforeChange();
    syncLayoutFromCanvas(normalizedNext);
  };

  const handleResizeStop = (nextLayout) => {
    captureHistoryBeforeChange();
    (nextLayout || []).forEach((item) => {
      if (item?.i) manualSizedWidgetIdsRef.current.add(String(item.i));
    });
    syncLayoutFromCanvas(nextLayout || []);
  };

  const updateWidgetLocal = (updatedWidget) => {
    if (!updatedWidget) {
      captureHistoryBeforeChange();
      setWidgets((prev) => prev.filter((w) => String(w.id) !== String(selectedWidgetId)));
      setLayout((prev) => {
        const next = prev.filter((l) => String(l.i) !== String(selectedWidgetId));
        if (!isPhoneBuilderMode) layoutRef.current = next;
        return next;
      });
      setMobileLayout((prev) => {
        const next = prev.filter((l) => String(l.i) !== String(selectedWidgetId));
        mobileLayoutRef.current = next;
        return next;
      });
      setSelectedWidgetId(null);
      return;
    }
    markHistoryGroupedEdit();
    setWidgets((prev) => prev.map((w) => (String(w.id) === String(updatedWidget.id) ? updatedWidget : w)));
    if (updatedWidget.rawType === "container" && updatedWidget.containerPreset) {
      setLayout((prev) => {
        const next = prev.map((l, idx) => {
          if (String(l.i) !== String(updatedWidget.id)) return l;
          const containerLayout = applyDesktopContainerLayout(updatedWidget, l);
          return normalizeLayoutItem(
            { ...l, x: containerLayout.x, w: containerLayout.w },
            idx,
            updatedWidget.id,
          );
        });
        layoutRef.current = next;
        return next;
      });
    }
    if (updatedWidget.layout || updatedWidget.mobileLayout) {
      const layoutPatch = updatedWidget.mobileLayout && isPhoneBuilderMode
        ? updatedWidget.mobileLayout
        : updatedWidget.layout;
      if (!layoutPatch) return;
      const applyPatch = (prev) => {
        const next = prev.map((l, idx) =>
          String(l.i) === String(updatedWidget.id)
            ? normalizeLayoutItem({ ...l, ...layoutPatch }, idx, updatedWidget.id)
            : l,
        );
        if (isPhoneBuilderMode) {
          mobileLayoutRef.current = next;
        } else {
          layoutRef.current = next;
        }
        return next;
      };
      if (isPhoneBuilderMode) {
        setMobileLayout(applyPatch);
      } else {
        setLayout(applyPatch);
      }
    }
  };

  const handlePreview = async (widget) => {
    try {
      if (!requiresDataQuery(widget.rawType) || !isConfiguredWidgetQuery(widget.query)) {
        setWidgets((prev) =>
          prev.map((w) => (String(w.id) === String(widget.id) ? { ...w, previewData: [], previewError: null } : w)),
        );
        return;
      }
      setBusy(true);
      const res = await previewWidget(widget.query, {
        dbSource: widget.dataSource || "ims_postgresql",
        filters,
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
    const liveDesktopLayout = layoutRef.current?.length ? layoutRef.current : layout;
    const liveMobileLayout = mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout;
    const desktopSource = widget.containerId
      ? (widget.layout && typeof widget.layout === "object" ? widget.layout : normalizeLayoutItem({}, 0, widget.id))
      : (liveDesktopLayout.find((l) => String(l.i) === String(widget.id))
        || widget.layout
        || normalizeLayoutItem({}, 0, widget.id));
    const mobileSource = widget.containerId
      ? (widget.mobileLayout && typeof widget.mobileLayout === "object" ? widget.mobileLayout : desktopSource)
      : (liveMobileLayout.find((l) => String(l.i) === String(widget.id))
        || widget.mobileLayout
        || desktopSource);

    const buildResolvedLayout = (sourceLayout, applySizeOptions = false) => {
      const withPixelSize = normalizeLayoutItem(
        {
          ...sourceLayout,
          w: applySizeOptions && options?.widthPx != null ? pixelToGridW(options.widthPx) : sourceLayout.w,
          h: applySizeOptions && options?.heightPx != null ? pixelToGridH(options.heightPx) : sourceLayout.h,
        },
        0,
        widget.id,
      );
      return normalizeLayoutItem(enforceLayoutByType(widget.rawType, withPixelSize), 0, widget.id);
    };

    const resolvedDesktopLayout = buildResolvedLayout(desktopSource, !isPhoneBuilderMode);
    const resolvedMobileLayout = buildResolvedLayout(mobileSource, isPhoneBuilderMode);
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
      layout: resolvedDesktopLayout,
      mobile_layout: resolvedMobileLayout,
      device_target: "both",
      is_active: widget.is_active !== false,
      is_published: false,
    };
    if (widget.containerId) {
      payload.section_id = widget.containerId;
    }

    try {
      setBusy(true);
      const applyDesktopSavedLayout = (prev) => {
        const next = prev.map((l, idx) =>
          String(l.i) === String(widget.id)
            ? normalizeLayoutItem({ ...l, ...resolvedDesktopLayout }, idx, widget.id)
            : l,
        );
        layoutRef.current = next;
        return next;
      };
      const applyMobileSavedLayout = (prev) => {
        const next = prev.map((l, idx) =>
          String(l.i) === String(widget.id)
            ? normalizeLayoutItem({ ...l, ...resolvedMobileLayout }, idx, widget.id)
            : l,
        );
        mobileLayoutRef.current = next;
        return next;
      };
      if (isPhoneBuilderMode) {
        setMobileLayout(applyMobileSavedLayout);
      } else if (!widget.containerId) {
        setLayout(applyDesktopSavedLayout);
      }
      const isTemp = String(widget.id).startsWith("tmp_");
      let res;
      if (isTemp) {
        res = await createWidget(payload);
      } else {
        try {
          res = await updateWidgetApi(widget.id, payload);
        } catch (err) {
          const message = String(err?.message || "").toLowerCase();
          if (message.includes("not found")) {
            res = await createWidget(payload);
          } else {
            throw err;
          }
        }
      }
      const saved = res?.data;
      if (!saved) return;

      const remapNestedItems = (items = []) =>
        items.map((item, idx) =>
          String(item.i) === String(widget.id)
            ? normalizeLayoutItem({ ...item, i: String(saved.id) }, idx, saved.id)
            : item,
        );

      setWidgets((prev) =>
        prev.map((w) => {
          if (String(w.id) === String(widget.containerId)) {
            return {
              ...w,
              nestedLayout: remapNestedItems(w.nestedLayout || []),
              mobileNestedLayout: remapNestedItems(w.mobileNestedLayout || []),
            };
          }
          if (String(w.id) === String(widget.id)) {
            return {
              ...w,
              ...saved,
              id: saved.id,
              rawType: saved.type === "count" || saved.type === "sum" ? "kpi" : saved.type === "section" ? "container" : saved.type,
              metricType: saved.type === "sum" ? "sum" : "count",
              type:
                saved.type === "graph"
                  ? saved?.chart_config?.chart_type || "bar"
                  : saved.type === "section"
                    ? "container"
                    : typeToDisplayType[saved.type] || "table",
              query: saved.query || "",
              erpFilter: saved?.chart_config?.erp_filter || {},
              emptyText: saved?.chart_config?.emptyText || "Click edit and add query",
              dataSource: saved?.chart_config?.data_source || "ims_postgresql",
              audienceScope: saved?.audience_scope || "global",
              targetUserIds: Array.isArray(saved?.target_user_ids) ? saved.target_user_ids : [],
              sectionId: saved?.chart_config?.section_id ?? w.containerId ?? null,
              containerId: saved?.chart_config?.section_id ?? w.containerId ?? null,
              targetPageKey: saved?.target_page_key || widget.targetPageKey || "dashboard",
              targetPageModule: saved?.target_page_module || widget.targetPageModule || null,
              deviceTarget: normalizeWidgetDeviceTarget(saved?.device_target || widget.deviceTarget),
              layout: resolvedDesktopLayout,
              mobileLayout: resolvedMobileLayout,
              style: mergeWidgetStyle(
                saved.type === "count" || saved.type === "sum" ? "kpi" : saved.type === "section" ? "container" : saved.type,
                saved?.chart_config,
              ),
            };
          }
          return w;
        }),
      );
      if (!widget.containerId) {
        setLayout((prev) => {
          const next = prev.map((l, idx) =>
            String(l.i) === String(widget.id) ? normalizeLayoutItem({ ...l, i: String(saved.id) }, idx, saved.id) : l,
          );
          layoutRef.current = next;
          return next;
        });
        setMobileLayout((prev) => {
          const next = prev.map((l, idx) =>
            String(l.i) === String(widget.id) ? normalizeLayoutItem({ ...l, i: String(saved.id) }, idx, saved.id) : l,
          );
          mobileLayoutRef.current = next;
          return next;
        });
      }
      setSelectedWidgetId(saved.id);
    } catch (err) {
      showBuilderNotice("error", err.message || "Failed to save widget.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteWidget = async (widget) => {
    if (!widget) return;
    captureHistoryBeforeChange();
    const childWidgets =
      widget.rawType === "container"
        ? widgets.filter((entry) => String(entry.containerId) === String(widget.id))
        : [];
    const removedIds = new Set([String(widget.id), ...childWidgets.map((child) => String(child.id))]);

    setWidgets((prev) => {
      let next = prev.filter((w) => !removedIds.has(String(w.id)));
      if (widget.containerId) {
        next = next.map((entry) => {
          if (String(entry.id) !== String(widget.containerId)) return entry;
          return {
            ...entry,
            nestedLayout: (entry.nestedLayout || []).filter((item) => !removedIds.has(String(item.i))),
            mobileNestedLayout: (entry.mobileNestedLayout || []).filter((item) => !removedIds.has(String(item.i))),
          };
        });
      }
      return next;
    });
    setLayout((prev) => {
      const next = prev.filter((l) => !removedIds.has(String(l.i)));
      if (!isPhoneBuilderMode) layoutRef.current = next;
      return next;
    });
    setMobileLayout((prev) => {
      const next = prev.filter((l) => !removedIds.has(String(l.i)));
      mobileLayoutRef.current = next;
      return next;
    });
    setSelectedWidgetId(null);

    try {
      const deleteOne = async (entry) => {
        if (String(entry.id).startsWith("tmp_")) return;
        try {
          await deleteWidget(entry.id, {
            appKey: targetAppKey,
            pageKey: DASHBOARD_STORAGE_PAGE_KEY,
            dashboardKey: selectedDashboardKey,
          });
        } catch (err) {
          const message = String(err?.message || "").toLowerCase();
          if (!message.includes("not found")) throw err;
        }
      };
      for (const child of childWidgets) {
        await deleteOne(child);
      }
      await deleteOne(widget);
    } catch (err) {
      showBuilderNotice("error", err.message || "Failed to delete widget.");
    }
  };

  const buildDashboardJsonPayload = () => {
    const syncedWidgets = hydrateContainerNestedLayouts(
      widgets.map((widget) => {
        if (widget.rawType !== "container") return widget;
        return {
          ...widget,
          nestedLayout: getContainerNestedSource(widget, widgets),
          mobileNestedLayout: getContainerNestedMobileSource(widget, widgets),
        };
      }),
    );
    const liveLayout = layoutRef.current?.length ? layoutRef.current : layout;
    const liveMobile = mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout;
    const publishLayout = clampLayoutInBounds(
      liveLayout.map((item, idx) => ({
        ...(item || {}),
        i: String(item?.i || item?.id || `layout_${idx}`),
      })),
      GRID_COLS,
    ).map((item, idx) => {
      const widget = syncedWidgets.find((entry) => String(entry.id) === String(item.i));
      const resolved = widget?.rawType === "container"
        ? applyDesktopContainerLayout(widget, item)
        : item;
      return normalizeLayoutItem(resolved, idx, item.i);
    });
    const publishMobileLayout = clampLayoutInBounds(
      liveMobile.map((item, idx) => ({
        ...(item || {}),
        i: String(item?.i || item?.id || `mobile_layout_${idx}`),
      })),
      GRID_COLS,
    ).map((item, idx) => normalizeLayoutItem(item, idx, item.i));
    const widgetsForJson = syncedWidgets.map((widget) => {
      if (widget.rawType !== "container") return widget;
      return {
        ...widget,
        nestedLayout: getContainerNestedSource(widget, syncedWidgets),
        mobileNestedLayout: getContainerNestedMobileSource(widget, syncedWidgets),
      };
    });
    const dashboardWidgets = widgetsForJson.map((widget) => {
      const isNestedChild = Boolean(widget.containerId);
      const parentContainer = isNestedChild
        ? syncedWidgets.find((entry) => String(entry.id) === String(widget.containerId))
        : null;
      const nestedMobileItem = isNestedChild
        ? (parentContainer?.mobileNestedLayout || []).find((item) => String(item.i) === String(widget.id))
        : null;
      const currentLayout = isNestedChild
        ? (widget.layout && typeof widget.layout === "object" ? widget.layout : normalizeLayoutItem({}, 0, widget.id))
        : (publishLayout.find((l) => String(l.i) === String(widget.id)) || widget.layout || normalizeLayoutItem({}, 0, widget.id));
      let currentMobileLayout = isNestedChild
        ? nestedMobileItem
        : (publishMobileLayout.find((l) => String(l.i) === String(widget.id)) || null);
      if (isNestedChild && !currentMobileLayout) {
        if (widget.mobileLayout && typeof widget.mobileLayout === "object") {
          currentMobileLayout = widget.mobileLayout;
        } else {
          const nestedDesktopItem = (parentContainer?.nestedLayout || []).find(
            (item) => String(item.i) === String(widget.id),
          );
          currentMobileLayout = nestedDesktopItem
            ? normalizeLayoutItem({ ...nestedDesktopItem, x: 0, w: 12 }, 0, widget.id)
            : currentLayout;
        }
      } else if (!isNestedChild && !currentMobileLayout) {
        currentMobileLayout = widget.mobileLayout || currentLayout;
      }
      const resolvedLayout = normalizeLayoutItem(
        enforceLayoutByType(widget.rawType, currentLayout),
        0,
        widget.id,
      );
      const resolvedMobileLayout = normalizeLayoutItem(
        enforceLayoutByType(widget.rawType, currentMobileLayout),
        0,
        widget.id,
      );
      return {
        ...normalizeWidgetForDashboardJson(widget, resolvedLayout),
        mobileLayout: compactLayoutForStorage(resolvedMobileLayout, widget.id),
        deviceTarget: normalizeWidgetDeviceTarget(widget.deviceTarget),
      };
    });
    return {
      publishLayout,
      publishMobileLayout,
      dashboardJson: {
        version: 2,
        appKey: targetAppKey,
        pageKey: DASHBOARD_STORAGE_PAGE_KEY,
        widgets: dashboardWidgets,
      },
    };
  };

  const handleBuilderDeviceModeChange = (nextMode) => {
    const normalizedMode = nextMode === BUILDER_DEVICE_MOBILE ? BUILDER_DEVICE_MOBILE : BUILDER_DEVICE_DESKTOP;
    if (normalizedMode === builderDeviceMode) return;

    if (normalizedMode === BUILDER_DEVICE_MOBILE) {
      const liveLayout = layoutRef.current?.length ? layoutRef.current : layout;
      const liveMobileLayout = mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout;
      const mergedMobile = mergeMobileLayoutFromDesktop(widgets, liveLayout, liveMobileLayout);
      mobileLayoutRef.current = mergedMobile;
      setMobileLayout(mergedMobile);
      setWidgets((prev) =>
        prev.map((widget) => {
          if (widget.rawType !== "container") return widget;
          if (Array.isArray(widget.mobileNestedLayout) && widget.mobileNestedLayout.length) {
            return widget;
          }
          const nestedSource = getContainerNestedSource(widget, prev);
          return {
            ...widget,
            mobileNestedLayout: stackNestedLayoutForPhone(nestedSource),
          };
        }),
      );
    }

    setBuilderDeviceMode(normalizedMode);
    setSelectedWidgetId(null);
    setPanelWidgetSnapshot(null);
  };

  const handleDashboardRename = async () => {
    if (!isNonDefaultDashboard || busy) return;
    const nextName = String(dashboardEditName || "").trim();
    const currentName = String(selectedDashboardLabel || "").trim();
    if (!nextName || nextName === currentName) return;
    try {
      await renameDashboardConfig({
        appKey: targetAppKey,
        pageKey: DASHBOARD_STORAGE_PAGE_KEY,
        dashboardKey: selectedDashboardKey,
        dashboardName: nextName,
      });
      await refreshDashboardOptions();
    } catch (err) {
      alert(err.message || "Failed to rename dashboard.");
      setDashboardEditName(currentName);
    }
  };

  const handleSaveAllDraft = async () => {
    if (widgets.length === 0) return false;
    try {
      setBusy(true);
      const { publishLayout, publishMobileLayout, dashboardJson } = buildDashboardJsonPayload();
      await saveDashboardDraft({
        appKey: targetAppKey,
        pageKey: DASHBOARD_STORAGE_PAGE_KEY,
        dashboardKey: selectedDashboardKey,
        dashboardName: dashboardNameForSave,
        scope: dashboardScopeForSave,
        targetUserIds: dashboardTargetUsersForSave,
        defaultForUserIds: defaultForUsersForSave,
        dashboardJson,
      });
      layoutRef.current = publishLayout;
      mobileLayoutRef.current = publishMobileLayout;
      setLayout(publishLayout);
      setMobileLayout(publishMobileLayout);
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
    setShowPublishModal(true);
  };

  const confirmPublishAll = async ({ saveDraftFirst = false } = {}) => {
    if (widgets.length === 0 || publishingRef.current) return;
    publishingRef.current = true;
    setShowPublishModal(false);
    try {
      setBusy(true);
      if (saveDraftFirst && isDirty) {
        const saved = await handleSaveAllDraft();
        if (!saved) return;
      }
      const { publishLayout, publishMobileLayout, dashboardJson } = buildDashboardJsonPayload();

      await publishDashboardConfig({
        appKey: targetAppKey,
        pageKey: DASHBOARD_STORAGE_PAGE_KEY,
        dashboardKey: selectedDashboardKey,
        dashboardName: dashboardNameForSave,
        scope: dashboardScopeForSave,
        targetUserIds: dashboardTargetUsersForSave,
        defaultForUserIds: defaultForUsersForSave,
        dashboardJson,
      });

      layoutRef.current = publishLayout;
      mobileLayoutRef.current = publishMobileLayout;
      setLayout(publishLayout);
      setMobileLayout(publishMobileLayout);
      await refreshDashboardOptions();
      await loadWidgets();
      showBuilderNotice("success", "Dashboard published successfully!");
    } catch (err) {
      showBuilderNotice("error", err.message || "Failed to publish dashboard.");
    } finally {
      setBusy(false);
      publishingRef.current = false;
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
        setAsDefaultForUsers: cloneAsDefaultForUsers,
        dashboardJson,
      });
      const refreshed = await listDashboardConfigs({ appKey: targetAppKey, pageKey: DASHBOARD_STORAGE_PAGE_KEY });
      const rows = Array.isArray(refreshed?.data) ? refreshed.data : [];
      setDashboardOptions(buildDashboardOptions(rows));
      setSelectedDashboardKey(normalizedDashboardKey);
      setSelectedAudienceUserIds(cloneUserIds.map(Number).filter(Number.isFinite));
      if (cloneAsDefaultForUsers) {
        setDefaultForAssignedUsers(cloneUserIds.map(Number).filter(Number.isFinite));
      }
      setShowClonePanel(false);
      setCloneName("");
      setCloneAudienceUserIds([]);
      setCloneAsDefaultForUsers(false);
      await loadWidgets(normalizedDashboardKey);
      alert("Clone dashboard created.");
    } catch (error) {
      alert(error?.message || "Failed to create clone dashboard.");
    } finally {
      setBusy(false);
    }
  };

  const buildContainerCloneBundle = (containerWidget) => {
    if (!containerWidget || containerWidget.rawType !== "container") return null;

    const containerId = String(containerWidget.id);
    const children = widgets.filter(
      (entry) => String(entry.containerId || entry.sectionId) === containerId,
    );
    const newContainerId = `tmp_${Date.now()}`;
    const idMap = new Map([[containerId, newContainerId]]);
    children.forEach((child, idx) => {
      idMap.set(String(child.id), `tmp_${Date.now()}_${idx + 1}`);
    });

    const remapNestedItems = (items = []) =>
      items.map((item, idx) => {
        const mappedId = idMap.get(String(item.i)) || String(item.i);
        return normalizeLayoutItem({ ...item, i: mappedId }, idx, mappedId);
      });

    const nestedSource = getContainerNestedSource(containerWidget, widgets);
    const mobileNestedSource = getContainerNestedMobileSource(containerWidget, widgets);
    const nextNestedLayout = remapNestedItems(nestedSource);
    const nextMobileNestedLayout = remapNestedItems(mobileNestedSource);

    const liveDesktopLayout = layoutRef.current?.length ? layoutRef.current : layout;
    const liveMobileLayout = mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout;
    const desktopSource =
      liveDesktopLayout.find((item) => String(item.i) === containerId)
      || containerWidget.layout
      || normalizeLayoutItem({}, liveDesktopLayout.length, containerId);
    const mobileSource =
      liveMobileLayout.find((item) => String(item.i) === containerId)
      || containerWidget.mobileLayout
      || desktopSource;
    const desktopSlot = findCloneLayoutSlot(liveDesktopLayout, desktopSource);
    const mobileSlot = findCloneLayoutSlot(liveMobileLayout, mobileSource);
    const clonedDesktopLayout = normalizeLayoutItem(
      { ...desktopSource, ...desktopSlot },
      liveDesktopLayout.length,
      newContainerId,
    );
    const clonedMobileLayout = normalizeLayoutItem(
      { ...mobileSource, ...mobileSlot },
      liveMobileLayout.length,
      newContainerId,
    );

    const clonedContainer = {
      ...containerWidget,
      id: newContainerId,
      title: `${String(containerWidget.title || "").trim() || "Container"} Copy`,
      nestedLayout: nextNestedLayout,
      mobileNestedLayout: nextMobileNestedLayout,
      sectionId: null,
      containerId: null,
      previewData: null,
      previewError: null,
      deviceTarget: "both",
    };

    const clonedChildren = children.map((child) => {
      const newChildId = idMap.get(String(child.id));
      const nestedItem = nextNestedLayout.find((item) => String(item.i) === String(newChildId));
      const mobileNestedItem = nextMobileNestedLayout.find((item) => String(item.i) === String(newChildId));
      return {
        ...child,
        id: newChildId,
        containerId: newContainerId,
        sectionId: newContainerId,
        layout: nestedItem || child.layout,
        mobileLayout: mobileNestedItem || child.mobileLayout || nestedItem || child.layout,
        previewData: null,
        previewError: null,
        deviceTarget: "both",
      };
    });

    return {
      sourceContainerId: containerId,
      clonedContainer,
      clonedChildren,
      clonedDesktopLayout,
      clonedMobileLayout,
      nextNestedLayout,
      nextMobileNestedLayout,
    };
  };

  const applyContainerCloneBundle = (cloneBundle) => {
    if (!cloneBundle) return;
    const {
      sourceContainerId,
      clonedContainer,
      clonedChildren,
      clonedDesktopLayout,
      clonedMobileLayout,
    } = cloneBundle;
    const newContainerId = clonedContainer.id;
    const liveMobileLayout = mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout;

    setWidgets((prev) => [...prev, clonedContainer, ...clonedChildren]);

    if (isPhoneBuilderMode) {
      setMobileLayout((prev) => {
        const next = [...prev, normalizeLayoutItem(clonedMobileLayout, prev.length, newContainerId)];
        mobileLayoutRef.current = next;
        return next;
      });
    } else {
      setLayout((prev) => {
        const next = [...prev, normalizeLayoutItem(clonedDesktopLayout, prev.length, newContainerId)];
        layoutRef.current = next;
        return next;
      });
      if (liveMobileLayout.some((item) => String(item.i) === String(sourceContainerId))) {
        setMobileLayout((prev) => {
          const next = [...prev, normalizeLayoutItem(clonedMobileLayout, prev.length, newContainerId)];
          mobileLayoutRef.current = next;
          return next;
        });
      }
    }

    setSelectedWidgetId(newContainerId);
    setPropertyPanelOpen(true);
  };

  const cloneContainerWithChildren = (containerWidget) => {
    captureHistoryBeforeChange();
    const cloneBundle = buildContainerCloneBundle(containerWidget);
    applyContainerCloneBundle(cloneBundle);
    return cloneBundle;
  };

  const persistClonedContainer = async (containerWidget, cloneBundle) => {
    if (!cloneBundle) return;
    const {
      clonedDesktopLayout,
      clonedMobileLayout,
      clonedChildren,
    } = cloneBundle;

    const containerPayload = {
      title: `${String(containerWidget.title || "").trim() || "Container"} Copy`,
      description: containerWidget.description || "",
      type: "section",
      query: "",
      audience_scope: containerWidget.audienceScope || "global",
      target_user_ids: Array.isArray(containerWidget.targetUserIds) ? containerWidget.targetUserIds : [],
      chart_config: {
        ...chartConfigFromWidgetStyle(containerWidget),
        nested_layout: [],
        mobile_nested_layout: [],
      },
      app_key: targetAppKey,
      page_key: DASHBOARD_STORAGE_PAGE_KEY,
      target_page_key: containerWidget.targetPageKey || "dashboard",
      target_page_module: containerWidget.targetPageModule || null,
      dashboard_key: selectedDashboardKey,
      dashboard_name: selectedDashboardLabel,
      dashboard_scope: dashboardScopeForSave,
      dashboard_target_user_ids: dashboardTargetUsersForSave,
      layout: normalizeLayoutItem(
        enforceLayoutByType("container", clonedDesktopLayout),
        0,
        containerWidget.id,
      ),
      mobile_layout: normalizeLayoutItem(
        enforceLayoutByType("container", clonedMobileLayout),
        0,
        containerWidget.id,
      ),
      device_target: "both",
      is_active: containerWidget.is_active !== false,
      is_published: false,
    };

    const containerRes = await createWidget(containerPayload);
    const savedContainer = containerRes?.data;
    if (!savedContainer?.id) throw new Error("Failed to clone container.");

    const savedNested = [];
    const savedMobileNested = [];

    for (const child of clonedChildren) {
      const nestedItem = cloneBundle.nextNestedLayout.find((item) => String(item.i) === String(child.id));
      const mobileNestedItem = cloneBundle.nextMobileNestedLayout.find((item) => String(item.i) === String(child.id));
      const childPayload = {
        title: child.title || "",
        description: child.description || "",
        type: resolveApiType(child),
        query: requiresDataQuery(child.rawType) ? child.query || "" : "",
        audience_scope: child.audienceScope || "global",
        target_user_ids: Array.isArray(child.targetUserIds) ? child.targetUserIds : [],
        chart_config: {
          ...chartConfigFromWidgetStyle({ ...child, containerId: savedContainer.id, sectionId: savedContainer.id }),
          section_id: savedContainer.id,
        },
        app_key: targetAppKey,
        page_key: DASHBOARD_STORAGE_PAGE_KEY,
        target_page_key: child.targetPageKey || "dashboard",
        target_page_module: child.targetPageModule || null,
        dashboard_key: selectedDashboardKey,
        dashboard_name: selectedDashboardLabel,
        dashboard_scope: dashboardScopeForSave,
        dashboard_target_user_ids: dashboardTargetUsersForSave,
        layout: normalizeLayoutItem(
          enforceLayoutByType(child.rawType, nestedItem || child.layout || {}),
          0,
          child.id,
        ),
        mobile_layout: normalizeLayoutItem(
          enforceLayoutByType(child.rawType, mobileNestedItem || child.mobileLayout || nestedItem || child.layout || {}),
          0,
          child.id,
        ),
        device_target: "both",
        is_active: child.is_active !== false,
        is_published: false,
      };
      const childRes = await createWidget(childPayload);
      const savedChild = childRes?.data;
      if (!savedChild?.id) continue;
      if (nestedItem) {
        savedNested.push(normalizeLayoutItem({ ...nestedItem, i: String(savedChild.id) }, savedNested.length, savedChild.id));
      }
      if (mobileNestedItem) {
        savedMobileNested.push(
          normalizeLayoutItem({ ...mobileNestedItem, i: String(savedChild.id) }, savedMobileNested.length, savedChild.id),
        );
      }
    }

    await updateWidgetApi(savedContainer.id, {
      chart_config: {
        ...chartConfigFromWidgetStyle({
          ...containerWidget,
          nestedLayout: savedNested,
          mobileNestedLayout: savedMobileNested.length ? savedMobileNested : savedNested,
        }),
        nested_layout: savedNested,
        mobile_nested_layout: savedMobileNested.length ? savedMobileNested : savedNested,
      },
    });
  };

  const handleCloneWidget = async (widget) => {
    if (!widget) return;
    if (widget.containerId || widget.sectionId) {
      cloneWidgetInContainer(widget.containerId || widget.sectionId, widget);
      return;
    }
    if (widget.rawType === "container") {
      const isTemp = String(widget.id).startsWith("tmp_");
      if (isTemp) {
        cloneContainerWithChildren(widget);
        return;
      }

      captureHistoryBeforeChange();
      const cloneBundle = buildContainerCloneBundle(widget);
      if (!cloneBundle) return;

      try {
        setBusy(true);
        await persistClonedContainer(widget, cloneBundle);
        await loadWidgets();
        setSelectedWidgetId(null);
      } catch (err) {
        alert(err.message || "Failed to clone container.");
      } finally {
        setBusy(false);
      }
      return;
    }
    captureHistoryBeforeChange();

    const liveDesktopLayout = layoutRef.current?.length ? layoutRef.current : layout;
    const liveMobileLayout = mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout;
    const desktopSource =
      liveDesktopLayout.find((l) => String(l.i) === String(widget.id))
      || widget.layout
      || normalizeLayoutItem({}, liveDesktopLayout.length, widget.id);
    const mobileSource =
      liveMobileLayout.find((l) => String(l.i) === String(widget.id))
      || widget.mobileLayout
      || desktopSource;
    const desktopSlot = findCloneLayoutSlot(liveDesktopLayout, desktopSource);
    const mobileSlot = findCloneLayoutSlot(liveMobileLayout, mobileSource);
    const clonedDesktopLayout = {
      ...normalizeLayoutItem(desktopSource, liveDesktopLayout.length, widget.id),
      ...desktopSlot,
    };
    const clonedMobileLayout = {
      ...normalizeLayoutItem(mobileSource, liveMobileLayout.length, widget.id),
      ...mobileSlot,
    };

    const appendCloneLayouts = (targetId) => {
      setLayout((prev) => {
        const next = [...prev, normalizeLayoutItem(clonedDesktopLayout, prev.length, targetId)];
        layoutRef.current = next;
        return next;
      });
      setMobileLayout((prev) => {
        const next = [...prev, normalizeLayoutItem(clonedMobileLayout, prev.length, targetId)];
        mobileLayoutRef.current = next;
        return next;
      });
    };

    const isTemp = String(widget.id).startsWith("tmp_");
    if (isTemp) {
      const localId = `tmp_${Date.now()}`;
      const clonedLocal = {
        ...widget,
        id: localId,
        title: `${widget.title || "Widget"} Copy`,
        deviceTarget: "both",
      };
      setWidgets((prev) => [...prev, clonedLocal]);
      appendCloneLayouts(localId);
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
      layout: normalizeLayoutItem(
        enforceLayoutByType(widget.rawType, clonedDesktopLayout),
        liveDesktopLayout.length,
        widget.id,
      ),
      mobile_layout: normalizeLayoutItem(
        enforceLayoutByType(widget.rawType, clonedMobileLayout),
        liveMobileLayout.length,
        widget.id,
      ),
      device_target: "both",
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
        deviceTarget: normalizeWidgetDeviceTarget(saved?.device_target || widget.deviceTarget),
      };

      setWidgets((prev) => [...prev, mapped]);
      appendCloneLayouts(saved.id);
      setSelectedWidgetId(saved.id);
    } catch (err) {
      alert(err.message || "Failed to clone widget.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`relative flex flex-row ${embedMode ? "min-h-0" : "flex-1 h-full min-h-0 w-full"} ${readOnly && !isPhoneView ? "md:-m-2 md:w-[calc(100%+1rem)]" : ""} bg-[#f8fafc] overflow-hidden font-sans`}>
      {!readOnly && builderNotice ? (
        <div
          className={`fixed left-1/2 top-4 z-[130] w-[min(92vw,420px)] -translate-x-1/2 rounded-lg border px-4 py-3 shadow-lg ${
            builderNotice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-semibold">{builderNotice.message}</p>
        </div>
      ) : null}
      {/* ── MAIN: header + canvas ── */}
      <div className={`${embedMode ? "w-full" : "flex-1"} flex flex-col overflow-hidden min-w-0`}>
        {!readOnly && (
          <div className="h-11 bg-white border-b border-slate-200 shrink-0 z-20 shadow-sm flex min-w-0">
            {isPhoneBuilderMode && (
              <div className="hidden sm:flex items-center px-2 border-r border-slate-100 bg-blue-50/80 shrink-0 max-w-[220px]">
                <span className="text-[9px] font-bold uppercase tracking-widest text-blue-700 truncate">
                  Phone layout — drag & resize for mobile
                </span>
              </div>
            )}
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

              <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => handleBuilderDeviceModeChange(BUILDER_DEVICE_DESKTOP)}
                  title="Laptop layout"
                  className={`h-7 px-2 rounded text-[9px] font-bold uppercase tracking-wide inline-flex items-center gap-1 transition-all ${
                    builderDeviceMode === BUILDER_DEVICE_DESKTOP
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  <Monitor size={11} />
                  <span className="hidden sm:inline">Laptop</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBuilderDeviceModeChange(BUILDER_DEVICE_MOBILE)}
                  title="Phone layout"
                  className={`h-7 px-2 rounded text-[9px] font-bold uppercase tracking-wide inline-flex items-center gap-1 transition-all ${
                    builderDeviceMode === BUILDER_DEVICE_MOBILE
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  <Smartphone size={11} />
                  <span className="hidden sm:inline">Phone</span>
                </button>
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                      Name
                    </label>
                    <input
                      value={dashboardEditName}
                      onChange={(e) => setDashboardEditName(e.target.value)}
                      onBlur={handleDashboardRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="Dashboard name"
                      className="h-7 min-w-[120px] max-w-[160px] rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 outline-none focus:border-blue-400"
                    />
                  </div>
                )}
                {isNonDefaultDashboard && (
                  <DashboardAudienceUserSelect
                    selectedUserIds={selectedAudienceUserIds}
                    onSelectedUserIdsChange={(ids) => {
                      const normalized = Array.isArray(ids)
                        ? ids.map((value) => Number(value)).filter(Number.isFinite)
                        : [];
                      setSelectedAudienceUserIds(normalized);
                      setDefaultForAssignedUsers((prev) =>
                        prev.filter((userId) => normalized.includes(userId)),
                      );
                    }}
                    userOptions={userOptions}
                    compact
                  />
                )}
                {isNonDefaultDashboard && dashboardTargetUsersForSave.length > 0 && (
                  <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none" title="Assigned users will see this dashboard first when they have multiple dashboards">
                    <input
                      type="checkbox"
                      checked={isDefaultForAssignedUsers}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setDefaultForAssignedUsers(
                            dashboardTargetUsersForSave.map(Number).filter(Number.isFinite),
                          );
                        } else {
                          setDefaultForAssignedUsers([]);
                        }
                      }}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                      Default for users
                    </span>
                  </label>
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
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cloneAsDefaultForUsers}
                  onChange={(e) => setCloneAsDefaultForUsers(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                />
                <span className="text-[10px] font-semibold text-slate-600">
                  Set as default dashboard for selected users
                </span>
              </label>
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
                title={widgetStripLabel(w, idx)}
                className={`shrink-0 max-w-[170px] px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                  String(selectedWidgetId) === String(w.id)
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="block truncate">{widgetStripLabel(w, idx)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Canvas — fills available width, measured by containerRef */}
        <div
          ref={canvasContainerRef}
          className={`relative z-0 ${embedMode ? "max-h-[480px]" : "flex-1"} overflow-y-auto overflow-x-hidden custom-scrollbar ${
            readOnly
              ? isPhoneView
                ? "bg-transparent px-0 py-1"
                : "bg-[#f8fafc] p-0"
              : "bg-[#f8fafc] bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:18px_18px] px-1 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 "
          }`}
        >
          <div
            style={readOnly ? undefined : { minHeight: "100%" }}
            className={`w-full ${isPhonePreviewFrame ? "flex justify-center py-3" : ""}`}
            onClick={() => {
              if (!readOnly && !isCanvasLocked) {
                setSelectedWidgetId(null);
              }
            }}
          >
            {gridReady ? (
            <div className={isPhonePreviewFrame ? "w-[390px] max-w-full rounded-[24px] border-4 border-slate-800 bg-white shadow-xl" : "w-full"}>
            {readOnly ? (
            <GridLayout
              key={`dashboard-live-${isPhoneView ? "phone" : "desktop"}-${canvasWidth}`}
              className={`layout dashboard-view-grid${isPhoneView ? " dashboard-live-phone" : " dashboard-live-desktop"}`}
              width={canvasWidth}
              layout={activeReadOnlyLayout}
              cols={GRID_COLS}
              rowHeight={GRID_ROW_HEIGHT}
              compactType={null}
              preventCollision={false}
              isDraggable={false}
              isResizable={false}
              margin={[GRID_GAP_X, GRID_GAP_Y]}
              containerPadding={[0, 0]}
            >
              {canvasWidgets.map((widget) => (
                <div
                  key={String(widget.id)}
                  className={`group relative h-full w-full max-w-full ${widget.rawType === "container" ? "container-widget-cell " : ""}`}
                >
                  <WidgetRenderer
                    widget={widget}
                    readOnly={readOnly}
                    isPhoneMode={isPhoneLayoutMode}
                    isDropTarget={false}
                    selectedWidgetId={selectedWidgetId}
                    onNestedLayoutChange={handleNestedLayoutChange}
                    onSelectWidget={() => {}}
                    onDeleteWidget={handleDeleteWidget}
                    onAddChildWidget={addWidgetInContainer}
                    onCloneChildWidget={cloneWidgetInContainer}
                    onCloneWidget={handleCloneWidget}
                  />
                </div>
              ))}
            </GridLayout>
            ) : (
            <Responsive
              key={`builder-grid-${builderDeviceMode}`}
              className="layout dashboard-builder-grid"
              width={canvasWidth}
              layouts={renderedLayouts}
              breakpoints={activeBreakpoints}
              cols={activeColsMap}
              rowHeight={GRID_ROW_HEIGHT}
              onDragStart={!isCanvasLocked ? handleDragStart : undefined}
              onDragStop={!isCanvasLocked ? handleDragStop : undefined}
              onResizeStop={!isCanvasLocked ? handleResizeStop : undefined}
              compactType={null}
              preventCollision={false}
              draggableHandle={isCanvasLocked ? undefined : ".canvas-drag-handle"}
              isDraggable={!isCanvasLocked}
              isResizable={!isCanvasLocked}
              resizeHandles={!isCanvasLocked ? ["s", "w", "e", "n", "sw", "nw", "se", "ne"] : []}
              margin={[GRID_GAP_X, GRID_GAP_Y]}
              containerPadding={[0, 0]}
            >
              {canvasWidgets.map((widget) => (
                <div
                  key={String(widget.id)}
                  className={`group relative h-full w-full max-w-full transition-all duration-150 ${widget.rawType === "container" ? "container-widget-cell " : ""}${dropTargetContainerIds.has(String(widget.id)) ? "ring-2 ring-blue-400 ring-dashed " : ""}${String(selectedWidgetId) === String(widget.id) ? "z-20" : "z-10"}`}
                  onMouseDown={(e) => {
                    if (isCanvasLocked || showClonePanel) return;
                    if (e.target.closest(".canvas-drag-handle, .widget-action-bar, button, a, input, select, textarea, .react-resizable-handle")) return;
                    e.stopPropagation();
                    setSelectedWidgetId(widget.id);
                    setPropertyPanelOpen(true);
                  }}
                  onClick={(e) => {
                    if (isCanvasLocked || showClonePanel) return;
                    e.stopPropagation();
                    setSelectedWidgetId(widget.id);
                    setPropertyPanelOpen(true);
                  }}
                >
                  {!isCanvasLocked && widget.rawType !== "container" && String(selectedWidgetId) === String(widget.id) && (
                    <div className="absolute -inset-2 border-2 border-blue-500 rounded-[12px] pointer-events-none z-0" />
                  )}
                  {!isCanvasLocked && widget.rawType !== "container" && String(selectedWidgetId) === String(widget.id) && (
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
                  {!isCanvasLocked && widget.rawType !== "container" && (
                    <div className="canvas-drag-handle absolute top-1 left-1 z-40 h-5 w-5 grid place-items-center cursor-move opacity-0 group-hover:opacity-100 bg-white shadow border border-slate-200 rounded transition-all">
                      <GripVertical size={11} className="text-slate-400 pointer-events-none" />
                    </div>
                  )}
                  <WidgetRenderer
                    widget={widget}
                    readOnly={readOnly}
                    isPhoneMode={isPhoneLayoutMode}
                    isDropTarget={dropTargetContainerIds.has(String(widget.id))}
                    selectedWidgetId={selectedWidgetId}
                    onNestedLayoutChange={handleNestedLayoutChange}
                    onSelectWidget={(childId) => {
                      setSelectedWidgetId(childId);
                      setPropertyPanelOpen(true);
                    }}
                    onDeleteWidget={handleDeleteWidget}
                    onAddChildWidget={addWidgetInContainer}
                    onCloneChildWidget={cloneWidgetInContainer}
                    onCloneWidget={handleCloneWidget}
                  />
                </div>
              ))}
            </Responsive>
            )}
            </div>
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
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">
                  No Widgets Yet
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  {isPhoneBuilderMode
                    ? "Add widgets here for phone, or switch to Laptop mode. Drag and resize to fit mobile."
                    : "Start by creating your first widget."}
                </p>
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

      {!readOnly && propertyPanelDock === "fixed" && (
        <WidgetBuilderPanel
          dockMode="fixed"
          onDockModeChange={setPropertyPanelDock}
          open={propertyPanelOpen && Boolean(panelWidget)}
          onOpenChange={setPropertyPanelOpen}
          selectedWidget={panelWidget}
          onUpdate={updateWidgetLocal}
          onPreview={handlePreview}
          onSave={handleSaveWidget}
          onDelete={handleDeleteWidget}
          onPixelSizeChange={handlePixelSizeChange}
          onAddChildWidget={addWidgetInContainer}
          onMoveWidgetIntoContainer={moveWidgetIntoContainer}
          movableWidgets={movableWidgetsForContainer}
          isPhoneBuilderMode={isPhoneBuilderMode}
          appKey={targetAppKey}
          pageOptions={pageOptions}
          dbSourceOptions={DB_SOURCE_OPTIONS}
          widthPx={widthPx}
          heightPx={heightPx}
          minWidthPx={isPhoneBuilderMode ? 24 : minLayoutWidthPx}
          minHeightPx={isPhoneBuilderMode ? 24 : minLayoutHeightPx}
          onClose={() => {
            setSelectedWidgetId(null);
            setPanelWidgetSnapshot(null);
            setPropertyPanelOpen(false);
          }}
          busy={busy}
        />
      )}

      {!readOnly && propertyPanelDock === "float" && (
        <WidgetBuilderPanel
          dockMode="float"
          onDockModeChange={setPropertyPanelDock}
          open={propertyPanelOpen && Boolean(panelWidget)}
          onOpenChange={setPropertyPanelOpen}
          selectedWidget={panelWidget}
          onUpdate={updateWidgetLocal}
          onPreview={handlePreview}
          onSave={handleSaveWidget}
          onDelete={handleDeleteWidget}
          onPixelSizeChange={handlePixelSizeChange}
          onAddChildWidget={addWidgetInContainer}
          onMoveWidgetIntoContainer={moveWidgetIntoContainer}
          movableWidgets={movableWidgetsForContainer}
          isPhoneBuilderMode={isPhoneBuilderMode}
          appKey={targetAppKey}
          pageOptions={pageOptions}
          dbSourceOptions={DB_SOURCE_OPTIONS}
          widthPx={widthPx}
          heightPx={heightPx}
          minWidthPx={isPhoneBuilderMode ? 24 : minLayoutWidthPx}
          minHeightPx={isPhoneBuilderMode ? 24 : minLayoutHeightPx}
          onClose={() => {
            setSelectedWidgetId(null);
            setPanelWidgetSnapshot(null);
            setPropertyPanelOpen(false);
          }}
          busy={busy}
        />
      )}

      {!readOnly && showPublishModal && (
        <>
          <button
            type="button"
            aria-label="Close publish dialog"
            className="fixed inset-0 z-[110] bg-slate-900/30"
            onClick={() => setShowPublishModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-[120] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <p className="text-sm font-bold text-slate-800">Publish dashboard?</p>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              This will make your dashboard live for users.
              {isDirty ? " You have unsaved changes — save draft first or publish current canvas." : " Press OK to publish."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {isDirty && (
                <button
                  type="button"
                  onClick={() => confirmPublishAll({ saveDraftFirst: true })}
                  disabled={busy}
                  className="flex-1 min-w-[120px] rounded-md bg-blue-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Save & Publish
                </button>
              )}
              <button
                type="button"
                onClick={() => confirmPublishAll({ saveDraftFirst: false })}
                disabled={busy || publishingRef.current}
                className="flex-1 min-w-[100px] rounded-md bg-emerald-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Publishing..." : "OK, Publish"}
              </button>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="flex-1 min-w-[100px] rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
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
        .dashboard-builder-grid .react-grid-item.container-widget-cell {
          overflow: visible !important;
        }
        .dashboard-builder-grid .react-grid-item.container-widget-cell > div {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden;
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
        .dashboard-live-desktop.react-grid-layout,
        .dashboard-view-grid.dashboard-live-desktop .react-grid-layout {
          width: 100% !important;
          margin: 0 !important;
        }
        .dashboard-view-grid .react-grid-layout {
          width: 100% !important;
        }
        .dashboard-view-grid .react-grid-item {
          cursor: default !important;
          display: flex !important;
        }
        .dashboard-view-grid .react-grid-item.container-widget-cell {
          overflow: visible !important;
        }
        .dashboard-view-grid .react-grid-item.container-widget-cell > div {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden;
        }
        .dashboard-view-grid .react-grid-item > div {
          width: 100%;
          height: 100%;
        }
        .dashboard-view-grid .react-grid-item.react-draggable-dragging {
          transform: none !important;
        }
        @media (max-width: 768px) {
          .dashboard-live-phone .container-nested-grid .react-grid-item > div {
            box-shadow: none !important;
          }
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

