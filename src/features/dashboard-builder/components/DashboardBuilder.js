"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, startTransition } from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import { useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { ChevronDown, Copy, CloudOff, GripVertical, Layout, Monitor, MoreHorizontal, Pencil, Plus, Redo2, Smartphone, Trash2, Undo2, UploadCloud, X } from "lucide-react";
import { useSelector } from "react-redux";
import { api } from "@/core/api/apiClient";
import { CORE_ENDPOINTS } from "@/core/api/endpoints";
import WidgetRenderer from "./WidgetRenderer";
import SimpleBuilderCanvas from "./SimpleBuilderCanvas";
import WidgetBuilderPanel from "./WidgetBuilderPanel";
import { applyMainLayoutPixelsToItem, buildCanvasWidgetsWithContainers, applyDesktopContainerLayout, containerAutoGridHeight, hasCustomMobileNestedLayout, hasCustomPhoneLayout, hasCustomTopLevelMobileLayout, hasManualWidgetLayout, hydrateContainerNestedLayouts, inferContainerPresetFromLayout, inferNestedContentCanvasWidthPx, inferNestedGridWidthPx, mainGridLayoutToPixels, mainLayoutItemPixelStyle, mergeNestedItemFromChild, nestedGridColWidthPx, NESTED_BUILDER_COLS, NESTED_GAP, NESTED_GRID_COLS, NESTED_ROW_HEIGHT, normalizeContainerLayoutItem, normalizeNestedLayoutItem, placeNextNestedLayoutItem, readNestedGridWidthPx, readWidgetLayoutPixels, resolveContainerDisplayHeight, resolveContainerGridHeight, resolveContainerPreset, resolveNextContainerLayoutHeightPx, resolvePhoneNestedLayoutForDisplay, resolvePhoneTopLevelLayout, resolvePublishedDesktopLayout, resolvePublishedNestedLayout, resolvePublishedPhoneLayout, sanitizeNestedLayoutItems, scaleNestedLayoutToBuilder, scaleNestedLayoutToStorage, shouldPreserveSavedLayout, stackLayoutForPhone, stackNestedLayoutForPhone, syncNestedChildLayoutsFromContainers } from "../utils/dashboardLayoutEngine";
import { boxesFromChildren, boxesFromTopLevelWidgets, boxPxToGridItem, cloneBoxBeside, cloneBoxInContainer, contentBoundsPx, defaultBoxForType, defaultTopLevelBoxForType, ensurePhoneLayoutPx, layoutPxFingerprint, mergeLayoutPxFromWidgets, normalizeBox, packLayoutPxGaps, placeNextBoxPx, PHONE_CONTENT_WIDTH, PHONE_FRAME_INSET, readWidgetBoxPx, sanitizeNestedLayoutPx, scaleLayoutPx } from "../utils/floatingLayoutEngine";
import DashboardAudienceUserSelect from "./DashboardAudienceUserSelect";
import DashboardHome from "@/features/shared/dashboard/components/DashboardHome";
import { cloneDashboardToUsers, createWidget, deleteDashboardConfig, deleteWidget, getDashboardWidgets, hybridPreviewWidget, listDashboardConfigs, listWidgets, previewWidget, publishDashboardConfig, renameDashboardConfig, saveDashboardDraft, unpublishDashboardConfig, updateWidget as updateWidgetApi } from "../services/dashboardApi";
import { useEscapeKey } from "@/core/hooks/useEscapeKey";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { filterAppNavPagesByAccess, getDefaultPageKeyForApp } from "../utils/appNavPages";
import { buildDashboardRuntimeFilters, canFilterDashboardByUser } from "../utils/dashboardFilterAccess";
import { isConfiguredWidgetQuery } from "../utils/widgetQuery.js";
import { DASHBOARD_DB_SOURCE_OPTIONS, isWidgetHybridMode, resolveHybridExternalDbSource } from "../utils/dashboardDbSources.js";
import { normalizeTableSearchPosition, normalizeTableSearchWidth } from "../utils/tableToolbar.js";
import { isPwaStandalone, getListHotkeyParts } from "@/core/utils/pwa";

const typeToDisplayType = {
  kpi: "kpi",
  count: "kpi",
  sum: "kpi",
  table: "table",
  graph: "bar",
  heading: "heading",
  section: "container",
  container: "container",
  hybrid: "hybrid",
};

const requiresDataQuery = (rawType) => ["kpi", "table", "graph", "count", "sum"].includes(String(rawType));
const resolveApiType = (widget) => {
  const raw = String(widget?.rawType || "").toLowerCase();
  if (raw === "kpi" || raw === "count" || raw === "sum") {
    return widget?.metricType === "sum" || raw === "sum" ? "sum" : "count";
  }
  if (raw === "hybrid") return "table";
  if (raw === "container" || raw === "section") return "section";
  if (raw === "table" || raw === "graph" || raw === "heading") return raw;
  return "table";
};
const isTopLevelCanvasWidget = (widget = {}) => !widget.containerId && !widget.sectionId;

/** Live nested layouts from builder grid (desktop + mobile kept separate). */
const liveContainerNestedLayoutsRef = {
  desktop: new Map(),
  mobile: new Map(),
};

const getLiveNestedMap = (isMobile = false) =>
  (isMobile ? liveContainerNestedLayoutsRef.mobile : liveContainerNestedLayoutsRef.desktop);

const clearLiveNestedMaps = () => {
  liveContainerNestedLayoutsRef.desktop.clear();
  liveContainerNestedLayoutsRef.mobile.clear();
};

const getContainerNestedSource = (container, allWidgets = []) => {
  if (!container) return [];
  const containerId = String(container.id);
  const children = allWidgets.filter(
    (child) => String(child.containerId || child.sectionId) === containerId,
  );
  const liveNested = liveContainerNestedLayoutsRef.desktop.get(containerId);
  const usedLive = Array.isArray(liveNested) && liveNested.length > 0;
  let nested = usedLive
    ? liveNested.map((item) => ({ ...item }))
    : Array.isArray(container.nestedLayout)
      ? [...container.nestedLayout]
      : [];
  children.forEach((child, idx) => {
    const childId = String(child.id);
    const existingIdx = nested.findIndex((item) => String(item.i) === childId);
    const childLayout = child.layout && typeof child.layout === "object" ? child.layout : null;
    if (existingIdx === -1) {
      nested.push(
        normalizeLayoutItem(
          mergeNestedItemFromChild(
            child,
            childLayout || buildInitialNestedLayoutForType(child.rawType, idx, child.id),
          ),
          idx,
          child.id,
        ),
      );
      return;
    }
    // Live builder grid coords are authoritative for publish — do not overwrite with stale child.layout.
    if (usedLive) {
      nested[existingIdx] = normalizeLayoutItem(
        { i: childId, ...nested[existingIdx] },
        existingIdx,
        child.id,
      );
      return;
    }
    const saved = nested[existingIdx];
    nested[existingIdx] = normalizeLayoutItem(
      mergeNestedItemFromChild(child, { i: childId, ...saved }),
      existingIdx,
      child.id,
    );
  });
  return sanitizeNestedLayoutItems(nested);
};

const getContainerNestedMobileSource = (container, allWidgets = [], options = {}) => {
  if (!container) return [];
  const { preferLiveNested = false } = options;
  const containerId = String(container.id);
  const children = allWidgets.filter(
    (child) => String(child.containerId || child.sectionId) === containerId,
  );
  const desktopNested = Array.isArray(container.nestedLayout) && container.nestedLayout.length
    ? sanitizeNestedLayoutItems([...container.nestedLayout])
    : getContainerNestedSource(container, allWidgets);
  const savedMobile = Array.isArray(container.mobileNestedLayout) ? container.mobileNestedLayout : [];
  const liveNested = liveContainerNestedLayoutsRef.mobile.get(containerId);
  const useLive = preferLiveNested && Array.isArray(liveNested) && liveNested.length > 0;
  let nested = useLive
    ? liveNested.map((item) => ({ ...item }))
    : (savedMobile.length
      ? [...savedMobile]
      : stackNestedLayoutForPhone(desktopNested));
  children.forEach((child, idx) => {
    const childId = String(child.id);
    const existingIdx = nested.findIndex((item) => String(item.i) === childId);
    if (existingIdx === -1) {
      nested.push(
        normalizeLayoutItem(
          mergeNestedItemFromChild(
            child,
            child.mobileLayout || buildInitialNestedLayoutForType(child.rawType, idx, child.id),
          ),
          idx,
          child.id,
        ),
      );
      return;
    }
    nested[existingIdx] = normalizeLayoutItem(
      {
        i: childId,
        x: nested[existingIdx].x,
        y: nested[existingIdx].y,
        w: nested[existingIdx].w,
        h: nested[existingIdx].h,
      },
      existingIdx,
      child.id,
    );
  });
  return sanitizeNestedLayoutItems(nested);
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
    titlePosition: "top",
    kpiLabelPosition: "bottom",
  };
  if (rawType === "kpi") {
    return { ...shared, fontSize: 26, kpiLabelFontSize: 10, padding: 6 };
  }
  if (rawType === "heading") {
    return { ...shared, color: "#0f172a", fontSize: 18, padding: 0, bg: "transparent", borderRadius: 0 };
  }
  if (rawType === "container") {
    return { ...shared, bg: "#f1f5f9", color: "#334155", fontSize: 12, padding: 12, borderRadius: 10 };
  }
  if (rawType === "table") {
    return {
      ...shared,
      color: "#475569",
      fontSize: 10,
      padding: 8,
      tableHeaderColor: "#64748b",
      tableHeaderBg: "#f8fafc",
      tableBodyColor: "#475569",
      tableBodyBg: "#ffffff",
      tableBorderColor: "#e2e8f0",
      tableHeaderFontSize: 9,
      tableBodyFontSize: 10,
      tableSearchFontSize: 10,
      tableRowHoverBg: "#f8fafc",
    };
  }
  if (rawType === "graph") {
    return {
      ...shared,
      fontSize: 10,
      padding: 8,
      graphTextSize: 10,
      graphPieRadius: 70,
      graphShowLegend: true,
      graphColors: ["#3b82f6", "#60a5fa", "#34d399", "#f59e0b", "#f43f5e", "#a855f7", "#06b6d4", "#84cc16"],
      graphColorPalette: "ocean",
    };
  }
  if (rawType === "hybrid") {
    return {
      ...shared,
      color: "#475569",
      fontSize: 10,
      padding: 8,
      tableHeaderColor: "#64748b",
      tableHeaderBg: "#f8fafc",
      tableBodyColor: "#475569",
      tableBodyBg: "#ffffff",
      tableBorderColor: "#e2e8f0",
      tableHeaderFontSize: 9,
      tableBodyFontSize: 10,
      tableSearchFontSize: 10,
      tableRowHoverBg: "#f8fafc",
    };
  }
  return { ...shared, fontSize: 10, padding: 8 };
}

function mergeSpacingSide(cfg = {}, defaults = {}, uniformKey) {
  const uniform = cfg[uniformKey] ?? defaults[uniformKey];
  const snake = (side) => `${uniformKey}_${side.toLowerCase()}`;
  const camel = (side) => `${uniformKey}${side}`;
  const read = (side) => cfg[snake(side)] ?? cfg[camel(side)] ?? uniform;
  return {
    [camel("Top")]: read("Top"),
    [camel("Right")]: read("Right"),
    [camel("Bottom")]: read("Bottom"),
    [camel("Left")]: read("Left"),
  };
}

function mergeWidgetStyle(rawType, chartConfig = {}) {
  const defaults = defaultWidgetStyle(rawType);
  const cfg = chartConfig && typeof chartConfig === "object" ? chartConfig : {};
  const merged = {
    ...defaults,
    color: cfg.color ?? defaults.color,
    bg: cfg.bg ?? defaults.bg,
    fontSize: cfg.fontSize ?? defaults.fontSize,
    borderRadius: cfg.borderRadius ?? defaults.borderRadius,
    boxShadow: cfg.boxShadow ?? defaults.boxShadow,
    contentAlign: cfg.contentAlign ?? defaults.contentAlign,
    fontFamily: cfg.fontFamily ?? defaults.fontFamily,
    padding: cfg.padding ?? defaults.padding,
    margin: cfg.margin ?? defaults.margin,
    ...mergeSpacingSide(cfg, defaults, "padding"),
    ...mergeSpacingSide(cfg, defaults, "margin"),
    emptyTextPosition: cfg.emptyTextPosition ?? defaults.emptyTextPosition,
    titlePosition: cfg.titlePosition === "bottom" ? "bottom" : (defaults.titlePosition || "top"),
    kpiLabelPosition: cfg.kpiLabelPosition ?? defaults.kpiLabelPosition,
    kpiLabelFontSize: cfg.kpiLabelFontSize ?? defaults.kpiLabelFontSize,
    layoutWidthPx: Number.isFinite(Number(cfg.layout_width_px ?? cfg.layoutWidthPx))
      ? Math.round(Number(cfg.layout_width_px ?? cfg.layoutWidthPx))
      : undefined,
    layoutHeightPx: Number.isFinite(Number(cfg.layout_height_px ?? cfg.layoutHeightPx))
      ? Math.round(Number(cfg.layout_height_px ?? cfg.layoutHeightPx))
      : undefined,
    nestedGridWidthPx: Number.isFinite(Number(cfg.nested_grid_width_px ?? cfg.nestedGridWidthPx))
      ? Math.round(Number(cfg.nested_grid_width_px ?? cfg.nestedGridWidthPx))
      : undefined,
    boxPx: Number.isFinite(Number(cfg.box_width ?? cfg.boxWidth))
      ? {
        left: Math.max(0, Math.round(Number(cfg.box_left ?? cfg.boxLeft ?? 0))),
        top: Math.max(0, Math.round(Number(cfg.box_top ?? cfg.boxTop ?? 0))),
        width: Math.max(40, Math.round(Number(cfg.box_width ?? cfg.boxWidth))),
        height: Math.max(32, Math.round(Number(cfg.box_height ?? cfg.boxHeight ?? 64))),
      }
      : (cfg.boxPx && Number.isFinite(Number(cfg.boxPx.width))
        ? {
          left: Math.max(0, Math.round(Number(cfg.boxPx.left ?? 0))),
          top: Math.max(0, Math.round(Number(cfg.boxPx.top ?? 0))),
          width: Math.max(40, Math.round(Number(cfg.boxPx.width))),
          height: Math.max(32, Math.round(Number(cfg.boxPx.height ?? 64))),
        }
        : undefined),
    tableHeaderColor: cfg.table_header_color ?? cfg.tableHeaderColor ?? defaults.tableHeaderColor,
    tableHeaderBg: cfg.table_header_bg ?? cfg.tableHeaderBg ?? defaults.tableHeaderBg,
    tableBodyColor: cfg.table_body_color ?? cfg.tableBodyColor ?? defaults.tableBodyColor,
    tableBodyBg: cfg.table_body_bg ?? cfg.tableBodyBg ?? defaults.tableBodyBg,
    tableBorderColor: cfg.table_border_color ?? cfg.tableBorderColor ?? defaults.tableBorderColor,
    tableHeaderFontSize: cfg.table_header_font_size ?? cfg.tableHeaderFontSize ?? defaults.tableHeaderFontSize,
    tableBodyFontSize: cfg.table_body_font_size ?? cfg.tableBodyFontSize ?? defaults.tableBodyFontSize,
    tableSearchFontSize: cfg.table_search_font_size ?? cfg.tableSearchFontSize ?? defaults.tableSearchFontSize,
    tableSearchColor: cfg.table_search_color ?? cfg.tableSearchColor ?? defaults.tableSearchColor,
    tableSearchBg: cfg.table_search_bg ?? cfg.tableSearchBg ?? defaults.tableSearchBg,
    tableRowHoverBg: cfg.table_row_hover_bg ?? cfg.tableRowHoverBg ?? defaults.tableRowHoverBg,
    graphTextSize: cfg.graph_text_size ?? cfg.graphTextSize ?? defaults.graphTextSize,
    graphPieRadius: cfg.graph_pie_radius ?? cfg.graphPieRadius ?? defaults.graphPieRadius,
    graphShowLegend: cfg.graph_show_legend ?? cfg.graphShowLegend ?? defaults.graphShowLegend,
    graphXKey: cfg.graph_x_key ?? cfg.graphXKey ?? defaults.graphXKey,
    graphYKey: cfg.graph_y_key ?? cfg.graphYKey ?? defaults.graphYKey,
    graphColorPalette: cfg.graph_color_palette ?? cfg.graphColorPalette ?? defaults.graphColorPalette,
    graphColors: Array.isArray(cfg.graph_colors || cfg.graphColors)
      ? (cfg.graph_colors || cfg.graphColors)
      : defaults.graphColors,
  };
  if (rawType === "heading" && (!cfg.bg || cfg.bg === "#ffffff" || cfg.bg === "#fff")) {
    merged.bg = "transparent";
    merged.padding = cfg.padding ?? 0;
    merged.borderRadius = 0;
  }
  return merged;
}

function spacingConfigFromWidgetStyle(widget = {}, defaults = {}) {
  const style = widget.style || {};
  const uniformPad = style.padding ?? defaults.padding ?? 8;
  const uniformMar = style.margin ?? defaults.margin ?? 0;
  const read = (kind, side, uniform) => {
    const key = `${kind}${side}`;
    const snake = `${kind}_${side.toLowerCase()}`;
    const val = style[key] ?? style[snake];
    return Number.isFinite(Number(val)) ? Math.max(0, Number(val)) : uniform;
  };
  return {
    padding: uniformPad,
    margin: uniformMar,
    padding_top: read("padding", "Top", uniformPad),
    padding_right: read("padding", "Right", uniformPad),
    padding_bottom: read("padding", "Bottom", uniformPad),
    padding_left: read("padding", "Left", uniformPad),
    margin_top: read("margin", "Top", uniformMar),
    margin_right: read("margin", "Right", uniformMar),
    margin_bottom: read("margin", "Bottom", uniformMar),
    margin_left: read("margin", "Left", uniformMar),
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
    boxShadow: widget.style?.boxShadow,
    fontFamily: widget.style?.fontFamily || "inherit",
    ...spacingConfigFromWidgetStyle(widget, defaults),
    erp_filter: widget.erpFilter && typeof widget.erpFilter === "object" ? widget.erpFilter : {},
    link_type: widget.linkType || "NONE",
    link_url: widget.linkUrl || "",
    link_app_id: widget.linkAppId || "",
    link_page_id: widget.linkPageId || "",
    section_id: widget.containerId || widget.sectionId || null,
    container_preset: widget.containerPreset || "full",
    layout_locked: widget.layoutLocked === true || hasManualWidgetLayout(widget),
    nested_layout: sanitizeNestedLayoutItems(widget.nestedLayout || []),
    nested_layout_px: sanitizeNestedLayoutPx(widget.nestedLayoutPx || []),
    mobile_nested_layout: sanitizeNestedLayoutItems(widget.mobileNestedLayout || []),
    mobile_nested_layout_px: sanitizeNestedLayoutPx(widget.mobileNestedLayoutPx || []),
    mobile_padding_left: widget.mobilePaddingLeft ?? widget.style?.mobilePaddingLeft ?? 8,
    mobile_padding_right: widget.mobilePaddingRight ?? widget.style?.mobilePaddingRight ?? 8,
    mobile_padding_top: widget.mobilePaddingTop ?? widget.style?.mobilePaddingTop ?? 8,
    mobile_padding_bottom: widget.mobilePaddingBottom ?? widget.style?.mobilePaddingBottom ?? 8,
    contentAlign: widget.style?.contentAlign || "center",
    emptyTextPosition: widget.style?.emptyTextPosition || "center",
    titlePosition: widget.style?.titlePosition === "bottom" ? "bottom" : "top",
    kpiLabelPosition: widget.style?.kpiLabelPosition || "bottom",
    kpiLabelFontSize: widget.style?.kpiLabelFontSize ?? defaults.kpiLabelFontSize,
    layout_width_px: Number.isFinite(Number(widget.style?.layoutWidthPx))
      ? Math.round(Number(widget.style.layoutWidthPx))
      : undefined,
    layout_height_px: Number.isFinite(Number(widget.style?.layoutHeightPx))
      ? Math.round(Number(widget.style.layoutHeightPx))
      : undefined,
    nested_grid_width_px: Number.isFinite(Number(widget.style?.nestedGridWidthPx))
      ? Math.round(Number(widget.style.nestedGridWidthPx))
      : undefined,
    box_left: Number.isFinite(Number(widget.style?.boxPx?.left)) ? Math.round(Number(widget.style.boxPx.left)) : undefined,
    box_top: Number.isFinite(Number(widget.style?.boxPx?.top)) ? Math.round(Number(widget.style.boxPx.top)) : undefined,
    box_width: Number.isFinite(Number(widget.style?.boxPx?.width)) ? Math.round(Number(widget.style.boxPx.width)) : undefined,
    box_height: Number.isFinite(Number(widget.style?.boxPx?.height)) ? Math.round(Number(widget.style.boxPx.height)) : undefined,
    emptyText: widget.emptyText || "Click edit and add query",
    table_search_enabled: widget.tableSearchEnabled === true,
    table_search_placeholder: String(widget.tableSearchPlaceholder || "").trim(),
    table_search_position: normalizeTableSearchPosition(widget.tableSearchPosition),
    table_search_width: normalizeTableSearchWidth(widget.tableSearchWidth),
    table_column_sort_enabled: widget.tableColumnSortEnabled === true,
    table_export_enabled: widget.tableExportEnabled === true,
    table_header_color: widget.style?.tableHeaderColor,
    table_header_bg: widget.style?.tableHeaderBg,
    table_body_color: widget.style?.tableBodyColor,
    table_body_bg: widget.style?.tableBodyBg,
    table_border_color: widget.style?.tableBorderColor,
    table_header_font_size: widget.style?.tableHeaderFontSize,
    table_body_font_size: widget.style?.tableBodyFontSize,
    table_search_font_size: widget.style?.tableSearchFontSize,
    table_search_color: widget.style?.tableSearchColor,
    table_search_bg: widget.style?.tableSearchBg,
    table_row_hover_bg: widget.style?.tableRowHoverBg,
    graph_text_size: widget.style?.graphTextSize,
    graph_pie_radius: widget.style?.graphPieRadius,
    graph_show_legend: widget.style?.graphShowLegend !== false,
    graph_x_key: widget.style?.graphXKey || undefined,
    graph_y_key: widget.style?.graphYKey || undefined,
    graph_color_palette: widget.style?.graphColorPalette || undefined,
    graph_colors: Array.isArray(widget.style?.graphColors) ? widget.style.graphColors : undefined,
    is_hybrid: isWidgetHybridMode(widget),
    hybrid_mssql_query: widget.chart_config?.hybrid_mssql_query || "",
    hybrid_external_source: resolveHybridExternalDbSource(widget),
    data_source: isWidgetHybridMode(widget) ? "hybrid" : (widget.dataSource || "ims_postgresql"),
  };
}
const BUILDER_WIDGET_TYPES = ["kpi", "table", "graph", "heading", "container"];
const USE_FLOATING_BUILDER = true;

const widgetStripLabel = (widget, idx) => {
  const custom = String(widget.title || "").trim();
  if (custom) return custom;
  const typeLabel = {
    container: "Container",
    kpi: "KPI",
    table: "Table",
    graph: "Graph",
    heading: "Heading",
    hybrid: "Hybrid",
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

const compactLayoutForStorage = (rawLayout = {}, widgetId = "") => ({
  i: String(widgetId || rawLayout.i || ""),
  x: Number.isFinite(Number(rawLayout.x)) ? Number(rawLayout.x) : 0,
  y: Number.isFinite(Number(rawLayout.y)) ? Number(rawLayout.y) : 0,
  w: Math.max(1, Number.isFinite(Number(rawLayout.w)) ? Number(rawLayout.w) : 1),
  h: Math.max(1, Number.isFinite(Number(rawLayout.h)) ? Number(rawLayout.h) : 1),
});

const normalizeWidgetForDashboardJson = (widget = {}, resolvedLayout = {}, { persistManualLayout = false, persistNestedPixelLayout = false, lockNestedLayout = false } = {}) => {
  const rawStyle = widget.style && typeof widget.style === "object" ? widget.style : {};
  // Never persist layoutWidthPx — it is canvas-width dependent and corrupts grid `w` on reload.
  const { layoutWidthPx: _dropWidthPx, layoutHeightPx, ...portableStyle } = rawStyle;
  let style = portableStyle;
  if (persistManualLayout || persistNestedPixelLayout) {
    style = { ...portableStyle };
    if (layoutHeightPx != null) style.layoutHeightPx = layoutHeightPx;
    if (rawStyle.boxPx && typeof rawStyle.boxPx === "object") {
      style.boxPx = { ...rawStyle.boxPx };
    }
  }

  return {
    id: widget.id,
    rawType: widget.rawType || "table",
    type: widget.type || "table",
    title: widget.title || "",
    description: widget.description || "",
    query: widget.query || "",
    dataSource: widget.dataSource || "ims_postgresql",
    erpFilter: widget.erpFilter && typeof widget.erpFilter === "object" ? widget.erpFilter : {},
    emptyText: widget.emptyText || "Click edit and add query",
    tableSearchEnabled: widget.tableSearchEnabled === true,
    tableSearchPlaceholder: String(widget.tableSearchPlaceholder || "").trim(),
    tableSearchPosition: normalizeTableSearchPosition(widget.tableSearchPosition),
    tableSearchWidth: normalizeTableSearchWidth(widget.tableSearchWidth),
    tableColumnSortEnabled: widget.tableColumnSortEnabled === true,
    tableExportEnabled: widget.tableExportEnabled === true,
    sectionId: widget.containerId || widget.sectionId || null,
    containerId: widget.containerId || widget.sectionId || null,
    containerPreset: resolveContainerPreset(widget, resolvedLayout),
    layoutLocked: lockNestedLayout || (persistManualLayout && widget.layoutLocked === true),
    nestedLayout: Array.isArray(widget.nestedLayout) ? widget.nestedLayout : [],
    nestedLayoutPx: Array.isArray(widget.nestedLayoutPx) ? widget.nestedLayoutPx : [],
    mobileNestedLayout: Array.isArray(widget.mobileNestedLayout) ? widget.mobileNestedLayout : [],
    mobileNestedLayoutPx: Array.isArray(widget.mobileNestedLayoutPx) ? widget.mobileNestedLayoutPx : [],
    mobilePaddingLeft: widget.mobilePaddingLeft ?? 8,
    mobilePaddingRight: widget.mobilePaddingRight ?? 8,
    mobilePaddingTop: widget.mobilePaddingTop ?? 8,
    mobilePaddingBottom: widget.mobilePaddingBottom ?? 8,
    style,
    layout: compactLayoutForStorage(resolvedLayout, widget.id),
    mobileLayout: compactLayoutForStorage(
      widget.mobileLayout || resolvedLayout,
      widget.id,
    ),
    deviceTarget: normalizeWidgetDeviceTarget(widget.deviceTarget),
    isActive: widget.is_active !== false,
    targetPageKey: widget.targetPageKey || "dashboard",
    targetPageModule: widget.targetPageModule || null,
    linkType: widget.linkType || "NONE",
    linkUrl: widget.linkUrl || "",
    linkAppId: widget.linkAppId || "",
    linkPageId: widget.linkPageId || "",
    // Required for Hybrid publish/runtime — without this, hybrid_mssql_query is lost
    // and live load runs plain PG against {{temp_erp_data}} (query error).
    chart_config: chartConfigFromWidgetStyle(widget),
  };
};
const GRID_COLS = 12;
const BUILDER_GRID_COLS = 24;
const BUILDER_COL_SCALE = BUILDER_GRID_COLS / GRID_COLS;
const GRID_ROW_HEIGHT = 64;
const GRID_GAP_X = 12;
const GRID_GAP_Y = 12;
const BUILDER_PANEL_WIDTH = 300;
const BUILDER_SELECT_CLASS =
  "h-7 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 outline-none focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15 transition-shadow";

const scaleLayoutCoordsToBuilder = (items = []) => items.map((item) => ({
  ...item,
  x: Math.max(0, Math.round((Number(item.x) || 0) * BUILDER_COL_SCALE)),
  w: Math.max(1, Math.round((Number(item.w) || 1) * BUILDER_COL_SCALE)),
}));

const scaleLayoutCoordsToStorage = (items = []) => items.map((item) => ({
  ...item,
  x: Math.max(0, Math.round((Number(item.x) || 0) / BUILDER_COL_SCALE)),
  w: Math.max(1, Math.round((Number(item.w) || 1) / BUILDER_COL_SCALE)),
}));

const activeDesktopGridCols = (isPhoneBuilderMode) => (isPhoneBuilderMode ? GRID_COLS : BUILDER_GRID_COLS);
const HISTORY_LIMIT = 50;
const BUILDER_DEVICE_DESKTOP = "desktop";
const BUILDER_DEVICE_MOBILE = "mobile";
/** Phone layout math uses content box (inside bezel). Outer chrome stays PHONE_OUTER_WIDTH (390). */
const PHONE_BUILDER_WIDTH = PHONE_CONTENT_WIDTH;

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
    const fromWidgets = widgetIds
      .map((id) => widgets.find((entry) => String(entry.id) === id))
      .filter(Boolean)
      .map((widget, idx) => {
        if (!widget.mobileLayout || !Object.keys(widget.mobileLayout).length) return null;
        return normalizeLayoutItem({ ...widget.mobileLayout, i: String(widget.id) }, idx, widget.id);
      })
      .filter(Boolean);
    if (fromWidgets.length && hasCustomPhoneLayout(widgets, desktopLayout, fromWidgets)) {
      return mergeMobileLayoutFromDesktop(widgets, desktopLayout, fromWidgets);
    }
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

function fingerprintStyleForCompare(style = {}) {
  if (!style || typeof style !== "object") return {};
  const {
    layoutWidthPx: _layoutWidthPx,
    layoutHeightPx: _layoutHeightPx,
    nestedGridWidthPx: _nestedGridWidthPx,
    ...portable
  } = style;
  return portable;
}

function resolveMobileLayoutForFingerprint(widget = {}, layout = [], mobileLayout = [], desktopLayoutItem = {}) {
  const fromArray = mobileLayout.find((item) => String(item.i) === String(widget.id));
  if (fromArray) {
    return {
      x: Number(fromArray.x) || 0,
      y: Number(fromArray.y) || 0,
      w: Number(fromArray.w) || 1,
      h: Number(fromArray.h) || 1,
    };
  }
  const isTopLevel = !widget.containerId && !widget.sectionId;
  if (isTopLevel && !mobileLayout.length) {
    return {
      x: Number(desktopLayoutItem.x) || 0,
      y: Number(desktopLayoutItem.y) || 0,
      w: Number(desktopLayoutItem.w) || 1,
      h: Number(desktopLayoutItem.h) || 1,
    };
  }
  const fromWidget = widget.mobileLayout && typeof widget.mobileLayout === "object"
    ? widget.mobileLayout
    : null;
  if (fromWidget && Object.keys(fromWidget).length) {
    return {
      x: Number(fromWidget.x) || 0,
      y: Number(fromWidget.y) || 0,
      w: Number(fromWidget.w) || 1,
      h: Number(fromWidget.h) || 1,
    };
  }
  return {
    x: Number(desktopLayoutItem.x) || 0,
    y: Number(desktopLayoutItem.y) || 0,
    w: Number(desktopLayoutItem.w) || 1,
    h: Number(desktopLayoutItem.h) || 1,
  };
}

function buildStateFingerprint(widgets = [], layout = [], mobileLayout = []) {
  const normalized = widgets.map((widget) => {
    const matchedLayout = layout.find((item) => String(item.i) === String(widget.id)) || widget.layout || {};
    const desktopLayoutItem = {
      x: Number(matchedLayout.x) || 0,
      y: Number(matchedLayout.y) || 0,
      w: Number(matchedLayout.w) || 1,
      h: Number(matchedLayout.h) || 1,
    };
    const matchedMobileLayout = resolveMobileLayoutForFingerprint(
      widget,
      layout,
      mobileLayout,
      desktopLayoutItem,
    );
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
      linkType: String(widget.linkType || "NONE"),
      linkUrl: String(widget.linkUrl || ""),
      linkAppId: String(widget.linkAppId || ""),
      linkPageId: String(widget.linkPageId || ""),
      deviceTarget: normalizeWidgetDeviceTarget(widget.deviceTarget),
      emptyText: String(widget.emptyText || ""),
      tableSearchEnabled: widget.tableSearchEnabled === true,
      tableSearchPlaceholder: String(widget.tableSearchPlaceholder || "").trim(),
      tableSearchPosition: normalizeTableSearchPosition(widget.tableSearchPosition),
      tableSearchWidth: normalizeTableSearchWidth(widget.tableSearchWidth),
      tableColumnSortEnabled: widget.tableColumnSortEnabled === true,
      tableExportEnabled: widget.tableExportEnabled === true,
      style: fingerprintStyleForCompare(widget.style || {}),
      erpFilter: widget.erpFilter || {},
      layout: desktopLayoutItem,
      mobileLayout: matchedMobileLayout,
    };
  });
  return JSON.stringify(normalized);
}

function cloneBuilderSnapshot(
  widgetsState = [],
  layoutState = [],
  mobileLayoutState = [],
  layoutPxState = [],
  layoutPxMobileState = [],
) {
  // Strip heavy runtime data so style edits (colors) don't freeze the UI while cloning history.
  const widgets = JSON.parse(JSON.stringify(widgetsState, (key, value) => {
    if (key === "data" || key === "previewData" || key === "error" || key === "previewError") return undefined;
    return value;
  }));
  const layout = JSON.parse(JSON.stringify(layoutState));
  const mobileLayout = JSON.parse(JSON.stringify(mobileLayoutState));
  const layoutPxSnap = JSON.parse(JSON.stringify(layoutPxState || []));
  const layoutPxMobileSnap = JSON.parse(JSON.stringify(layoutPxMobileState || []));
  return {
    widgets,
    layout,
    mobileLayout,
    layoutPx: layoutPxSnap,
    layoutPxMobile: layoutPxMobileSnap,
    fingerprint: `${buildStateFingerprint(widgets, layout, mobileLayout)}|px:${layoutPxFingerprint(layoutPxSnap)}|mpx:${layoutPxFingerprint(layoutPxMobileSnap)}`,
  };
}

/** Reattach preview/live rows after undo/redo (history strips them to stay light). */
function mergeRuntimeWidgetData(snapshotWidgets = [], liveWidgets = [], runtimeCache = null) {
  const liveById = new Map((liveWidgets || []).map((widget) => [String(widget.id), widget]));
  return (snapshotWidgets || []).map((widget) => {
    const id = String(widget.id);
    const live = liveById.get(id);
    const cached = runtimeCache instanceof Map ? runtimeCache.get(id) : null;
    if (!live && !cached) return widget;
    const next = { ...widget };
    const pick = (key) => {
      if (live && live[key] !== undefined) return live[key];
      if (cached && cached[key] !== undefined) return cached[key];
      return undefined;
    };
    const data = pick("data");
    const previewData = pick("previewData");
    const error = pick("error");
    const previewError = pick("previewError");
    if (data !== undefined) next.data = data;
    if (previewData !== undefined) next.previewData = previewData;
    if (error !== undefined) next.error = error;
    if (previewError !== undefined) next.previewError = previewError;
    return next;
  });
}

function findCloneLayoutSlot(layout = [], sourceLayout = {}, cols = NESTED_GRID_COLS) {
  const width = Math.max(1, Number(sourceLayout.w) || 3);
  const height = Math.max(1, Number(sourceLayout.h) || 2);
  let candidateY = Math.max(0, Number(sourceLayout.y) || 0);
  let candidateX = Math.min(cols - width, (Number(sourceLayout.x) || 0) + width);

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (candidateX + width > cols) {
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
        || candidateY >= iy + ih
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
  if (rawType === "hybrid") {
    return normalizeLayoutItem({ ...base, w: 12, h: 4 }, idx, id);
  }
  if (rawType === "container") {
    const containerLayout = normalizeContainerLayoutItem(
      { containerPreset },
      { w: containerPreset === "half" ? BUILDER_GRID_COLS / 2 : BUILDER_GRID_COLS },
      BUILDER_GRID_COLS,
    );
    return normalizeLayoutItem({ ...base, x: containerLayout.x, w: containerLayout.w, h: 3 }, idx, id);
  }
  return base;
};

const buildInitialNestedLayoutForType = (rawType, idx, id) => {
  const base = normalizeLayoutItem({}, idx, id);
  if (rawType === "kpi") return normalizeLayoutItem({ ...base, w: 3, h: 2 }, idx, id);
  if (rawType === "table") return normalizeLayoutItem({ ...base, w: 12, h: 2 }, idx, id);
  if (rawType === "graph") return normalizeLayoutItem({ ...base, w: 12, h: 2 }, idx, id);
  if (rawType === "heading") return normalizeLayoutItem({ ...base, w: 12, h: 1 }, idx, id);
  if (rawType === "hybrid") return normalizeLayoutItem({ ...base, w: 12, h: 2 }, idx, id);
  return normalizeLayoutItem({ ...base, w: 6, h: 2 }, idx, id);
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
  const liveGridMeasure = useContainerWidth({ initialWidth: 0 });
  const cloneButtonRef = useRef(null);
  const savedFingerprintRef = useRef("");
  const pendingActionRef = useRef(null);
  const widgetsRef = useRef([]);
  /** Keeps preview/data by id across delete so undo can restore numbers. */
  const widgetRuntimeDataRef = useRef(new Map());
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
  const [propertyPanelDock, setPropertyPanelDock] = useState("float");

  const [widgets, setWidgets] = useState([]);
  const [layout, setLayout] = useState([]);
  const [layoutPx, setLayoutPx] = useState([]);
  const [layoutPxMobile, setLayoutPxMobile] = useState([]);
  const [mobileLayout, setMobileLayout] = useState([]);
  const [builderDeviceMode, setBuilderDeviceMode] = useState(BUILDER_DEVICE_DESKTOP);
  const [containerWidth, setContainerWidth] = useState(0);
  const layoutRef = useRef([]);
  const layoutPxRef = useRef([]);
  const layoutPxMobileRef = useRef([]);
  const phoneLayoutCustomizedRef = useRef(false);
  const designCanvasWidthRef = useRef(null);
  const [designCanvasWidth, setDesignCanvasWidth] = useState(null);
  const mobileLayoutRef = useRef([]);
  const layoutBlueprintRef = useRef({ desktop: [], mobile: [] });
  /** Full published layout_px (incl. permission-hidden widgets) for live gap packing. */
  const layoutPxBlueprintRef = useRef({ desktop: [], mobile: [] });
  const manualSizedWidgetIdsRef = useRef(new Set());
  const [isPhoneView, setIsPhoneView] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });
  const isPhoneBuilderMode = !readOnly && builderDeviceMode === BUILDER_DEVICE_MOBILE;
  const isPhonePreviewFrame = isPhoneBuilderMode;
  const isPhoneLayoutView = isPhonePreviewFrame;
  const isPhoneLayoutMode = isPhoneBuilderMode || isPhoneView;
  const [selectedDashboardKey, setSelectedDashboardKey] = useState("default");
  const [targetAppKey, setTargetAppKey] = useState(String(appKey || "ims").toLowerCase());
  const [selectedWidgetId, setSelectedWidgetId] = useState(null);
  const [panelWidgetSnapshot, setPanelWidgetSnapshot] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [userOptions, setUserOptions] = useState([]);
  const [dashboardOptions, setDashboardOptions] = useState([
    { value: "default", label: "Default", scope: "global", targetUserIds: [], defaultForUserIds: [] },
  ]);
  const [cloneName, setCloneName] = useState("");
  const [showClonePanel, setShowClonePanel] = useState(false);
  const [showAddWidgetMenu, setShowAddWidgetMenu] = useState(false);
  const [showWidgetsStrip, setShowWidgetsStrip] = useState(false);
  const [widgetsSearchQuery, setWidgetsSearchQuery] = useState("");
  const [selectedAudienceUserIds, setSelectedAudienceUserIds] = useState([]);
  const [cloneAudienceUserIds, setCloneAudienceUserIds] = useState([]);
  const [cloneAsDefaultForUsers, setCloneAsDefaultForUsers] = useState(false);
  const [dashboardEditName, setDashboardEditName] = useState("");
  const [defaultForAssignedUsers, setDefaultForAssignedUsers] = useState([]);
  const filters = useMemo(() => {
    const today = dayjs().format("YYYY-MM-DD");
    return buildDashboardRuntimeFilters({ searchParams, canFilterByUser, today });
  }, [searchParams, canFilterByUser]);
  const runtimeDashboardKey = useMemo(() => {
    if (!readOnly) return selectedDashboardKey;
    const fromUrl = String(searchParams?.get("df_dash") || "").trim().toLowerCase();
    return fromUrl || "default";
  }, [readOnly, selectedDashboardKey, searchParams]);

  const filteredWidgetsList = useMemo(() => {
    if (!widgetsSearchQuery) return widgets;
    const query = widgetsSearchQuery.toLowerCase().trim();
    return widgets.filter(w => 
      String(w.title || "").toLowerCase().includes(query) ||
      String(w.rawType || "").toLowerCase().includes(query) ||
      String(w.query || "").toLowerCase().includes(query) ||
      String(w.id || "").toLowerCase().includes(query)
    );
  }, [widgets, widgetsSearchQuery]);

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
  useEscapeKey(() => setSelectedWidgetId(null), !readOnly && Boolean(selectedWidgetId) && !showClonePanel && !showAddWidgetMenu);
  useEscapeKey(() => setShowClonePanel(false), !readOnly && showClonePanel);
  useEscapeKey(() => setShowAddWidgetMenu(false), !readOnly && showAddWidgetMenu);

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
    (widgets || []).forEach((widget) => {
      if (!widget?.id) return;
      const id = String(widget.id);
      const prev = widgetRuntimeDataRef.current.get(id) || {};
      const next = { ...prev };
      let changed = false;
      if (widget.data !== undefined) {
        next.data = widget.data;
        changed = true;
      }
      if (widget.previewData !== undefined) {
        next.previewData = widget.previewData;
        changed = true;
      }
      if (widget.error !== undefined) {
        next.error = widget.error;
        changed = true;
      }
      if (widget.previewError !== undefined) {
        next.previewError = widget.previewError;
        changed = true;
      }
      if (changed) widgetRuntimeDataRef.current.set(id, next);
    });
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

  const captureHistorySnapshot = useCallback(() => cloneBuilderSnapshot(
    widgetsRef.current,
    layoutRef.current?.length ? layoutRef.current : layout,
    mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout,
    layoutPxRef.current?.length ? layoutPxRef.current : layoutPx,
    layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile,
  ), [layout, mobileLayout, layoutPx, layoutPxMobile]);

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
    // History omits preview/data — reattach from live widgets or runtime cache (survives delete).
    const restoredWidgets = mergeRuntimeWidgetData(
      snapshot.widgets || [],
      widgetsRef.current,
      widgetRuntimeDataRef.current,
    );
    widgetsRef.current = restoredWidgets;
    setWidgets(restoredWidgets);
    setLayout(nextLayout);
    setMobileLayout(nextMobileLayout);
    if (USE_FLOATING_BUILDER) {
      const nextLayoutPx = sanitizeNestedLayoutPx(snapshot.layoutPx || []);
      const nextLayoutPxMobile = sanitizeNestedLayoutPx(snapshot.layoutPxMobile || []);
      if (nextLayoutPx.length) {
        layoutPxRef.current = nextLayoutPx;
        setLayoutPx(nextLayoutPx);
      } else {
        const snapshotWidgets = snapshot.widgets || [];
        const topLevel = snapshotWidgets.filter((widget) => isTopLevelCanvasWidget(widget));
        const fromBoxPx = topLevel
          .map((widget) => {
            const box = widget.style?.boxPx;
            if (!box || !Number.isFinite(Number(box.width))) return null;
            return { i: String(widget.id), ...normalizeBox(box) };
          })
          .filter(Boolean);
        const rebuilt = fromBoxPx.length
          ? sanitizeNestedLayoutPx(fromBoxPx)
          : boxesFromTopLevelWidgets(topLevel, [], nextLayout, {
            colWidth: 80,
            rowHeight: GRID_ROW_HEIGHT,
            gapX: GRID_GAP_X,
            gapY: GRID_GAP_Y,
          });
        layoutPxRef.current = rebuilt;
        setLayoutPx(rebuilt);
      }
      layoutPxMobileRef.current = nextLayoutPxMobile;
      setLayoutPxMobile(nextLayoutPxMobile);
    }
    setSelectedWidgetId((prev) => {
      if (!prev) return null;
      return restoredWidgets.some((w) => String(w.id) === String(prev)) ? prev : null;
    });
    window.setTimeout(() => {
      historyApplyingRef.current = false;
    }, 0);
  }, []);

  const captureHistoryBeforeChange = useCallback(() => {
    if (readOnly || busy || historyApplyingRef.current) return;
    const snapshot = captureHistorySnapshot();
    const past = historyPastRef.current;
    if (past.length && past[past.length - 1].fingerprint === snapshot.fingerprint) return;
    historyPastRef.current = [...past.slice(-(HISTORY_LIMIT - 1)), snapshot];
    historyFutureRef.current = [];
    refreshHistoryFlags();
  }, [readOnly, busy, captureHistorySnapshot, refreshHistoryFlags]);

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
    const current = captureHistorySnapshot();
    const previous = past[past.length - 1];
    historyPastRef.current = past.slice(0, -1);
    historyFutureRef.current = [current, ...historyFutureRef.current].slice(0, HISTORY_LIMIT);
    applyHistorySnapshot(previous);
    refreshHistoryFlags();
  }, [readOnly, busy, captureHistorySnapshot, applyHistorySnapshot, refreshHistoryFlags]);

  const handleRedo = useCallback(() => {
    if (readOnly || busy || historyApplyingRef.current) return;
    const future = historyFutureRef.current;
    if (!future.length) return;
    const current = captureHistorySnapshot();
    const next = future[0];
    historyFutureRef.current = future.slice(1);
    historyPastRef.current = [...historyPastRef.current, current].slice(-HISTORY_LIMIT);
    applyHistorySnapshot(next);
    refreshHistoryFlags();
  }, [readOnly, busy, captureHistorySnapshot, applyHistorySnapshot, refreshHistoryFlags]);

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

  useEffect(() => {
    if (readOnly) return undefined;
    const clearDragHack = () => {
      try {
        document.body?.classList?.remove?.("react-draggable-transparent-selection");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("blur", clearDragHack);
    return () => {
      window.removeEventListener("blur", clearDragHack);
    };
  }, [readOnly]);

  // Save / Publish hotkeys — handlers assigned later via ref (must stay above early returns).
  const builderSavePublishHotkeysRef = useRef({ save: null, publish: null });

  useEffect(() => {
    if (readOnly) return undefined;
    const onKeyDown = (event) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || event.shiftKey) return;
      const key = String(event.key || "").toLowerCase();
      const isPwa = isPwaStandalone();

      // Ctrl/Cmd+S → Save Draft (works even while typing in builder fields)
      if (key === "s" && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        builderSavePublishHotkeysRef.current.save?.();
        return;
      }

      // Publish: Ctrl+Alt+U (browser) / Ctrl+U (PWA)
      if (key === "u") {
        const allow = event.altKey || (!event.altKey && isPwa);
        if (!allow) return;
        const tag = String(event.target?.tagName || "").toUpperCase();
        const isEditable =
          tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(event.target?.isContentEditable);
        if (isEditable) return;
        event.preventDefault();
        event.stopPropagation();
        builderSavePublishHotkeysRef.current.publish?.();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [readOnly]);

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
      // Window resize can briefly report 0 — keep last good width so the canvas never blanks.
      if (measured < 200) return;
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
    if (busy) return undefined;
    const node = canvasContainerRef.current;
    if (!node) return undefined;
    const measure = () => {
      const width = Math.max(0, Math.floor(node.getBoundingClientRect?.().width || node.clientWidth || 0));
      if (width >= 200) {
        setContainerWidth((prev) => (Math.abs(prev - width) <= 1 ? prev : width));
      }
      liveGridMeasure.measureWidth();
    };
    measure();
    const raf = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(raf);
  }, [readOnly, isPhoneView, busy, widgets.length, liveGridMeasure.measureWidth]);

  useLayoutEffect(() => {
    if (!readOnly || typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsPhoneView(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [readOnly]);

  const mapWidgetRow = (row, idx) => {
    const chartConfig = row?.chart_config && typeof row.chart_config === "object" ? row.chart_config : {};
    const hybridMode = chartConfig.is_hybrid === true || row.type === "hybrid";
    const rawType =
      row.type === "section"
        ? "container"
        : row.type === "count" || row.type === "sum"
          ? "kpi"
          : row.type === "hybrid"
            ? "table"
            : row.type;
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
      ...(row.has_query !== undefined ? { has_query: row.has_query } : {}),
      ...(Array.isArray(row.data) ? { data: row.data } : {}),
      ...(row.error != null ? { error: row.error } : {}),
      erpFilter: row?.chart_config?.erp_filter || {},
      previewData: null,
      previewError: null,
      style: mergeWidgetStyle(rawType, row?.chart_config),
      emptyText: row?.chart_config?.emptyText || "Click edit and add query",
      tableSearchEnabled: chartConfig.table_search_enabled === true,
      tableSearchPlaceholder: String(chartConfig.table_search_placeholder || "").trim(),
      tableSearchPosition: normalizeTableSearchPosition(chartConfig.table_search_position),
      tableSearchWidth: normalizeTableSearchWidth(chartConfig.table_search_width),
      tableColumnSortEnabled: chartConfig.table_column_sort_enabled === true,
      tableExportEnabled: chartConfig.table_export_enabled === true,
      dataSource: hybridMode ? "hybrid" : (chartConfig.data_source || "ims_postgresql"),
      chart_config: {
        ...chartConfig,
        is_hybrid: hybridMode,
        hybrid_external_source: chartConfig.hybrid_external_source
          || (String(chartConfig.data_source || "").toLowerCase() === "erp_mssql" ? "erp_mssql"
            : String(chartConfig.data_source || "").toLowerCase() === "hrms_mssql" ? "hrms_mssql"
              : "erp_mssql"),
      },
      audienceScope: row?.audience_scope || "global",
      targetUserIds: Array.isArray(row?.target_user_ids) ? row.target_user_ids : [],
      sectionId: chartConfig.section_id ?? row.sectionId ?? row.containerId ?? null,
      containerId: chartConfig.section_id ?? row.containerId ?? row.sectionId ?? null,
      containerPreset: resolveContainerPreset(
        { containerPreset: chartConfig.container_preset ?? row.containerPreset },
        row.layout && typeof row.layout === "object" ? row.layout : {},
      ),
      layoutLocked: chartConfig.layout_locked === true || row.layoutLocked === true,
      nestedLayout: Array.isArray(chartConfig.nested_layout)
        ? chartConfig.nested_layout
        : (Array.isArray(row.nestedLayout) ? row.nestedLayout : []),
      nestedLayoutPx: Array.isArray(chartConfig.nested_layout_px) && chartConfig.nested_layout_px.length
        ? chartConfig.nested_layout_px
        : (Array.isArray(row.nestedLayoutPx) ? row.nestedLayoutPx : []),
      mobileNestedLayout: Array.isArray(chartConfig.mobile_nested_layout)
        ? chartConfig.mobile_nested_layout
        : (Array.isArray(row.mobileNestedLayout) ? row.mobileNestedLayout : []),
      mobileNestedLayoutPx: Array.isArray(chartConfig.mobile_nested_layout_px) && chartConfig.mobile_nested_layout_px.length
        ? chartConfig.mobile_nested_layout_px
        : (Array.isArray(row.mobileNestedLayoutPx) ? row.mobileNestedLayoutPx : []),
      mobilePaddingLeft: chartConfig.mobile_padding_left ?? 8,
      mobilePaddingRight: chartConfig.mobile_padding_right ?? 8,
      mobilePaddingTop: chartConfig.mobile_padding_top ?? 8,
      mobilePaddingBottom: chartConfig.mobile_padding_bottom ?? 8,
      targetPageKey: row?.target_page_key || row?.targetPageKey || "dashboard",
      targetPageModule: row?.target_page_module || row?.targetPageModule || null,
      linkType: String(chartConfig.link_type || row?.linkType || "NONE").toUpperCase() === "APP"
        ? "APP"
        : String(chartConfig.link_type || row?.linkType || "NONE").toUpperCase() === "URL"
          ? "URL"
          : "NONE",
      linkUrl: String(chartConfig.link_url || row?.linkUrl || "").trim(),
      linkAppId: String(chartConfig.link_app_id || row?.linkAppId || "").trim(),
      linkPageId: String(chartConfig.link_page_id || row?.linkPageId || "").trim(),
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
      if (readOnly) {
        layoutBlueprintRef.current = {
          desktop: Array.isArray(res?.layout_blueprint?.desktop) ? res.layout_blueprint.desktop : [],
          mobile: Array.isArray(res?.layout_blueprint?.mobile) ? res.layout_blueprint.mobile : [],
        };
        layoutPxBlueprintRef.current = {
          desktop: sanitizeNestedLayoutPx(Array.isArray(res?.layout_px) ? res.layout_px : []),
          mobile: sanitizeNestedLayoutPx(Array.isArray(res?.layout_px_mobile) ? res.layout_px_mobile : []),
        };
      } else {
        layoutBlueprintRef.current = { desktop: [], mobile: [] };
        layoutPxBlueprintRef.current = { desktop: [], mobile: [] };
      }
      const loadedCanvasWidth = Number(res?.canvas_width);
      const nextDesignWidth = Number.isFinite(loadedCanvasWidth) && loadedCanvasWidth >= 200
        ? Math.round(loadedCanvasWidth)
        : null;
      designCanvasWidthRef.current = nextDesignWidth;
      setDesignCanvasWidth(nextDesignWidth);
      let mapped = rows.map((row, idx) => mapWidgetRow(row, idx));

      // Builder should reopen with live data, not blank "No Data Found" cards.
      if (!readOnly) {
        const previewResults = await Promise.all(
          mapped.map(async (widget) => {
            if (!requiresDataQuery(widget.rawType) || !isConfiguredWidgetQuery(widget.query)) {
              return { id: String(widget.id), data: null, error: null };
            }
            try {
              let response;
              if (isWidgetHybridMode(widget)) {
                response = await hybridPreviewWidget({
                  mssql_query: widget.chart_config?.hybrid_mssql_query || "",
                  pg_query: widget.query || "",
                  db_source: resolveHybridExternalDbSource(widget),
                  filters,
                });
              } else {
                response = await previewWidget(widget.query, {
                  dbSource: widget.dataSource || "ims_postgresql",
                  filters,
                });
              }
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
      mapped = mapped.map((widget) => {
        const isNestedChild = Boolean(widget.containerId || widget.sectionId);
        const isContainer = widget.rawType === "container" && !isNestedChild;
        const { layoutWidthPx: _dropW, layoutHeightPx, nestedGridWidthPx: _dropNestedW, ...portableStyle } = widget.style || {};
        const nextStyle = { ...portableStyle };
        // Nested widgets: ignore stale layoutHeightPx — size comes from parent nested_layout.
        if (isContainer) {
          const reconciledHeight = resolveNextContainerLayoutHeightPx(widget, widget.layout, {
            rowHeight: GRID_ROW_HEIGHT,
            gapY: GRID_GAP_Y,
            nestedLayout: widget.nestedLayout,
          });
          if (reconciledHeight != null) {
            nextStyle.layoutHeightPx = reconciledHeight;
          } else if (layoutHeightPx != null) {
            nextStyle.layoutHeightPx = layoutHeightPx;
          }
        } else if (!isNestedChild && !isContainer && (widget.layoutLocked === true) && layoutHeightPx != null) {
          nextStyle.layoutHeightPx = layoutHeightPx;
        }
        return {
          ...widget,
          layoutLocked: widget.layoutLocked === true || isNestedChild || isContainer,
          style: nextStyle,
        };
      });
      if (readOnly) {
        mapped = mapped.map((widget) => ({
          ...widget,
          previewData: widget.data ?? widget.previewData ?? [],
          previewError: widget.error ?? widget.previewError ?? null,
        }));
      }
      mapped.forEach((widget) => {
        if (widget.rawType === "container") {
          if (widget.layoutLocked === true || hasManualWidgetLayout(widget)) {
            manualSizedWidgetIdsRef.current.add(String(widget.id));
          } else {
            manualSizedWidgetIdsRef.current.delete(String(widget.id));
          }
          return;
        }
        if (widget.layoutLocked === true) {
          manualSizedWidgetIdsRef.current.add(String(widget.id));
        }
      });
      let hydrated = hydrateContainerNestedLayouts(mapped);
      hydrated = syncNestedChildLayoutsFromContainers(hydrated);
      hydrated
        .filter((widget) => widget.rawType === "container")
        .forEach((container) => {
          const nested = Array.isArray(container.nestedLayout) ? container.nestedLayout : [];
          if (nested.length) {
            liveContainerNestedLayoutsRef.desktop.set(String(container.id), nested);
          }
        });
      const topLevel = hydrated.filter((widget) => isTopLevelCanvasWidget(widget));
      let nextLayout;
      let nextMobileLayout;
      if (readOnly) {
        const rawLayout = topLevel.map((w) => {
          const source = w.layout || {};
          return { ...source, i: String(w.id) };
        });
        nextLayout = clampLayoutInBounds(
          resolvePublishedDesktopLayout(
            hydrated,
            rawLayout,
            GRID_COLS,
            layoutBlueprintRef.current?.desktop,
          ).map((item, idx) =>
            normalizeLayoutItem(item, idx, item.i, { lock: true }),
          ),
          GRID_COLS,
        );
        nextMobileLayout = clampLayoutInBounds(
          resolvePublishedPhoneLayout(
            hydrated,
            topLevel.map((w) => {
              const source = w.mobileLayout && Object.keys(w.mobileLayout).length
                ? w.mobileLayout
                : {};
              return { ...source, i: String(w.id) };
            }),
            GRID_COLS,
            layoutBlueprintRef.current?.mobile,
            topLevel.map((w) => ({ ...(w.layout || {}), i: String(w.id) })),
          ).map((item, idx) => normalizeLayoutItem(item, idx, item.i, { lock: true })),
          GRID_COLS,
        );
      } else {
        const rawLayout = topLevel.map((w, idx) => {
          const source = w.layout || {};
          if (w.rawType === "container") {
            const containerLayout = applyDesktopContainerLayout(w, source);
            const withHeight = applyMainLayoutPixelsToItem(
              {
                ...source,
                ...containerLayout,
                h: Math.max(1, Number(source.h) || 2),
              },
              w,
            );
            return normalizeLayoutItem(
              {
                ...withHeight,
                x: containerLayout.x,
                w: containerLayout.w,
                layoutLocked: shouldPreserveSavedLayout(w),
              },
              idx,
              w.id,
            );
          }
          return normalizeLayoutItem(source, idx, w.id);
        });
        nextLayout = scaleLayoutCoordsToBuilder(rawLayout);
        const rawMobileCandidates = topLevel
          .map((w) => (w.mobileLayout && Object.keys(w.mobileLayout).length
            ? { ...w.mobileLayout, i: String(w.id) }
            : null))
          .filter(Boolean);
        if (hasCustomTopLevelMobileLayout(rawLayout, rawMobileCandidates, hydrated)) {
          nextMobileLayout = topLevel.map((w, idx) => {
            const source = w.mobileLayout && Object.keys(w.mobileLayout).length
              ? w.mobileLayout
              : {};
            const [clamped] = clampLayoutInBounds([{ ...source, i: String(w.id) }], GRID_COLS);
            return normalizeLayoutItem(clamped, idx, w.id);
          });
        } else {
          nextMobileLayout = [];
        }
      }
      const hydratedWithLayout = hydrated.map((widget) => {
        if (!isTopLevelCanvasWidget(widget)) return widget;
        const matched = nextLayout.find((entry) => String(entry.i) === String(widget.id));
        const matchedMobile = nextMobileLayout.find((entry) => String(entry.i) === String(widget.id));
        return {
          ...widget,
          ...(matched ? { layout: matched } : {}),
          ...(matchedMobile ? { mobileLayout: matchedMobile } : {}),
        };
      });
      let finalWidgets = hydratedWithLayout;
      layoutRef.current = nextLayout;
      mobileLayoutRef.current = nextMobileLayout;
      setLayout(nextLayout);
      setMobileLayout(nextMobileLayout);
      if (USE_FLOATING_BUILDER) {
        const topLevelHydrated = hydratedWithLayout.filter((widget) => isTopLevelCanvasWidget(widget));
        // Always merge API layout_px with per-widget boxPx so live never falls back to grid packing.
        const mergedLayoutPx = mergeLayoutPxFromWidgets(
          Array.isArray(res?.layout_px) ? res.layout_px : [],
          topLevelHydrated,
        );
        const visibleTopIds = new Set(topLevelHydrated.map((widget) => String(widget.id)));
        // Live: keep original designer coords in state; display packing happens in resolvedLayoutPx
        // so re-packs always start from the blueprint (stable c1→c2→c3 order).
        // Builder: keep absolute designer coords untouched.
        const nextLayoutPx = mergedLayoutPx.filter((box) => visibleTopIds.has(String(box.i)));
        layoutPxRef.current = nextLayoutPx;
        setLayoutPx(nextLayoutPx);
        const rawMobilePx = Array.isArray(res?.layout_px_mobile) ? res.layout_px_mobile : [];
        const sanitizedMobilePx = sanitizeNestedLayoutPx(rawMobilePx);
        const nextMobilePx = sanitizedMobilePx.filter((box) => visibleTopIds.has(String(box.i)));
        layoutPxMobileRef.current = nextMobilePx;
        setLayoutPxMobile(nextMobilePx);
        phoneLayoutCustomizedRef.current = nextMobilePx.length > 0;
        if (!designCanvasWidthRef.current) {
          // Prefer full blueprint bounds for pack width (incl. hidden widgets).
          const bounds = contentBoundsPx(
            layoutPxBlueprintRef.current?.desktop?.length
              ? layoutPxBlueprintRef.current.desktop
              : (Array.isArray(res?.layout_px) ? res.layout_px : nextLayoutPx),
            0,
          );
          if (bounds.width >= 200) {
            designCanvasWidthRef.current = bounds.width;
            setDesignCanvasWidth(bounds.width);
          }
        }
        finalWidgets = hydratedWithLayout.map((widget) => {
          if (!isTopLevelCanvasWidget(widget)) {
            // Nested: keep child boxPx from chart_config / parent nested_layout_px
            return widget;
          }
          // Prefer original saved box from full blueprint so live packing has stable sizes/order.
          const blueprintBox = (layoutPxBlueprintRef.current?.desktop || []).find(
            (item) => String(item.i) === String(widget.id),
          );
          const matched = blueprintBox
            || nextLayoutPx.find((item) => String(item.i) === String(widget.id));
          if (!matched) return widget;
          const { left, top, width, height } = matched;
          return {
            ...widget,
            style: {
              ...(widget.style || {}),
              boxPx: { left, top, width, height },
            },
          };
        });
      }
      setWidgets(finalWidgets);
      if (!readOnly) {
        resetHistory();
        captureSavedFingerprint(finalWidgets, nextLayout, nextMobileLayout);
        const hasCurrentSelection = finalWidgets.some((w) => String(w.id) === String(selectedWidgetId));
        if (hasCurrentSelection) return;
        if (finalWidgets.length > 0) {
          setSelectedWidgetId(finalWidgets[0].id);
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

  /** Published: top-level widgets the viewer can see (containers need at least one permitted child). */
  const publishedVisibleWidgets = useMemo(() => {
    if (!readOnly) return visibleWidgets;
    return visibleWidgets.filter((widget) => {
      if (widget.rawType !== "container") return true;
      return widgets.some(
        (child) => String(child.containerId || child.sectionId) === String(widget.id),
      );
    });
  }, [readOnly, visibleWidgets, widgets]);

  const canvasWidgets = useMemo(() => {
    const pool = readOnly ? widgets : hydrateContainerNestedLayouts(widgets);
    const usePhoneFloating = isPhoneBuilderMode || (readOnly && isPhoneView);
    const withNested = readOnly || isPhoneBuilderMode || usePhoneFloating
      ? pool.map((widget) => {
        if (widget.rawType !== "container") return widget;
        const sectionChildren = pool.filter(
          (child) => String(child.containerId || child.sectionId) === String(widget.id),
        );
        // Floating phone: prefer saved mobile nested px; else desktop nested (laptop fallback).
        const fullNestedPx = Array.isArray(widget.nestedLayoutPx) ? widget.nestedLayoutPx : [];
        const fullMobileNestedPx = Array.isArray(widget.mobileNestedLayoutPx)
          ? widget.mobileNestedLayoutPx
          : [];
        const desktopNestedPx = boxesFromChildren(sectionChildren, fullNestedPx);
        const mobileNestedPx = fullMobileNestedPx.length
          ? boxesFromChildren(sectionChildren, fullMobileNestedPx)
          : null;
        const nestedLayout = resolvePublishedNestedLayout(widget, pool);
        let nestedLayoutPx = usePhoneFloating && mobileNestedPx
          ? mobileNestedPx
          : desktopNestedPx;
        // Live: pack nested holes when permission hid sibling children inside the container.
        if (readOnly && nestedLayoutPx.length) {
          const blueprintNested = usePhoneFloating && fullMobileNestedPx.length
            ? fullMobileNestedPx
            : fullNestedPx;
          const nestedCanvasWidth = Number(widget.style?.boxPx?.width)
            || contentBoundsPx(blueprintNested, 0).width
            || null;
          nestedLayoutPx = packLayoutPxGaps(nestedLayoutPx, blueprintNested, {
            canvasWidth: nestedCanvasWidth,
          });
        }
        return {
          ...widget,
          nestedLayout,
          nestedLayoutPx,
          sectionChildren,
        };
      })
      : pool;
    // Published (laptop + phone): hide containers whose nested widgets were all permission-filtered out.
    const forCanvas = readOnly
      ? withNested.filter((widget) => {
        if (widget.rawType !== "container") return true;
        return (widget.sectionChildren || []).length > 0;
      })
      : withNested;
    if (readOnly) {
      return buildCanvasWidgetsWithContainers(forCanvas);
    }
    return buildCanvasWidgetsWithContainers(withNested);
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

  const builderCanvasLayout = isPhoneBuilderMode ? mobileLayout : layout;

  const visibleLayout = useMemo(() => {
    const layoutWidgets = readOnly ? publishedVisibleWidgets : visibleWidgets;
    const ids = new Set(layoutWidgets.map((w) => String(w.id)));
    const source = builderCanvasLayout.filter((l) => ids.has(String(l.i)));
    if (isPhoneBuilderMode) {
      return source.map((item, idx) => normalizeLayoutItem(item, idx, item.i || item.id));
    }
    if (readOnly && !isPhoneView) {
      return clampLayoutInBounds(
        resolvePublishedDesktopLayout(
          publishedVisibleWidgets,
          source,
          GRID_COLS,
          layoutBlueprintRef.current?.desktop,
        ),
        GRID_COLS,
      );
    }
    // Builder: trust saved canvas grid coords — do not auto-expand container height at render time
    // (that was pushing sibling widgets far away during resize).
    return source.map((item, idx) => {
      const widget = widgets.find((entry) => String(entry.id) === String(item.i));
      if (widget?.rawType === "container") {
        const containerLayout = applyDesktopContainerLayout(widget, item, BUILDER_GRID_COLS);
        const base = normalizeLayoutItem(
          { ...item, x: containerLayout.x, w: containerLayout.w },
          idx,
          item.i,
        );
        const withHeight = (readOnly && shouldPreserveSavedLayout(widget))
          ? applyMainLayoutPixelsToItem(base, widget)
          : base;
        return {
          ...withHeight,
          resizeHandles: ["e", "w", "se", "sw"],
        };
      }
      if (shouldPreserveSavedLayout(widget) && readOnly) {
        return applyMainLayoutPixelsToItem(item, widget);
      }
      return normalizeLayoutItem(item, idx, item.i);
    });
  }, [builderCanvasLayout, visibleWidgets, publishedVisibleWidgets, isPhoneBuilderMode, readOnly, isPhoneView, widgets]);

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
  }, [readOnly, appKey, pageKey, targetAppKey, resolvedPageKey, selectedDashboardKey, runtimeDashboardKey, filters.fromDate, filters.toDate, filters.userId, filters.fyuid, filterRefreshToken]);

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
          const nestedCols = isPhoneBuilderMode ? NESTED_GRID_COLS : NESTED_BUILDER_COLS;
          const toDisplay = (item) => (
            isPhoneBuilderMode ? item : scaleNestedLayoutToBuilder([item])[0]
          );
          return matched
            ? normalizeNestedLayoutItem(toDisplay(matched), 0, selectedWidget.id, {
              rawType: selectedWidget.rawType || selectedWidget.type || "kpi",
              cols: nestedCols,
            })
            : (selectedWidget.layout
              ? normalizeNestedLayoutItem(toDisplay(selectedWidget.layout), 0, selectedWidget.id, {
                rawType: selectedWidget.rawType || selectedWidget.type || "kpi",
                cols: nestedCols,
              })
              : null);
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
  const canvasWidth = useMemo(() => {
    if (isPhonePreviewFrame) return PHONE_CONTENT_WIDTH;
    // Live phone: use real viewport/host width (edge-to-edge), not a 390 cap.
    if (readOnly && isPhoneView) {
      const liveWidth = liveGridMeasure.mounted ? liveGridMeasure.width : 0;
      if (liveWidth >= 200) return liveWidth;
      if (measuredCanvasWidth >= 200) return measuredCanvasWidth;
      return PHONE_CONTENT_WIDTH;
    }
    const liveWidth = liveGridMeasure.mounted ? liveGridMeasure.width : 0;
    if (liveWidth >= 200) return liveWidth;
    if (measuredCanvasWidth >= 200) return measuredCanvasWidth;
    // Never return a sub-200 width — that unmounts the canvas (gridReady false → blank).
    return Math.max(320, measuredCanvasWidth || 1200);
  }, [measuredCanvasWidth, isPhonePreviewFrame, liveGridMeasure.mounted, liveGridMeasure.width, readOnly, isPhoneView]);
  // Laptop live matches builder at 1:1 (scroll). Phone still uses fixed design width.
  const floatingCanvasWidth = canvasWidth;
  // Stay ready once we've ever had a usable width; don't unmount on resize glitches.
  const gridReady = canvasWidth >= 200 || measuredCanvasWidth >= 200;

  const colWidth = Math.max(
    20,
    (Math.max(0, canvasWidth - GRID_GAP_X * (activeDesktopGridCols(isPhoneBuilderMode) - 1)))
      / activeDesktopGridCols(isPhoneBuilderMode),
  );

  const floatingGridMetrics = useMemo(() => ({
    colWidth,
    rowHeight: GRID_ROW_HEIGHT,
    gapX: GRID_GAP_X,
    gapY: GRID_GAP_Y,
    canvasWidth,
  }), [colWidth, canvasWidth]);

  const isPhoneFloatingView = USE_FLOATING_BUILDER && (isPhoneBuilderMode || (readOnly && isPhoneView));
  // Live phone should render the phone design width (same as PHONE builder), not stretch laptop layout.
  const lockPhoneDesignWidth = isPhoneBuilderMode || (readOnly && isPhoneView);

  const resolvedLayoutPx = useMemo(() => {
    if (!USE_FLOATING_BUILDER) return [];
    const desktopSource = (layoutPx?.length ? layoutPx : layoutPxRef.current) || [];
    let desktopPx = desktopSource.length
      ? sanitizeNestedLayoutPx(desktopSource)
      : boxesFromTopLevelWidgets(
        (widgets || []).filter((widget) => isTopLevelCanvasWidget(widget)),
        [],
        layoutRef.current?.length ? layoutRef.current : layout,
        floatingGridMetrics,
      );

    // Live: flow-pack from original blueprint coords (not already-shifted state).
    if (readOnly && !isPhoneFloatingView) {
      const visibleIds = new Set(
        (publishedVisibleWidgets || []).map((widget) => String(widget.id)),
      );
      const blueprint = layoutPxBlueprintRef.current?.desktop?.length
        ? layoutPxBlueprintRef.current.desktop
        : desktopPx;
      // Empty containers are display-only filtered on publish. Do not treat them as
      // permission holes — that used to reflow the whole laptop layout and break
      // builder↔publish alignment (table/KPI left edges drifted).
      const emptyContainerIds = new Set(
        (widgets || [])
          .filter((widget) => (
            widget.rawType === "container"
            && !visibleIds.has(String(widget.id))
          ))
          .map((widget) => String(widget.id)),
      );
      const packBlueprint = sanitizeNestedLayoutPx(blueprint).filter(
        (box) => !emptyContainerIds.has(String(box.i)),
      );
      const sizeById = new Map(desktopPx.map((box) => [String(box.i), box]));
      const sourceBoxes = packBlueprint
        .filter((box) => visibleIds.has(String(box.i)))
        .map((box) => {
          const live = sizeById.get(String(box.i));
          // Keep live width/height if present; positions come from blueprint for stable order.
          return live
            ? { ...box, width: live.width, height: live.height }
            : box;
        });
      desktopPx = packLayoutPxGaps(sourceBoxes, packBlueprint, {
        canvasWidth: Number(designCanvasWidthRef.current)
          || Number(designCanvasWidth)
          || null,
      });
    }

    // Laptop builder + live laptop: desktop layout only — never mix phone boxes.
    if (!isPhoneFloatingView) return desktopPx;

    const phoneW = PHONE_CONTENT_WIDTH;
    const topLevelForPhone = (widgets || []).filter((widget) => isTopLevelCanvasWidget(widget));
    const rawMobile = sanitizeNestedLayoutPx(
      (layoutPxMobile?.length ? layoutPxMobile : layoutPxMobileRef.current) || [],
    );
    // Complete + clamp only when a phone layout already exists. Incomplete
    // layout_px_mobile (laptop-added table after phone was customized) used to fall
    // back to desktop boxPx (~640) and collapse the phone canvas fitScale.
    // Empty mobile still falls through to scale-from-desktop below.
    const savedMobile = rawMobile.length
      ? ensurePhoneLayoutPx(topLevelForPhone, rawMobile, { phoneWidth: phoneW, desktopPx })
      : [];
    const packPhoneVisible = (boxes) => {
      if (!readOnly) return boxes;
      const visibleIds = new Set(
        (publishedVisibleWidgets || []).map((widget) => String(widget.id)),
      );
      const blueprint = layoutPxBlueprintRef.current?.mobile?.length
        ? layoutPxBlueprintRef.current.mobile
        : (layoutPxBlueprintRef.current?.desktop?.length
          ? layoutPxBlueprintRef.current.desktop
          : boxes);
      const sizeById = new Map(boxes.map((box) => [String(box.i), box]));
      const sourceBoxes = sanitizeNestedLayoutPx(blueprint)
        .filter((box) => visibleIds.has(String(box.i)))
        .map((box) => {
          const live = sizeById.get(String(box.i));
          return live
            ? { ...box, width: live.width, height: live.height }
            : box;
        });
      // If blueprint has no matching visible boxes (scaled phone fallback), pack `boxes` as-is.
      const toPack = sourceBoxes.length ? sourceBoxes : boxes.filter((box) => visibleIds.has(String(box.i)));
      return ensurePhoneLayoutPx(
        topLevelForPhone.filter((widget) => visibleIds.has(String(widget.id))),
        packLayoutPxGaps(toPack, blueprint, { canvasWidth: phoneW }),
        { phoneWidth: phoneW, desktopPx },
      );
    };

    // Phone builder: phone canvas as designed.
    if (isPhoneBuilderMode && savedMobile.length) {
      const mobileBounds = contentBoundsPx(savedMobile, 0);
      if (mobileBounds.width <= phoneW + 48) return savedMobile;
      return scaleLayoutPx(savedMobile, Math.max(320, mobileBounds.width), phoneW);
    }
    // Live phone: phone layout only when published/saved; else laptop scaled into phone width.
    if (readOnly && savedMobile.length) {
      const packedMobile = packPhoneVisible(savedMobile);
      const mobileBounds = contentBoundsPx(packedMobile, 0);
      if (mobileBounds.width <= phoneW + 48) return packedMobile;
      return scaleLayoutPx(packedMobile, Math.max(320, mobileBounds.width), phoneW);
    }
    const designW = Math.max(
      320,
      Number(designCanvasWidthRef.current) || contentBoundsPx(desktopPx, 0).width,
    );
    // Live phone without saved mobile: pack desktop gaps first, then scale into phone width.
    // (Desktop pack was skipped above because isPhoneFloatingView is true.)
    if (readOnly) {
      const visibleIds = new Set(
        (publishedVisibleWidgets || []).map((widget) => String(widget.id)),
      );
      const blueprint = layoutPxBlueprintRef.current?.desktop?.length
        ? layoutPxBlueprintRef.current.desktop
        : desktopPx;
      const sizeById = new Map(desktopPx.map((box) => [String(box.i), box]));
      const sourceBoxes = sanitizeNestedLayoutPx(blueprint)
        .filter((box) => visibleIds.has(String(box.i)))
        .map((box) => {
          const live = sizeById.get(String(box.i));
          return live ? { ...box, width: live.width, height: live.height } : box;
        });
      const toPack = sourceBoxes.length
        ? sourceBoxes
        : desktopPx.filter((box) => visibleIds.has(String(box.i)));
      const packedDesktop = packLayoutPxGaps(toPack, blueprint, {
        canvasWidth: Number(designCanvasWidthRef.current) || Number(designCanvasWidth) || null,
      });
      return ensurePhoneLayoutPx(
        topLevelForPhone.filter((widget) => visibleIds.has(String(widget.id))),
        scaleLayoutPx(packedDesktop, designW, phoneW),
        { phoneWidth: phoneW, desktopPx: packedDesktop },
      );
    }
    return ensurePhoneLayoutPx(
      topLevelForPhone,
      scaleLayoutPx(desktopPx, designW, phoneW),
      { phoneWidth: phoneW, desktopPx },
    );
  }, [
    layoutPx,
    layoutPxMobile,
    widgets,
    layout,
    floatingGridMetrics,
    isPhoneFloatingView,
    isPhoneBuilderMode,
    readOnly,
    publishedVisibleWidgets,
    designCanvasWidth,
  ]);

  const handleCanvasLayoutPxChange = useCallback((nextLayoutPx, options = {}) => {
    if (readOnly) return;
    let normalized = sanitizeNestedLayoutPx(nextLayoutPx);
    if (!normalized.length) return;
    // Do NOT re-equalize the whole group here — canvas already clamps the edited
    // widget only. Re-running equalizePhoneSideGutters rewrote sibling sizes.
    normalized.forEach((item) => {
      const widget = widgetsRef.current?.find((entry) => String(entry.id) === String(item.i));
      if (widget && isTopLevelCanvasWidget(widget)) {
        manualSizedWidgetIdsRef.current.add(String(item.i));
      }
    });

    if (isPhoneBuilderMode) {
      phoneLayoutCustomizedRef.current = true;
      layoutPxMobileRef.current = normalized;
      if (options.interim) {
        setLayoutPxMobile(normalized);
        return;
      }
      captureHistoryBeforeChange();
      setLayoutPxMobile(normalized);
      // Keep grid mobileLayout in sync for publish fallback / older paths.
      const phoneW = PHONE_BUILDER_WIDTH;
      const storageColWidth = Math.max(8, (phoneW - GRID_GAP_X * (GRID_COLS - 1)) / GRID_COLS);
      const nextMobileGrid = clampLayoutInBounds(
        normalized.map((box, idx) => normalizeLayoutItem(
          boxPxToGridItem(box, box.i, {
            colWidth: storageColWidth,
            rowHeight: GRID_ROW_HEIGHT,
            gapX: GRID_GAP_X,
            gapY: GRID_GAP_Y,
            cols: GRID_COLS,
          }),
          idx,
          box.i,
        )),
        GRID_COLS,
      );
      mobileLayoutRef.current = nextMobileGrid;
      setMobileLayout(nextMobileGrid);
      setWidgets((prev) =>
        prev.map((widget) => {
          if (!isTopLevelCanvasWidget(widget)) return widget;
          const matched = normalized.find((item) => String(item.i) === String(widget.id));
          const gridItem = nextMobileGrid.find((item) => String(item.i) === String(widget.id));
          if (!matched) return widget;
          return {
            ...widget,
            layoutLocked: true,
            ...(gridItem ? { mobileLayout: { ...gridItem } } : {}),
            style: {
              ...(widget.style || {}),
              // Phone edits live in layout_px_mobile; keep desktop boxPx untouched.
            },
          };
        }),
      );
      return;
    }

    layoutPxRef.current = normalized;
    if (options.interim) {
      setLayoutPx(normalized);
      return;
    }
    captureHistoryBeforeChange();
    setLayoutPx(normalized);
    setWidgets((prev) =>
      prev.map((widget) => {
        if (!isTopLevelCanvasWidget(widget)) return widget;
        const matched = normalized.find((item) => String(item.i) === String(widget.id));
        if (!matched) return widget;
        const { left, top, width, height } = matched;
        if (widget.rawType === "container") {
          manualSizedWidgetIdsRef.current.add(String(widget.id));
        }
        return {
          ...widget,
          layoutLocked: true,
          style: {
            ...(widget.style || {}),
            boxPx: { left, top, width, height },
            layoutWidthPx: width,
            layoutHeightPx: height,
          },
        };
      }),
    );
  }, [captureHistoryBeforeChange, isPhoneBuilderMode, readOnly]);

  const selectedParentContainer = selectedWidget?.containerId
    ? widgets.find((entry) => String(entry.id) === String(selectedWidget.containerId))
    : null;
  const selectedParentLayout = selectedParentContainer
    ? builderCanvasLayout.find((item) => String(item.i) === String(selectedParentContainer.id))
    : null;
  const lockedNestedCanvasPx = selectedParentContainer ? readNestedGridWidthPx(selectedParentContainer) : null;
  const shellInnerWidthPx = selectedParentLayout
    ? Math.round(
      (Math.max(1, Number(selectedParentLayout.w) || 1) * colWidth)
      + Math.max(0, (Math.max(1, Number(selectedParentLayout.w) || 1) - 1) * GRID_GAP_X),
    )
    : canvasWidth;
  const parentCanvasWidthPx = selectedWidget?.containerId
    ? (lockedNestedCanvasPx ?? shellInnerWidthPx)
    : canvasWidth;
  const nestedColWidth = nestedGridColWidthPx(
    parentCanvasWidthPx,
    selectedWidget?.containerId && !isPhoneBuilderMode ? NESTED_BUILDER_COLS : NESTED_GRID_COLS,
  );
  const activeColWidth = selectedWidget?.containerId ? nestedColWidth : colWidth;
  const activeRowHeight = selectedWidget?.containerId ? NESTED_ROW_HEIGHT : GRID_ROW_HEIGHT;
  const activeGapX = selectedWidget?.containerId ? NESTED_GAP : GRID_GAP_X;
  const activeGapY = selectedWidget?.containerId ? NESTED_GAP : GRID_GAP_Y;
  const minLayoutWidthPx = selectedWidget?.containerId
    ? Math.max(20, Math.round(activeColWidth * 0.2))
    : Math.max(24, Math.round(activeColWidth * 0.25));
  const minLayoutHeightPx = selectedWidget?.containerId
    ? Math.max(20, Math.round(activeRowHeight))
    : Math.max(24, Math.round(activeRowHeight * 0.5));
  const storedLayoutPixels = selectedWidget ? readWidgetLayoutPixels(selectedWidget) : { widthPx: null, heightPx: null };
  const selectedFloatingBox = USE_FLOATING_BUILDER && selectedWidget && isTopLevelCanvasWidget(selectedWidget)
    ? (resolvedLayoutPx.find((item) => String(item.i) === String(selectedWidget.id))
      || (!isPhoneLayoutMode && selectedWidget.style?.boxPx ? normalizeBox(selectedWidget.style.boxPx) : null))
    : null;
  const selectedNestedFloatingBox = USE_FLOATING_BUILDER && selectedWidget?.containerId
    ? (() => {
      const parent = widgets.find((entry) => String(entry.id) === String(selectedWidget.containerId));
      const nestedPx = isPhoneBuilderMode
        ? (Array.isArray(parent?.mobileNestedLayoutPx) && parent.mobileNestedLayoutPx.length
          ? parent.mobileNestedLayoutPx
          : (Array.isArray(parent?.nestedLayoutPx) ? parent.nestedLayoutPx : []))
        : (Array.isArray(parent?.nestedLayoutPx) && parent.nestedLayoutPx.length
          ? parent.nestedLayoutPx
          : []);
      const matched = nestedPx.find((item) => String(item.i) === String(selectedWidget.id));
      if (matched) return normalizeBox(matched);
      if (!isPhoneLayoutMode && selectedWidget.style?.boxPx) return normalizeBox(selectedWidget.style.boxPx);
      return null;
    })()
    : null;
  const activeFloatingBox = selectedFloatingBox || selectedNestedFloatingBox;
  const ignoreStoredNestedPixels = Boolean(selectedWidget?.containerId) && !activeFloatingBox;
  const widthPx = activeFloatingBox
    ? activeFloatingBox.width
    : (!ignoreStoredNestedPixels && storedLayoutPixels.widthPx != null
      ? storedLayoutPixels.widthPx
      : selectedLayout
        ? Math.round((selectedLayout.w || 1) * activeColWidth + Math.max(0, (selectedLayout.w || 1) - 1) * activeGapX)
        : 0);
  const heightPx = activeFloatingBox
    ? activeFloatingBox.height
    : (!ignoreStoredNestedPixels && storedLayoutPixels.heightPx != null
      ? storedLayoutPixels.heightPx
      : selectedLayout
        ? Math.round(
            (selectedLayout.h || 1) * activeRowHeight + Math.max(0, (selectedLayout.h || 1) - 1) * activeGapY,
          )
        : 0);

  const clamp = (num, min, max) => Math.min(max, Math.max(min, num));
  const pixelToGridW = (px) =>
    clamp(
      pixelToGridByDirection(
        px,
        widthPx,
        minLayoutWidthPx,
        activeColWidth,
        activeGapX,
        selectedWidget?.containerId ? NESTED_BUILDER_COLS : activeDesktopGridCols(isPhoneBuilderMode),
      ),
      1,
      selectedWidget?.containerId ? NESTED_BUILDER_COLS : activeDesktopGridCols(isPhoneBuilderMode),
    );
  const pixelToGridH = (px) =>
    clamp(
      pixelToGridByDirection(
        px,
        heightPx,
        minLayoutHeightPx,
        activeRowHeight,
        activeGapY,
        30,
      ),
      1,
      30,
    );

  const pixelToGridByDirection = (nextPx, currentPx, minPx, unitSizePx, gapPx, maxGrid) => {
    const safeMin = Math.max(1, Number(minPx) || 1);
    const safeUnit = Math.max(1, Number(unitSizePx) || safeMin);
    const safeGap = Math.max(0, Number(gapPx) || 0);
    const safeMax = Math.max(1, Number(maxGrid) || 1);
    const rawPx = Number(nextPx);
    const normalizedPx = Number.isFinite(rawPx) ? Math.max(safeMin, rawPx) : safeMin;
    const ratio = (normalizedPx + safeGap) / (safeUnit + safeGap);
    const prev = Math.max(safeMin, Number(currentPx) || safeMin);
    const rounded = normalizedPx >= prev ? Math.ceil(ratio) : Math.floor(ratio);
    return clamp(rounded, 1, safeMax);
  };

  const handlePixelSizeChange = ({ widthPx: nextWidthPx, heightPx: nextHeightPx }) => {
    if (isCanvasLocked || !selectedWidget) return;
    if (nextWidthPx == null && nextHeightPx == null) return;
    captureHistoryBeforeChange();
    manualSizedWidgetIdsRef.current.add(String(selectedWidget.id));

    // Phone floating: size edits go ONLY to layout_px_mobile / mobileNestedLayoutPx.
    if (USE_FLOATING_BUILDER && isPhoneBuilderMode && !selectedWidget.containerId) {
      phoneLayoutCustomizedRef.current = true;
      const existingPx = sanitizeNestedLayoutPx(
        layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile,
      );
      const matched = existingPx.find((item) => String(item.i) === String(selectedWidget.id));
      const currentBox = matched
        ? normalizeBox(matched)
        : normalizeBox({ left: 8, top: 8, width: 200, height: 120 });
      const nextBox = normalizeBox({
        left: currentBox.left,
        top: currentBox.top,
        width: nextWidthPx != null ? nextWidthPx : currentBox.width,
        height: nextHeightPx != null ? nextHeightPx : currentBox.height,
      });
      nextBox.width = Math.min(nextBox.width, PHONE_CONTENT_WIDTH - PHONE_FRAME_INSET * 2);
      nextBox.left = Math.min(
        Math.max(PHONE_FRAME_INSET, nextBox.left),
        Math.max(PHONE_FRAME_INSET, PHONE_CONTENT_WIDTH - PHONE_FRAME_INSET - nextBox.width),
      );
      const nextPx = matched
        ? existingPx.map((item) => (
          String(item.i) === String(selectedWidget.id)
            ? { i: String(item.i), ...nextBox }
            : item
        ))
        : [...existingPx, { i: String(selectedWidget.id), ...nextBox }];
      const normalizedPx = sanitizeNestedLayoutPx(nextPx);
      layoutPxMobileRef.current = normalizedPx;
      setLayoutPxMobile(normalizedPx);
      return;
    }

    if (USE_FLOATING_BUILDER && isPhoneBuilderMode && selectedWidget.containerId) {
      phoneLayoutCustomizedRef.current = true;
      const containerId = String(selectedWidget.containerId);
      const container = widgetsRef.current.find((entry) => String(entry.id) === containerId);
      const existingNestedPx = sanitizeNestedLayoutPx(
        Array.isArray(container?.mobileNestedLayoutPx) && container.mobileNestedLayoutPx.length
          ? container.mobileNestedLayoutPx
          : (Array.isArray(container?.nestedLayoutPx) ? container.nestedLayoutPx : []),
      );
      const matched = existingNestedPx.find((item) => String(item.i) === String(selectedWidget.id));
      const currentBox = matched ? normalizeBox(matched) : normalizeBox({ left: 4, top: 4, width: 100, height: 72 });
      const nextBox = normalizeBox({
        left: currentBox.left,
        top: currentBox.top,
        width: nextWidthPx != null ? nextWidthPx : currentBox.width,
        height: nextHeightPx != null ? nextHeightPx : currentBox.height,
      });
      const normalizedPx = sanitizeNestedLayoutPx(
        matched
          ? existingNestedPx.map((item) => (
            String(item.i) === String(selectedWidget.id)
              ? { i: String(item.i), ...nextBox }
              : item
          ))
          : [...existingNestedPx, { i: String(selectedWidget.id), ...nextBox }],
      );
      handleNestedLayoutChange(containerId, normalizedPx, true, {});
      return;
    }

    // Laptop floating: size edits go ONLY to layout_px / style.boxPx — never phone layout.
    if (USE_FLOATING_BUILDER && !isPhoneBuilderMode && !selectedWidget.containerId) {
      const existingPx = sanitizeNestedLayoutPx(
        layoutPxRef.current?.length ? layoutPxRef.current : layoutPx,
      );
      const matched = existingPx.find((item) => String(item.i) === String(selectedWidget.id));
      const currentBox = matched ? normalizeBox(matched) : readWidgetBoxPx(selectedWidget);
      const nextBox = normalizeBox({
        left: currentBox.left,
        top: currentBox.top,
        width: nextWidthPx != null ? nextWidthPx : currentBox.width,
        height: nextHeightPx != null ? nextHeightPx : currentBox.height,
      });
      const nextPx = matched
        ? existingPx.map((item) => (
          String(item.i) === String(selectedWidget.id)
            ? { i: String(item.i), ...nextBox }
            : item
        ))
        : [...existingPx, { i: String(selectedWidget.id), ...nextBox }];
      const normalizedPx = sanitizeNestedLayoutPx(nextPx);
      layoutPxRef.current = normalizedPx;
      setLayoutPx(normalizedPx);
      setWidgets((prev) =>
        prev.map((widget) => {
          if (String(widget.id) !== String(selectedWidget.id)) return widget;
          return {
            ...widget,
            layoutLocked: true,
            style: {
              ...(widget.style || {}),
              boxPx: nextBox,
              layoutWidthPx: nextBox.width,
              layoutHeightPx: nextBox.height,
            },
          };
        }),
      );
      return;
    }

    if (USE_FLOATING_BUILDER && !isPhoneBuilderMode && selectedWidget.containerId) {
      const containerId = String(selectedWidget.containerId);
      const container = widgetsRef.current.find((entry) => String(entry.id) === containerId);
      const existingNestedPx = sanitizeNestedLayoutPx(
        Array.isArray(container?.nestedLayoutPx) && container.nestedLayoutPx.length
          ? container.nestedLayoutPx
          : boxesFromChildren(
            widgetsRef.current.filter((entry) => String(entry.containerId) === containerId),
            [],
          ),
      );
      const matched = existingNestedPx.find((item) => String(item.i) === String(selectedWidget.id));
      const currentBox = matched ? normalizeBox(matched) : readWidgetBoxPx(selectedWidget);
      const nextBox = normalizeBox({
        left: currentBox.left,
        top: currentBox.top,
        width: nextWidthPx != null ? nextWidthPx : currentBox.width,
        height: nextHeightPx != null ? nextHeightPx : currentBox.height,
      });
      const normalizedPx = sanitizeNestedLayoutPx(
        matched
          ? existingNestedPx.map((item) => (
            String(item.i) === String(selectedWidget.id)
              ? { i: String(item.i), ...nextBox }
              : item
          ))
          : [...existingNestedPx, { i: String(selectedWidget.id), ...nextBox }],
      );
      handleNestedLayoutChange(containerId, normalizedPx, false, {});
      return;
    }

    const nestedCols = isPhoneBuilderMode ? NESTED_GRID_COLS : NESTED_BUILDER_COLS;
    const current = selectedLayout
      ? (selectedWidget.containerId
        ? normalizeNestedLayoutItem(selectedLayout, 0, selectedWidget.id, {
          rawType: selectedWidget.rawType || selectedWidget.type || "kpi",
          cols: nestedCols,
        })
        : normalizeLayoutItem(selectedLayout, 0, selectedWidget.id))
      : (selectedWidget.containerId
        ? normalizeNestedLayoutItem({}, 0, selectedWidget.id, {
          rawType: selectedWidget.rawType || selectedWidget.type || "kpi",
          cols: nestedCols,
        })
        : normalizeLayoutItem({}, 0, selectedWidget.id));
    const nextW = nextWidthPx != null
      ? pixelToGridW(nextWidthPx)
      : current.w;
    const nextH = nextHeightPx != null
      ? pixelToGridH(nextHeightPx)
      : current.h;
    const layoutStylePatch = {
      ...(nextWidthPx != null && Number.isFinite(Number(nextWidthPx))
        ? { layoutWidthPx: Math.round(Number(nextWidthPx)) }
        : {}),
      ...(nextHeightPx != null && Number.isFinite(Number(nextHeightPx))
        ? { layoutHeightPx: Math.round(Number(nextHeightPx)) }
        : {}),
    };
    const nextBuilder = selectedWidget.containerId
      ? normalizeNestedLayoutItem(
        { ...current, w: nextW, h: nextH },
        0,
        selectedWidget.id,
        { rawType: selectedWidget.rawType || selectedWidget.type || "kpi", cols: nestedCols },
      )
      : normalizeLayoutItem(
        { ...current, w: nextW, h: nextH },
        0,
        selectedWidget.id,
      );
    const next = selectedWidget.containerId && !isPhoneBuilderMode
      ? normalizeNestedLayoutItem(
        scaleNestedLayoutToStorage([nextBuilder], NESTED_BUILDER_COLS)[0],
        0,
        selectedWidget.id,
        { rawType: selectedWidget.rawType || selectedWidget.type || "kpi", cols: NESTED_GRID_COLS },
      )
      : nextBuilder;

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
      const parentContainer = widgets.find((widget) => String(widget.id) === parentId);
      const nestedSource = isPhoneBuilderMode
        ? (parentContainer?.mobileNestedLayout || [])
        : (parentContainer?.nestedLayout || []);
      const patchedNested = nestedSource.map((item, idx) =>
        String(item.i) === String(selectedWidget.id)
          ? normalizeNestedLayoutItem({ ...item, ...next }, idx, selectedWidget.id, {
            rawType: selectedWidget.rawType || selectedWidget.type || "kpi",
            cols: NESTED_GRID_COLS,
          })
          : item,
      );
      if (isPhoneBuilderMode) {
        liveContainerNestedLayoutsRef.mobile.set(parentId, patchedNested);
      } else {
        liveContainerNestedLayoutsRef.desktop.set(parentId, patchedNested);
      }
      setWidgets((prev) =>
        prev.map((widget) => {
          if (String(widget.id) === String(selectedWidget.id)) {
            const { layoutWidthPx: _dropW, layoutHeightPx: _dropH, ...restStyle } = widget.style || {};
            return {
              ...widget,
              layout: isPhoneBuilderMode ? widget.layout : next,
              mobileLayout: isPhoneBuilderMode ? next : widget.mobileLayout,
              layoutLocked: true,
              style: restStyle,
            };
          }
          if (String(widget.id) === parentId) {
            return isPhoneBuilderMode
              ? { ...widget, mobileNestedLayout: patchedNested }
              : { ...widget, nestedLayout: patchedNested };
          }
          return widget;
        }),
      );
      return;
    }

    if (selectedWidget.rawType === "container") {
      manualSizedWidgetIdsRef.current.add(String(selectedWidget.id));
      const inferredPreset = nextW <= BUILDER_GRID_COLS / 2 ? "half" : "full";
      const clampedW = Math.min(BUILDER_GRID_COLS, Math.max(1, nextW));
      const containerLayout = isPhoneBuilderMode
        ? { x: 0, w: clampedW }
        : normalizeContainerLayoutItem(
          { ...selectedWidget, containerPreset: inferredPreset },
          { ...next, w: clampedW },
          BUILDER_GRID_COLS,
        );
      const resolved = normalizeLayoutItem(
        {
          ...next,
          x: isPhoneBuilderMode ? 0 : containerLayout.x,
          w: isPhoneBuilderMode ? clampedW : containerLayout.w,
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
              layoutLocked: true,
              layout: isPhoneBuilderMode ? w.layout : resolved,
              mobileLayout: isPhoneBuilderMode ? resolved : w.mobileLayout,
              style: {
                ...(w.style || {}),
                ...layoutStylePatch,
              },
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
            ? {
              ...w,
              mobileLayout: next,
              style: {
                ...(w.style || {}),
                ...layoutStylePatch,
              },
            }
            : w,
        ),
      );
      return;
    }

    applyTopLevelLayout(next);
    setWidgets((prev) =>
      prev.map((w) =>
        String(w.id) === String(selectedWidget.id)
          ? {
            ...w,
            layout: next,
            layoutLocked: true,
            style: {
              ...(w.style || {}),
              ...layoutStylePatch,
            },
          }
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
      linkType: "NONE",
      linkUrl: "",
      linkAppId: "",
      linkPageId: "",
    };

    if (isPhoneBuilderMode && USE_FLOATING_BUILDER) {
      const existingPx = sanitizeNestedLayoutPx(
        layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile,
      );
      const box = placeNextBoxPx(
        existingPx,
        defaultTopLevelBoxForType(rawType, containerPreset, PHONE_BUILDER_WIDTH),
      );
      // Keep new phone widgets within the phone frame width + side gutter.
      box.width = Math.min(box.width, PHONE_BUILDER_WIDTH - PHONE_FRAME_INSET * 2);
      box.left = Math.min(
        Math.max(PHONE_FRAME_INSET, box.left),
        Math.max(PHONE_FRAME_INSET, PHONE_BUILDER_WIDTH - PHONE_FRAME_INSET - box.width),
      );
      const nextPx = [...existingPx, { i: id, ...box }];
      phoneLayoutCustomizedRef.current = true;
      layoutPxMobileRef.current = nextPx;
      setLayoutPxMobile(nextPx);
      setWidgets((prev) => [...prev, {
        ...temp,
        style: {
          ...defaultWidgetStyle(rawType),
          // Don't stamp desktop boxPx from phone sizes.
        },
      }]);
      setMobileLayout((prev) => {
        const storageColWidth = Math.max(8, (PHONE_BUILDER_WIDTH - GRID_GAP_X * (GRID_COLS - 1)) / GRID_COLS);
        const gridItem = normalizeLayoutItem(
          boxPxToGridItem({ i: id, ...box }, id, {
            colWidth: storageColWidth,
            rowHeight: GRID_ROW_HEIGHT,
            gapX: GRID_GAP_X,
            gapY: GRID_GAP_Y,
            cols: GRID_COLS,
          }),
          prev.length,
          id,
        );
        const next = [...prev, gridItem];
        mobileLayoutRef.current = next;
        return next;
      });
      setSelectedWidgetId(id);
      setPropertyPanelOpen(true);
      return;
    }
    if (isPhoneBuilderMode) {
      setWidgets((prev) => [...prev, temp]);
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
    if (USE_FLOATING_BUILDER) {
      const existingPx = sanitizeNestedLayoutPx(layoutPxRef.current?.length ? layoutPxRef.current : layoutPx);
      const box = placeNextBoxPx(
        existingPx,
        defaultTopLevelBoxForType(rawType, containerPreset, canvasWidth || 1200),
      );
      const nextPx = [...existingPx, { i: id, ...box }];
      layoutPxRef.current = nextPx;
      setLayoutPx(nextPx);
      // Keep phone floating layout complete even when already customized — otherwise
      // the new widget is missing from layout_px_mobile and phone view falls back to
      // desktop boxPx (wide tables → fitScale collapse / huge select jump).
      if (phoneLayoutCustomizedRef.current) {
        const phoneBox = placeNextBoxPx(
          sanitizeNestedLayoutPx(layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile),
          defaultTopLevelBoxForType(rawType, containerPreset, PHONE_BUILDER_WIDTH),
        );
        phoneBox.width = Math.min(phoneBox.width, PHONE_BUILDER_WIDTH - PHONE_FRAME_INSET * 2);
        phoneBox.left = Math.min(
          Math.max(PHONE_FRAME_INSET, phoneBox.left),
          Math.max(PHONE_FRAME_INSET, PHONE_BUILDER_WIDTH - PHONE_FRAME_INSET - phoneBox.width),
        );
        const nextMobilePx = ensurePhoneLayoutPx(
          [...(widgetsRef.current?.length ? widgetsRef.current : widgets), { ...temp, id }],
          [
            ...(layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile),
            { i: id, ...phoneBox },
          ],
          { phoneWidth: PHONE_BUILDER_WIDTH, desktopPx: nextPx },
        );
        layoutPxMobileRef.current = nextMobilePx;
        setLayoutPxMobile(nextMobilePx);
      }
      setWidgets((prev) => [...prev, {
        ...temp,
        style: {
          ...defaultWidgetStyle(rawType),
          boxPx: box,
        },
      }]);
      setLayout((prev) => {
        const next = [...prev, buildInitialLayoutForType(rawType, prev.length, id, containerPreset)];
        layoutRef.current = next;
        // If phone layout was already customized, never rewrite the grid from laptop adds
        // (floating phone px was updated above).
        if (!phoneLayoutCustomizedRef.current) {
          setMobileLayout((mobilePrev) => {
            const allWidgets = [...(widgetsRef.current?.length ? widgetsRef.current : widgets), { ...temp, style: { ...defaultWidgetStyle(rawType), boxPx: box } }];
            const merged = mergeMobileLayoutFromDesktop(allWidgets, next, mobilePrev);
            mobileLayoutRef.current = merged;
            return merged;
          });
        }
        return next;
      });
      setSelectedWidgetId(id);
      setPropertyPanelOpen(true);
      return;
    }
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
      const next = [...prev, buildInitialLayoutForType(rawType, prev.length, id, containerPreset)];
      layoutRef.current = next;
      if (!phoneLayoutCustomizedRef.current) {
        setMobileLayout((mobilePrev) => {
          const allWidgets = [...(widgetsRef.current?.length ? widgetsRef.current : widgets), temp];
          const merged = mergeMobileLayoutFromDesktop(allWidgets, next, mobilePrev);
          mobileLayoutRef.current = merged;
          return merged;
        });
      }
      return next;
    });
    setSelectedWidgetId(id);
    setPropertyPanelOpen(true);
  };

  // Nested layout changes update widget state; container shell height is grown by callers.

  const addWidgetInContainer = (containerId, rawType) => {
    captureHistoryBeforeChange();
    const id = `tmp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const type = rawType === "graph" ? "bar" : typeToDisplayType[rawType] || "table";
    let patch = null;

    setWidgets((prev) => {
      const container = prev.find((widget) => String(widget.id) === String(containerId));
      if (!container) return prev;

      if (isPhoneBuilderMode) {
        phoneLayoutCustomizedRef.current = true;
        const mobileNestedSource = getContainerNestedMobileSource(container, prev);
        const containerChildren = prev.filter((entry) => String(entry.containerId) === String(containerId));
        const existingMobilePx = sanitizeNestedLayoutPx(
          Array.isArray(container.mobileNestedLayoutPx) && container.mobileNestedLayoutPx.length
            ? container.mobileNestedLayoutPx
            : (Array.isArray(container.nestedLayoutPx) && container.nestedLayoutPx.length
              ? container.nestedLayoutPx
              : boxesFromChildren(containerChildren, [])),
        );
        const box = placeNextBoxPx(existingMobilePx, defaultBoxForType(rawType));
        const nextMobileNestedPx = [...existingMobilePx, { i: id, ...box }];
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
          linkType: "NONE",
          linkUrl: "",
          linkAppId: "",
          linkPageId: "",
          mobileLayout: mobileNestedItem,
        };

        return [
          ...prev.map((widget) => {
            if (String(widget.id) !== String(containerId)) return widget;
            return {
              ...widget,
              mobileNestedLayout: nextMobileNested,
              mobileNestedLayoutPx: nextMobileNestedPx,
            };
          }),
          temp,
        ];
      }

      const nestedSource = getContainerNestedSource(container, prev);
      const mobileNestedSource = getContainerNestedMobileSource(container, prev);
      const containerChildren = prev.filter((entry) => String(entry.containerId) === String(containerId));
      const existingPx = sanitizeNestedLayoutPx(
        Array.isArray(container.nestedLayoutPx) && container.nestedLayoutPx.length
          ? container.nestedLayoutPx
          : boxesFromChildren(containerChildren, []),
      );
      const box = placeNextBoxPx(existingPx, defaultBoxForType(rawType));
      const nestedPxItem = { i: id, ...box };
      const nextNestedPx = [...existingPx, nestedPxItem];

      const phoneLocked = phoneLayoutCustomizedRef.current;
      let nextMobileNested = mobileNestedSource;
      let mobileNestedItem = null;
      if (!phoneLocked) {
        mobileNestedItem = normalizeNestedLayoutItem(
          placeNextNestedLayoutItem(
            mobileNestedSource,
            buildInitialNestedLayoutForType(rawType, mobileNestedSource.length, id),
          ),
          mobileNestedSource.length,
          id,
          { rawType },
        );
        nextMobileNested = [...mobileNestedSource, mobileNestedItem];
      }
      patch = { nextNested: null, nextNestedPx, nextMobileNested: phoneLocked ? null : nextMobileNested };

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
        style: {
          ...defaultWidgetStyle(rawType),
          boxPx: box,
        },
        emptyText: "Click edit and add query",
        previewData: null,
        previewError: null,
        is_active: true,
        targetPageKey: getDefaultPageKeyForApp(targetAppKey, canAccess, role),
        targetPageModule: null,
        linkType: "NONE",
        linkUrl: "",
        linkAppId: "",
        linkPageId: "",
        ...(mobileNestedItem ? { mobileLayout: mobileNestedItem } : {}),
      };

      return [
        ...prev.map((widget) => {
          if (String(widget.id) !== String(containerId)) return widget;
          return {
            ...widget,
            nestedLayoutPx: nextNestedPx,
            ...(phoneLocked ? {} : { mobileNestedLayout: nextMobileNested }),
          };
        }),
        temp,
      ];
    });

    if (patch) {
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
      const phoneLocked = phoneLayoutCustomizedRef.current;
      const nextMobileNested = phoneLocked
        ? mobileNestedSource
        : [...mobileNestedSource, mobileNestedItem];
      patch = {
        nextNested,
        nextMobileNested: phoneLocked ? null : nextMobileNested,
      };

      return prev.map((entry) => {
        if (String(entry.id) === String(widgetId)) {
          return {
            ...entry,
            containerId,
            sectionId: containerId,
            layout: nestedItem,
            ...(phoneLocked ? {} : { mobileLayout: mobileNestedItem }),
          };
        }
        if (String(entry.id) === String(containerId)) {
          return {
            ...entry,
            nestedLayout: nextNested,
            ...(phoneLocked ? {} : { mobileNestedLayout: nextMobileNested }),
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
    setSelectedWidgetId(widgetId);
    setPropertyPanelOpen(true);
  };

  const cloneWidgetInContainer = (containerId, widget) => {
    if (!widget || !containerId) return;
    captureHistoryBeforeChange();
    const newId = `tmp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const liveWidgets = widgetsRef.current?.length ? widgetsRef.current : widgets;
    const container = liveWidgets.find((entry) => String(entry.id) === String(containerId));
    if (!container) return;

    const containerWidth = Number(container.style?.boxPx?.width)
      || Number((layoutPxRef.current || layoutPx).find((item) => String(item.i) === String(containerId))?.width)
      || 0;
    let clonedForPreview = null;

    if (isPhoneBuilderMode) {
      phoneLayoutCustomizedRef.current = true;
      const mobileNestedSource = getContainerNestedMobileSource(container, liveWidgets);
      const sourceLayout = widget.mobileLayout
        || widget.layout
        || buildInitialNestedLayoutForType(widget.rawType, mobileNestedSource.length, widget.id);
      const preservedW = Math.min(12, Math.max(1, Number(sourceLayout.w) || 12));
      const preservedH = Math.max(1, Number(sourceLayout.h) || 2);
      const slot = findCloneLayoutSlot(
        mobileNestedSource,
        { ...sourceLayout, w: preservedW, h: preservedH },
        12,
      );
      const mobileNestedItem = normalizeNestedLayoutItem(
        { x: 0, y: slot.y, w: preservedW, h: preservedH, i: newId },
        mobileNestedSource.length,
        newId,
        { rawType: widget.rawType || widget.type || "kpi" },
      );
      const nextMobileNested = [...mobileNestedSource, mobileNestedItem];
      const containerChildren = liveWidgets.filter((entry) => String(entry.containerId) === String(containerId));
      const existingMobilePx = sanitizeNestedLayoutPx(
        Array.isArray(container.mobileNestedLayoutPx) && container.mobileNestedLayoutPx.length
          ? container.mobileNestedLayoutPx
          : (Array.isArray(container.nestedLayoutPx) ? container.nestedLayoutPx : boxesFromChildren(containerChildren, [])),
      );
      const sourceBox = existingMobilePx.find((item) => String(item.i) === String(widget.id))
        || defaultBoxForType(widget.rawType || "kpi");
      const box = cloneBoxInContainer(sourceBox, existingMobilePx, containerWidth || PHONE_CONTENT_WIDTH);
      const nextMobileNestedPx = [...existingMobilePx, { i: newId, ...box }];

      const cloned = {
        ...widget,
        id: newId,
        title: `${String(widget.title || "").trim() || widget.rawType || "Widget"} Copy`,
        containerId,
        sectionId: containerId,
        mobileLayout: mobileNestedItem,
        layoutLocked: true,
        previewData: Array.isArray(widget.previewData) ? [...widget.previewData] : (Array.isArray(widget.data) ? [...widget.data] : []),
        previewError: null,
        deviceTarget: "both",
        style: (() => {
          const { layoutWidthPx: _dropW, layoutHeightPx: _dropH, boxPx: _dropBox, ...restStyle } = widget.style || {};
          return { ...restStyle, boxPx: box };
        })(),
      };
      clonedForPreview = cloned;

      setWidgets((prev) => [
        ...prev.map((entry) => {
          if (String(entry.id) !== String(containerId)) return entry;
          return {
            ...entry,
            mobileNestedLayout: nextMobileNested,
            mobileNestedLayoutPx: nextMobileNestedPx,
          };
        }),
        cloned,
      ]);
      setSelectedWidgetId(newId);
      setPropertyPanelOpen(true);
      if (clonedForPreview) {
        queueMicrotask(() => handlePreview(clonedForPreview, { quiet: true }));
      }
      return;
    }

    const nestedSource = getContainerNestedSource(container, liveWidgets);
    const mobileNestedSource = getContainerNestedMobileSource(container, liveWidgets);
    const containerChildren = liveWidgets.filter((entry) => String(entry.containerId) === String(containerId));
    const existingPx = sanitizeNestedLayoutPx(
      Array.isArray(container.nestedLayoutPx) && container.nestedLayoutPx.length
        ? container.nestedLayoutPx
        : boxesFromChildren(containerChildren, []),
    );
    const sourceBox = existingPx.find((item) => String(item.i) === String(widget.id))
      || readWidgetBoxPx(widget, existingPx.length);
    const box = cloneBoxInContainer(sourceBox, existingPx, containerWidth);
    const nestedPxItem = { i: newId, ...box };
    const nextNestedPx = [...existingPx, nestedPxItem];

    const phoneLocked = phoneLayoutCustomizedRef.current;
    let nextMobileNested = mobileNestedSource;
    let mobileNestedItem = null;
    let nextMobileNestedPx = null;
    if (!phoneLocked) {
      mobileNestedItem = normalizeNestedLayoutItem(
        placeNextNestedLayoutItem(
          mobileNestedSource,
          buildInitialNestedLayoutForType(widget.rawType, mobileNestedSource.length, newId),
        ),
        mobileNestedSource.length,
        newId,
        { rawType: widget.rawType || widget.type || "kpi" },
      );
      nextMobileNested = [...mobileNestedSource, mobileNestedItem];
      const existingMobilePx = sanitizeNestedLayoutPx(
        Array.isArray(container.mobileNestedLayoutPx) && container.mobileNestedLayoutPx.length
          ? container.mobileNestedLayoutPx
          : existingPx,
      );
      nextMobileNestedPx = [...existingMobilePx, { i: newId, ...cloneBoxInContainer(sourceBox, existingMobilePx, containerWidth || PHONE_CONTENT_WIDTH) }];
    }

    const cloned = {
      ...widget,
      id: newId,
      title: `${String(widget.title || "").trim() || widget.rawType || "Widget"} Copy`,
      containerId,
      sectionId: containerId,
      ...(mobileNestedItem ? { mobileLayout: mobileNestedItem } : {}),
      layoutLocked: true,
      previewData: Array.isArray(widget.previewData) ? [...widget.previewData] : (Array.isArray(widget.data) ? [...widget.data] : []),
      previewError: null,
      deviceTarget: "both",
      style: (() => {
        const { layoutWidthPx: _dropW, layoutHeightPx: _dropH, ...restStyle } = widget.style || {};
        return { ...restStyle, boxPx: box };
      })(),
    };
    clonedForPreview = cloned;

    setWidgets((prev) => [
      ...prev.map((entry) => {
        if (String(entry.id) !== String(containerId)) return entry;
        return {
          ...entry,
          nestedLayoutPx: nextNestedPx,
          ...(phoneLocked
            ? {}
            : {
              mobileNestedLayout: nextMobileNested,
              ...(nextMobileNestedPx ? { mobileNestedLayoutPx: nextMobileNestedPx } : {}),
            }),
        };
      }),
      cloned,
    ]);
    setSelectedWidgetId(newId);
    setPropertyPanelOpen(true);
    if (clonedForPreview) {
      queueMicrotask(() => handlePreview(clonedForPreview, { quiet: true }));
    }
  };

  const handleNestedLayoutChange = (containerId, nextLayout, isMobile = false, options = {}) => {
    if (isCanvasLocked) return;

    // Pixel layouts come from floating nested canvas on BOTH phone and laptop.
    const isPixelLayout = Array.isArray(nextLayout) && nextLayout.some(
      (item) => Number.isFinite(Number(item.left)) || Number.isFinite(Number(item.width)),
    );
    // Phone builder / phone flag → write only mobile nested stores (never desktop).
    const saveToPhone = Boolean(isPhoneBuilderMode || isMobile);

    if (isPixelLayout) {
      const normalizedPx = sanitizeNestedLayoutPx(nextLayout);
      // Do NOT write pixel boxes into the live grid nested map — that poisons publish grid fallback.
      if (options.interim) return;
      captureHistoryBeforeChange();
      const containerKey = String(containerId);
      if (saveToPhone) phoneLayoutCustomizedRef.current = true;
      setWidgets((prev) => {
        const nextWidgets = prev.map((widget) => {
          if (String(widget.id) === containerKey) {
            return saveToPhone
              ? { ...widget, mobileNestedLayoutPx: normalizedPx }
              : { ...widget, nestedLayoutPx: normalizedPx };
          }
          const parentRef = String(widget.containerId || widget.sectionId || "");
          if (parentRef !== containerKey) return widget;
          // Nested child boxPx is laptop-only; phone must not overwrite it.
          if (saveToPhone) return widget;
          const matched = normalizedPx.find((item) => String(item.i) === String(widget.id));
          if (!matched) return widget;
          const { left, top, width, height } = matched;
          const { layoutWidthPx: _dropW, layoutHeightPx: _dropH, ...restStyle } = widget.style || {};
          return {
            ...widget,
            layoutLocked: true,
            style: {
              ...restStyle,
              boxPx: { left, top, width, height },
            },
          };
        });

        return nextWidgets;
      });
      return;
    }

    const containerChildren = widgets.filter((entry) => String(entry.containerId) === String(containerId));
    const normalized = (nextLayout || []).map((item, idx) => {
      const child = containerChildren.find((entry) => String(entry.id) === String(item.i));
      return normalizeNestedLayoutItem(item, idx, item.i, {
        rawType: child?.rawType || child?.type || "kpi",
      });
    });
    getLiveNestedMap(saveToPhone).set(String(containerId), normalized);
    if (options.interim) return;
    captureHistoryBeforeChange();
    const containerKey = String(containerId);
    if (saveToPhone) phoneLayoutCustomizedRef.current = true;
    setWidgets((prev) => {
      const nextWidgets = prev.map((widget) => {
        if (String(widget.id) === containerKey) {
          return saveToPhone
            ? { ...widget, mobileNestedLayout: normalized }
            : { ...widget, nestedLayout: normalized };
        }
        if (String(widget.containerId) !== containerKey) return widget;
        const matched = normalized.find((item) => String(item.i) === String(widget.id));
        if (!matched) return widget;
        const { layoutWidthPx: _dropW, layoutHeightPx: _dropH, ...restStyle } = widget.style || {};
        return {
          ...widget,
          ...(saveToPhone ? { mobileLayout: matched } : { layout: matched }),
          layoutLocked: true,
          style: restStyle,
        };
      });

      const container = nextWidgets.find((widget) => String(widget.id) === containerKey);
      if (container && !saveToPhone) {
        const locked = readNestedGridWidthPx(container);
        const needed = inferNestedContentCanvasWidthPx(normalized, locked ?? undefined);
        if (needed != null && (locked == null || needed > locked)) {
          const nextWidth = locked == null ? needed : Math.max(locked, needed);
          const idx = nextWidgets.findIndex((widget) => String(widget.id) === containerKey);
          if (idx >= 0) {
            nextWidgets[idx] = {
              ...nextWidgets[idx],
              style: {
                ...(nextWidgets[idx].style || {}),
                nestedGridWidthPx: nextWidth,
              },
            };
          }
        }
      }
      const containerForHeight = nextWidgets.find((widget) => String(widget.id) === containerKey);
      const shouldSyncHeight = containerForHeight
        && !shouldPreserveSavedLayout(containerForHeight)
        && !manualSizedWidgetIdsRef.current.has(containerKey);
      if (shouldSyncHeight) {
        const nestedForHeight = saveToPhone
          ? (containerForHeight.mobileNestedLayout || normalized)
          : (containerForHeight.nestedLayout || normalized);
        const autoH = containerAutoGridHeight(
          { ...containerForHeight, nestedLayout: nestedForHeight },
          nestedForHeight,
          { allWidgets: nextWidgets },
        );
        const patchContainerHeight = (layoutItems) =>
          layoutItems.map((item, idx) => (
            String(item.i) === containerKey
              ? normalizeLayoutItem(
                { ...item, h: resolveContainerGridHeight(autoH, item.h, { locked: false }) },
                idx,
                containerKey,
              )
              : item
          ));
        if (saveToPhone) {
          setMobileLayout((current) => {
            const updated = patchContainerHeight(current);
            mobileLayoutRef.current = updated;
            return updated;
          });
        } else {
          setLayout((current) => {
            const updated = patchContainerHeight(current);
            layoutRef.current = updated;
            return updated;
          });
        }
      }

      return nextWidgets;
    });
  };

  const syncLayoutFromCanvas = (sourceLayout = [], options = {}) => {
    const { lockResizedContainerId = null } = options;
    if (isCanvasLocked) return;
    const normalizedNext = (sourceLayout || []).map((l, idx) => {
      if (!isPhoneBuilderMode) {
        const widget = widgets.find((entry) => String(entry.id) === String(l.i));
        if (widget?.rawType === "container") {
          const [clamped] = clampLayoutInBounds([l], BUILDER_GRID_COLS);
          return normalizeLayoutItem(clamped, idx, l.i);
        }
        const [clamped] = clampLayoutInBounds([l], BUILDER_GRID_COLS);
        return normalizeLayoutItem(clamped, idx, l.i);
      }
      return normalizeLayoutItem(l, idx, l.i);
    });
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
        if (!matched) return w;
        if (w.rawType === "container") {
          const inferredPreset = inferContainerPresetFromLayout(
            matched,
            isPhoneBuilderMode ? GRID_COLS : BUILDER_GRID_COLS,
          );
          const nextH = Math.max(1, Number(matched.h) || 1);
          const nextW = Math.max(1, Number(matched.w) || 1);
          const preserve = shouldPreserveSavedLayout(w)
            || manualSizedWidgetIdsRef.current.has(String(w.id))
            || (lockResizedContainerId && String(w.id) === String(lockResizedContainerId));
          const shellPixels = mainGridLayoutToPixels(
            { ...matched, h: nextH, w: nextW },
            {
              colWidth,
              rowHeight: GRID_ROW_HEIGHT,
              gapX: GRID_GAP_X,
              gapY: GRID_GAP_Y,
            },
          );
          const { layoutWidthPx: _dropW, ...restStyle } = w.style || {};
          return {
            ...w,
            layout: { ...matched, h: nextH, w: nextW },
            containerPreset: inferredPreset,
            layoutLocked: preserve || lockResizedContainerId === String(w.id),
            style: {
              ...restStyle,
              ...(preserve || lockResizedContainerId === String(w.id)
                ? {
                  layoutHeightPx: shellPixels.heightPx,
                  ...(shellPixels.widthPx != null ? { layoutWidthPx: shellPixels.widthPx } : {}),
                }
                : {}),
            },
          };
        }
        if (lockResizedContainerId && String(w.id) === String(lockResizedContainerId)) {
          const shellPixels = mainGridLayoutToPixels(matched, {
            colWidth,
            rowHeight: GRID_ROW_HEIGHT,
            gapX: GRID_GAP_X,
            gapY: GRID_GAP_Y,
          });
          const { layoutWidthPx: _dropW, layoutHeightPx: _dropH, ...restStyle } = w.style || {};
          return {
            ...w,
            layout: matched,
            layoutLocked: true,
            style: {
              ...restStyle,
              ...(shellPixels.widthPx != null ? { layoutWidthPx: shellPixels.widthPx } : {}),
              ...(shellPixels.heightPx != null ? { layoutHeightPx: shellPixels.heightPx } : {}),
            },
          };
        }
        return { ...w, layout: matched };
      }),
    );
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
    // Style-only payloads from PropertyPanel send a small key set (id/type/style/...).
    // Full widget objects always include query/dataSource/etc — never treat those as style-only
    // or SQL / hybrid chart_config edits get silently discarded.
    const STYLE_ONLY_KEYS = new Set(["id", "rawType", "type", "style", "title", "emptyText"]);
    const updatedKeys = Object.keys(updatedWidget || {});
    const styleOnly = Boolean(updatedWidget?.style)
      && updatedKeys.length > 0
      && updatedKeys.every((key) => STYLE_ONLY_KEYS.has(key));

    const commitWidgets = () => {
      setWidgets((prev) => {
        let changed = false;
        const next = prev.map((w) => {
          if (String(w.id) !== String(updatedWidget.id)) return w;
          const merged = {
            ...w,
            ...updatedWidget,
            style: {
              ...(w.style || {}),
              ...(updatedWidget.style || {}),
            },
            chart_config: updatedWidget.chart_config
              ? {
                ...(w.chart_config || {}),
                ...updatedWidget.chart_config,
              }
              : w.chart_config,
            layout: updatedWidget.layout
              ? { ...(w.layout || {}), ...updatedWidget.layout }
              : w.layout,
            mobileLayout: updatedWidget.mobileLayout
              ? { ...(w.mobileLayout || {}), ...updatedWidget.mobileLayout }
              : w.mobileLayout,
          };
          if (
            styleOnly
            && JSON.stringify(w.style || {}) === JSON.stringify(merged.style || {})
            && w.title === merged.title
            && w.emptyText === merged.emptyText
            && w.type === merged.type
          ) {
            return w;
          }
          changed = true;
          return merged;
        });
        return changed ? next : prev;
      });
    };

    if (styleOnly) {
      startTransition(commitWidgets);
      return;
    }

    commitWidgets();
    if (updatedWidget.rawType === "container" && updatedWidget.containerPreset) {
      manualSizedWidgetIdsRef.current.add(String(updatedWidget.id));
      const presetW = updatedWidget.containerPreset === "half" ? BUILDER_GRID_COLS / 2 : BUILDER_GRID_COLS;
      setLayout((prev) => {
        const next = prev.map((l, idx) => {
          if (String(l.i) !== String(updatedWidget.id)) return l;
          const containerLayout = applyDesktopContainerLayout(updatedWidget, { ...l, w: presetW }, BUILDER_GRID_COLS);
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
      if (!layoutPatch || typeof layoutPatch !== "object") return;
      const hasLayoutKeys = ["x", "y", "w", "h"].some((key) => layoutPatch[key] != null);
      if (!hasLayoutKeys) return;
      const applyPatch = (prev) => {
        const current = prev.find((l) => String(l.i) === String(updatedWidget.id));
        if (
          current
          && Number(current.x) === Number(layoutPatch.x ?? current.x)
          && Number(current.y) === Number(layoutPatch.y ?? current.y)
          && Number(current.w) === Number(layoutPatch.w ?? current.w)
          && Number(current.h) === Number(layoutPatch.h ?? current.h)
        ) {
          return prev;
        }
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

  const handlePreview = async (widget, options = {}) => {
    const quiet = options?.quiet === true;
    try {
      if (!requiresDataQuery(widget.rawType) || !isConfiguredWidgetQuery(widget.query)) {
        // Keep any existing rows (e.g. copied preview from clone) — don't force empty.
        setWidgets((prev) =>
          prev.map((w) => {
            if (String(w.id) !== String(widget.id)) return w;
            const hasRows = Array.isArray(w.previewData) && w.previewData.length > 0;
            const hasLive = Array.isArray(w.data) && w.data.length > 0;
            if (hasRows || hasLive) return { ...w, previewError: null };
            return { ...w, previewData: w.previewData ?? [], previewError: null };
          }),
        );
        return;
      }
      if (!quiet) setBusy(true);

      let res;
      if (isWidgetHybridMode(widget)) {
        res = await hybridPreviewWidget({
          mssql_query: widget.chart_config?.hybrid_mssql_query || "",
          pg_query: widget.query || "",
          db_source: resolveHybridExternalDbSource(widget),
          filters,
        });
      } else {
        res = await previewWidget(widget.query, {
          dbSource: widget.dataSource || "ims_postgresql",
          filters,
        });
      }

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
            ? { ...w, previewError: err.message || "Preview failed." }
            : w,
        ),
      );
    } finally {
      if (!quiet) setBusy(false);
    }
  };

  const handleSaveWidget = async (widget, options = {}) => {
    const widgetForSave = {
      ...widget,
      layoutLocked: widget.layoutLocked === true
        || options?.widthPx != null
        || options?.heightPx != null,
      style: {
        ...(widget.style || {}),
        ...(options?.widthPx != null && Number.isFinite(Number(options.widthPx))
          ? { layoutWidthPx: Math.round(Number(options.widthPx)) }
          : {}),
        ...(options?.heightPx != null && Number.isFinite(Number(options.heightPx))
          ? { layoutHeightPx: Math.round(Number(options.heightPx)) }
          : {}),
      },
    };
    const liveDesktopLayout = layoutRef.current?.length ? layoutRef.current : layout;
    const liveMobileLayout = mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout;
    let desktopSource = widgetForSave.containerId
      ? (widgetForSave.layout && typeof widgetForSave.layout === "object" ? widgetForSave.layout : normalizeLayoutItem({}, 0, widgetForSave.id))
      : (liveDesktopLayout.find((l) => String(l.i) === String(widgetForSave.id))
        || widgetForSave.layout
        || normalizeLayoutItem({}, 0, widgetForSave.id));
    if (widgetForSave.rawType === "container" && !widgetForSave.containerId && !isPhoneBuilderMode) {
      desktopSource = {
        ...desktopSource,
        h: resolveContainerDisplayHeight(widgetForSave, desktopSource, widgets),
      };
    }
    const mobileSource = widgetForSave.containerId
      ? (widgetForSave.mobileLayout && typeof widgetForSave.mobileLayout === "object" ? widgetForSave.mobileLayout : desktopSource)
      : (liveMobileLayout.find((l) => String(l.i) === String(widgetForSave.id))
        || widgetForSave.mobileLayout
        || desktopSource);

    const buildResolvedLayout = (sourceLayout, applySizeOptions = false) => {
      const withPixelSize = normalizeLayoutItem(
        {
          ...sourceLayout,
          w: applySizeOptions && options?.widthPx != null ? pixelToGridW(options.widthPx) : sourceLayout.w,
          h: applySizeOptions && options?.heightPx != null ? pixelToGridH(options.heightPx) : sourceLayout.h,
        },
        0,
        widgetForSave.id,
      );
      return normalizeLayoutItem(enforceLayoutByType(widgetForSave.rawType, withPixelSize), 0, widgetForSave.id);
    };

    const resolvedDesktopLayout = buildResolvedLayout(desktopSource, !isPhoneBuilderMode);
    const resolvedMobileLayout = buildResolvedLayout(mobileSource, isPhoneBuilderMode);
    const payload = {
      title: widgetForSave.title,
      description: widgetForSave.description || "",
      type: resolveApiType(widgetForSave),
      query: requiresDataQuery(widgetForSave.rawType) ? widgetForSave.query || "" : "",
      audience_scope: widgetForSave.audienceScope || "global",
      target_user_ids: Array.isArray(widgetForSave.targetUserIds) ? widgetForSave.targetUserIds : [],
      chart_config: chartConfigFromWidgetStyle(widgetForSave),
      app_key: targetAppKey,
      page_key: DASHBOARD_STORAGE_PAGE_KEY,
      target_page_key: widgetForSave.targetPageKey || "dashboard",
      target_page_module: widgetForSave.targetPageModule || null,
      dashboard_key: selectedDashboardKey,
      dashboard_name: selectedDashboardLabel,
      dashboard_scope: dashboardScopeForSave,
      dashboard_target_user_ids: dashboardTargetUsersForSave,
      layout: resolvedDesktopLayout,
      mobile_layout: resolvedMobileLayout,
      device_target: "both",
      is_active: widgetForSave.is_active !== false,
      is_published: false,
    };
    if (widgetForSave.containerId) {
      payload.section_id = widgetForSave.containerId;
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

      if (widget.containerId) {
        const parentId = String(widget.containerId);
        const parent = widgets.find((entry) => String(entry.id) === parentId);
        const childId = String(saved.id);
        if (parent && !String(parent.id).startsWith("tmp_")) {
          const patchNestedList = (items = []) =>
            items.map((item, idx) =>
              String(item.i) === String(widget.id) || String(item.i) === childId
                ? normalizeLayoutItem({ ...item, ...resolvedDesktopLayout, i: childId }, idx, childId)
                : item,
            );
          const nextNested = patchNestedList(parent.nestedLayout || []);
          const nextMobileNested = patchNestedList(
            Array.isArray(parent.mobileNestedLayout) && parent.mobileNestedLayout.length
              ? parent.mobileNestedLayout
              : nextNested,
          );
          try {
            await updateWidgetApi(parent.id, {
              title: parent.title || "",
              description: parent.description || "",
              type: "section",
              query: "",
              audience_scope: parent.audienceScope || "global",
              target_user_ids: Array.isArray(parent.targetUserIds) ? parent.targetUserIds : [],
              chart_config: {
                ...chartConfigFromWidgetStyle({
                  ...parent,
                  nestedLayout: nextNested,
                  mobileNestedLayout: nextMobileNested,
                }),
              },
              app_key: targetAppKey,
              page_key: DASHBOARD_STORAGE_PAGE_KEY,
              target_page_key: parent.targetPageKey || "dashboard",
              target_page_module: parent.targetPageModule || null,
              dashboard_key: selectedDashboardKey,
              layout: parent.layout,
              mobile_layout: parent.mobileLayout || parent.layout,
              device_target: "both",
              is_active: parent.is_active !== false,
              is_published: false,
            });
          } catch (_parentSyncError) {
            // Parent nested_layout will still sync on Save Draft / Publish.
          }
        }
      }

      const remapNestedItems = (items = []) =>
        items.map((item, idx) => {
          const isMatch = String(item.i) === String(widget.id) || String(item.i) === String(saved.id);
          if (!isMatch) return item;
          return normalizeLayoutItem(
            { ...item, ...resolvedDesktopLayout, i: String(saved.id) },
            idx,
            saved.id,
          );
        });
      const remapNestedPxItems = (items = []) =>
        sanitizeNestedLayoutPx(
          (items || []).map((item) => (
            String(item.i) === String(widget.id) || String(item.i) === String(saved.id)
              ? { ...item, i: String(saved.id) }
              : item
          )),
        );

      setWidgets((prev) =>
        prev.map((w) => {
          if (String(w.id) === String(widget.containerId)) {
            return {
              ...w,
              nestedLayout: remapNestedItems(w.nestedLayout || []),
              mobileNestedLayout: remapNestedItems(w.mobileNestedLayout || []),
              nestedLayoutPx: remapNestedPxItems(w.nestedLayoutPx || []),
              mobileNestedLayoutPx: remapNestedPxItems(w.mobileNestedLayoutPx || []),
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
              tableSearchEnabled: saved?.chart_config?.table_search_enabled === true,
              tableSearchPlaceholder: String(saved?.chart_config?.table_search_placeholder || "").trim(),
              tableSearchPosition: normalizeTableSearchPosition(saved?.chart_config?.table_search_position),
              tableSearchWidth: normalizeTableSearchWidth(saved?.chart_config?.table_search_width),
              tableColumnSortEnabled: saved?.chart_config?.table_column_sort_enabled === true,
              tableExportEnabled: saved?.chart_config?.table_export_enabled === true,
              dataSource: saved?.chart_config?.data_source || "ims_postgresql",
              audienceScope: saved?.audience_scope || "global",
              targetUserIds: Array.isArray(saved?.target_user_ids) ? saved.target_user_ids : [],
              sectionId: saved?.chart_config?.section_id ?? w.containerId ?? null,
              containerId: saved?.chart_config?.section_id ?? w.containerId ?? null,
              layoutLocked: widgetForSave.layoutLocked === true || saved?.chart_config?.layout_locked === true,
              targetPageKey: saved?.target_page_key || widgetForSave.targetPageKey || "dashboard",
              targetPageModule: saved?.target_page_module || widgetForSave.targetPageModule || null,
              linkType: String(saved?.chart_config?.link_type || widgetForSave.linkType || "NONE").toUpperCase() === "APP"
                ? "APP"
                : String(saved?.chart_config?.link_type || widgetForSave.linkType || "NONE").toUpperCase() === "URL"
                  ? "URL"
                  : "NONE",
              linkUrl: String(saved?.chart_config?.link_url || widgetForSave.linkUrl || "").trim(),
              linkAppId: String(saved?.chart_config?.link_app_id || widgetForSave.linkAppId || "").trim(),
              linkPageId: String(saved?.chart_config?.link_page_id || widgetForSave.linkPageId || "").trim(),
              deviceTarget: normalizeWidgetDeviceTarget(saved?.device_target || widgetForSave.deviceTarget),
              layout: resolvedDesktopLayout,
              mobileLayout: resolvedMobileLayout,
              style: {
                ...mergeWidgetStyle(
                  saved.type === "count" || saved.type === "sum" ? "kpi" : saved.type === "section" ? "container" : saved.type,
                  saved?.chart_config,
                ),
                ...(widgetForSave.style || {}),
              },
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
        if (USE_FLOATING_BUILDER) {
          const nextPx = sanitizeNestedLayoutPx(
            (layoutPxRef.current?.length ? layoutPxRef.current : layoutPx).map((item) => (
              String(item.i) === String(widget.id) ? { ...item, i: String(saved.id) } : item
            )),
          );
          layoutPxRef.current = nextPx;
          setLayoutPx(nextPx);
          const nextMobilePx = sanitizeNestedLayoutPx(
            (layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile).map((item) => (
              String(item.i) === String(widget.id) ? { ...item, i: String(saved.id) } : item
            )),
          );
          layoutPxMobileRef.current = nextMobilePx;
          setLayoutPxMobile(nextMobilePx);
        }
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
            nestedLayoutPx: (entry.nestedLayoutPx || []).filter((item) => !removedIds.has(String(item.i))),
            mobileNestedLayout: (entry.mobileNestedLayout || []).filter((item) => !removedIds.has(String(item.i))),
            mobileNestedLayoutPx: (entry.mobileNestedLayoutPx || []).filter((item) => !removedIds.has(String(item.i))),
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
    if (USE_FLOATING_BUILDER) {
      const nextPx = sanitizeNestedLayoutPx(
        (layoutPxRef.current?.length ? layoutPxRef.current : layoutPx).filter((item) => !removedIds.has(String(item.i))),
      );
      layoutPxRef.current = nextPx;
      setLayoutPx(nextPx);
      const nextMobilePx = sanitizeNestedLayoutPx(
        (layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile).filter((item) => !removedIds.has(String(item.i))),
      );
      layoutPxMobileRef.current = nextMobilePx;
      setLayoutPxMobile(nextMobilePx);
    }
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
    const sourceWidgets = widgetsRef.current?.length ? widgetsRef.current : widgets;
    const preferPhoneNestedLive = builderDeviceMode === BUILDER_DEVICE_MOBILE;
    const syncedWidgets = hydrateContainerNestedLayouts(
      sourceWidgets.map((widget) => {
        if (widget.rawType !== "container") return widget;
        const nestedLayout = preferPhoneNestedLive
          ? (Array.isArray(widget.nestedLayout) && widget.nestedLayout.length
            ? sanitizeNestedLayoutItems([...widget.nestedLayout])
            : getContainerNestedSource(widget, sourceWidgets))
          : getContainerNestedSource(widget, sourceWidgets);
        if (!preferPhoneNestedLive) {
          liveContainerNestedLayoutsRef.desktop.set(String(widget.id), nestedLayout);
        }
        return {
          ...widget,
          nestedLayout,
          mobileNestedLayout: getContainerNestedMobileSource(widget, sourceWidgets, { preferLiveNested: preferPhoneNestedLive }),
        };
      }),
    );
    const liveLayout = layoutRef.current?.length ? layoutRef.current : layout;
    const liveMobile = mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout;
    const topLevelIds = new Set(
      syncedWidgets.filter((widget) => isTopLevelCanvasWidget(widget)).map((widget) => String(widget.id)),
    );
    const publishLayoutPx = mergeLayoutPxFromWidgets(
      layoutPxRef.current?.length ? layoutPxRef.current : layoutPx,
      syncedWidgets,
    );
    layoutPxRef.current = publishLayoutPx;

    // Floating builder: derive storage grid from pixel boxes so fallback/phone stay aligned.
    let publishLayout;
    if (USE_FLOATING_BUILDER && publishLayoutPx.length) {
      const designW = Math.max(
        320,
        Number(designCanvasWidthRef.current)
          || Number(canvasWidth)
          || 1200,
      );
      const storageColWidth = Math.max(
        8,
        (designW - GRID_GAP_X * (GRID_COLS - 1)) / GRID_COLS,
      );
      publishLayout = clampLayoutInBounds(
        publishLayoutPx.map((box, idx) => normalizeLayoutItem(
          boxPxToGridItem(box, box.i, {
            colWidth: storageColWidth,
            rowHeight: GRID_ROW_HEIGHT,
            gapX: GRID_GAP_X,
            gapY: GRID_GAP_Y,
            cols: GRID_COLS,
          }),
          idx,
          box.i,
        )),
        GRID_COLS,
      );
    } else {
      // Publish: keep builder grid coords as-is (no auto-height / repack) for pixel-perfect parity.
      publishLayout = clampLayoutInBounds(
        scaleLayoutCoordsToStorage(
          liveLayout
            .filter((item) => topLevelIds.has(String(item?.i || item?.id)))
            .map((item, idx) => {
              const widget = syncedWidgets.find((entry) => String(entry.id) === String(item.i));
              if (widget?.rawType === "container") {
                const containerLayout = applyDesktopContainerLayout(widget, item, GRID_COLS);
                return normalizeLayoutItem(
                  {
                    ...item,
                    i: String(item.i),
                    x: containerLayout.x,
                    w: containerLayout.w,
                    y: Math.max(0, Number(item.y) || 0),
                    h: Math.max(1, Number(item.h) || 1),
                  },
                  idx,
                  item.i,
                );
              }
              return normalizeLayoutItem(
                { ...(item || {}), i: String(item?.i || item?.id || `layout_${idx}`) },
                idx,
                item?.i || item?.id,
              );
            }),
        ),
        GRID_COLS,
      );
    }
    let publishMobileLayout = clampLayoutInBounds(
      liveMobile
        .filter((item) => topLevelIds.has(String(item?.i || item?.id)))
        .map((item, idx) => ({
          ...(item || {}),
          i: String(item?.i || item?.id || `mobile_layout_${idx}`),
        })),
      GRID_COLS,
    ).map((item, idx) => normalizeLayoutItem(item, idx, item.i));
    const topLevelWidgets = syncedWidgets.filter((widget) => isTopLevelCanvasWidget(widget));
    if (!hasCustomTopLevelMobileLayout(publishLayout, publishMobileLayout, syncedWidgets)) {
      publishMobileLayout = stackLayoutForPhone(topLevelWidgets, publishLayout, GRID_COLS).map((item, idx) =>
        normalizeLayoutItem(item, idx, item.i),
      );
    }
    const widgetsForJson = syncedWidgets.map((widget) => {
      const isManual = manualSizedWidgetIdsRef.current.has(String(widget.id)) && widget.layoutLocked === true;
      const isNestedChild = Boolean(widget.containerId || widget.sectionId);
      const isContainer = widget.rawType === "container" && !isNestedChild;
      if (isManual) {
        if (isContainer) {
          const layoutItem = publishLayout.find((entry) => String(entry.i) === String(widget.id)) || widget.layout || {};
          const pixelStyle = mainLayoutItemPixelStyle(layoutItem);
          const { layoutWidthPx: _dropW, ...restStyle } = widget.style || {};
          const matchedPx = publishLayoutPx.find((item) => String(item.i) === String(widget.id));
          const children = syncedWidgets.filter(
            (child) => String(child.containerId || child.sectionId) === String(widget.id),
          );
          const nestedLayoutPx = boxesFromChildren(
            children,
            Array.isArray(widget.nestedLayoutPx) ? widget.nestedLayoutPx : [],
          );
          return {
            ...widget,
            nestedLayout: getContainerNestedSource(widget, syncedWidgets),
            nestedLayoutPx,
            mobileNestedLayout: getContainerNestedMobileSource(widget, syncedWidgets, { preferLiveNested: preferPhoneNestedLive }),
            layoutLocked: true,
            style: {
              ...restStyle,
              layoutHeightPx: pixelStyle.heightPx,
              ...(matchedPx
                ? { boxPx: { left: matchedPx.left, top: matchedPx.top, width: matchedPx.width, height: matchedPx.height } }
                : {}),
            },
          };
        }
        const matchedPx = publishLayoutPx.find((item) => String(item.i) === String(widget.id));
        if (matchedPx) {
          return {
            ...widget,
            style: {
              ...(widget.style || {}),
              boxPx: { left: matchedPx.left, top: matchedPx.top, width: matchedPx.width, height: matchedPx.height },
            },
          };
        }
        return widget;
      }
      const { layoutWidthPx: _dropW, layoutHeightPx, ...portableStyle } = widget.style || {};
      const nextStyle = { ...portableStyle };
      // Nested widget size lives in parent nested_layout grid coords only.
      if (isContainer) {
        const layoutItem = publishLayout.find((entry) => String(entry.i) === String(widget.id)) || widget.layout || {};
        const pixelStyle = mainLayoutItemPixelStyle(layoutItem);
        nextStyle.layoutHeightPx = pixelStyle.heightPx;
      } else if (!isNestedChild && layoutHeightPx != null) {
        nextStyle.layoutHeightPx = layoutHeightPx;
      }
      // Floating builder: keep pixel box + lock so publish/live match the canvas.
      if (USE_FLOATING_BUILDER && !isNestedChild) {
        const matchedPx = publishLayoutPx.find((item) => String(item.i) === String(widget.id));
        if (matchedPx) {
          nextStyle.boxPx = {
            left: matchedPx.left,
            top: matchedPx.top,
            width: matchedPx.width,
            height: matchedPx.height,
          };
        } else if (widget.style?.boxPx) {
          nextStyle.boxPx = { ...widget.style.boxPx };
        }
      }
      if (USE_FLOATING_BUILDER && isNestedChild) {
        const parent = syncedWidgets.find((entry) => String(entry.id) === String(widget.containerId || widget.sectionId));
        const nestedPx = Array.isArray(parent?.nestedLayoutPx)
          ? parent.nestedLayoutPx.find((item) => String(item.i) === String(widget.id))
          : null;
        if (nestedPx) {
          nextStyle.boxPx = {
            left: nestedPx.left,
            top: nestedPx.top,
            width: nestedPx.width,
            height: nestedPx.height,
          };
        } else if (widget.style?.boxPx) {
          nextStyle.boxPx = { ...widget.style.boxPx };
        }
      }
      const nextWidget = {
        ...widget,
        layoutLocked: isNestedChild || isContainer || (USE_FLOATING_BUILDER && !isNestedChild)
          ? true
          : (widget.layoutLocked === true),
        style: nextStyle,
        ...(isContainer
          ? {
            nestedLayout: getContainerNestedSource(widget, syncedWidgets),
            nestedLayoutPx: (() => {
              const children = syncedWidgets.filter(
                (child) => String(child.containerId || child.sectionId) === String(widget.id),
              );
              return boxesFromChildren(
                children,
                Array.isArray(widget.nestedLayoutPx) ? widget.nestedLayoutPx : [],
              );
            })(),
            mobileNestedLayoutPx: Array.isArray(widget.mobileNestedLayoutPx)
              ? sanitizeNestedLayoutPx(widget.mobileNestedLayoutPx)
              : [],
            mobileNestedLayout: getContainerNestedMobileSource(widget, syncedWidgets, { preferLiveNested: preferPhoneNestedLive }),
          }
          : {}),
      };
      return nextWidget;
    });
    const dashboardWidgets = widgetsForJson.map((widget) => {
      const isNestedChild = Boolean(widget.containerId || widget.sectionId);
      const isContainer = widget.rawType === "container" && !isNestedChild;
      const parentContainer = isNestedChild
        ? syncedWidgets.find((entry) => String(entry.id) === String(widget.containerId || widget.sectionId))
        : null;
      const nestedMobileItem = isNestedChild
        ? (parentContainer?.mobileNestedLayout || []).find((item) => String(item.i) === String(widget.id))
        : null;
      const nestedDesktopItem = isNestedChild
        ? mergeNestedItemFromChild(
          widget,
          (parentContainer?.nestedLayout || []).find((item) => String(item.i) === String(widget.id)) || {},
        )
        : null;
      const currentLayout = isNestedChild
        ? (nestedDesktopItem
          || (widget.layout && typeof widget.layout === "object" ? widget.layout : normalizeLayoutItem({}, 0, widget.id)))
        : (publishLayout.find((l) => String(l.i) === String(widget.id)) || widget.layout || normalizeLayoutItem({}, 0, widget.id));
      let currentMobileLayout = isNestedChild
        ? nestedMobileItem
        : (publishMobileLayout.find((l) => String(l.i) === String(widget.id)) || null);
      if (isNestedChild && !currentMobileLayout) {
        const parentDesktopNested = parentContainer
          ? getContainerNestedSource(parentContainer, syncedWidgets)
          : [];
        const parentMobileNested = parentContainer
          ? getContainerNestedMobileSource(parentContainer, syncedWidgets, { preferLiveNested: preferPhoneNestedLive })
          : [];
        const phoneNested = resolvePhoneNestedLayoutForDisplay(parentDesktopNested, parentMobileNested);
        currentMobileLayout = phoneNested.find((item) => String(item.i) === String(widget.id)) || null;
      } else if (!isNestedChild && !currentMobileLayout) {
        currentMobileLayout = publishMobileLayout.find((l) => String(l.i) === String(widget.id)) || null;
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
      const { layoutWidthPx: _dropNestedW, layoutHeightPx: _dropNestedH, ...nestedBaseStyle } = widget.style || {};
      let widgetForJson = { ...widget, style: nestedBaseStyle };
      if (isContainer) {
        const pixelStyle = mainLayoutItemPixelStyle(resolvedLayout);
        const { layoutWidthPx: _dropCw, ...containerStyle } = widgetForJson.style || {};
        widgetForJson = {
          ...widgetForJson,
          layoutLocked: true,
          style: {
            ...containerStyle,
            layoutHeightPx: pixelStyle.heightPx,
          },
        };
      }
      return {
        ...normalizeWidgetForDashboardJson(widgetForJson, resolvedLayout, {
          persistManualLayout: USE_FLOATING_BUILDER
            || isContainer
            || (manualSizedWidgetIdsRef.current.has(String(widget.id)) && widget.layoutLocked === true),
          persistNestedPixelLayout: USE_FLOATING_BUILDER || isContainer,
          lockNestedLayout: isNestedChild || isContainer || USE_FLOATING_BUILDER,
        }),
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
        layout_px: publishLayoutPx,
        canvas_width: (() => {
          const bounds = contentBoundsPx(publishLayoutPx, 0);
          return Math.max(320, bounds.width);
        })(),
        ...(USE_FLOATING_BUILDER && (
          layoutPxMobileRef.current?.length || layoutPxMobile?.length || phoneLayoutCustomizedRef.current
        ) ? {
          layout_px_mobile: ensurePhoneLayoutPx(
            (widgets || []).filter((widget) => isTopLevelCanvasWidget(widget)),
            layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile,
            { phoneWidth: PHONE_BUILDER_WIDTH, desktopPx: publishLayoutPx },
          ),
          canvas_width_mobile: PHONE_BUILDER_WIDTH,
        } : {}),
        widgets: dashboardWidgets,
      },
    };
  };

  const handleBuilderDeviceModeChange = (nextMode) => {
    const normalizedMode = nextMode === BUILDER_DEVICE_MOBILE ? BUILDER_DEVICE_MOBILE : BUILDER_DEVICE_DESKTOP;
    if (normalizedMode === builderDeviceMode) return;

    const liveLayout = (layoutRef.current?.length ? layoutRef.current : layout).map((item) => ({ ...item }));
    const liveMobileLayout = (mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout).map((item) => ({ ...item }));

    const syncTopLevelLayoutsOnWidgets = (widgetList, desktopItems, mobileItems) =>
      widgetList.map((widget) => {
        if (!isTopLevelCanvasWidget(widget)) return widget;
        const desktopItem = desktopItems.find((item) => String(item.i) === String(widget.id));
        const mobileItem = mobileItems.find((item) => String(item.i) === String(widget.id));
        return {
          ...widget,
          ...(desktopItem ? { layout: { ...desktopItem } } : {}),
          ...(mobileItem ? { mobileLayout: { ...mobileItem } } : {}),
        };
      });

    if (normalizedMode === BUILDER_DEVICE_MOBILE) {
      const mergedMobile = hasCustomPhoneLayout(widgets, liveLayout, liveMobileLayout)
        ? mergeMobileLayoutFromDesktop(widgets, liveLayout, liveMobileLayout)
        : initMobileLayoutFromDesktop(widgets, liveLayout);
      mobileLayoutRef.current = mergedMobile;
      setMobileLayout(mergedMobile);

      // Floating phone canvas: always seed from laptop scaled to 390 when
      // there is no real phone layout yet, or when saved phone px is still desktop-wide.
      if (USE_FLOATING_BUILDER) {
        const desktopPx = sanitizeNestedLayoutPx(
          (layoutPxRef.current?.length ? layoutPxRef.current : layoutPx) || [],
        );
        const existingMobilePx = sanitizeNestedLayoutPx(
          (layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile) || [],
        );
        const existingBounds = existingMobilePx.length ? contentBoundsPx(existingMobilePx, 0) : { width: 0 };
        const hasRealPhoneLayout = phoneLayoutCustomizedRef.current
          && existingMobilePx.length
          && existingBounds.width <= PHONE_BUILDER_WIDTH + 48;

        if (hasRealPhoneLayout) {
          const completed = ensurePhoneLayoutPx(
            (widgets || []).filter((widget) => isTopLevelCanvasWidget(widget)),
            existingMobilePx,
            { phoneWidth: PHONE_BUILDER_WIDTH, desktopPx },
          );
          layoutPxMobileRef.current = completed;
          setLayoutPxMobile(completed);
          setWidgets((prev) => syncTopLevelLayoutsOnWidgets(prev, liveLayout, mergedMobile));
        } else if (desktopPx.length) {
          const designW = Math.max(
            320,
            Number(designCanvasWidthRef.current) || contentBoundsPx(desktopPx, 0).width,
          );
          const seeded = scaleLayoutPx(desktopPx, designW, PHONE_BUILDER_WIDTH);
          layoutPxMobileRef.current = seeded;
          setLayoutPxMobile(seeded);
          // Working copy only — live still uses laptop until user edits + publish.
          phoneLayoutCustomizedRef.current = false;
          // Seed only the working phone canvas — do NOT stamp mobileNestedLayoutPx onto
          // widgets until the user actually edits phone (avoids polluting laptop publish).
          setWidgets((prev) => syncTopLevelLayoutsOnWidgets(prev, liveLayout, mergedMobile));
        }
      }

      let seededWidgets = syncTopLevelLayoutsOnWidgets(widgets, liveLayout, mergedMobile);
      seededWidgets = seededWidgets.map((widget) => {
        if (widget.rawType !== "container") return widget;
        const savedMobile = Array.isArray(widget.mobileNestedLayout) ? widget.mobileNestedLayout : [];
        if (
          savedMobile.length
          || hasCustomMobileNestedLayout(widget.nestedLayout || [], savedMobile)
        ) {
          return widget;
        }
        const nestedSource = Array.isArray(widget.nestedLayout) && widget.nestedLayout.length
          ? widget.nestedLayout
          : getContainerNestedSource(widget, seededWidgets);
        return {
          ...widget,
          mobileNestedLayout: sanitizeNestedLayoutItems(
            stackNestedLayoutForPhone(nestedSource.map((item) => ({ ...item }))),
          ),
        };
      });
      if (!USE_FLOATING_BUILDER) {
        setWidgets(seededWidgets);
      } else if (!(layoutPxRef.current?.length || layoutPx?.length)) {
        setWidgets(seededWidgets);
      }
      liveContainerNestedLayoutsRef.mobile.clear();
      seededWidgets.forEach((widget) => {
        if (widget.rawType !== "container") return;
        const mobileNested = Array.isArray(widget.mobileNestedLayout) ? widget.mobileNestedLayout : [];
        if (mobileNested.length) {
          liveContainerNestedLayoutsRef.mobile.set(
            String(widget.id),
            mobileNested.map((item) => ({ ...item })),
          );
        }
      });
    } else {
      mobileLayoutRef.current = liveMobileLayout;
      setMobileLayout(liveMobileLayout);
      layoutRef.current = liveLayout;
      setLayout(liveLayout);

      const syncedWidgets = syncTopLevelLayoutsOnWidgets(widgets, liveLayout, liveMobileLayout);
      setWidgets(syncedWidgets);
      liveContainerNestedLayoutsRef.desktop.clear();
      syncedWidgets.forEach((widget) => {
        if (widget.rawType !== "container") return;
        const desktopNested = Array.isArray(widget.nestedLayout) ? widget.nestedLayout : [];
        if (desktopNested.length) {
          liveContainerNestedLayoutsRef.desktop.set(
            String(widget.id),
            desktopNested.map((item) => ({ ...item })),
          );
        }
      });
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
      if (Number.isFinite(Number(dashboardJson.canvas_width))) {
        designCanvasWidthRef.current = Math.round(Number(dashboardJson.canvas_width));
        setDesignCanvasWidth(designCanvasWidthRef.current);
      }
      layoutPxRef.current = Array.isArray(dashboardJson.layout_px) ? dashboardJson.layout_px : layoutPxRef.current;
      setLayoutPx(layoutPxRef.current);
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

  builderSavePublishHotkeysRef.current = {
    save: () => {
      if (busy || widgets.length === 0 || !isDirty) return;
      void handleSaveAllDraft();
    },
    publish: () => {
      if (busy || widgets.length === 0) return;
      void handlePublishAll();
    },
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

      if (Number.isFinite(Number(dashboardJson.canvas_width))) {
        designCanvasWidthRef.current = Math.round(Number(dashboardJson.canvas_width));
        setDesignCanvasWidth(designCanvasWidthRef.current);
      }
      layoutPxRef.current = Array.isArray(dashboardJson.layout_px) ? dashboardJson.layout_px : layoutPxRef.current;
      setLayoutPx(layoutPxRef.current);
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

  const handleExportDashboard = () => {
    try {
      const config = {
        app_key: targetAppKey,
        dashboard_key: selectedDashboardKey,
        dashboard_name: dashboardNameForSave,
        widgets: widgets.map(w => {
           const layout = renderedLayout.find(l => String(l.i) === String(w.id));
           return normalizeWidgetForDashboardJson(w, layout || w.layout);
        }),
        layout_px: layoutPx,
        layout_px_mobile: layoutPxMobile,
        canvas_width: designCanvasWidth,
        version: 1.1,
        exported_at: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard_${selectedDashboardKey}_${dayjs().format('YYYYMMDD_HHmm')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showBuilderNotice("success", "Dashboard configuration exported successfully.");
    } catch (err) {
      showBuilderNotice("error", "Failed to export dashboard.");
    }
  };

  const buildContainerCloneBundle = (containerWidget) => {
    if (!containerWidget || (containerWidget.rawType !== "container" && containerWidget.rawType !== "section")) return null;

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
    const nestedPxSource = Array.isArray(containerWidget.nestedLayoutPx) && containerWidget.nestedLayoutPx.length
      ? containerWidget.nestedLayoutPx
      : boxesFromChildren(children, nestedSource);
    const nextNestedLayoutPx = nestedPxSource.map((item) => {
      const mappedId = idMap.get(String(item.i)) || String(item.i);
      return { i: mappedId, ...normalizeBox(item) };
    });
    const mobileNestedPxSource = Array.isArray(containerWidget.mobileNestedLayoutPx) && containerWidget.mobileNestedLayoutPx.length
      ? containerWidget.mobileNestedLayoutPx
      : nestedPxSource;
    const nextMobileNestedLayoutPx = mobileNestedPxSource.map((item) => {
      const mappedId = idMap.get(String(item.i)) || String(item.i);
      return { i: mappedId, ...normalizeBox(item) };
    });

    const liveDesktopLayout = layoutRef.current?.length ? layoutRef.current : layout;
    const liveMobileLayout = mobileLayoutRef.current?.length ? mobileLayoutRef.current : mobileLayout;
    const liveLayoutPx = layoutPxRef.current?.length ? layoutPxRef.current : layoutPx;
    const liveLayoutPxMobile = layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile;
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
    let clonedDesktopLayoutPx = null;
    let clonedMobileLayoutPx = null;
    if (USE_FLOATING_BUILDER) {
      const sourceBox = liveLayoutPx.find((item) => String(item.i) === containerId)
        || readWidgetBoxPx(containerWidget, liveLayoutPx.length);
      const box = cloneBoxBeside(sourceBox, liveLayoutPx);
      clonedDesktopLayoutPx = { i: newContainerId, ...box };
      const mobileSourceBox = liveLayoutPxMobile.find((item) => String(item.i) === containerId)
        || {
          ...sourceBox,
          width: Math.min(sourceBox.width, PHONE_CONTENT_WIDTH - PHONE_FRAME_INSET * 2),
          left: PHONE_FRAME_INSET,
        };
      const mobileBox = cloneBoxBeside(mobileSourceBox, liveLayoutPxMobile.length ? liveLayoutPxMobile : [mobileSourceBox]);
      clonedMobileLayoutPx = {
        i: newContainerId,
        ...normalizeBox({
          ...mobileBox,
          width: Math.min(mobileBox.width, PHONE_CONTENT_WIDTH - PHONE_FRAME_INSET * 2),
          left: Math.max(PHONE_FRAME_INSET, Math.min(mobileBox.left, PHONE_CONTENT_WIDTH - PHONE_FRAME_INSET - Math.min(mobileBox.width, PHONE_CONTENT_WIDTH - PHONE_FRAME_INSET * 2))),
        }),
      };
    }

    const clonedContainer = {
      ...containerWidget,
      id: newContainerId,
      title: `${String(containerWidget.title || "").trim() || "Container"} Copy`,
      nestedLayout: nextNestedLayout,
      nestedLayoutPx: nextNestedLayoutPx,
      mobileNestedLayout: nextMobileNestedLayout,
      mobileNestedLayoutPx: nextMobileNestedLayoutPx,
      sectionId: null,
      containerId: null,
      previewData: null,
      previewError: null,
      deviceTarget: "both",
      style: {
        ...(containerWidget.style || {}),
        ...(clonedDesktopLayoutPx
          ? { boxPx: { left: clonedDesktopLayoutPx.left, top: clonedDesktopLayoutPx.top, width: clonedDesktopLayoutPx.width, height: clonedDesktopLayoutPx.height } }
          : {}),
        nestedGridWidthPx: readNestedGridWidthPx(containerWidget)
          ?? inferNestedGridWidthPx(containerWidget, desktopSource, {
            colWidth,
            rowHeight: GRID_ROW_HEIGHT,
            gapX: GRID_GAP_X,
            gapY: GRID_GAP_Y,
          }),
      },
    };

    const clonedChildren = children.map((child) => {
      const newChildId = idMap.get(String(child.id));
      const nestedItem = nextNestedLayout.find((item) => String(item.i) === String(newChildId));
      const mobileNestedItem = nextMobileNestedLayout.find((item) => String(item.i) === String(newChildId));
      const nestedPxItem = nextNestedLayoutPx.find((item) => String(item.i) === String(newChildId));
      return {
        ...child,
        id: newChildId,
        containerId: newContainerId,
        sectionId: newContainerId,
        layout: nestedItem || child.layout,
        mobileLayout: mobileNestedItem || child.mobileLayout || nestedItem || child.layout,
        previewData: Array.isArray(child.previewData)
          ? [...child.previewData]
          : (Array.isArray(child.data) ? [...child.data] : child.previewData),
        previewError: null,
        deviceTarget: "both",
        style: {
          ...(child.style || {}),
          ...(nestedPxItem
            ? { boxPx: { left: nestedPxItem.left, top: nestedPxItem.top, width: nestedPxItem.width, height: nestedPxItem.height } }
            : {}),
        },
      };
    });

    return {
      sourceContainerId: containerId,
      clonedContainer,
      clonedChildren,
      clonedDesktopLayout,
      clonedMobileLayout,
      clonedDesktopLayoutPx,
      clonedMobileLayoutPx,
      nextNestedLayout,
      nextMobileNestedLayout,
      nextNestedLayoutPx,
      nextMobileNestedLayoutPx,
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
      clonedDesktopLayoutPx,
      clonedMobileLayoutPx,
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
      if (USE_FLOATING_BUILDER && clonedMobileLayoutPx) {
        const nextMobilePx = sanitizeNestedLayoutPx([
          ...(layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile),
          clonedMobileLayoutPx,
        ]);
        layoutPxMobileRef.current = nextMobilePx;
        setLayoutPxMobile(nextMobilePx);
        phoneLayoutCustomizedRef.current = true;
      }
    } else {
      setLayout((prev) => {
        const next = [...prev, normalizeLayoutItem(clonedDesktopLayout, prev.length, newContainerId)];
        layoutRef.current = next;
        return next;
      });
      if (USE_FLOATING_BUILDER && clonedDesktopLayoutPx) {
        const nextPx = sanitizeNestedLayoutPx([
          ...(layoutPxRef.current?.length ? layoutPxRef.current : layoutPx),
          clonedDesktopLayoutPx,
        ]);
        layoutPxRef.current = nextPx;
        setLayoutPx(nextPx);
      }
      if (USE_FLOATING_BUILDER && clonedMobileLayoutPx) {
        // Always keep phone px in sync when cloning on laptop (customized or not).
        const nextMobilePx = sanitizeNestedLayoutPx([
          ...(layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile),
          clonedMobileLayoutPx,
        ]);
        layoutPxMobileRef.current = nextMobilePx;
        setLayoutPxMobile(nextMobilePx);
      }
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
    (clonedChildren || []).forEach((child) => {
      if (!requiresDataQuery(child.rawType)) return;
      queueMicrotask(() => handlePreview(child, { quiet: true }));
    });
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
      title: `${String(containerWidget.title || "").trim() || "Container"} Copy`,
      description: containerWidget.description || "",
      type: "section",
      query: "",
      audience_scope: containerWidget.audienceScope || "global",
      target_user_ids: Array.isArray(containerWidget.targetUserIds) ? containerWidget.targetUserIds : [],
      chart_config: {
        ...chartConfigFromWidgetStyle({
          ...containerWidget,
          nestedLayout: savedNested,
          mobileNestedLayout: savedMobileNested.length ? savedMobileNested : savedNested,
        }),
        nested_layout: savedNested,
        mobile_nested_layout: savedMobileNested.length ? savedMobileNested : savedNested,
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
        savedContainer.id,
      ),
      mobile_layout: normalizeLayoutItem(
        enforceLayoutByType("container", clonedMobileLayout),
        0,
        savedContainer.id,
      ),
      device_target: "both",
      is_active: containerWidget.is_active !== false,
      is_published: false,
    });
  };

  const handleCloneWidget = async (widget) => {
    if (!widget) return;
    if (widget.containerId || widget.sectionId) {
      cloneWidgetInContainer(widget.containerId || widget.sectionId, widget);
      return;
    }
    if (widget.rawType === "container" || widget.rawType === "section" || widget.type === "container") {
      captureHistoryBeforeChange();
      const cloneBundle = cloneContainerWithChildren(widget);
      if (cloneBundle?.clonedContainer?.id) {
        setSelectedWidgetId(cloneBundle.clonedContainer.id);
        setPropertyPanelOpen(true);
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

    const isTemp = String(widget.id).startsWith("tmp_");
    const needsConfiguredQuery = requiresDataQuery(widget.rawType) && !isConfiguredWidgetQuery(widget.query);

    // Floating builder (laptop + phone): always write pixel layout so the clone is visible.
    if (USE_FLOATING_BUILDER) {
      const isPhone = isPhoneBuilderMode;
      const existingPx = sanitizeNestedLayoutPx(
        isPhone
          ? (layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile)
          : (layoutPxRef.current?.length ? layoutPxRef.current : layoutPx),
      );
      const sourceBox = existingPx.find((item) => String(item.i) === String(widget.id))
        || readWidgetBoxPx(widget, existingPx.length);
      const box = cloneBoxBeside(sourceBox, existingPx);
      const phoneBox = isPhone
        ? normalizeBox({
          ...box,
          width: Math.min(box.width, PHONE_CONTENT_WIDTH - PHONE_FRAME_INSET * 2),
          left: Math.max(
            PHONE_FRAME_INSET,
            Math.min(box.left, PHONE_CONTENT_WIDTH - PHONE_FRAME_INSET - Math.min(box.width, PHONE_CONTENT_WIDTH - PHONE_FRAME_INSET * 2)),
          ),
        })
        : box;
      const localId = `tmp_${Date.now()}`;
      const nextPx = [...existingPx, { i: localId, ...(isPhone ? phoneBox : box) }];
      if (isPhone) {
        phoneLayoutCustomizedRef.current = true;
        layoutPxMobileRef.current = nextPx;
        setLayoutPxMobile(nextPx);
      } else {
        layoutPxRef.current = nextPx;
        setLayoutPx(nextPx);
        // Keep phone store in sync when phone layout was already customized.
        if (phoneLayoutCustomizedRef.current) {
          const existingMobile = sanitizeNestedLayoutPx(
            layoutPxMobileRef.current?.length ? layoutPxMobileRef.current : layoutPxMobile,
          );
          const mobileClone = normalizeBox({
            ...box,
            width: Math.min(box.width, PHONE_CONTENT_WIDTH - PHONE_FRAME_INSET * 2),
            left: PHONE_FRAME_INSET,
          });
          const nextMobilePx = sanitizeNestedLayoutPx([
            ...existingMobile,
            { i: localId, ...cloneBoxBeside(mobileClone, existingMobile.length ? existingMobile : [mobileClone]) },
          ]);
          layoutPxMobileRef.current = nextMobilePx;
          setLayoutPxMobile(nextMobilePx);
        }
      }
      const desktopSlot = findCloneLayoutSlot(liveDesktopLayout, desktopSource);
      const mobileSlot = findCloneLayoutSlot(liveMobileLayout, mobileSource);
      const clonedDesktopLayout = {
        ...normalizeLayoutItem(desktopSource, liveDesktopLayout.length, widget.id),
        ...desktopSlot,
        i: localId,
      };
      const clonedMobileLayout = {
        ...normalizeLayoutItem(mobileSource, liveMobileLayout.length, widget.id),
        ...mobileSlot,
        i: localId,
      };
      const clonedLocal = {
        ...widget,
        id: localId,
        title: `${widget.title || "Widget"} Copy`,
        deviceTarget: "both",
        style: {
          ...(widget.style || {}),
          ...(isPhone ? {} : { boxPx: box }),
        },
      };

      setWidgets((prev) => [...prev, clonedLocal]);
      setLayout((prev) => {
        const next = [...prev, normalizeLayoutItem(clonedDesktopLayout, prev.length, localId)];
        layoutRef.current = next;
        return next;
      });
      setMobileLayout((prev) => {
        const next = [...prev, normalizeLayoutItem(clonedMobileLayout, prev.length, localId)];
        mobileLayoutRef.current = next;
        return next;
      });
      setSelectedWidgetId(localId);
      setPropertyPanelOpen(true);

      if (isTemp || needsConfiguredQuery || isPhone) {
        return;
      }
      // Saved laptop widgets: persist via API with pixel box preserved in style.
      try {
        setBusy(true);
        const payload = {
          title: clonedLocal.title,
          description: widget.description || "",
          type: resolveApiType(widget),
          query: requiresDataQuery(widget.rawType) ? widget.query || "" : "",
          audience_scope: widget.audienceScope || "global",
          target_user_ids: Array.isArray(widget.targetUserIds) ? widget.targetUserIds : [],
          chart_config: chartConfigFromWidgetStyle(clonedLocal),
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
            localId,
          ),
          mobile_layout: normalizeLayoutItem(
            enforceLayoutByType(widget.rawType, clonedMobileLayout),
            liveMobileLayout.length,
            localId,
          ),
          device_target: "both",
          is_active: widget.is_active !== false,
          is_published: false,
        };
        const res = await createWidget(payload);
        const saved = res?.data;
        if (saved?.id) {
          setWidgets((prev) => prev.map((w) => (
            String(w.id) === String(localId)
              ? {
                ...w,
                id: saved.id,
                layout: normalizeLayoutItem(clonedDesktopLayout, 0, saved.id),
                mobileLayout: normalizeLayoutItem(clonedMobileLayout, 0, saved.id),
              }
              : w
          )));
          const remappedPx = sanitizeNestedLayoutPx(
            (layoutPxRef.current || []).map((item) => (
              String(item.i) === String(localId) ? { ...item, i: String(saved.id) } : item
            )),
          );
          layoutPxRef.current = remappedPx;
          setLayoutPx(remappedPx);
          if (phoneLayoutCustomizedRef.current || (layoutPxMobileRef.current || []).some((item) => String(item.i) === String(localId))) {
            const remappedMobilePx = sanitizeNestedLayoutPx(
              (layoutPxMobileRef.current || []).map((item) => (
                String(item.i) === String(localId) ? { ...item, i: String(saved.id) } : item
              )),
            );
            layoutPxMobileRef.current = remappedMobilePx;
            setLayoutPxMobile(remappedMobilePx);
          }
          setLayout((prev) => prev.map((l, idx) => (
            String(l.i) === String(localId) ? normalizeLayoutItem({ ...l, i: String(saved.id) }, idx, saved.id) : l
          )));
          setMobileLayout((prev) => prev.map((l, idx) => (
            String(l.i) === String(localId) ? normalizeLayoutItem({ ...l, i: String(saved.id) }, idx, saved.id) : l
          )));
          setSelectedWidgetId(saved.id);
        }
      } catch (err) {
        showBuilderNotice("error", err.message || "Failed to clone widget.");
      } finally {
        setBusy(false);
      }
      return;
    }

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

    if (isTemp || needsConfiguredQuery) {
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
        tableSearchEnabled: saved?.chart_config?.table_search_enabled === true,
        tableSearchPlaceholder: String(saved?.chart_config?.table_search_placeholder || "").trim(),
        tableSearchPosition: normalizeTableSearchPosition(saved?.chart_config?.table_search_position),
        tableSearchWidth: normalizeTableSearchWidth(saved?.chart_config?.table_search_width),
        tableColumnSortEnabled: saved?.chart_config?.table_column_sort_enabled === true,
        tableExportEnabled: saved?.chart_config?.table_export_enabled === true,
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
    <div className={`relative flex flex-row ${
      embedMode
        ? "min-h-0"
        : readOnly
          ? (isPhoneView
            // Live phone: full-bleed into the side gutters (no shell letterbox).
            ? "w-full min-h-0 min-w-0 overflow-x-hidden max-md:w-full"
            : "w-full min-h-0 min-w-0 overflow-x-auto")
          : "flex-1 h-full min-h-0 w-full overflow-hidden"
    } ${readOnly && isPhoneView ? "bg-[#f8fafc] max-md:bg-[#f8fafc]" : "bg-[#f8fafc]"} font-sans`}>
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
      <div className={`${
        embedMode
          ? "w-full"
          : readOnly
            ? (isPhoneView
              ? "w-full flex flex-col min-w-0 overflow-x-hidden"
              : "w-full flex flex-col min-w-0 overflow-x-auto")
            : "flex-1 flex flex-col overflow-hidden min-w-0"
      }`}>
        {!readOnly && (
          <div className="h-10 bg-white border-b border-slate-200 shrink-0 z-20 shadow-sm flex min-w-0" data-builder-toolbar-shell>
            {/* Left: can scroll on tiny screens — actions stay pinned right */}
            <div className="builder-toolbar flex-1 min-w-0 flex items-center gap-2 px-2 overflow-x-auto overflow-y-hidden">
              <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center shadow-sm shrink-0" title="Builder">
                <Layout className="text-white" size={14} />
              </div>

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

              <div className="flex items-center gap-1.5 shrink-0">
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap hidden md:inline">
                  App
                </label>
                <select
                  value={targetAppKey}
                  onChange={(e) => handleBuilderAppChange(e.target.value)}
                  title="App"
                  className={`${BUILDER_SELECT_CLASS} min-w-[100px] max-w-[140px]`}
                >
                  {DASHBOARD_APP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap hidden md:inline">
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
                  title="Dashboard"
                  className={`${BUILDER_SELECT_CLASS} min-w-[88px] max-w-[120px]`}
                >
                  {dashboardOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {isNonDefaultDashboard && (
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
                  placeholder="Name"
                  title="Dashboard name"
                  className="h-7 min-w-[96px] max-w-[140px] rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 outline-none focus:border-blue-400 shrink-0"
                />
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
                <label className="hidden lg:flex items-center gap-1.5 shrink-0 cursor-pointer select-none" title="Default for assigned users">
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
                    Default
                  </span>
                </label>
              )}
            </div>

            {/* Right: always visible — no scroll, no overlap hide */}
            <div className="builder-toolbar-actions shrink-0 flex items-center gap-1 px-2 border-l border-slate-100 bg-white">
              {isDirty && (
                <span
                  className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-700 whitespace-nowrap"
                  title="Unsaved changes"
                >
                  •
                </span>
              )}
              <button
                type="button"
                onClick={handleUndo}
                disabled={busy || !canUndo}
                title="Undo (Ctrl+Z)"
                className="h-7 w-7 grid place-items-center rounded-md border border-slate-300 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 shrink-0"
              >
                <Undo2 size={12} />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={busy || !canRedo}
                title="Redo (Ctrl+Y)"
                className="h-7 w-7 grid place-items-center rounded-md border border-slate-300 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 shrink-0"
              >
                <Redo2 size={12} />
              </button>
              <button
                ref={cloneButtonRef}
                type="button"
                onClick={() => (showClonePanel ? closeClonePanel() : openClonePanel())}
                title="Clone Dashboard"
                className={`h-7 w-7 grid place-items-center rounded-md border shrink-0 ${
                  showClonePanel
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Copy size={12} />
              </button>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddWidgetMenu((open) => !open)}
                  title="Add widget"
                  className={`h-7 px-2 rounded-md text-[9px] font-bold uppercase tracking-wide border inline-flex items-center gap-0.5 whitespace-nowrap ${
                    showAddWidgetMenu
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-white"
                  }`}
                >
                  <Plus size={11} />
                  Add
                  <ChevronDown size={10} />
                </button>
                {showAddWidgetMenu && (
                  <>
                    <button
                      type="button"
                      aria-label="Close add menu"
                      className="fixed inset-0 z-[80] cursor-default"
                      onClick={() => setShowAddWidgetMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-[90] min-w-[140px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                      {BUILDER_WIDGET_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            addWidget(t);
                            setShowAddWidgetMenu(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                        >
                          + {t === "kpi" ? "KPI" : t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {widgets.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowWidgetsStrip((open) => !open)}
                  title={showWidgetsStrip ? "Hide widget list" : "Show widget list"}
                  className={`h-7 px-1.5 rounded-md text-[9px] font-bold uppercase tracking-wide border whitespace-nowrap shrink-0 ${
                    showWidgetsStrip
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <MoreHorizontal size={12} className="inline" />
                  <span className="ml-0.5 hidden sm:inline">{widgets.length}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveAllDraft}
                disabled={busy || widgets.length === 0 || !isDirty}
                title="Save Draft (Ctrl+S)"
                className="h-7 px-2 rounded-md text-[9px] font-bold uppercase tracking-wide bg-white border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handlePublishAll}
                disabled={busy || widgets.length === 0}
                title={`${selectedDashboardPublished ? "Republish" : "Publish"} (${getListHotkeyParts("u", isPwaStandalone()).join("+")})`}
                className="h-7 px-2 rounded-md text-[9px] font-bold uppercase tracking-wide bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 whitespace-nowrap shrink-0"
              >
                <UploadCloud size={10} className="inline mr-0.5" />
                {selectedDashboardPublished ? "Republish" : "Publish"}
              </button>
              <button
                type="button"
                onClick={handleUnpublishAll}
                disabled={busy || !selectedDashboardPublished}
                title="Unpublish"
                className="h-7 w-7 grid place-items-center rounded-md border border-slate-300 bg-white text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 shrink-0"
              >
                <CloudOff size={12} />
              </button>
              {isNonDefaultDashboard && (
                <button
                  type="button"
                  onClick={handleDeleteCloneDashboard}
                  disabled={busy}
                  title="Delete Clone"
                  className="h-7 w-7 grid place-items-center rounded-md border border-rose-200 bg-white text-rose-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rose-50 shrink-0"
                >
                  <Trash2 size={12} />
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


        {!readOnly && widgets.length > 0 && showWidgetsStrip && (
          <div className="widget-manager-panel bg-white border-b border-slate-200 shadow-sm shrink-0">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-3 bg-slate-50/50">
              <div className="flex-1 relative">
                <Layout size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search widgets by title, type, or query..."
                  value={widgetsSearchQuery}
                  onChange={(e) => setWidgetsSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                />
                {widgetsSearchQuery && (
                   <button 
                     onClick={() => setWidgetsSearchQuery("")}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                   >
                     <X size={14} />
                   </button>
                )}
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportDashboard}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm"
                >
                  <UploadCloud size={14} />
                  Export Dashboard
                </button>
                
                <div className="h-8 w-px bg-slate-200 mx-1 hidden md:block" />
                
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">
                  {filteredWidgetsList.length} of {widgets.length} Widgets
                </span>
              </div>
            </div>

            <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-3 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredWidgetsList.map((w, idx) => (
                  <div
                    key={`manage-${w.id}`}
                    onClick={() => {
                      setSelectedWidgetId(w.id);
                      setPropertyPanelOpen(true);
                    }}
                    className={`group relative flex flex-col p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                      String(selectedWidgetId) === String(w.id)
                        ? "bg-blue-50 border-blue-500 shadow-md ring-4 ring-blue-500/5"
                        : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          String(selectedWidgetId) === String(w.id) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}>
                          <span className="text-[9px] font-bold">{idx + 1}</span>
                        </div>
                        <h4 className="text-[11px] font-bold text-slate-800 truncate uppercase tracking-tight">
                          {widgetStripLabel(w, idx)}
                        </h4>
                      </div>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                        isWidgetHybridMode(w)
                          ? "bg-amber-50 border-amber-200 text-amber-600"
                          : "bg-slate-100 border-slate-200 text-slate-500"
                      }`}>
                        {isWidgetHybridMode(w) ? "Hybrid" : (w.rawType || w.type || "widget")}
                      </span>
                    </div>
                    
                    {w.query && (
                      <p className="text-[9px] text-slate-400 font-mono truncate bg-slate-50 rounded px-1.5 py-1 mb-1 border border-slate-100 group-hover:text-slate-600 transition-colors">
                        {w.query}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-auto pt-1 border-t border-slate-100/50">
                      <span className="text-[8px] font-medium text-slate-400 italic truncate max-w-[120px]">
                        ID: {w.id}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button className="p-1 hover:bg-blue-100 rounded text-blue-600"><Pencil size={10} /></button>
                         <button className="p-1 hover:bg-rose-100 rounded text-rose-500" onClick={(e) => { e.stopPropagation(); handleDeleteWidget(w); }}><Trash2 size={10} /></button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredWidgetsList.length === 0 && (
                  <div className="col-span-full py-10 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <CloudOff size={24} className="mb-2 opacity-50" />
                    <p className="text-xs font-bold uppercase tracking-widest">No widgets found matching search</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Canvas — fills available width, measured by containerRef */}
        <div
          ref={canvasContainerRef}
          data-dashboard-canvas-host
          className={`relative z-0 w-full min-w-0 ${
            embedMode
              ? "max-h-[480px] overflow-auto"
              : readOnly && isPhoneView
                // Live phone: edge-to-edge canvas (break out of any residual parent pad).
                ? "overflow-x-hidden overflow-y-auto bg-transparent p-0 max-md:w-full max-md:max-w-none"
                : isPhoneBuilderMode
                  ? "flex-1 overflow-x-hidden overflow-y-auto bg-[#f8fafc] p-0"
                  // Builder + live laptop: same horizontal scroll (1:1 WYSIWYG).
                  : "flex-1 overflow-x-auto overflow-y-auto bg-[#f8fafc] p-0"
          }`}
        >
          <div
            style={
              readOnly && isPhoneView
                ? { width: "100%", maxWidth: "100%" }
                : readOnly
                  ? undefined
                  : { minHeight: "100%" }
            }
            className={`${
              isPhonePreviewFrame
                ? "flex justify-center py-3 w-full max-w-full"
                : (readOnly && isPhoneView)
                  ? "w-full max-w-none"
                  // Live laptop grows with design width (scroll), same as builder.
                  : "w-max min-w-full"
            }`}
          >
            {gridReady ? (
            <div
              className={
                isPhonePreviewFrame
                  ? "box-border w-[390px] max-w-full rounded-[24px] border-4 border-slate-800 bg-white shadow-xl overflow-hidden"
                  : (readOnly && isPhoneView)
                    // Live phone: span the full content column (into former side gutters).
                    ? "w-full max-w-none overflow-hidden"
                    : "w-max min-w-full"
              }
              style={
                readOnly && isPhoneView
                  ? { width: "100%", marginLeft: 0, marginRight: 0 }
                  : undefined
              }
            >
            {/* Phone gutters are layout insets (equal L/R) — no CSS padding here. */}
            <div
              ref={liveGridMeasure.containerRef}
              {...(lockPhoneDesignWidth ? { "data-dashboard-phone-frame": "true" } : {})}
              className={
                lockPhoneDesignWidth
                  ? "relative box-border w-full min-w-0 overflow-hidden p-0"
                  : "relative w-max min-w-full"
              }
            >
            <SimpleBuilderCanvas
              key={isPhoneFloatingView ? "floating-phone" : "floating-desktop"}
              widgets={canvasWidgets}
              layoutPx={resolvedLayoutPx}
              readOnly={readOnly}
              phoneMode={isPhoneFloatingView}
              canvasWidth={
                lockPhoneDesignWidth
                  ? (isPhonePreviewFrame
                    ? PHONE_CONTENT_WIDTH
                    : Math.max(320, floatingCanvasWidth || PHONE_CONTENT_WIDTH))
                  : floatingCanvasWidth
              }
              selectedWidgetId={readOnly ? null : selectedWidgetId}
              onLayoutChange={readOnly ? undefined : handleCanvasLayoutPxChange}
              onSelectWidget={readOnly ? undefined : (widgetId) => {
                setSelectedWidgetId(widgetId == null || widgetId === "" ? null : widgetId);
                if (widgetId != null && widgetId !== "") {
                  setPropertyPanelOpen(true);
                }
              }}
              onDeleteWidget={readOnly ? undefined : handleDeleteWidget}
              onCloneWidget={readOnly ? undefined : handleCloneWidget}
              onNestedLayoutChange={readOnly ? () => {} : handleNestedLayoutChange}
              onAddChildWidget={readOnly ? () => {} : addWidgetInContainer}
              onCloneChildWidget={readOnly ? () => {} : cloneWidgetInContainer}
            />
            </div>
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
                      {t === "kpi" ? "KPI" : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!readOnly && (
        <WidgetBuilderPanel
          dockMode={propertyPanelDock}
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
          dbSourceOptions={DASHBOARD_DB_SOURCE_OPTIONS}
          widthPx={widthPx}
          heightPx={heightPx}
          minWidthPx={isPhoneBuilderMode ? 20 : (selectedWidget?.containerId ? 20 : minLayoutWidthPx)}
          minHeightPx={isPhoneBuilderMode ? 20 : (selectedWidget?.containerId ? 20 : minLayoutHeightPx)}
          onClose={() => {
            setSelectedWidgetId(null);
            setPanelWidgetSnapshot(null);
            setPropertyPanelOpen(false);
          }}
          busy={busy}
          canFilterByUser={canFilterByUser}
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
        .dashboard-builder-grid .container-nested-grid-host {
          overflow: visible !important;
        }
        .container-nested-grid-host {
          overflow: hidden !important;
        }
        .container-nested-grid-host.overflow-visible {
          overflow: visible !important;
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
        .dashboard-builder-grid .react-grid-item:has(> .container-widget-cell) {
          overflow: hidden !important;
          display: flex !important;
          min-width: 0 !important;
          min-height: 0 !important;
          height: auto !important;
        }
        .dashboard-builder-grid .react-grid-item:has(> .container-widget-cell) > .container-widget-cell {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: auto !important;
          align-self: flex-start !important;
          overflow: hidden !important;
        }
        .dashboard-builder-grid .react-grid-item.container-widget-cell {
          overflow: visible !important;
          display: flex !important;
          min-height: 0 !important;
        }
        .dashboard-builder-grid .react-grid-item.container-widget-cell > div {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          overflow: hidden !important;
        }
        .dashboard-builder-grid .react-grid-item.container-widget-cell > div.h-auto {
          height: auto !important;
          align-self: flex-start !important;
        }
        .dashboard-builder-grid .react-grid-item.heading-widget-cell > div,
        .dashboard-view-grid .react-grid-item.heading-widget-cell > div,
        .container-nested-grid .react-grid-item.heading-widget-cell > div {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .container-nested-grid .react-grid-item.heading-widget-cell {
          min-height: 0 !important;
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
        .container-nested-grid .react-grid-item {
          min-height: 0 !important;
          overflow: visible !important;
        }
        .container-nested-interaction-layer {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          pointer-events: none !important;
          z-index: 20 !important;
        }
        .container-nested-interaction-layer .react-grid-item {
          pointer-events: auto !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .container-nested-interaction-layer .react-grid-item > div {
          background: transparent !important;
        }
        .container-live-css-grid {
          position: relative;
          z-index: 1;
        }
        .dashboard-builder-grid .react-grid-item:has(> .container-widget-cell).container-nested-interacting,
        .dashboard-builder-grid .react-grid-item:has(> .container-widget-cell):has(.container-nested-grid-host.overflow-visible) {
          overflow: visible !important;
        }
        .dashboard-builder-grid .react-grid-item:has(> .container-widget-cell).container-nested-interacting > .container-widget-cell,
        .dashboard-builder-grid .react-grid-item:has(> .container-widget-cell):has(.container-nested-grid-host.overflow-visible) > .container-widget-cell > div {
          overflow: visible !important;
        }
        .container-nested-grid:not(.read-only-nested) .react-grid-item {
          cursor: grab !important;
        }
        .container-nested-grid:not(.read-only-nested) .react-grid-item.react-draggable-dragging {
          cursor: grabbing !important;
        }
        .container-nested-grid .react-grid-item:has(.ring-blue-400) {
          z-index: 45 !important;
        }
        .container-nested-grid .react-grid-item.react-draggable-dragging {
          overflow: visible !important;
          z-index: 50 !important;
          transition: none !important;
        }
        .container-nested-grid .react-grid-item.react-draggable-dragging > div {
          height: 100% !important;
          width: 100% !important;
          transform: none !important;
        }
        .container-nested-grid .react-grid-item.resizing {
          overflow: visible !important;
          z-index: 50 !important;
        }
        .container-nested-grid .react-grid-placeholder {
          background: transparent !important;
          border: 1px dashed rgba(59, 130, 246, 0.45) !important;
          border-radius: 6px !important;
          opacity: 1 !important;
          z-index: 5 !important;
        }
        .container-nested-grid:not(.read-only-nested) .react-grid-item > div:not(.nested-widget-toolbar) {
          min-height: 0 !important;
          height: 100% !important;
          width: 100% !important;
          overflow: visible !important;
          align-self: stretch !important;
        }
        .container-nested-grid .nested-widget-shell {
          height: 100% !important;
          min-height: 64px !important;
          background: #fff;
          border-radius: 6px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
          overflow: visible !important;
          display: flex !important;
          align-items: stretch !important;
        }
        .dashboard-builder-grid .container-nested-grid .react-grid-item {
          overflow: visible !important;
        }
        .container-nested-grid.read-only-nested .react-grid-item > div:not(.nested-widget-toolbar) {
          min-height: 0 !important;
          height: 100% !important;
          width: 100% !important;
          overflow: hidden !important;
        }
        .container-nested-grid .react-grid-item:has(.nested-explicit-height) {
          height: auto !important;
          min-height: 0 !important;
          align-self: flex-start !important;
        }
        .container-nested-grid .nested-explicit-height {
          height: 100% !important;
          max-height: 100% !important;
          min-height: unset !important;
        }
        .container-nested-grid.read-only-nested .react-grid-item > div.nested-explicit-height {
          min-height: unset !important;
          height: 100% !important;
        }
        .container-nested-grid .nested-widget-toolbar {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          position: absolute !important;
          top: 4px !important;
          left: 4px !important;
          width: auto !important;
          height: auto !important;
          max-height: 1.75rem !important;
          z-index: 50 !important;
        }
        .container-nested-grid .nested-widget-toolbar .nested-drag-handle {
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          max-width: 20px !important;
          min-height: 20px !important;
          max-height: 20px !important;
          flex: none !important;
        }
        .container-nested-grid .react-grid-item.react-draggable-dragging {
          cursor: grabbing !important;
        }
        .container-nested-grid .react-grid-item > .react-resizable-handle {
          opacity: 0;
          transition: opacity 0.15s ease;
          z-index: 70;
          padding: 0 !important;
          margin: 0 !important;
          background-image: none !important;
          background-position: center !important;
          background-origin: border-box !important;
          transform: none !important;
          border: 1px solid rgba(59, 130, 246, 0.55) !important;
          background-color: rgba(59, 130, 246, 0.35) !important;
          border-radius: 3px !important;
          box-sizing: border-box !important;
        }
        .container-nested-grid .react-grid-item.resizing > .react-resizable-handle,
        .container-nested-grid .react-grid-item:has(.ring-blue-400) > .react-resizable-handle {
          opacity: 1;
        }
        .container-nested-grid .react-resizable-handle-sw,
        .container-nested-grid .react-resizable-handle-nw,
        .container-nested-grid .react-resizable-handle-ne,
        .container-nested-grid .react-resizable-handle-n {
          display: none !important;
        }
        .container-nested-grid .react-resizable-handle-w {
          display: block !important;
          left: -3px !important;
          top: 50% !important;
          margin-top: -10px !important;
          width: 6px !important;
          height: 20px !important;
          cursor: w-resize !important;
          transform: none !important;
        }
        .container-nested-grid .react-resizable-handle-e {
          display: block !important;
          right: -3px !important;
          top: 50% !important;
          margin-top: -10px !important;
          width: 6px !important;
          height: 20px !important;
          cursor: e-resize !important;
          transform: none !important;
        }
        .container-nested-grid .react-resizable-handle-s {
          display: block !important;
          left: 50% !important;
          bottom: -3px !important;
          margin-left: -10px !important;
          width: 20px !important;
          height: 6px !important;
          cursor: s-resize !important;
          transform: none !important;
        }
        .container-nested-grid .react-resizable-handle-se {
          display: block !important;
          right: -2px !important;
          bottom: -2px !important;
          width: 12px !important;
          height: 12px !important;
          cursor: se-resize !important;
          transform: none !important;
          border-radius: 0 0 4px 0 !important;
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
        .dashboard-view-grid:not(.dashboard-builder-grid) .react-resizable-handle {
          display: none !important;
          pointer-events: none !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .react-grid-item {
          cursor: default !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .react-grid-item .canvas-drag-handle,
        .dashboard-builder-grid.dashboard-live-phone .react-grid-item .nested-drag-handle {
          cursor: grab !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .widget-chrome-toolbar {
          position: absolute !important;
          top: 2px !important;
          left: 2px !important;
          width: auto !important;
          height: auto !important;
          max-height: none !important;
          flex: none !important;
          z-index: 50 !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .widget-chrome-toolbar .canvas-drag-handle,
        .dashboard-builder-grid.dashboard-live-phone .widget-chrome-toolbar .nested-drag-handle {
          position: relative !important;
          top: auto !important;
          left: auto !important;
          width: 16px !important;
          height: 16px !important;
          min-width: 16px !important;
          min-height: 16px !important;
          max-width: 16px !important;
          max-height: 16px !important;
          flex: none !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .widget-chrome-toolbar .widget-action-bar {
          position: relative !important;
          top: auto !important;
          left: auto !important;
          width: auto !important;
          height: auto !important;
          max-height: none !important;
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          padding: 1px !important;
          gap: 1px !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .widget-chrome-toolbar .widget-action-bar button {
          width: 16px !important;
          height: 16px !important;
          min-width: 16px !important;
          min-height: 16px !important;
          max-width: 16px !important;
          max-height: 16px !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .react-grid-item .react-resizable-handle {
          display: block !important;
          pointer-events: auto !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .container-nested-grid .react-resizable-handle {
          display: block !important;
          pointer-events: auto !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .container-nested-grid .nested-drag-handle,
        .dashboard-builder-grid.dashboard-live-phone .container-nested-grid .widget-action-bar button {
          width: 16px !important;
          height: 16px !important;
          min-width: 16px !important;
          min-height: 16px !important;
          max-width: 16px !important;
          max-height: 16px !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .container-nested-grid .nested-drag-handle {
          top: 2px !important;
          left: 2px !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .container-nested-grid .widget-action-bar {
          top: 2px !important;
          left: 20px !important;
          max-height: 18px !important;
          padding: 1px !important;
          gap: 1px !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .container-widget-cell .canvas-drag-handle,
        .dashboard-builder-grid.dashboard-live-phone .container-widget-cell .widget-action-bar button {
          width: 16px !important;
          height: 16px !important;
          min-width: 16px !important;
          min-height: 16px !important;
        }
        .dashboard-builder-grid.dashboard-live-phone .container-widget-cell .widget-action-bar {
          max-height: 18px !important;
          padding: 1px !important;
        }
        .dashboard-live-css-grid .dashboard-live-cell > div {
          width: 100%;
          height: 100%;
          min-height: 0;
        }
        .dashboard-live-css-grid .dashboard-live-container-cell {
          height: auto !important;
          align-self: start !important;
        }
        .dashboard-live-css-grid .dashboard-live-container-cell > div {
          height: auto !important;
          overflow: visible !important;
        }
        .container-live-css-grid > div {
          align-self: start;
        }
        .container-live-css-grid > div > div {
          width: 100%;
          height: 100%;
          min-height: 100%;
        }
        .dashboard-live-css-grid .container-nested-grid {
          position: relative;
          z-index: 1;
        }
        .dashboard-live-css-grid .container-nested-grid .react-grid-item {
          overflow: visible !important;
        }
        .dashboard-live-css-grid .container-nested-grid .react-grid-item > div:not(.nested-widget-toolbar) {
          height: 100% !important;
          overflow: visible !important;
        }
        .dashboard-live-css-grid .container-nested-grid .react-resizable-handle {
          display: none !important;
        }
        .dashboard-live-desktop.react-grid-layout,
        .dashboard-view-grid.dashboard-live-desktop .react-grid-layout {
          margin: 0 !important;
        }
        /* Phone published CSS — independent from laptop (.dashboard-live-desktop) */
        .dashboard-view-grid.dashboard-live-phone .react-grid-layout {
          margin: 0 !important;
        }
        .dashboard-view-grid.dashboard-live-phone .react-grid-item {
          cursor: default !important;
          display: flex !important;
          flex-direction: column !important;
          min-height: 0 !important;
          overflow: visible !important;
        }
        .dashboard-view-grid.dashboard-live-phone .react-grid-item:has(> .container-widget-cell) {
          overflow: visible !important;
          align-items: stretch !important;
        }
        .dashboard-view-grid.dashboard-live-phone .react-grid-item:has(> .container-widget-cell) > .container-widget-cell {
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
          min-height: 100% !important;
          align-self: stretch !important;
          overflow: visible !important;
        }
        .dashboard-view-grid.dashboard-live-phone .react-grid-item.container-widget-cell {
          overflow: visible !important;
        }
        .dashboard-view-grid.dashboard-live-phone .react-grid-item.container-widget-cell > div {
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: visible !important;
        }
        .dashboard-view-grid.dashboard-live-phone .container-nested-grid,
        .dashboard-view-grid.dashboard-live-phone .container-nested-grid .react-grid-layout {
          overflow: visible !important;
          width: 100% !important;
        }
        .dashboard-view-grid.dashboard-live-phone .container-nested-grid .react-grid-item {
          overflow: visible !important;
        }
        .dashboard-view-grid.dashboard-live-phone .container-nested-grid .react-grid-item > div:not(.nested-widget-toolbar) {
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: visible !important;
        }
        .dashboard-view-grid.dashboard-live-phone .react-grid-item:not(.container-widget-cell) > div {
          width: 100%;
          height: 100%;
        }
        .dashboard-live-phone.dashboard-builder-grid .container-nested-grid .react-grid-item > div:not(.nested-widget-toolbar) {
          width: 100% !important;
          height: 100% !important;
          overflow: visible !important;
        }
        .dashboard-phone-builder .react-grid-item:has(> .container-widget-cell) {
          overflow: hidden !important;
        }
        .dashboard-phone-builder .react-grid-item:has(> .container-widget-cell) > .container-widget-cell {
          overflow: hidden !important;
        }
        .dashboard-phone-builder .react-grid-item:has(> .container-widget-cell) > .container-widget-cell > div {
          overflow: hidden !important;
        }
        .dashboard-phone-builder .container-nested-grid,
        .dashboard-phone-builder .container-nested-grid .react-grid-layout,
        .dashboard-phone-builder .container-nested-grid .react-grid-item,
        .dashboard-phone-builder .container-nested-grid .react-grid-item > div:not(.nested-widget-toolbar) {
          overflow: hidden !important;
        }
        .dashboard-view-grid .react-grid-item {
          cursor: default !important;
          display: flex !important;
        }
        .dashboard-view-grid .react-grid-item:has(> .container-widget-cell) {
          overflow: visible !important;
        }
        .dashboard-view-grid .react-grid-item:has(> .container-widget-cell) > .container-widget-cell {
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
          min-height: 100% !important;
          align-self: stretch !important;
          overflow: hidden !important;
        }
        .dashboard-view-grid .react-grid-item.container-widget-cell {
          overflow: visible !important;
        }
        .dashboard-view-grid .react-grid-item.container-widget-cell > div {
          width: 100% !important;
          max-width: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .dashboard-view-grid .container-nested-grid,
        .dashboard-view-grid .container-nested-grid .react-grid-layout,
        .dashboard-view-grid .container-nested-css-grid {
          overflow: hidden !important;
        }
        .dashboard-view-grid .container-nested-grid .react-grid-item {
          overflow: hidden !important;
          z-index: 2 !important;
        }
        .dashboard-view-grid .container-nested-grid .react-grid-item > div {
          overflow: hidden !important;
        }
        .dashboard-view-grid .container-nested-grid .nested-kpi-value {
          overflow: visible !important;
          position: relative;
          z-index: 3;
        }
        .dashboard-view-grid .container-nested-css-grid > div {
          min-height: 100%;
        }
        .dashboard-view-grid .react-grid-item.container-widget-cell > div.h-full {
          height: 100% !important;
          align-self: stretch !important;
        }
        .dashboard-view-grid .react-grid-item.container-widget-cell > div.h-auto {
          height: 100% !important;
          align-self: stretch !important;
        }
        .dashboard-view-grid .react-grid-item:not(.container-widget-cell) > div {
          width: 100%;
          height: 100%;
        }
        .dashboard-view-grid:not(.dashboard-builder-grid) .react-grid-item.react-draggable-dragging {
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
        .builder-toolbar::-webkit-scrollbar {
          display: none;
        }
        .widgets-strip {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .widgets-strip::-webkit-scrollbar {
          display: none;
        }
        .floating-nested-canvas,
        .floating-nested-canvas .relative,
        .floating-builder-canvas .relative {
          overflow: visible !important;
        }
        body.floating-canvas-interacting {
          user-select: none !important;
          cursor: grabbing !important;
        }
        body.floating-canvas-interacting .floating-resize-handle {
          opacity: 1 !important;
        }
        .floating-nested-canvas .floating-widget-frame,
        .floating-builder-canvas .floating-widget-frame {
          box-sizing: border-box;
          overflow: visible !important;
        }
        .floating-builder-canvas .floating-container-frame {
          overflow: visible !important;
        }
        .floating-builder-canvas .floating-container-frame > .overflow-hidden,
        .floating-builder-canvas .floating-top-widget > .overflow-hidden {
          overflow: hidden !important;
        }
        .floating-resize-layer {
          z-index: 120 !important;
        }
        .floating-resize-handle {
          position: absolute;
          z-index: 100;
          background: #3b82f6;
          border: 1px solid #ffffff;
          border-radius: 2px;
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.35);
          opacity: 0;
          pointer-events: auto;
          transition: opacity 0.12s;
        }
        .floating-container-frame .floating-resize-s {
          bottom: -6px;
          height: 14px;
          width: 40px;
          margin-left: -20px;
        }
        .floating-container-frame .floating-resize-se,
        .floating-container-frame .floating-resize-sw,
        .floating-container-frame .floating-resize-ne,
        .floating-container-frame .floating-resize-nw {
          width: 16px;
          height: 16px;
        }
        .floating-container-frame .floating-resize-e,
        .floating-container-frame .floating-resize-w {
          width: 14px;
          height: 40px;
          margin-top: -20px;
        }
        .floating-container-frame .floating-resize-e {
          right: -6px;
        }
        .floating-container-frame .floating-resize-w {
          left: -6px;
        }
        .floating-container-frame .floating-resize-n {
          top: -6px;
          height: 14px;
          width: 40px;
          margin-left: -20px;
        }
        .floating-widget-frame.is-selected .floating-resize-handle,
        .floating-widget-frame:hover .floating-resize-handle,
        body.floating-canvas-interacting .floating-resize-handle {
          opacity: 1;
        }
        .floating-resize-e {
          top: 50%;
          right: 0;
          width: 8px;
          height: 24px;
          margin-top: -12px;
          cursor: e-resize;
        }
        .floating-resize-w {
          top: 50%;
          left: 0;
          width: 8px;
          height: 24px;
          margin-top: -12px;
          cursor: w-resize;
        }
        .floating-resize-s {
          left: 50%;
          bottom: 0;
          width: 24px;
          height: 8px;
          margin-left: -12px;
          cursor: s-resize;
        }
        .floating-resize-se {
          right: 0;
          bottom: 0;
          width: 12px;
          height: 12px;
          cursor: se-resize;
        }
        .floating-resize-n {
          top: 0;
          left: 50%;
          width: 24px;
          height: 8px;
          margin-left: -12px;
          cursor: n-resize;
        }
        .floating-resize-ne {
          top: 0;
          right: 0;
          width: 12px;
          height: 12px;
          cursor: ne-resize;
        }
        .floating-resize-nw {
          top: 0;
          left: 0;
          width: 12px;
          height: 12px;
          cursor: nw-resize;
        }
        .floating-resize-sw {
          left: 0;
          bottom: 0;
          width: 12px;
          height: 12px;
          cursor: sw-resize;
        }
      `}</style>
    </div>
  );
}

