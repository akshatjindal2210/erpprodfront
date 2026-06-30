import React, { useEffect, useState } from "react";
import { getTables } from "../services/dashboardApi";
import { Database, Palette, Code, Trash2, Info, Eye, Save, X, ChevronRight, ChevronDown, Copy, Check } from "lucide-react";

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
  widthPx = 0,
  heightPx = 0,
  busy = false,
}) => {
  const [tables, setTables] = useState([]);
  const [activeTab, setActiveTab] = useState("data");
  const [validationError, setValidationError] = useState("");
  const [tablesCollapsed, setTablesCollapsed] = useState(true);
  const [copiedTable, setCopiedTable] = useState("");
  const [widthInput, setWidthInput] = useState(String(widthPx || 0));
  const [heightInput, setHeightInput] = useState(String(heightPx || 0));

  useEffect(() => {
    getTables()
      .then((res) => setTables(res.data || []))
      .catch(() => setTables([]));
  }, []);

  useEffect(() => {
    setWidthInput(String(widthPx || 0));
  }, [widthPx, selectedWidget?.id]);

  useEffect(() => {
    setHeightInput(String(heightPx || 0));
  }, [heightPx, selectedWidget?.id]);

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
    const parsedWidth = Math.max(80, Number(widthInput) || 80);
    const parsedHeight = Math.max(80, Number(heightInput) || 80);
    onPixelSizeChange?.({
      widthPx: parsedWidth,
      heightPx: parsedHeight,
    });
    if (!REQUIRES_SQL.has(selectedWidget.rawType)) {
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
    const parsedWidth = Math.max(80, Number(widthInput) || 80);
    const parsedHeight = Math.max(80, Number(heightInput) || 80);
    onPixelSizeChange?.({
      widthPx: parsedWidth,
      heightPx: parsedHeight,
    });
    if (!REQUIRES_SQL.has(selectedWidget.rawType)) {
      setValidationError("");
      onSave?.(selectedWidget, { widthPx: parsedWidth, heightPx: parsedHeight });
      return;
    }
    const err = validateSelectOnlyFrontend(selectedWidget.query);
    setValidationError(err);
    if (err) return;
    onSave?.(selectedWidget, { widthPx: parsedWidth, heightPx: parsedHeight });
  };

  const copyTableName = async (tableName) => {
    try {
      await navigator.clipboard.writeText(tableName);
      setCopiedTable(tableName);
      setTimeout(() => setCopiedTable(""), 1200);
    } catch (_error) {
      setCopiedTable("");
    }
  };

  return (
    <div className="w-full bg-white h-full flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <h3 className="font-bold text-xs uppercase tracking-widest text-slate-800">Widget Builder</h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("data")}
              className={`p-1.5 rounded-md transition-all ${activeTab === "data" ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Database size={14} />
            </button>
            <button
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

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3.5 bg-slate-50/30">
        {activeTab === "data" ? (
          <>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Widget Type</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "kpi", label: "KPI" },
                  { key: "table", label: "Table" },
                  { key: "graph", label: "Graph" },
                  { key: "heading", label: "Heading" },
                ].map((t) => (
                  <button
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
                      applyWidgetPatch({ rawType: "table", type: "table" });
                    }}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all border ${
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

            {selectedWidget.rawType === "graph" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Chart Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {["bar", "line", "pie"].map((chartType) => (
                    <button
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

            {REQUIRES_SQL.has(selectedWidget.rawType) && <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">SQL Query</label>
                <div className="relative">
                  <Code size={14} className="absolute top-2.5 left-3 text-slate-400" />
                  <textarea
                  className="w-full bg-slate-900 border-none focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2.5 pl-9 text-[10px] font-mono text-blue-100 min-h-[120px] shadow-inner custom-scrollbar"
                    placeholder="SELECT ... FROM ..."
                    value={selectedWidget.query || ""}
                    onChange={(e) => {
                      setValidationError("");
                      handleChange("query", e.target.value);
                    }}
                  />
                </div>
                {!!validationError && <p className="mt-1 text-[10px] text-rose-500 font-semibold">{validationError}</p>}
              </div>

              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <button
                  type="button"
                  onClick={() => setTablesCollapsed((prev) => !prev)}
                  className="w-full flex items-center justify-between text-[9px] text-blue-600 font-bold uppercase tracking-widest"
                >
                  <span>Available Tables ({tables.length})</span>
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
                          onClick={() => copyTableName(t)}
                          className="px-1.5 py-0.5 bg-white rounded text-[9px] text-slate-600 font-mono border border-blue-100/60 hover:border-blue-300 hover:text-blue-700 transition-all inline-flex items-center gap-1"
                          title="Click to copy table name"
                        >
                          {isCopied ? <Check size={10} /> : <Copy size={10} />}
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Card Size (Pixels)
                </label>
                <button
                  type="button"
                  onClick={() => onPixelSizeChange?.({ widthPx: 99999 })}
                  className="text-[9px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest border border-blue-200 hover:border-blue-400 rounded px-1.5 py-0.5 transition-all"
                  title="Stretch widget to full row width"
                >
                  ↔ Full Width
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Width</p>
                  <input
                    type="number"
                    min={80}
                    max={3000}
                    className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                    value={widthInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setWidthInput(value);
                      const parsed = Number(value);
                      if (Number.isFinite(parsed)) {
                        onPixelSizeChange?.({
                          widthPx: Math.max(80, parsed),
                        });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onPixelSizeChange?.({
                          widthPx: Math.max(80, Number(widthInput) || 80),
                        });
                      }
                    }}
                    onBlur={() =>
                      onPixelSizeChange?.({
                        widthPx: Math.max(80, Number(widthInput) || 80),
                      })
                    }
                  />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Height</p>
                  <input
                    type="number"
                    min={80}
                    max={3000}
                    className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700"
                    value={heightInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setHeightInput(value);
                      const parsed = Number(value);
                      if (Number.isFinite(parsed)) {
                        onPixelSizeChange?.({
                          heightPx: Math.max(80, parsed),
                        });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onPixelSizeChange?.({
                          heightPx: Math.max(80, Number(heightInput) || 80),
                        });
                      }
                    }}
                    onBlur={() =>
                      onPixelSizeChange?.({
                        heightPx: Math.max(80, Number(heightInput) || 80),
                      })
                    }
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
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Accent Color</label>
                <input
                  type="color"
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-md"
                  value={selectedWidget.style?.color || "#3b82f6"}
                  onChange={(e) => handleChange("style.color", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Background</label>
                <input
                  type="color"
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-md"
                  value={selectedWidget.style?.bg || "#ffffff"}
                  onChange={(e) => handleChange("style.bg", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Text Align</label>
              <div className="grid grid-cols-3 gap-2">
                {["left", "center", "right"].map((align) => (
                  <button
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

            {selectedWidget.rawType === "kpi" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">KPI Label Position</label>
                <div className="grid grid-cols-2 gap-2">
                  {["top", "bottom"].map((pos) => (
                    <button
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

      <div className="sticky bottom-0 p-2 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 space-y-1.5 z-10">
        <button
          onClick={handlePreview}
          disabled={busy}
          className="w-full bg-white border border-blue-200 text-blue-600 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
        >
          <Eye size={14} /> Preview
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          className="w-full bg-blue-600 border border-blue-600 text-white py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
        >
          <Save size={14} /> Save Draft
        </button>
        <button
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
