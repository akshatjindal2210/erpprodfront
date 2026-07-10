import React, { useEffect, useState } from "react";
import { getTables } from "../services/dashboardApi";
import { Database, Palette, Table2, Code, Trash2, Info, Eye, Save, X, ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import { DASHBOARD_WIDGET_QUERY_PLACEHOLDER, getDashboardQueryRuntimeFilters } from "../utils/widgetQuery.js";
import { EXTERNAL_MSSQL_QUERY_PLACEHOLDER, isExternalMssqlDbSource } from "../utils/dashboardDbSources.js";

const BLOCKED_SQL = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i;
const REQUIRES_SQL = new Set(["kpi", "table", "graph"]);

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
  const [tablesCollapsed, setTablesCollapsed] = useState(true);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [copiedTable, setCopiedTable] = useState("");
  const [copiedFilter, setCopiedFilter] = useState("");
  const availableFilters = getDashboardQueryRuntimeFilters({ canFilterByUser });
  const resolvedMinWidthPx = minWidthPx ?? (isPhoneBuilderMode ? 24 : 80);
  const resolvedMinHeightPx = minHeightPx ?? resolvedMinWidthPx;
  const inputMinPx = Math.max(16, Math.min(resolvedMinWidthPx, resolvedMinHeightPx, 40));
  const [draftWidthPx, setDraftWidthPx] = useState(widthPx);
  const [draftHeightPx, setDraftHeightPx] = useState(heightPx);
  const isTableWidget = selectedWidget?.rawType === "table";

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
    getTables({ appKey, dbSource: selectedWidget?.dataSource || "ims_postgresql" })
      .then((res) => setTables(res.data || []))
      .catch(() => setTables([]));
  }, [appKey, selectedWidget?.dataSource]);

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

  const handleChange = (path, value) => {
    const updated = { ...selectedWidget };
    const parts = path.split(".");
    let current = updated;
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = { ...(current[parts[i]] || {}) };
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    onUpdate(updated);
  };

  const applyWidgetPatch = (patch) => {
    const next = {
      ...selectedWidget,
      ...patch,
      style: {
        ...(selectedWidget.style || {}),
        ...(patch.style || {}),
      },
      layout: {
        ...(selectedWidget.layout || {}),
        ...(patch.layout || {}),
      },
    };
    onUpdate(next);
  };

  const handlePreview = () => {
    const parsedWidth = Math.max(resolvedMinWidthPx, Number(widthPx) || resolvedMinWidthPx);
    const parsedHeight = Math.max(resolvedMinHeightPx, Number(heightPx) || resolvedMinHeightPx);
    onPixelSizeChange?.({
      widthPx: parsedWidth,
      heightPx: parsedHeight,
    });
    if (!REQUIRES_SQL.has(selectedWidget.rawType)) {
      setValidationError("");
      onPreview?.(selectedWidget, { widthPx: parsedWidth, heightPx: parsedHeight });
      return;
    }
    if (isExternalSqlServer) {
      setValidationError("");
      onPreview?.(selectedWidget, { widthPx: parsedWidth, heightPx: parsedHeight });
      return;
    }
    const err = validateSelectOnlyFrontend(selectedWidget.query);
    setValidationError(err);
    if (err) return;
    onPreview?.(selectedWidget, { widthPx: parsedWidth, heightPx: parsedHeight });
  };

  const handleSave = () => {
    const parsedWidth = Math.max(resolvedMinWidthPx, Number(widthPx) || resolvedMinWidthPx);
    const parsedHeight = Math.max(resolvedMinHeightPx, Number(heightPx) || resolvedMinHeightPx);
    onPixelSizeChange?.({
      widthPx: parsedWidth,
      heightPx: parsedHeight,
    });
    if (!REQUIRES_SQL.has(selectedWidget.rawType)) {
      setValidationError("");
      onSave?.(selectedWidget, { widthPx: parsedWidth, heightPx: parsedHeight });
      return;
    }
    if (isExternalSqlServer) {
      setValidationError("");
      onSave?.(selectedWidget, { widthPx: parsedWidth, heightPx: parsedHeight });
      return;
    }
    const err = validateSelectOnlyFrontend(selectedWidget.query);
    setValidationError(err);
    if (err) return;
    onSave?.(selectedWidget, { widthPx: parsedWidth, heightPx: parsedHeight });
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
                  onChange={(e) => applyWidgetPatch({ dataSource: e.target.value })}
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

            {selectedWidget.rawType === "graph" && (
              <div>
                <PanelFieldLabel>Chart Type</PanelFieldLabel>
                <div className="grid grid-cols-3 gap-1">
                  {["bar", "line", "pie"].map((chartType) => (
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
                        onClick={() => applyWidgetPatch({ containerPreset: preset.key })}
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

            {REQUIRES_SQL.has(selectedWidget.rawType) && <div className="space-y-2">
              <div>
                <PanelFieldLabel>{isExternalSqlServer ? "SQL Server Query" : "SQL Query"}</PanelFieldLabel>
                <div className="relative">
                  <Code size={13} className="absolute top-2.5 left-2.5 text-slate-400" />
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
            </div>}

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
                        onPixelSizeChange?.({
                          widthPx: parsed,
                        });
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
                        onPixelSizeChange?.({
                          heightPx: parsed,
                        });
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
                  <PanelFieldLabel>Position</PanelFieldLabel>
                  <SegmentControl
                    value={selectedWidget.tableSearchPosition === "left" ? "left" : "right"}
                    options={[
                      { value: "left", label: "Left" },
                      { value: "right", label: "Right" },
                    ]}
                    onChange={(pos) => applyWidgetPatch({ tableSearchPosition: pos })}
                  />
                </div>
              </div>
            )}

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
                  <input
                    type="color"
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                    value={selectedWidget.style?.tableHeaderColor || "#64748b"}
                    onChange={(e) => handleChange("style.tableHeaderColor", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Heading background</label>
                  <input
                    type="color"
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                    value={selectedWidget.style?.tableHeaderBg || "#f8fafc"}
                    onChange={(e) => handleChange("style.tableHeaderBg", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Body text</label>
                  <input
                    type="color"
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                    value={selectedWidget.style?.tableBodyColor || "#475569"}
                    onChange={(e) => handleChange("style.tableBodyColor", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Body background</label>
                  <input
                    type="color"
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                    value={selectedWidget.style?.tableBodyBg || "#ffffff"}
                    onChange={(e) => handleChange("style.tableBodyBg", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Border</label>
                  <input
                    type="color"
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                    value={selectedWidget.style?.tableBorderColor || "#e2e8f0"}
                    onChange={(e) => handleChange("style.tableBorderColor", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Row hover</label>
                  <input
                    type="color"
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                    value={selectedWidget.style?.tableRowHoverBg || "#f8fafc"}
                    onChange={(e) => handleChange("style.tableRowHoverBg", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Heading font (px)</label>
                  <input
                    type="number"
                    min={8}
                    max={16}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700"
                    value={selectedWidget.style?.tableHeaderFontSize ?? 9}
                    onChange={(e) => handleChange("style.tableHeaderFontSize", Math.max(8, Number(e.target.value) || 9))}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">Body font (px)</label>
                  <input
                    type="number"
                    min={8}
                    max={18}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700"
                    value={selectedWidget.style?.tableBodyFontSize ?? 10}
                    onChange={(e) => handleChange("style.tableBodyFontSize", Math.max(8, Number(e.target.value) || 10))}
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
                <input
                  type="color"
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                  value={selectedWidget.style?.color || "#3b82f6"}
                  onChange={(e) => handleChange("style.color", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Background</label>
                <input
                  type="color"
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                  value={selectedWidget.style?.bg || "#ffffff"}
                  onChange={(e) => handleChange("style.bg", e.target.value)}
                />
              </div>
            </div>

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
