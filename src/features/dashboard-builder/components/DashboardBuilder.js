"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Responsive, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Copy, Eye, GripVertical, Layout, MousePointer2, Pencil, Plus, Trash2, UploadCloud } from "lucide-react";
import { useSelector } from "react-redux";
import WidgetRenderer from "./WidgetRenderer";
import PropertyPanel from "./PropertyPanel";
import DashboardHome from "@/features/shared/dashboard/components/DashboardHome";
import { createWidget, deleteWidget, getDashboardWidgets, listWidgets, publishWidget, previewWidget, updateWidget as updateWidgetApi } from "../services/dashboardApi";

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
const BUILDER_WIDGET_TYPES = ["kpi", "table", "graph", "heading"];
const GRID_COLS = 12;
const GRID_ROW_HEIGHT = 64;
const GRID_GAP_X = 12;
const GRID_GAP_Y = 12;

const buildDefaultLayout = (idx = 0) => ({
  x: (idx * 2) % 12,
  y: Infinity,
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

const normalizeLayoutItem = (rawLayout = {}, idx = 0, id = "") => {
  const fallback = buildDefaultLayout(idx);
  const normalized = {
    i: String(id || rawLayout.i || `tmp_${Date.now()}`),
    x: Number.isFinite(Number(rawLayout.x)) ? Number(rawLayout.x) : fallback.x,
    y: Number.isFinite(Number(rawLayout.y)) ? Number(rawLayout.y) : fallback.y,
    w: Number.isFinite(Number(rawLayout.w)) ? Math.max(1, Number(rawLayout.w)) : fallback.w,
    h: Number.isFinite(Number(rawLayout.h)) ? Math.max(1, Number(rawLayout.h)) : fallback.h,
    minW: 1,
    minH: 1,
    static: false,
    isResizable: true,
    isDraggable: true,
  };
  return normalized;
};

const enforceLayoutByType = (rawType, layout = {}) => {
  const next = { ...(layout || {}) };
  return next;
};

export default function DashboardBuilder({ readOnly = false }) {
  const { width: containerWidth, containerRef } = useContainerWidth({ measureBeforeMount: true });
  const role = useSelector((state) => state.auth.role);

  const [widgets, setWidgets] = useState([]);
  const [layout, setLayout] = useState([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  // Start busy=true so dashboard never briefly flashes DashboardHome before data arrives
  const [busy, setBusy] = useState(true);

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
    previewData: null,
    previewError: null,
    style: {
      color: row?.chart_config?.color || "#3b82f6",
      bg: row?.chart_config?.bg || "#ffffff",
      fontSize: row?.chart_config?.fontSize || 10,
      borderRadius: row?.chart_config?.borderRadius || 6,
      contentAlign: row?.chart_config?.contentAlign || "center",
      emptyTextPosition: row?.chart_config?.emptyTextPosition || "center",
      kpiLabelPosition: row?.chart_config?.kpiLabelPosition || "bottom",
    },
    emptyText: row?.chart_config?.emptyText || "Click edit and add query",
    sectionId: row?.chart_config?.section_id ?? null,
      layout: normalizeLayoutItem(
        enforceLayoutByType(rawType, row.layout && typeof row.layout === "object" ? row.layout : {}),
        idx,
        row.id,
      ),
    };
  };

  const loadWidgets = async () => {
    try {
      setBusy(true);
      setLoadError(null);
      const res = readOnly ? await getDashboardWidgets() : await listWidgets();
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
              const response = await previewWidget(widget.query);
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
      setWidgets(mapped);
      setLayout(
        mapped.map((w, idx) => normalizeLayoutItem(w.layout || {}, idx, w.id)),
      );
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

  const renderedLayout = useMemo(() => {
    return visibleLayout.map((item, idx) => {
      const normalized = normalizeLayoutItem(item, idx, item.i);
      if (!readOnly) return normalized;
      return {
        ...normalized,
        static: true,
        isResizable: false,
        isDraggable: false,
      };
    });
  }, [visibleLayout, readOnly]);

  const renderedLayouts = useMemo(
    () => ({
      lg: renderedLayout,
      md: renderedLayout,
      sm: renderedLayout,
      xs: renderedLayout,
      xxs: renderedLayout,
    }),
    [renderedLayout],
  );

  useEffect(() => {
    loadWidgets();
  }, [readOnly]);

  const selectedWidget = widgets.find((w) => String(w.id) === String(selectedWidgetId));
  const selectedLayout = selectedWidget
    ? layout.find((l) => String(l.i) === String(selectedWidget.id)) || selectedWidget.layout || null
    : null;
  // Canvas fills the actual measured container width.
  // Panel is a flex sibling so containerWidth already excludes it.
  // Grid w/h are proportional (out of 12 cols) so layouts look consistent.
  const canvasWidth = Math.max(320, containerWidth || 320);
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
    if (!selectedWidget) return;
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
  if (!readOnly && normalizedRole !== "super_admin" && normalizedRole !== "super admin") {
    return (
      <div className="h-full min-h-screen flex items-center justify-center bg-[#f8fafc]">
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
      <div className="h-full min-h-screen flex items-center justify-center bg-[#f8fafc]">
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
      <div className="h-full min-h-screen flex items-center justify-center bg-[#f8fafc]">
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
  if (readOnly && !busy && visibleWidgets.length === 0) {
    return <DashboardHome title="IMS" />;
  }

  const addWidget = (rawType) => {
    const id = `tmp_${Date.now()}`;
    const type = rawType === "graph" ? "bar" : typeToDisplayType[rawType] || "table";
    const temp = {
      id,
      rawType,
      type,
      title: "",
      description: "",
      query: "",
      sectionId: null,
      style: { color: "#3b82f6", bg: "#ffffff", fontSize: 10, borderRadius: 6 },
      emptyText: "Click edit and add query",
      previewData: null,
      previewError: null,
      is_active: true,
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
          return [...shifted, { ...headingLayout, x: 0, y: insertY }];
        });
        setSelectedWidgetId(id);
        return;
      }
    }
    setLayout((prev) => [...prev, buildInitialLayoutForType(rawType, prev.length, id)]);
    setSelectedWidgetId(id);
  };

  const onLayoutChange = (currentLayout, allLayouts) => {
    const sourceLayout = allLayouts?.lg || currentLayout || [];
    const normalizedNext = sourceLayout.map((l, idx) => normalizeLayoutItem(l, idx, l.i));
    setLayout(normalizedNext);
    setWidgets((prev) =>
      prev.map((w) => {
        const matched = normalizedNext.find((l) => String(l.i) === String(w.id));
        return matched ? { ...w, layout: matched } : w;
      }),
    );
  };

  const updateWidgetLocal = (updatedWidget) => {
    if (!updatedWidget) {
      setWidgets((prev) => prev.filter((w) => String(w.id) !== String(selectedWidgetId)));
      setLayout((prev) => prev.filter((l) => String(l.i) !== String(selectedWidgetId)));
      setSelectedWidgetId(null);
      return;
    }
    setWidgets((prev) => prev.map((w) => (String(w.id) === String(updatedWidget.id) ? updatedWidget : w)));
    if (updatedWidget.layout) {
      setLayout((prev) =>
        prev.map((l, idx) =>
          String(l.i) === String(updatedWidget.id)
            ? normalizeLayoutItem({ ...l, ...updatedWidget.layout }, idx, updatedWidget.id)
            : l,
        ),
      );
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
      const res = await previewWidget(widget.query);
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
    const currentLayout =
      layout.find((l) => String(l.i) === String(widget.id)) || normalizeLayoutItem({}, 0, widget.id);
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
      chart_config: {
        chart_type: widget.rawType === "graph" ? widget.type : undefined,
        color: widget.style?.color,
        bg: widget.style?.bg,
        fontSize: widget.style?.fontSize,
        borderRadius: widget.style?.borderRadius,
        section_id: widget.sectionId || null,
        contentAlign: widget.style?.contentAlign || "center",
        emptyTextPosition: widget.style?.emptyTextPosition || "center",
        kpiLabelPosition: widget.style?.kpiLabelPosition || "bottom",
        emptyText: widget.emptyText || "Click edit and add query",
      },
      layout: resolvedLayout,
      is_active: widget.is_active !== false,
      is_published: false,
    };

    try {
      setBusy(true);
      setLayout((prev) =>
        prev.map((l, idx) =>
          String(l.i) === String(widget.id) ? normalizeLayoutItem({ ...l, ...resolvedLayout }, idx, widget.id) : l,
        ),
      );
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
                emptyText: saved?.chart_config?.emptyText || "Click edit and add query",
                sectionId: saved?.chart_config?.section_id ?? null,
              }
            : w,
        ),
      );
      setLayout((prev) =>
        prev.map((l, idx) =>
          String(l.i) === String(widget.id) ? normalizeLayoutItem(l, idx, saved.id) : l,
        ),
      );
      setSelectedWidgetId(saved.id);
    } catch (err) {
      alert(err.message || "Failed to save widget.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteWidget = async (widget) => {
    if (!widget) return;
    try {
      setBusy(true);
      const isTemp = String(widget.id).startsWith("tmp_");
      if (!isTemp) await deleteWidget(widget.id);
      setWidgets((prev) => prev.filter((w) => String(w.id) !== String(widget.id)));
      setLayout((prev) => prev.filter((l) => String(l.i) !== String(widget.id)));
      setSelectedWidgetId(null);
    } catch (err) {
      alert(err.message || "Failed to delete widget.");
    } finally {
      setBusy(false);
    }
  };

  // Before publishing, extend each row's rightmost widget to fill blank columns on the right.
  const autoFillRowGaps = (layouts) => {
    const byRow = {};
    for (const l of layouts) {
      const key = String(l.y ?? 0);
      if (!byRow[key]) byRow[key] = [];
      byRow[key].push(l);
    }
    const filled = layouts.map((l) => ({ ...l }));
    for (const rowItems of Object.values(byRow)) {
      const sorted = [...rowItems].sort((a, b) => a.x - b.x);
      const rightEdge = Math.max(...sorted.map((l) => (l.x || 0) + (l.w || 1)));
      if (rightEdge < GRID_COLS) {
        const rightmost = sorted[sorted.length - 1];
        const idx = filled.findIndex((l) => l.i === rightmost.i);
        if (idx >= 0) filled[idx] = { ...filled[idx], w: GRID_COLS - (rightmost.x || 0) };
      }
    }
    return filled;
  };

  const handlePublishAll = async () => {
    if (widgets.length === 0) return;
    const errors = [];
    try {
      setBusy(true);
      // Auto-fill layout gaps so no blank space on the right of any row
      const filledLayout = autoFillRowGaps(layout);
      for (const widget of widgets) {
        const currentLayout =
          filledLayout.find((l) => String(l.i) === String(widget.id)) || normalizeLayoutItem({}, 0, widget.id);
        const resolvedLayout = normalizeLayoutItem(
          enforceLayoutByType(widget.rawType, currentLayout),
          0,
          widget.id,
        );
        const payload = {
          title: widget.title || (widget.rawType === "heading" ? "Heading" : "Widget"),
          description: widget.description || "",
          type: resolveApiType(widget),
          query: requiresDataQuery(widget.rawType) ? widget.query || "" : "",
          chart_config: {
            chart_type: widget.rawType === "graph" ? widget.type : undefined,
            color: widget.style?.color,
            bg: widget.style?.bg,
            fontSize: widget.style?.fontSize,
            borderRadius: widget.style?.borderRadius,
            section_id: widget.sectionId || null,
            contentAlign: widget.style?.contentAlign || "center",
            emptyTextPosition: widget.style?.emptyTextPosition || "center",
            kpiLabelPosition: widget.style?.kpiLabelPosition || "bottom",
            emptyText: widget.emptyText || "Click edit and add query",
          },
          layout: resolvedLayout,
          is_active: widget.is_active !== false,
          is_published: true,
        };

        try {
          const isTemp = String(widget.id).startsWith("tmp_");
          if (isTemp) {
            const created = await createWidget(payload);
            const createdId = created?.data?.id;
            if (createdId) await publishWidget(createdId);
          } else {
            await updateWidgetApi(widget.id, payload);
            await publishWidget(widget.id);
          }
        } catch (widgetErr) {
          errors.push(`"${payload.title}": ${widgetErr.message}`);
        }
      }
      await loadWidgets();
      if (errors.length > 0) {
        alert(`Published with errors:\n${errors.join("\n")}`);
      } else {
        alert("Dashboard published successfully!");
      }
    } catch (err) {
      alert(err.message || "Failed to publish dashboard.");
    } finally {
      setBusy(false);
    }
  };

  const handleCloneWidget = async (widget) => {
    if (!widget) return;

    const sourceLayout =
      layout.find((l) => String(l.i) === String(widget.id)) ||
      normalizeLayoutItem({}, layout.length, widget.id);
    const clonedLayout = {
      ...normalizeLayoutItem(sourceLayout, layout.length, widget.id),
      x: Math.min((sourceLayout.x ?? 0) + 1, 10),
      y: Infinity,
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
      setLayout((prev) => [...prev, normalizeLayoutItem(clonedLayout, prev.length, localId)]);
      setSelectedWidgetId(localId);
      return;
    }

    const payload = {
      title: `${widget.title || "Widget"} Copy`,
      description: widget.description || "",
      type: resolveApiType(widget),
      query: requiresDataQuery(widget.rawType) ? widget.query || "" : "",
      chart_config: {
        chart_type: widget.rawType === "graph" ? widget.type : undefined,
        color: widget.style?.color,
        bg: widget.style?.bg,
        fontSize: widget.style?.fontSize,
        borderRadius: widget.style?.borderRadius,
        section_id: widget.sectionId || null,
        contentAlign: widget.style?.contentAlign || "center",
        emptyTextPosition: widget.style?.emptyTextPosition || "center",
        kpiLabelPosition: widget.style?.kpiLabelPosition || "bottom",
        emptyText: widget.emptyText || "Click edit and add query",
      },
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
        emptyText: saved?.chart_config?.emptyText || "Click edit and add query",
        sectionId: saved?.chart_config?.section_id ?? null,
        previewData: null,
        previewError: null,
        style: {
          color: saved?.chart_config?.color || "#3b82f6",
          bg: saved?.chart_config?.bg || "#ffffff",
          fontSize: saved?.chart_config?.fontSize || 10,
          borderRadius: saved?.chart_config?.borderRadius || 6,
          contentAlign: saved?.chart_config?.contentAlign || "center",
          emptyTextPosition: saved?.chart_config?.emptyTextPosition || "center",
          kpiLabelPosition: saved?.chart_config?.kpiLabelPosition || "bottom",
        },
      };

      setWidgets((prev) => [...prev, mapped]);
      setLayout((prev) => [...prev, normalizeLayoutItem(clonedLayout, prev.length, saved.id)]);
      setSelectedWidgetId(saved.id);
    } catch (err) {
      alert(err.message || "Failed to clone widget.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans" style={{ minHeight: "100vh" }}>
      {/* ── LEFT: canvas area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!readOnly && (
          <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-10 shadow-sm shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
                <Layout className="text-white" size={18} />
              </div>
              <div className="flex flex-col">
                <p className="font-bold text-xs text-slate-800 uppercase tracking-tight">Analytics Dashboard</p>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5 flex items-center gap-1">
                  <MousePointer2 size={10} /> Builder Mode
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-lg mr-2 border border-slate-200">
                {BUILDER_WIDGET_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => addWidget(t)}
                    className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight text-slate-600 hover:text-blue-600 hover:bg-white transition-all"
                  >
                    <Plus size={11} className="inline mr-1" />
                    {t}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handlePublishAll}
                disabled={busy || widgets.length === 0}
                className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all"
              >
                <UploadCloud size={11} className="inline mr-1" />
                Publish
              </button>
            </div>
          </div>
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
          ref={containerRef}
          className={`flex-1 overflow-y-auto p-3 custom-scrollbar ${
            readOnly
              ? "bg-[#f8fafc]"
              : "bg-[#f8fafc] bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:18px_18px]"
          }`}
          onClick={() => { if (!readOnly) setSelectedWidgetId(null); }}
        >
          <div style={{ minHeight: "100%" }} onClick={(e) => e.stopPropagation()}>
            <Responsive
              className={`layout ${readOnly ? "dashboard-view-grid" : ""}`}
              width={canvasWidth}
              layouts={renderedLayouts}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
              cols={{ lg: GRID_COLS, md: GRID_COLS, sm: GRID_COLS, xs: GRID_COLS, xxs: GRID_COLS }}
              rowHeight={GRID_ROW_HEIGHT}
              onLayoutChange={!readOnly ? (current, all) => onLayoutChange(current, all) : undefined}
              compactType={null}
              preventCollision={true}
              draggableHandle=".widget-drag-handle"
              isDraggable={!readOnly}
              isResizable={!readOnly}
              resizeHandles={!readOnly ? ["s", "w", "e", "n", "sw", "nw", "se", "ne"] : []}
              margin={[GRID_GAP_X, GRID_GAP_Y]}
            >
              {visibleWidgets.map((widget) => (
                <div
                  key={String(widget.id)}
                  className={`group relative transition-all duration-150 ${String(selectedWidgetId) === String(widget.id) ? "z-20" : "z-10"}`}
                  onClick={(e) => {
                    if (readOnly) return;
                    e.stopPropagation();
                    setSelectedWidgetId(widget.id);
                  }}
                >
                  {!readOnly && String(selectedWidgetId) === String(widget.id) && (
                    <div className="absolute -inset-2 border-2 border-blue-500 rounded-[12px] pointer-events-none z-0" />
                  )}
                  {!readOnly && String(selectedWidgetId) === String(widget.id) && (
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
                  {!readOnly && (
                    <div className="widget-drag-handle absolute top-2 left-2 h-6 px-2 cursor-move opacity-0 group-hover:opacity-100 bg-white shadow border border-slate-100 rounded-md flex items-center justify-center z-30 transition-all">
                      <GripVertical size={14} className="text-slate-400" />
                    </div>
                  )}
                  <WidgetRenderer widget={widget} />
                </div>
              ))}
            </Responsive>
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

      {/* ── RIGHT: property panel (builder only, dashboard is full width) ── */}
      {!readOnly && (
        <div className="w-[300px] flex-shrink-0 border-l border-slate-200 h-full overflow-hidden bg-white z-10">
          <PropertyPanel
            selectedWidget={selectedWidget}
            onUpdate={updateWidgetLocal}
            onPreview={handlePreview}
            onSave={handleSaveWidget}
            onDelete={handleDeleteWidget}
            onPixelSizeChange={handlePixelSizeChange}
            widthPx={widthPx}
            heightPx={heightPx}
            onClose={() => setSelectedWidgetId(null)}
            busy={busy}
          />
        </div>
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
        .dashboard-view-grid .react-resizable-handle {
          display: none !important;
          pointer-events: none !important;
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

