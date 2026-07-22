import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTables, hybridPreviewWidget } from "../services/dashboardApi";
import { Database, Palette, Table2, Code, Trash2, Info, Eye, Save, X, ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import { DASHBOARD_WIDGET_QUERY_PLACEHOLDER, getDashboardQueryRuntimeFilters } from "../utils/widgetQuery.js";
import { EXTERNAL_MSSQL_QUERY_PLACEHOLDER, isExternalMssqlDbSource, isHybridDbSource, isWidgetHybridMode, resolveHybridExternalDbSource } from "../utils/dashboardDbSources.js";
import { APPS } from "@/config/appsRegistry";
import { getAppNavPages } from "../utils/appNavPages";
import { DEFAULT_WIDGET_BOX_SHADOW, STRONG_WIDGET_BOX_SHADOW } from "../utils/floatingLayoutEngine";
import { normalizeWidgetLinkType } from "../utils/widgetClickLink";
import {
  normalizeTableSearchPosition,
  normalizeTableSearchWidth,
  TABLE_SEARCH_POSITION_OPTIONS,
} from "../utils/tableToolbar.js";

const BLOCKED_SQL = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i;
const REQUIRES_SQL = new Set(["kpi", "table", "graph"]);

const GRAPH_COLOR_PALETTES = {
  ocean: ["#3b82f6", "#60a5fa", "#38bdf8", "#0ea5e9", "#06b6d4", "#22d3ee", "#67e8f9", "#a5f3fc"],
  forest: ["#16a34a", "#22c55e", "#4ade80", "#86efac", "#15803d", "#65a30d", "#a3e635", "#bef264"],
  sunset: ["#f97316", "#fb923c", "#f59e0b", "#fbbf24", "#ef4444", "#f43f5e", "#e11d48", "#fb7185"],
  violet: ["#7c3aed", "#8b5cf6", "#a855f7", "#c084fc", "#6366f1", "#818cf8", "#a78bfa", "#c4b5fd"],
  slate: ["#0f172a", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1", "#1e293b", "#3b82f6"],
  rainbow: ["#ef4444", "#f59e0b", "#84cc16", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"],
};

function normalizeHexColor(value, fallback = "#3b82f6") {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

const COLOR_PRESETS = [
  "#0f172a", "#334155", "#64748b", "#94a3b8",
  "#ffffff", "#fecaca", "#fed7aa", "#fef08a",
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

/**
 * Do NOT use <input type="color"> — Chrome's OS color dialog freezes the tab when React
 * re-renders during / right after pick. Custom swatch + hex + presets stays responsive.
 */
function ColorPickerInput({
  value,
  fallback = "#3b82f6",
  className = "w-full h-9 bg-slate-50 border border-slate-200 rounded-md cursor-pointer",
  onCommit,
  resetKey = "",
  title,
}) {
  const committed = normalizeHexColor(value, fallback);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(committed);
  const [hexText, setHexText] = useState(committed);
  const rootRef = useRef(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    setDraft(committed);
    setHexText(committed);
  }, [committed, resetKey]);

  useEffect(() => {
    if (!open) return undefined;
    try {
      document.body?.classList?.remove?.(
        "react-draggable-transparent-selection",
        "floating-canvas-interacting",
      );
    } catch {
      /* ignore */
    }
    const onDocDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const commitColor = (raw) => {
    const next = normalizeHexColor(raw, fallback);
    setDraft(next);
    setHexText(next);
    if (next === normalizeHexColor(value, fallback)) return;
    // Defer so the popover close / click target isn't blocked by a heavy canvas update.
    window.setTimeout(() => {
      onCommitRef.current?.(next);
    }, 0);
  };

  const compact = /\babsolute\b/.test(className) || /opacity-0/.test(className);

  return (
    <div ref={rootRef} className={`relative ${compact ? "h-full w-full" : "w-full"}`}>
      <button
        type="button"
        title={title || draft}
        aria-label={title || "Pick color"}
        className={compact
          ? "block h-full w-full cursor-pointer border-0 p-0"
          : className}
        style={{ backgroundColor: draft }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      />
      {open ? (
        <div
          className="absolute left-0 top-full z-[220] mt-1 w-[200px] rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className="h-7 w-7 shrink-0 rounded border border-slate-200"
              style={{ backgroundColor: draft }}
            />
            <input
              type="text"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-700"
              value={hexText}
              onChange={(e) => {
                const raw = e.target.value.trim();
                setHexText(raw);
                if (/^#[0-9a-fA-F]{6}$/.test(raw) || /^#[0-9a-fA-F]{3}$/.test(raw)) {
                  const next = normalizeHexColor(raw, fallback);
                  setDraft(next);
                }
              }}
              onBlur={() => commitColor(hexText)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitColor(hexText);
                  setOpen(false);
                }
              }}
            />
          </div>
          <div className="grid grid-cols-8 gap-1">
            {COLOR_PRESETS.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                className={`h-5 w-5 rounded border ${draft === hex ? "border-blue-500 ring-1 ring-blue-300" : "border-slate-200"}`}
                style={{ backgroundColor: hex }}
                onClick={() => {
                  commitColor(hex);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SimpleToggle({ checked = false, onChange, label, hint = "" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <div className="min-w-0">
          <span className="block text-[11px] font-semibold text-slate-700">{label}</span>
          {hint ? <span className="block text-[9px] text-slate-400 mt-0.5">{hint}</span> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange?.(!checked)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-slate-200"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`}
          />
        </button>
      </label>
    </div>
  );
}

function SegmentControl({ value, options = [], onChange }) {
  return (
    <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange?.(opt.value)}
          className={`flex-1 rounded px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
            value === opt.value
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function PanelFieldLabel({ children, className = "" }) {
  return (
    <label className={`block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 ${className}`}>
      {children}
    </label>
  );
}
function validateSelectOnlyFrontend(query) {
  const q = String(query || "").trim();
  if (!q) return "Query is required.";
  const cleaned = q.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (!(cleaned.toUpperCase().startsWith("SELECT") || cleaned.toUpperCase().startsWith("WITH"))) {
    return "Only SELECT query allowed.";
  }
  const withoutTrailing = cleaned.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) return "Multiple statements are not allowed.";
  if (BLOCKED_SQL.test(cleaned)) return "Only read-only SELECT query allowed.";
  return "";
}

const PropertyPanel = ({
  selectedWidget,
  onUpdate,
  onPreview,
  onSave,
  onDelete,
  onClose,
  onPixelSizeChange,
  onAddChildWidget,
  onMoveWidgetIntoContainer,
  movableWidgets = [],
  isPhoneBuilderMode = false,
  appKey = "ims",
  pageOptions = [],
  dbSourceOptions = [],
  widthPx = 0,
  heightPx = 0,
  minWidthPx,
  minHeightPx,
  busy = false,
  hideHeader = false,
  canFilterByUser = false,
}) => {
  const [tables, setTables] = useState([]);
  const [activeTab, setActiveTab] = useState("data");
  const [validationError, setValidationError] = useState("");
  const [hybridStep, setHybridStep] = useState(1);
  const [hybridExternalPreview, setHybridExternalPreview] = useState([]);
  const [hybridColumns, setHybridColumns] = useState([]);
  const [hybridExternalRowCount, setHybridExternalRowCount] = useState(0);
  const [hybridLoading, setHybridLoading] = useState(false);
  const [hybridError, setHybridError] = useState("");

  useEffect(() => {
    setHybridExternalPreview([]);
    setHybridColumns([]);
    setHybridExternalRowCount(0);
    setHybridError("");
    setHybridStep(1);
  }, [selectedWidget.id]);
  const [tablesCollapsed, setTablesCollapsed] = useState(true);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [copiedTable, setCopiedTable] = useState("");
  const [copiedFilter, setCopiedFilter] = useState("");
  const availableFilters = getDashboardQueryRuntimeFilters({ canFilterByUser });
  const resolvedMinWidthPx = minWidthPx ?? (isPhoneBuilderMode ? 24 : 80);
  const resolvedMinHeightPx = minHeightPx ?? resolvedMinWidthPx;
  const inputMinPx = Math.max(16, Math.min(resolvedMinWidthPx, resolvedMinHeightPx, 40));
  const linkAppPages = useMemo(() => {
    const appId = selectedWidget?.linkAppId || "";
    if (!appId) return [];
    return getAppNavPages(appId).filter((p) => p.href);
  }, [selectedWidget?.linkAppId]);
  const linkType = normalizeWidgetLinkType(selectedWidget?.linkType);
  const [draftWidthPx, setDraftWidthPx] = useState(widthPx);
  const [draftHeightPx, setDraftHeightPx] = useState(heightPx);
  const [draftStyle, setDraftStyle] = useState(null);
  const styleFlushTimerRef = useRef(null);
  const pendingStyleRef = useRef(null);
  const selectedWidgetRef = useRef(selectedWidget);
  selectedWidgetRef.current = selectedWidget;
  const isTableWidget = selectedWidget?.rawType === "table";
  const displayStyle = {
    ...(selectedWidget?.style || {}),
    ...(draftStyle || {}),
  };

  useEffect(() => {
    setDraftStyle(null);
    pendingStyleRef.current = null;
    if (styleFlushTimerRef.current) {
      window.clearTimeout(styleFlushTimerRef.current);
      styleFlushTimerRef.current = null;
    }
  }, [selectedWidget?.id]);

  useEffect(() => () => {
    if (styleFlushTimerRef.current) window.clearTimeout(styleFlushTimerRef.current);
  }, []);

  useEffect(() => {
    if (selectedWidget?.rawType !== "table") {
      setActiveTab((tab) => (tab === "table" ? "data" : tab));
    }
  }, [selectedWidget?.id, selectedWidget?.rawType]);

  useEffect(() => {
    setDraftWidthPx(widthPx);
    setDraftHeightPx(heightPx);
  }, [selectedWidget?.id, widthPx, heightPx]);

  useEffect(() => {
    if (!selectedWidget || !REQUIRES_SQL.has(selectedWidget.rawType)) {
      setTables([]);
      return;
    }
    const tableDbSource = isHybridDbSource(selectedWidget.dataSource)
      ? "ims_postgresql"
      : (selectedWidget.dataSource || "ims_postgresql");
    getTables({ appKey, dbSource: tableDbSource })
      .then((res) => setTables(res.data || []))
      .catch(() => setTables([]));
  }, [appKey, selectedWidget?.id, selectedWidget?.rawType, selectedWidget?.dataSource]);

  if (!selectedWidget) {
    return (
      <div className="w-full bg-white p-6 h-full flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center mb-3 border border-slate-100">
          <Info className="text-slate-300" size={18} />
        </div>
        <h3 className="text-slate-800 font-bold text-xs mb-1 uppercase tracking-wider">Widget Builder</h3>
        <p className="text-slate-400 text-[10px] leading-relaxed">
          Select any widget on canvas to edit settings.
        </p>
      </div>
    );
  }
  const isExternalSqlServer = isExternalMssqlDbSource(selectedWidget.dataSource);
  const isHybrid = isWidgetHybridMode(selectedWidget);
  const hybridExternalSource = resolveHybridExternalDbSource(selectedWidget);

  const flushStylePatch = useCallback(() => {
    const patchStyle = pendingStyleRef.current;
    pendingStyleRef.current = null;
    styleFlushTimerRef.current = null;
    const widget = selectedWidgetRef.current;
    if (!patchStyle || !widget || !onUpdate) return widget;
    const nextStyle = {
      ...(widget.style || {}),
      ...patchStyle,
    };
    const next = {
      ...widget,
      style: nextStyle,
    };
    selectedWidgetRef.current = next;
    // Style-only payload — avoid re-sending layout so parent can skip layout work.
    onUpdate({
      id: widget.id,
      rawType: widget.rawType,
      type: widget.type,
      style: nextStyle,
    });
    setDraftStyle(null);
    return next;
  }, [onUpdate]);

  const applyWidgetPatch = useCallback((patch, options = {}) => {
    const widget = selectedWidgetRef.current;
    if (!widget || !onUpdate) return;
    const debounceMs = Number(options.debounceMs) || 0;
    const patchKeys = Object.keys(patch || {});
    const styleOnlyPatch = patchKeys.length > 0 && patchKeys.every((key) => key === "style");

    if (debounceMs > 0 && styleOnlyPatch && patch.style) {
      const mergedStyle = {
        ...(pendingStyleRef.current || {}),
        ...patch.style,
      };
      pendingStyleRef.current = mergedStyle;
      setDraftStyle((prev) => ({ ...(prev || {}), ...patch.style }));
      if (styleFlushTimerRef.current) window.clearTimeout(styleFlushTimerRef.current);
      styleFlushTimerRef.current = window.setTimeout(flushStylePatch, debounceMs);
      return;
    }
    if (styleFlushTimerRef.current) {
      window.clearTimeout(styleFlushTimerRef.current);
      styleFlushTimerRef.current = null;
    }
    const pending = pendingStyleRef.current;
    pendingStyleRef.current = null;

    if (styleOnlyPatch || (patch.style && !patch.layout && !patch.mobileLayout && patchKeys.every((k) => k === "style" || k === "title" || k === "emptyText" || k === "type" || k === "rawType"))) {
      const nextStyle = {
        ...(widget.style || {}),
        ...(pending || {}),
        ...(patch.style || {}),
      };
      const next = {
        ...widget,
        ...patch,
        style: nextStyle,
      };
      selectedWidgetRef.current = next;
      setDraftStyle(null);
      onUpdate({
        id: widget.id,
        rawType: patch.rawType ?? widget.rawType,
        type: patch.type ?? widget.type,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.emptyText !== undefined ? { emptyText: patch.emptyText } : {}),
        style: nextStyle,
      });
      return;
    }

    const next = {
      ...widget,
      ...patch,
      style: {
        ...(widget.style || {}),
        ...(pending || {}),
        ...(patch.style || {}),
      },
    };
    if (patch.layout) {
      next.layout = {
        ...(widget.layout || {}),
        ...patch.layout,
      };
    }
    if (patch.mobileLayout) {
      next.mobileLayout = {
        ...(widget.mobileLayout || {}),
        ...patch.mobileLayout,
      };
    }
    selectedWidgetRef.current = next;
    setDraftStyle(null);
    onUpdate(next);
  }, [flushStylePatch, onUpdate]);

  const handleChange = (path, value, options = {}) => {
    const parts = path.split(".");
    if (parts.length === 1) {
      applyWidgetPatch({ [parts[0]]: value }, options);
      return;
    }
    if (parts[0] === "style" && parts.length === 2) {
      applyWidgetPatch({ style: { [parts[1]]: value } }, options);
      return;
    }
    const widget = selectedWidgetRef.current;
    if (!widget || !onUpdate) return;
    const updated = { ...widget };
    let current = updated;
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = { ...(current[parts[i]] || {}) };
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    onUpdate(updated);
  };

  const handleHybridExternalPreview = async () => {
    try {
      setHybridLoading(true);
      setHybridError("");
      const current = selectedWidgetRef.current || selectedWidget;
      const mssqlQuery = current.chart_config?.hybrid_mssql_query || "";
      if (!mssqlQuery.trim()) {
        setHybridError("Please enter an external query first.");
        return;
      }

      const res = await hybridPreviewWidget({
        mssql_query: mssqlQuery,
        db_source: resolveHybridExternalDbSource(current),
        filters: {},
        stage_only: true,
      });

      const sampleRows = Array.isArray(res?.data) ? res.data : [];
      const columns = Array.isArray(res?.columns) && res.columns.length
        ? res.columns
        : (sampleRows[0] ? Object.keys(sampleRows[0]) : []);
      const externalRowCount = Number(res?.external_row_count) || sampleRows.length;

      setHybridExternalPreview(sampleRows);
      setHybridColumns(columns);
      setHybridExternalRowCount(externalRowCount);

      if (!String(current.query || "").trim()) {
        applyWidgetPatch({
          query: "SELECT * FROM {{temp_erp_data}}",
          chart_config: {
            ...(current.chart_config || {}),
            is_hybrid: true,
          },
        });
      }

      setHybridStep(2);
    } catch (err) {
      setHybridError(err.message || "Failed to preview external data.");
    } finally {
      setHybridLoading(false);
    }
  };

  const handlePreview = () => {
    if (pendingStyleRef.current) flushStylePatch();
    const widget = selectedWidgetRef.current || selectedWidget;
    const parsedWidth = Math.max(resolvedMinWidthPx, Number(widthPx) || resolvedMinWidthPx);
    const parsedHeight = Math.max(resolvedMinHeightPx, Number(heightPx) || resolvedMinHeightPx);
    onPixelSizeChange?.({
      widthPx: parsedWidth,
      heightPx: parsedHeight,
    });
    if (!REQUIRES_SQL.has(widget.rawType)) {
      setValidationError("");
      onPreview?.(widget, { widthPx: parsedWidth, heightPx: parsedHeight });
      return;
    }
    if (isExternalSqlServer || isHybrid) {
      setValidationError("");
      onPreview?.(widget, { widthPx: parsedWidth, heightPx: parsedHeight });
      return;
    }
    const err = validateSelectOnlyFrontend(widget.query);
    setValidationError(err);
    if (err) return;
    onPreview?.(widget, { widthPx: parsedWidth, heightPx: parsedHeight });
  };

  const handleSave = () => {
    if (pendingStyleRef.current) flushStylePatch();
    const widget = selectedWidgetRef.current || selectedWidget;
    const parsedWidth = Math.max(resolvedMinWidthPx, Number(widthPx) || resolvedMinWidthPx);
    const parsedHeight = Math.max(resolvedMinHeightPx, Number(heightPx) || resolvedMinHeightPx);
    onPixelSizeChange?.({
      widthPx: parsedWidth,
      heightPx: parsedHeight,
    });
    if (!REQUIRES_SQL.has(widget.rawType)) {
      setValidationError("");
      onSave?.(widget, { widthPx: parsedWidth, heightPx: parsedHeight });
      return;
    }
    if (isExternalSqlServer || isHybrid) {
      setValidationError("");
      onSave?.(widget, { widthPx: parsedWidth, heightPx: parsedHeight });
      return;
    }
    const err = validateSelectOnlyFrontend(widget.query);
    setValidationError(err);
    if (err) return;
    onSave?.(widget, { widthPx: parsedWidth, heightPx: parsedHeight });
  };

  const handleDatabaseChange = (nextSource) => {
    const currentConfig = selectedWidget.chart_config || {};
    if (isHybridDbSource(nextSource)) {
      const nextQuery = String(selectedWidget.query || "").trim()
        ? selectedWidget.query
        : "SELECT * FROM {{temp_erp_data}}";
      applyWidgetPatch({
        dataSource: "hybrid",
        query: nextQuery,
        chart_config: {
          ...currentConfig,
          is_hybrid: true,
          hybrid_external_source: currentConfig.hybrid_external_source || "erp_mssql",
        },
      });
      setHybridStep(1);
      return;
    }
    applyWidgetPatch({
      dataSource: nextSource,
      query: String(selectedWidget.query || "").includes("{{temp_erp_data}}")
        ? ""
        : selectedWidget.query,
      chart_config: {
        ...currentConfig,
        is_hybrid: false,
      },
    });
  };

  const insertTableName = (tableName) => {
    if (!REQUIRES_SQL.has(selectedWidget.rawType)) {
      setCopiedTable("");
      return;
    }
    const currentQuery = String(selectedWidget.query || "").trim();
    const nextQuery = currentQuery
      ? `${currentQuery}\n${tableName}`
      : `SELECT * FROM ${tableName}`;
    handleChange("query", nextQuery);
    setCopiedTable(tableName);
    setTimeout(() => setCopiedTable(""), 1200);
  };

  const insertFilterToken = (token) => {
    if (!REQUIRES_SQL.has(selectedWidget?.rawType)) return;
    const currentQuery = String(selectedWidget.query || "");
    if (currentQuery.includes(token)) return;
    const trimmed = currentQuery.trim();
    const nextQuery = trimmed
      ? `${trimmed} ${token}`
      : `SELECT * FROM your_table WHERE your_column = ${token}`;
    handleChange("query", nextQuery);
    setCopiedFilter(token);
    setTimeout(() => setCopiedFilter(""), 1200);
  };

  const panelTabs = (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg shrink-0">
      <button
        type="button"
        onClick={() => setActiveTab("data")}
        className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
          activeTab === "data" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
        }`}
      >
        <Database size={12} />
        Data
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("style")}
        className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
          activeTab === "style" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
        }`}
      >
        <Palette size={12} />
        Style
      </button>
      {isTableWidget && (
        <button
          type="button"
          onClick={() => setActiveTab("table")}
          className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
            activeTab === "table" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
          }`}
        >
          <Table2 size={12} />
          Table
        </button>
      )}
    </div>
  );

  return (
    <div
      className="widget-builder-panel w-full bg-white h-full flex flex-col overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {!hideHeader && (
      <div className="px-2.5 py-2 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <h3 className="font-bold text-[11px] uppercase tracking-widest text-slate-800">Widget Builder</h3>
        <button
          type="button"
          title="Close panel"
          onClick={() => onClose?.()}
          className="h-7 w-7 grid place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-700"
        >
          <X size={14} />
        </button>
      </div>
      )}

      <div className="px-2.5 pt-2 pb-1.5 border-b border-slate-100 bg-white shrink-0">
        {panelTabs}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 py-2.5 space-y-2.5 bg-slate-50/30">
        {activeTab === "data" ? (
          <>
            <div className="space-y-1">
              <PanelFieldLabel>Widget Type</PanelFieldLabel>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { key: "kpi", label: "KPI" },
                  { key: "table", label: "Table" },
                  { key: "graph", label: "Graph" },
                  { key: "heading", label: "Head" },
                  { key: "container", label: "Box" },
                ].map((t) => (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => {
                      setValidationError("");
                      const currentGraphType = ["bar", "line", "pie"].includes(selectedWidget.type)
                        ? selectedWidget.type
                        : "bar";
                      if (t.key === "kpi") {
                        applyWidgetPatch({ rawType: "kpi", type: "kpi" });
                        return;
                      }
                      if (t.key === "graph") {
                        applyWidgetPatch({ rawType: "graph", type: currentGraphType });
                        return;
                      }
                      if (t.key === "heading") {
                        applyWidgetPatch({ rawType: "heading", type: "heading", query: "" });
                        return;
                      }
                      if (t.key === "container") {
                        applyWidgetPatch({ rawType: "container", type: "container", query: "", containerPreset: "full" });
                        return;
                      }
                      applyWidgetPatch({ rawType: "table", type: "table" });
                    }}
                    className={`px-1 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all border ${
                      selectedWidget.rawType === t.key
                        ? "bg-blue-600 border-blue-600 text-white shadow-md"
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <PanelFieldLabel>Page Access</PanelFieldLabel>
                <select
                  value={selectedWidget.targetPageKey || "dashboard"}
                  onChange={(e) => {
                    const nextPage = pageOptions.find((opt) => opt.value === e.target.value);
                    applyWidgetPatch({
                      targetPageKey: e.target.value,
                      targetPageModule: nextPage?.module || null,
                    });
                  }}
                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                >
                  {pageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <PanelFieldLabel>Database</PanelFieldLabel>
                <select
                  value={selectedWidget.dataSource || "ims_postgresql"}
                  onChange={(e) => handleDatabaseChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                >
                  {dbSourceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedWidget.rawType !== "container" && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 space-y-2">
                <PanelFieldLabel>Click Link (open on click)</PanelFieldLabel>
                <select
                  value={linkType}
                  onChange={(e) => {
                    const next = normalizeWidgetLinkType(e.target.value);
                    applyWidgetPatch({
                      linkType: next,
                      linkUrl: next === "NONE" ? "" : (selectedWidget.linkUrl || ""),
                      linkAppId: next === "APP" ? (selectedWidget.linkAppId || "") : "",
                      linkPageId: next === "APP" ? (selectedWidget.linkPageId || "") : "",
                    });
                  }}
                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                >
                  <option value="NONE">No link</option>
                  <option value="URL">External / Custom URL</option>
                  <option value="APP">ERP Module Page</option>
                </select>

                {linkType === "URL" && (
                  <div>
                    <PanelFieldLabel>URL / Path</PanelFieldLabel>
                    <input
                      type="text"
                      value={selectedWidget.linkUrl || ""}
                      onChange={(e) => applyWidgetPatch({ linkUrl: e.target.value, linkType: "URL" })}
                      placeholder="https://... or /ims/dashboard/..."
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                    />
                  </div>
                )}

                {linkType === "APP" && (
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <PanelFieldLabel>Choose App</PanelFieldLabel>
                      <select
                        value={selectedWidget.linkAppId || ""}
                        onChange={(e) => {
                          applyWidgetPatch({
                            linkType: "APP",
                            linkAppId: e.target.value,
                            linkPageId: "",
                            linkUrl: "",
                          });
                        }}
                        className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        <option value="">-- Select App --</option>
                        {APPS.filter((a) => a.id !== "home").map((app) => (
                          <option key={app.id} value={app.id}>{app.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <PanelFieldLabel>Choose Page</PanelFieldLabel>
                      <select
                        value={selectedWidget.linkPageId || ""}
                        disabled={!selectedWidget.linkAppId}
                        onChange={(e) => {
                          const page = linkAppPages.find((p) => p.value === e.target.value);
                          applyWidgetPatch({
                            linkType: "APP",
                            linkPageId: e.target.value,
                            linkUrl: page?.href || "",
                          });
                        }}
                        className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
                      >
                        <option value="">-- Select Page --</option>
                        {linkAppPages.map((page) => (
                          <option key={page.value} value={page.value}>{page.label}</option>
                        ))}
                      </select>
                    </div>
                    {selectedWidget.linkUrl ? (
                      <p className="text-[10px] text-slate-400 truncate" title={selectedWidget.linkUrl}>
                        {selectedWidget.linkUrl}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {selectedWidget.rawType === "graph" && (
              <div>
                <PanelFieldLabel>Chart Type</PanelFieldLabel>
                <div className="grid grid-cols-4 gap-1">
                  {["bar", "line", "pie", "area"].map((chartType) => (
                    <button
                      type="button"
                      key={chartType}
                      onClick={() => handleChange("type", chartType)}
                      className={`px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all border ${
                        selectedWidget.type === chartType
                          ? "bg-blue-600 border-blue-600 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {chartType}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedWidget.rawType === "graph" && (() => {
              const previewRows = Array.isArray(selectedWidget.previewData) && selectedWidget.previewData.length
                ? selectedWidget.previewData
                : (Array.isArray(selectedWidget.data) ? selectedWidget.data : []);
              const columns = previewRows[0] && typeof previewRows[0] === "object"
                ? Object.keys(previewRows[0])
                : [];
              if (!columns.length) {
                return (
                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] text-slate-500">
                    Run Preview to load columns, then set X/Y and colors.
                  </div>
                );
              }
              return (
                <div className="space-y-2 rounded border border-slate-200 bg-white p-2">
                  <PanelFieldLabel>Columns (from preview)</PanelFieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-500 mb-1">X / Label</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700"
                        value={selectedWidget.style?.graphXKey || columns[0]}
                        onChange={(e) => handleChange("style.graphXKey", e.target.value)}
                      >
                        {columns.map((col) => (
                          <option key={`x-${col}`} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-500 mb-1">Y / Value</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700"
                        value={selectedWidget.style?.graphYKey || columns[1] || columns[0]}
                        onChange={(e) => handleChange("style.graphYKey", e.target.value)}
                      >
                        {columns.map((col) => (
                          <option key={`y-${col}`} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 truncate">
                    Columns: {columns.join(", ")}
                  </p>
                </div>
              );
            })()}

            {selectedWidget.rawType === "container" && (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Quick Width</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "full", label: "Full" },
                      { key: "half", label: "Half" },
                    ].map((preset) => (
                      <button
                        type="button"
                        key={preset.key}
                        onClick={() => applyWidgetPatch({ containerPreset: preset.key, layoutLocked: true })}
                        className={`px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
                          (selectedWidget.containerPreset || "full") === preset.key
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-white border-slate-200 text-slate-500"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    {isPhoneBuilderMode ? "Add New (Phone Layout)" : "Add New Widget Inside"}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {["kpi", "table", "graph", "heading"].map((childType) => (
                      <button
                        type="button"
                        key={`child-${childType}`}
                        onClick={() => onAddChildWidget?.(selectedWidget.id, childType)}
                        className="px-2 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200"
                      >
                        + {childType}
                      </button>
                    ))}
                  </div>
                </div>
                {movableWidgets.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Move Existing Widget Here
                    </p>
                    <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                      {movableWidgets.map((widget) => (
                        <button
                          type="button"
                          key={`move-${widget.id}`}
                          onClick={() => onMoveWidgetIntoContainer?.(selectedWidget.id, widget.id)}
                          className="w-full text-left px-2 py-1.5 rounded-md text-[10px] font-semibold border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 truncate"
                          title={widget.title || widget.rawType}
                        >
                          → {widget.title?.trim() || widget.rawType || "Widget"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Phone Inner Spacing (px)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "mobilePaddingLeft", label: "Left" },
                      { key: "mobilePaddingRight", label: "Right" },
                      { key: "mobilePaddingTop", label: "Top" },
                      { key: "mobilePaddingBottom", label: "Bottom" },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{field.label}</label>
                        <input
                          type="number"
                          min={0}
                          max={80}
                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                          value={selectedWidget[field.key] ?? selectedWidget.style?.[field.key] ?? 8}
                          onChange={(e) => handleChange(field.key, Math.max(0, Number(e.target.value) || 0))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {REQUIRES_SQL.has(selectedWidget.rawType) && (
              <div className="space-y-3">
                {isHybrid ? (
                  <div className="space-y-4">
                    {/* Step 1: External Source & Query */}
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
                      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${hybridStep >= 1 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>1</div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Load ERP / HRMS data</span>
                        </div>
                        {hybridStep === 2 && (
                          <button onClick={() => setHybridStep(1)} className="text-[9px] text-blue-600 font-bold hover:underline">Edit Step 1</button>
                        )}
                      </div>
                      
                      {hybridStep === 1 ? (
                        <div className="p-3 space-y-3">
                          <div>
                            <PanelFieldLabel>External database</PanelFieldLabel>
                            <select
                              value={hybridExternalSource}
                              onChange={(e) => applyWidgetPatch({
                                chart_config: {
                                  ...(selectedWidget.chart_config || {}),
                                  hybrid_external_source: e.target.value,
                                  is_hybrid: true,
                                },
                              })}
                              className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                            >
                              {dbSourceOptions.filter(opt => isExternalMssqlDbSource(opt.value)).map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <PanelFieldLabel>ERP SQL (First DB)</PanelFieldLabel>
                            <div className="relative">
                              <Code size={13} className="absolute top-2.5 left-2.5 text-slate-400 pointer-events-none" />
                              <textarea
                                className="w-full bg-slate-900 border-none focus:ring-2 focus:ring-blue-500/20 rounded-md px-2.5 py-2 pl-8 text-[10px] font-mono text-blue-100 min-h-[120px] max-h-[200px] shadow-inner custom-scrollbar leading-relaxed"
                                placeholder={EXTERNAL_MSSQL_QUERY_PLACEHOLDER}
                                value={selectedWidget.chart_config?.hybrid_mssql_query || ""}
                                onChange={(e) => {
                                  const current = selectedWidgetRef.current || selectedWidget;
                                  applyWidgetPatch({
                                    chart_config: {
                                      ...(current.chart_config || {}),
                                      hybrid_mssql_query: e.target.value,
                                      is_hybrid: true,
                                    },
                                  });
                                }}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={hybridLoading}
                            onClick={handleHybridExternalPreview}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2"
                          >
                            {hybridLoading ? (
                              <>
                                <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Fetching...
                              </>
                            ) : (
                              <>
                                <Database size={12} />
                                Preview ERP query
                              </>
                            )}
                          </button>
                          {hybridError && <p className="text-[9px] text-rose-500 font-semibold">{hybridError}</p>}
                        </div>
                      ) : (
                        <div className="px-3 py-2 bg-emerald-50/50 border-b border-emerald-100 space-y-1.5">
                          <p className="text-[9px] text-emerald-800 font-semibold">
                            ERP ready → in Step 2 use{" "}
                            <code className="bg-emerald-100 px-1 rounded font-mono font-bold">{"{{temp_erp_data}}"}</code>
                          </p>
                          {hybridColumns.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {hybridColumns.map((col) => (
                                <span
                                  key={col}
                                  className="px-1 py-0.5 rounded bg-white border border-emerald-200 text-[8px] font-mono text-emerald-800"
                                  title="Column from ERP result"
                                >
                                  {col}
                                </span>
                              ))}
                            </div>
                          )}
                          {hybridExternalRowCount > 0 && (
                            <p className="text-[8px] text-emerald-600">
                              {hybridExternalPreview.length > 0
                                ? `Showing ${hybridExternalPreview.length} of ${hybridExternalRowCount.toLocaleString()} ERP rows`
                                : `${hybridExternalRowCount.toLocaleString()} ERP rows`}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Step 2: PostgreSQL Merge Query */}
                    <div className={`rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm ${hybridStep < 2 ? "opacity-50 pointer-events-none" : ""}`}>
                      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center gap-2">
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${hybridStep >= 2 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>2</div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Join with PostgreSQL</span>
                      </div>
                      <div className="p-3 space-y-3">
                        <div>
                          <PanelFieldLabel>Final SQL Query (PostgreSQL)</PanelFieldLabel>
                          <div className="relative">
                            <Code size={13} className="absolute top-2.5 left-2.5 text-slate-400 pointer-events-none" />
                            <textarea
                              className="w-full bg-slate-900 border-none focus:ring-2 focus:ring-blue-500/20 rounded-md px-2.5 py-2 pl-8 text-[10px] font-mono text-blue-100 min-h-[120px] max-h-[200px] shadow-inner custom-scrollbar leading-relaxed"
                              placeholder={"-- Example:\nSELECT e.*, t.local_col\nFROM {{temp_erp_data}} e\nLEFT JOIN your_pg_table t ON t.id = e.\"Item_Code\""}
                              value={selectedWidget.query || ""}
                              onChange={(e) => {
                                setValidationError("");
                                handleChange("query", e.target.value);
                              }}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handlePreview}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          <Eye size={12} />
                          Run merge query
                        </button>

                        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setFiltersCollapsed((prev) => !prev)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 text-[9px] text-emerald-700 font-bold uppercase tracking-widest bg-emerald-50/90"
                          >
                            <span>Available Filters ({availableFilters.length})</span>
                            {filtersCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                          </button>
                          {!filtersCollapsed && (
                            <div className="flex flex-wrap gap-1 p-2 border-t border-slate-100">
                              {availableFilters.map((filter) => {
                                const isCopied = copiedFilter === filter.token;
                                return (
                                  <button
                                    key={filter.token}
                                    type="button"
                                    onClick={() => insertFilterToken(filter.token)}
                                    className="px-1.5 py-0.5 bg-slate-50 rounded text-[9px] text-slate-600 font-mono border border-emerald-100 hover:border-emerald-300 hover:text-emerald-800 inline-flex items-center gap-1"
                                    title={`${filter.label} — ${filter.hint}`}
                                  >
                                    {isCopied ? <Check size={10} /> : <Copy size={10} />}
                                    {filter.token}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setTablesCollapsed((prev) => !prev)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 text-[9px] text-blue-600 font-bold uppercase tracking-widest bg-blue-50/90 border-t border-slate-100"
                          >
                            <span>Available Tables ({tables.length})</span>
                            {tablesCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                          </button>
                          {!tablesCollapsed && (
                            <div className="flex flex-wrap gap-1 p-2 border-t border-slate-100 max-h-28 overflow-y-auto custom-scrollbar">
                              {tables.map((t) => {
                                const isCopied = copiedTable === t;
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => insertTableName(t)}
                                    className="px-1.5 py-0.5 bg-slate-50 rounded text-[9px] text-slate-600 font-mono border border-blue-100 hover:border-blue-300 hover:text-blue-700 inline-flex items-center gap-1"
                                    title="Add table to query"
                                  >
                                    {isCopied ? <Check size={9} /> : <Copy size={9} />}
                                    {t}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <PanelFieldLabel>{isExternalSqlServer ? "SQL Server Query" : "SQL Query"}</PanelFieldLabel>
                      <div className="relative">
                        <Code size={13} className="absolute top-2.5 left-2.5 text-slate-400 pointer-events-none" />
                        <textarea
                          className="w-full bg-slate-900 border-none focus:ring-2 focus:ring-blue-500/20 rounded-md px-2.5 py-2 pl-8 text-[10px] font-mono text-blue-100 min-h-[100px] max-h-[160px] shadow-inner custom-scrollbar leading-relaxed"
                          placeholder={
                            isExternalSqlServer
                              ? EXTERNAL_MSSQL_QUERY_PLACEHOLDER
                              : DASHBOARD_WIDGET_QUERY_PLACEHOLDER
                          }
                          value={selectedWidget.query || ""}
                          onChange={(e) => {
                            setValidationError("");
                            handleChange("query", e.target.value);
                          }}
                        />
                      </div>
                      {!!validationError && <p className="mt-0.5 text-[9px] text-rose-500 font-semibold">{validationError}</p>}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setFiltersCollapsed((prev) => !prev)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-[9px] text-emerald-700 font-bold uppercase tracking-widest bg-emerald-50/90"
                      >
                        <span>Available Filters ({availableFilters.length})</span>
                        {filtersCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </button>
                      {!filtersCollapsed && (
                        <div className="flex flex-wrap gap-1 p-2 border-t border-slate-100">
                          {availableFilters.map((filter) => {
                            const isCopied = copiedFilter === filter.token;
                            return (
                              <button
                                key={filter.token}
                                type="button"
                                onClick={() => insertFilterToken(filter.token)}
                                className="px-1.5 py-0.5 bg-slate-50 rounded text-[9px] text-slate-600 font-mono border border-emerald-100 hover:border-emerald-300 hover:text-emerald-800 inline-flex items-center gap-1"
                                title={`${filter.label} — ${filter.hint}`}
                              >
                                {isCopied ? <Check size={10} /> : <Copy size={10} />}
                                {filter.token}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setTablesCollapsed((prev) => !prev)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-[9px] text-blue-600 font-bold uppercase tracking-widest bg-blue-50/90 border-t border-slate-100"
                      >
                        <span>Available Tables ({tables.length})</span>
                        {tablesCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </button>
                      {!tablesCollapsed && (
                        <div className="flex flex-wrap gap-1 p-2 border-t border-slate-100 max-h-28 overflow-y-auto custom-scrollbar">
                          {tables.map((t) => {
                            const isCopied = copiedTable === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => insertTableName(t)}
                                className="px-1.5 py-0.5 bg-slate-50 rounded text-[9px] text-slate-600 font-mono border border-blue-100 hover:border-blue-300 hover:text-blue-700 inline-flex items-center gap-1"
                                title="Add table to query"
                              >
                                {isCopied ? <Check size={9} /> : <Copy size={9} />}
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <PanelFieldLabel>Width</PanelFieldLabel>
                <input
                  type="number"
                  min={inputMinPx}
                  max={3000}
                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                  value={draftWidthPx}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    setDraftWidthPx(e.target.value);
                    if (Number.isFinite(parsed) && parsed >= resolvedMinWidthPx) {
                      onPixelSizeChange?.({ widthPx: parsed });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const parsed = Number(draftWidthPx);
                      const next = Number.isFinite(parsed) ? Math.max(resolvedMinWidthPx, parsed) : Math.max(resolvedMinWidthPx, Number(widthPx) || resolvedMinWidthPx);
                      setDraftWidthPx(next);
                      onPixelSizeChange?.({ widthPx: next });
                    }
                  }}
                  onBlur={() => {
                    const parsed = Number(draftWidthPx);
                    const next = Number.isFinite(parsed) ? Math.max(resolvedMinWidthPx, parsed) : Math.max(resolvedMinWidthPx, Number(widthPx) || resolvedMinWidthPx);
                    setDraftWidthPx(next);
                    onPixelSizeChange?.({ widthPx: next });
                  }}
                />
              </div>
              <div>
                <PanelFieldLabel>Height</PanelFieldLabel>
                <input
                  type="number"
                  min={inputMinPx}
                  max={3000}
                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                  value={draftHeightPx}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    setDraftHeightPx(e.target.value);
                    if (Number.isFinite(parsed) && parsed >= resolvedMinHeightPx) {
                      onPixelSizeChange?.({ heightPx: parsed });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const parsed = Number(draftHeightPx);
                      const next = Number.isFinite(parsed) ? Math.max(resolvedMinHeightPx, parsed) : Math.max(resolvedMinHeightPx, Number(heightPx) || resolvedMinHeightPx);
                      setDraftHeightPx(next);
                      onPixelSizeChange?.({ heightPx: next });
                    }
                  }}
                  onBlur={() => {
                    const parsed = Number(draftHeightPx);
                    const next = Number.isFinite(parsed) ? Math.max(resolvedMinHeightPx, parsed) : Math.max(resolvedMinHeightPx, Number(heightPx) || resolvedMinHeightPx);
                    setDraftHeightPx(next);
                    onPixelSizeChange?.({ heightPx: next });
                  }}
                />
              </div>
            </div>

            <div>
              <PanelFieldLabel>Title</PanelFieldLabel>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 placeholder:text-slate-300"
                placeholder="Widget display title"
                value={selectedWidget.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
              />
            </div>
          </>
        ) : activeTab === "table" ? (
          <div className="space-y-2">
            <SimpleToggle
              label="Search bar"
              hint="Show search bar above the table"
              checked={selectedWidget.tableSearchEnabled === true}
              onChange={(enabled) => {
                if (!enabled) {
                  applyWidgetPatch({
                    tableSearchEnabled: false,
                    tableSearchPlaceholder: "",
                  });
                  return;
                }
                applyWidgetPatch({ tableSearchEnabled: true });
              }}
            />

            {selectedWidget.tableSearchEnabled === true && (
              <div className="space-y-1.5 rounded border border-slate-200 bg-white p-2">
                <div>
                  <PanelFieldLabel>Placeholder <span className="font-normal normal-case text-slate-400">(opt)</span></PanelFieldLabel>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px] text-slate-700"
                    placeholder="Search... (default)"
                    value={selectedWidget.tableSearchPlaceholder || ""}
                    onChange={(e) => applyWidgetPatch({ tableSearchPlaceholder: e.target.value })}
                  />
                </div>
                <div>
                  <PanelFieldLabel>Align</PanelFieldLabel>
                  <SegmentControl
                    value={normalizeTableSearchPosition(selectedWidget.tableSearchPosition)}
                    options={TABLE_SEARCH_POSITION_OPTIONS}
                    onChange={(pos) => applyWidgetPatch({ tableSearchPosition: pos })}
                  />
                </div>
                {normalizeTableSearchPosition(selectedWidget.tableSearchPosition) !== "full" && (
                  <div>
                    <PanelFieldLabel>Width (px)</PanelFieldLabel>
                    <input
                      type="number"
                      min={160}
                      max={600}
                      step={10}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px] text-slate-700"
                      value={normalizeTableSearchWidth(selectedWidget.tableSearchWidth)}
                      onChange={(e) => applyWidgetPatch({
                        tableSearchWidth: normalizeTableSearchWidth(e.target.value),
                      })}
                    />
                    <p className="text-[8px] text-slate-400 mt-0.5">160–600px (Full align ignores width)</p>
                  </div>
                )}
                <p className="text-[9px] text-slate-400">
                  Search uses body text/background colors by default. Override below if needed.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-500 mb-1">Search text</label>
                    <ColorPickerInput
                      className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                      value={displayStyle.tableSearchColor || displayStyle.tableBodyColor}
                      fallback="#475569"
                      onCommit={(color) => handleChange("style.tableSearchColor", color, { debounceMs: 220 })}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-500 mb-1">Search background</label>
                    <ColorPickerInput
                      className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                      value={displayStyle.tableSearchBg || displayStyle.tableBodyBg}
                      fallback="#ffffff"
                      onCommit={(color) => handleChange("style.tableSearchBg", color, { debounceMs: 220 })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] font-semibold text-slate-500 mb-1">Search font size (px)</label>
                    <input
                      type="number"
                      min={8}
                      max={24}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700"
                      value={selectedWidget.style?.tableSearchFontSize ?? selectedWidget.style?.tableBodyFontSize ?? 10}
                      onChange={(e) => handleChange("style.tableSearchFontSize", Math.max(8, Math.min(24, Number(e.target.value) || 10)))}
                    />
                  </div>
                </div>
              </div>
            )}

            <SimpleToggle
              label="Export"
              hint="CSV / Excel / PDF — exports current search results"
              checked={selectedWidget.tableExportEnabled === true}
              onChange={(enabled) => applyWidgetPatch({ tableExportEnabled: enabled === true })}
            />

            <SimpleToggle
              label="Column sort"
              hint="Click header for ASC / DESC"
              checked={selectedWidget.tableColumnSortEnabled === true}
              onChange={(enabled) => applyWidgetPatch({ tableColumnSortEnabled: enabled })}
            />

            <div className="space-y-1.5 rounded border border-slate-200 bg-white p-2">
              <PanelFieldLabel>Table colors</PanelFieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Heading text</label>
                  <ColorPickerInput
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                    value={displayStyle.tableHeaderColor}
                    fallback="#64748b"
                    onCommit={(color) => handleChange("style.tableHeaderColor", color, { debounceMs: 220 })}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Heading background</label>
                  <ColorPickerInput
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                    value={displayStyle.tableHeaderBg}
                    fallback="#f8fafc"
                    onCommit={(color) => handleChange("style.tableHeaderBg", color, { debounceMs: 220 })}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Body text</label>
                  <ColorPickerInput
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                    value={displayStyle.tableBodyColor}
                    fallback="#475569"
                    onCommit={(color) => handleChange("style.tableBodyColor", color, { debounceMs: 220 })}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Body background</label>
                  <ColorPickerInput
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                    value={displayStyle.tableBodyBg}
                    fallback="#ffffff"
                    onCommit={(color) => handleChange("style.tableBodyBg", color, { debounceMs: 220 })}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Border</label>
                  <ColorPickerInput
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                    value={displayStyle.tableBorderColor}
                    fallback="#e2e8f0"
                    onCommit={(color) => handleChange("style.tableBorderColor", color, { debounceMs: 220 })}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Row hover</label>
                  <ColorPickerInput
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                    value={displayStyle.tableRowHoverBg}
                    fallback="#f8fafc"
                    onCommit={(color) => handleChange("style.tableRowHoverBg", color, { debounceMs: 220 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Heading font (px)</label>
                  <input
                    type="number"
                    min={8}
                    max={28}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700"
                    value={selectedWidget.style?.tableHeaderFontSize ?? 9}
                    onChange={(e) => handleChange("style.tableHeaderFontSize", Math.max(8, Math.min(28, Number(e.target.value) || 9)))}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Body font (px)</label>
                  <input
                    type="number"
                    min={8}
                    max={28}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700"
                    value={selectedWidget.style?.tableBodyFontSize ?? 10}
                    onChange={(e) => handleChange("style.tableBodyFontSize", Math.max(8, Math.min(28, Number(e.target.value) || 10)))}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  {selectedWidget.rawType === "kpi" ? "Value Color" : "Text / Accent Color"}
                </label>
                <ColorPickerInput
                  resetKey={`${selectedWidget.id}-accent`}
                  value={displayStyle.color}
                  fallback="#3b82f6"
                  onCommit={(color) => {
                    if (color === normalizeHexColor(selectedWidgetRef.current?.style?.color, "#3b82f6")) return;
                    if (selectedWidget.rawType === "graph") {
                      const colors = [...(selectedWidgetRef.current?.style?.graphColors || displayStyle.graphColors || GRAPH_COLOR_PALETTES.ocean)];
                      colors[0] = color;
                      applyWidgetPatch({ style: { color, graphColors: colors } }, { debounceMs: 220 });
                      return;
                    }
                    applyWidgetPatch({ style: { color } }, { debounceMs: 220 });
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Background</label>
                <ColorPickerInput
                  resetKey={`${selectedWidget.id}-bg`}
                  value={displayStyle.bg}
                  fallback="#ffffff"
                  onCommit={(bg) => {
                    if (bg === normalizeHexColor(selectedWidgetRef.current?.style?.bg, "#ffffff")) return;
                    applyWidgetPatch({ style: { bg } }, { debounceMs: 220 });
                  }}
                />
              </div>
            </div>

            {selectedWidget.rawType === "graph" && (
              <div className="space-y-2 rounded border border-slate-200 bg-white p-2">
                <PanelFieldLabel>Graph customize</PanelFieldLabel>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Color palette</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700"
                    value={displayStyle.graphColorPalette || "ocean"}
                    onChange={(e) => {
                      const key = e.target.value;
                      const colors = GRAPH_COLOR_PALETTES[key] || GRAPH_COLOR_PALETTES.ocean;
                      applyWidgetPatch({
                        style: {
                          graphColorPalette: key,
                          graphColors: [...colors],
                          color: colors[0],
                        },
                      }, { debounceMs: 220 });
                    }}
                  >
                    {Object.keys(GRAPH_COLOR_PALETTES).map((key) => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(displayStyle.graphColors || GRAPH_COLOR_PALETTES.ocean).slice(0, 8).map((hex, idx) => {
                    const safeHex = normalizeHexColor(hex, GRAPH_COLOR_PALETTES.ocean[idx] || "#3b82f6");
                    return (
                      <div key={`gc-${idx}`} className="relative h-7 w-7 overflow-visible rounded border border-slate-200" title={safeHex}>
                        <ColorPickerInput
                          className="absolute inset-0 h-full w-full"
                          value={safeHex}
                          fallback={safeHex}
                          title={safeHex}
                          onCommit={(nextColor) => {
                            if (nextColor === safeHex) return;
                            const base = selectedWidgetRef.current?.style?.graphColors || displayStyle.graphColors || GRAPH_COLOR_PALETTES.ocean;
                            const next = [...base];
                            while (next.length < 8) next.push(GRAPH_COLOR_PALETTES.ocean[next.length] || "#3b82f6");
                            next[idx] = nextColor;
                            applyWidgetPatch({
                              style: {
                                graphColors: next,
                                ...(idx === 0 ? { color: nextColor } : {}),
                              },
                            }, { debounceMs: 220 });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-500 mb-1">Text size (px)</label>
                    <input
                      type="number"
                      min={8}
                      max={20}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700"
                      value={displayStyle.graphTextSize ?? displayStyle.fontSize ?? 10}
                      onChange={(e) => handleChange("style.graphTextSize", Math.max(8, Math.min(20, Number(e.target.value) || 10)), { debounceMs: 120 })}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-500 mb-1">Pie size</label>
                    <input
                      type="number"
                      min={40}
                      max={320}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700"
                      value={displayStyle.graphPieRadius ?? 70}
                      onChange={(e) => handleChange("style.graphPieRadius", Math.max(40, Math.min(320, Number(e.target.value) || 70)), { debounceMs: 120 })}
                      disabled={selectedWidget.type !== "pie"}
                    />
                  </div>
                </div>
                <SimpleToggle
                  label="Show legend"
                  hint="Labels / series legend under chart"
                  checked={selectedWidget.style?.graphShowLegend !== false}
                  onChange={(enabled) => handleChange("style.graphShowLegend", enabled)}
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Border Radius (px)</label>
              <input
                type="number"
                min={0}
                max={40}
                className="w-full bg-white border border-slate-200 rounded-md px-2 py-2 text-[11px] font-semibold text-slate-700"
                value={selectedWidget.style?.borderRadius ?? 6}
                onChange={(e) => handleChange("style.borderRadius", Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            {selectedWidget.rawType !== "heading" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Shadow</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "none", label: "None" },
                    { value: DEFAULT_WIDGET_BOX_SHADOW, label: "Soft" },
                    { value: STRONG_WIDGET_BOX_SHADOW, label: "Strong" },
                  ].map((opt) => {
                    const current = selectedWidget.style?.boxShadow || "none";
                    const active = current === opt.value || (!selectedWidget.style?.boxShadow && opt.value === "none");
                    return (
                      <button
                        type="button"
                        key={opt.label}
                        onClick={() => handleChange("style.boxShadow", opt.value)}
                        className={`px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all border ${
                          active
                            ? "bg-blue-600 border-blue-600 text-white shadow-md"
                            : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Text Align</label>
              <div className="grid grid-cols-3 gap-2">
                {["left", "center", "right"].map((align) => (
                  <button
                    type="button"
                    key={align}
                    onClick={() => handleChange("style.contentAlign", align)}
                    className={`px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all border ${
                      (selectedWidget.style?.contentAlign || "center") === align
                        ? "bg-blue-600 border-blue-600 text-white shadow-md"
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {align}
                  </button>
                ))}
              </div>
            </div>

            {(selectedWidget.rawType === "graph" || selectedWidget.rawType === "table") && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Title Position</label>
                <div className="grid grid-cols-2 gap-2">
                  {["top", "bottom"].map((pos) => (
                    <button
                      type="button"
                      key={pos}
                      onClick={() => handleChange("style.titlePosition", pos)}
                      className={`px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all border ${
                        (selectedWidget.style?.titlePosition || "top") === pos
                          ? "bg-blue-600 border-blue-600 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Font Family</label>
                <select
                  value={selectedWidget.style?.fontFamily || "inherit"}
                  onChange={(e) => handleChange("style.fontFamily", e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-2 text-[11px] font-semibold text-slate-700"
                >
                  <option value="inherit">System</option>
                  <option value="Inter, sans-serif">Inter</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="'Segoe UI', sans-serif">Segoe UI</option>
                  <option value="'Roboto', sans-serif">Roboto</option>
                  <option value="'Courier New', monospace">Courier</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  {selectedWidget.rawType === "kpi" ? "Value Size (px)" : "Font Size (px)"}
                </label>
                <input
                  type="number"
                  min={8}
                  max={selectedWidget.rawType === "kpi" ? 48 : 30}
                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-2 text-[11px] font-semibold text-slate-700"
                  value={selectedWidget.style?.fontSize ?? (selectedWidget.rawType === "kpi" ? 26 : 10)}
                  onChange={(e) => handleChange("style.fontSize", Math.max(8, Number(e.target.value) || 10))}
                />
              </div>
            </div>

            {selectedWidget.rawType === "kpi" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Label Size (px)</label>
                <input
                  type="number"
                  min={8}
                  max={18}
                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-2 text-[11px] font-semibold text-slate-700"
                  value={selectedWidget.style?.kpiLabelFontSize ?? 10}
                  onChange={(e) => handleChange("style.kpiLabelFontSize", Math.max(8, Number(e.target.value) || 10))}
                />
              </div>
            )}

            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Padding (px)</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "paddingTop", label: "Top" },
                    { key: "paddingBottom", label: "Bottom" },
                    { key: "paddingLeft", label: "Left" },
                    { key: "paddingRight", label: "Right" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{field.label}</label>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                        value={
                          selectedWidget.style?.[field.key]
                          ?? selectedWidget.style?.padding
                          ?? (selectedWidget.rawType === "kpi" ? 6 : selectedWidget.rawType === "heading" ? 0 : 8)
                        }
                        onChange={(e) => handleChange(`style.${field.key}`, Math.max(0, Number(e.target.value) || 0))}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Margin (px)</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "marginTop", label: "Top" },
                    { key: "marginBottom", label: "Bottom" },
                    { key: "marginLeft", label: "Left" },
                    { key: "marginRight", label: "Right" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{field.label}</label>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                        value={selectedWidget.style?.[field.key] ?? selectedWidget.style?.margin ?? 0}
                        onChange={(e) => handleChange(`style.${field.key}`, Math.max(0, Number(e.target.value) || 0))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {!["container"].includes(selectedWidget.rawType) && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Empty Placeholder Text</label>
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-2 text-[11px] font-semibold text-slate-700"
                  value={selectedWidget.emptyText || ""}
                  onChange={(e) => handleChange("emptyText", e.target.value)}
                  placeholder="Blank space text (optional)"
                />
              </div>
            )}

            {!["container", "kpi"].includes(selectedWidget.rawType) && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Empty Text Position</label>
                <div className="grid grid-cols-3 gap-2">
                  {["top", "center", "bottom"].map((pos) => (
                    <button
                      type="button"
                      key={pos}
                      onClick={() => handleChange("style.emptyTextPosition", pos)}
                      className={`px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
                        (selectedWidget.style?.emptyTextPosition || "center") === pos
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white border-slate-200 text-slate-500"
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedWidget.rawType === "kpi" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">KPI Label Position</label>
                <div className="grid grid-cols-2 gap-2">
                  {["top", "bottom"].map((pos) => (
                    <button
                      type="button"
                      key={pos}
                      onClick={() => handleChange("style.kpiLabelPosition", pos)}
                      className={`px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all border ${
                        (selectedWidget.style?.kpiLabelPosition || "bottom") === pos
                          ? "bg-blue-600 border-blue-600 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 space-y-1.5 z-10 shrink-0">
        <button
          type="button"
          onClick={handlePreview}
          disabled={busy}
          className="w-full bg-white border border-blue-200 text-blue-600 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
        >
          <Eye size={14} /> Preview
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="w-full bg-blue-600 border border-blue-600 text-white py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
        >
          <Save size={14} /> Save Draft
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(selectedWidget)}
          disabled={busy}
          className="w-full bg-white border border-rose-200 text-rose-500 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all flex items-center justify-center gap-2"
        >
          <Trash2 size={14} /> Delete Widget
        </button>
      </div>
    </div>
  );
};

export default PropertyPanel;
