import React, { useEffect, useState } from "react";
import { getTables } from "../services/dashboardApi";
import { Database, Palette, Code, Trash2, Info, Eye, Save, X, ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import { DASHBOARD_WIDGET_QUERY_PLACEHOLDER } from "../utils/widgetQuery.js";

const BLOCKED_SQL = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i;
const REQUIRES_SQL = new Set(["kpi", "table", "graph"]);

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
}) => {
  const [tables, setTables] = useState([]);
  const [activeTab, setActiveTab] = useState("data");
  const [validationError, setValidationError] = useState("");
  const [tablesCollapsed, setTablesCollapsed] = useState(true);
  const [copiedTable, setCopiedTable] = useState("");
  const resolvedMinWidthPx = minWidthPx ?? (isPhoneBuilderMode ? 24 : 80);
  const resolvedMinHeightPx = minHeightPx ?? resolvedMinWidthPx;
  const inputMinPx = Math.max(16, Math.min(resolvedMinWidthPx, resolvedMinHeightPx, 40));
  const [draftWidthPx, setDraftWidthPx] = useState(widthPx);
  const [draftHeightPx, setDraftHeightPx] = useState(heightPx);

  useEffect(() => {
    setDraftWidthPx(widthPx);
    setDraftHeightPx(heightPx);
  }, [selectedWidget?.id, widthPx, heightPx]);

  useEffect(() => {
    if (String(selectedWidget?.dataSource || "ims_postgresql") === "erp_mssql") {
      setTables([]);
      return;
    }
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
  const isMssqlSource = String(selectedWidget.dataSource || "ims_postgresql") === "erp_mssql";

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
    if (isMssqlSource) {
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
    if (isMssqlSource) {
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
    if (!REQUIRES_SQL.has(selectedWidget.rawType) || isMssqlSource) {
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

  return (
    <div
      className="w-full bg-white h-full flex flex-col overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {!hideHeader && (
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <h3 className="font-bold text-xs uppercase tracking-widest text-slate-800">Widget Builder</h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab("data")}
              className={`p-1.5 rounded-md transition-all ${activeTab === "data" ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Database size={14} />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("style")}
              className={`p-1.5 rounded-md transition-all ${activeTab === "style" ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Palette size={14} />
            </button>
          </div>
          <button
            type="button"
            title="Close panel"
            onClick={() => onClose?.()}
            className="h-7 w-7 grid place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      )}

      {hideHeader && (
        <div className="px-3 py-2 border-b border-slate-100 flex gap-1 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("data")}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${activeTab === "data" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
          >
            Data
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("style")}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${activeTab === "style" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
          >
            Style
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3.5 bg-slate-50/30">
        {activeTab === "data" ? (
          <>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Widget Type</p>
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
                    className={`px-1 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest transition-all border ${
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

            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Page Access</label>
                <select
                  value={selectedWidget.targetPageKey || "dashboard"}
                  onChange={(e) => {
                    const nextPage = pageOptions.find((opt) => opt.value === e.target.value);
                    applyWidgetPatch({
                      targetPageKey: e.target.value,
                      targetPageModule: nextPage?.module || null,
                    });
                  }}
                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-2 text-[11px] font-semibold text-slate-700"
                >
                  {pageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Database Type</label>
                <select
                  value={selectedWidget.dataSource || "ims_postgresql"}
                  onChange={(e) => applyWidgetPatch({ dataSource: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-2 text-[11px] font-semibold text-slate-700"
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
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Chart Type</label>
                <div className="grid grid-cols-3 gap-2">
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

            {REQUIRES_SQL.has(selectedWidget.rawType) && <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  {isMssqlSource ? "ERP SELECT Query" : "SQL Query"}
                </label>
                <div className="relative">
                  <Code size={14} className="absolute top-2.5 left-3 text-slate-400" />
                  <textarea
                  className="w-full bg-slate-900 border-none focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2.5 pl-9 text-[10px] font-mono text-blue-100 min-h-[120px] shadow-inner custom-scrollbar"
                    placeholder={
                      isMssqlSource
                        ? "SELECT col1, col2 FROM dailyprod WHERE dailyprod.docdt >= {{fromDate}} AND dailyprod.docdt <= {{toDate}}"
                        : DASHBOARD_WIDGET_QUERY_PLACEHOLDER
                    }
                    value={selectedWidget.query || ""}
                    onChange={(e) => {
                      setValidationError("");
                      handleChange("query", e.target.value);
                    }}
                  />
                </div>
                {!!validationError && <p className="mt-1 text-[10px] text-rose-500 font-semibold">{validationError}</p>}
              </div>

              {!isMssqlSource && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <button
                  type="button"
                  onClick={() => setTablesCollapsed((prev) => !prev)}
                  className="w-full flex items-center justify-between text-[9px] text-blue-600 font-bold uppercase tracking-widest"
                >
                  <span>Available Tables ({tables.length}) - {appKey.toUpperCase()}</span>
                  {tablesCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </button>
                {!tablesCollapsed && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tables.map((t) => {
                      const isCopied = copiedTable === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => insertTableName(t)}
                          className="px-1.5 py-0.5 bg-white rounded text-[9px] text-slate-600 font-mono border border-blue-100/60 hover:border-blue-300 hover:text-blue-700 transition-all inline-flex items-center gap-1"
                          title="Click to add table in query"
                        >
                          {isCopied ? <Check size={10} /> : <Copy size={10} />}
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
            </div>}

            <div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Width</p>
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
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Height</p>
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
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Title</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-0 rounded-md px-3 py-2 text-xs font-bold text-slate-700 placeholder:text-slate-300"
                  placeholder="Widget display title"
                  value={selectedWidget.title || ""}
                  onChange={(e) => handleChange("title", e.target.value)}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
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
