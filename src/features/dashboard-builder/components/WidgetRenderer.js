import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { AlertCircle, Copy, GripVertical, Pencil, Trash2 } from "lucide-react";
import ContainerNestedGrid from "./ContainerNestedGrid";
import { isConfiguredWidgetQuery } from "../utils/widgetQuery.js";

const resolveKpiValueFontPx = (style = {}, displayVal = "", readOnly = false) => {
  const configured = Number(style.fontSize);
  const textLen = String(displayVal || "").length;
  let base = Number.isFinite(configured) && configured >= 14 ? configured : (readOnly ? 28 : 26);
  if (textLen > 14) base = Math.min(base, 14);
  else if (textLen > 10) base = Math.min(base, 20);
  else if (textLen > 6 && base > 32) base = 32;
  return base;
};

const resolveKpiLabelFontPx = (style = {}) => {
  const configured = Number(style.kpiLabelFontSize);
  if (Number.isFinite(configured) && configured >= 8) return configured;
  const fallback = Number(style.fontSize);
  if (Number.isFinite(fallback) && fallback >= 8 && fallback <= 12) return fallback;
  return 10;
};

const renderTitleOnlyKpi = (label, style = {}, alignClass = "items-center text-center") => {
  const labelFontPx = resolveKpiLabelFontPx(style);
  const labelStyle = {
    fontSize: `${labelFontPx}px`,
    lineHeight: 1.25,
    color: style.color || "#64748b",
  };

  return (
    <div className={`flex flex-col justify-center h-full min-w-0 gap-0.5 ${alignClass}`}>
      <div className="font-semibold px-0.5 break-words leading-tight" style={labelStyle}>
        {label}
      </div>
    </div>
  );
};

const formatDisplayValue = (value) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "-";
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }
  return String(value);
};

const buildBoxStyle = (style = {}, { transparentBg = false, isContainer = false } = {}) => {
  const padding = Number.isFinite(Number(style.padding)) ? Math.max(0, Number(style.padding)) : 8;
  const margin = Number.isFinite(Number(style.margin)) ? Math.max(0, Number(style.margin)) : 0;
  const borderRadius = Number.isFinite(Number(style.borderRadius)) ? Math.max(0, Number(style.borderRadius)) : 6;
  return {
    boxSizing: "border-box",
    backgroundColor: transparentBg ? "transparent" : (style.bg || "#ffffff"),
    color: style.color || "#334155",
    borderRadius: `${borderRadius}px`,
    fontFamily: style.fontFamily || "inherit",
    padding: `${padding}px`,
    margin: isContainer ? "0" : `${margin}px`,
    width: isContainer ? "100%" : undefined,
    maxWidth: isContainer ? "100%" : undefined,
  };
};

const WidgetRenderer = ({
  widget,
  readOnly = false,
  nested = false,
  isPhoneMode = false,
  selectedWidgetId = null,
  onNestedLayoutChange,
  onSelectWidget,
  onDeleteWidget,
  onAddChildWidget,
  onCloneChildWidget,
  onCloneWidget,
  isDropTarget = false,
}) => {
  const data = widget.previewData || widget.data || [];
  const error = widget.error || widget.previewError || null;

  const { type, title, style = {} } = widget;
  const displayTitle = String(title || "").trim();
  const isHeading = type === "heading";
  const isContainer = type === "container" || type === "section";
  const alignClass =
    style.contentAlign === "left"
      ? "items-start text-left"
      : style.contentAlign === "right"
        ? "items-end text-right"
        : "items-center text-center";
  const emptyPosClass =
    style.emptyTextPosition === "top"
      ? "justify-start pt-2"
      : style.emptyTextPosition === "bottom"
        ? "justify-end pb-2"
        : "justify-center";

  const headingFontPx = Number.isFinite(Number(style.fontSize)) && Number(style.fontSize) >= 12
    ? Number(style.fontSize)
    : (readOnly ? 18 : 16);

  const renderContent = () => {
    if (type === "heading") {
      const headingAlign =
        style.contentAlign === "right"
          ? "justify-end text-right"
          : style.contentAlign === "center"
            ? "justify-center text-center"
            : "justify-start text-left";
      return (
        <div className={`flex h-full items-center border-b border-slate-200/80 ${headingAlign}`}>
          <h2
            className="font-extrabold tracking-tight leading-tight w-full"
            style={{ color: style.color || "#0f172a", fontSize: `${headingFontPx}px` }}
          >
            {title || widget.description || "Dashboard Heading"}
          </h2>
        </div>
      );
    }

    if (isContainer) {
      const sectionChildren = Array.isArray(widget.sectionChildren) ? widget.sectionChildren : [];
      const nestedLayout = isPhoneMode
        ? (Array.isArray(widget.mobileNestedLayout) && widget.mobileNestedLayout.length
          ? widget.mobileNestedLayout
          : (widget.nestedLayout || []))
        : (widget.nestedLayout || []);

      const mobilePadding = {
        top: widget.mobilePaddingTop ?? widget.style?.mobilePaddingTop ?? 8,
        right: widget.mobilePaddingRight ?? widget.style?.mobilePaddingRight ?? 8,
        bottom: widget.mobilePaddingBottom ?? widget.style?.mobilePaddingBottom ?? 8,
        left: widget.mobilePaddingLeft ?? widget.style?.mobilePaddingLeft ?? 8,
      };

      const containerShellStyle = buildBoxStyle(style, { isContainer: true });
      if (isPhoneMode) {
        containerShellStyle.padding = "0px";
      }

      return (

        <div
          className="group relative flex h-full flex-col min-h-0 w-full max-w-full overflow-hidden"
          style={containerShellStyle}
        >

          {!readOnly && !nested && (
            <>
              {String(selectedWidgetId) === String(widget.id) && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-l pointer-events-none z-0" />
              )}
              <div className="canvas-drag-handle absolute top-1 left-1 z-40 h-5 w-5 grid place-items-center cursor-move opacity-0 group-hover:opacity-100 bg-white shadow border border-slate-200 rounded transition-all">
                <GripVertical size={11} className="text-slate-400 pointer-events-none" />
              </div>
              {String(selectedWidgetId) === String(widget.id) && (
                <div className="widget-action-bar absolute top-1 left-7 z-40 flex items-center gap-0.5 bg-white border border-slate-200 rounded shadow-sm p-0.5">
                  <button
                    type="button"
                    className="h-5 w-5 grid place-items-center rounded hover:bg-slate-100 text-slate-600"
                    title="Edit"
                    onClick={(e) => { e.stopPropagation(); onSelectWidget?.(widget.id); }}
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    type="button"
                    className="h-5 w-5 grid place-items-center rounded hover:bg-slate-100 text-slate-600"
                    title="Clone container with widgets"
                    onClick={(e) => { e.stopPropagation(); onCloneWidget?.(widget); }}
                  >
                    <Copy size={10} />
                  </button>
                  <button
                    type="button"
                    className="h-5 w-5 grid place-items-center rounded hover:bg-rose-50 text-rose-500"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); onDeleteWidget?.(widget); }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              )}
            </>
          )}

          {(displayTitle || widget.description) && (

            <div className="shrink-0 mb-2">

              {displayTitle ? (

                <p

                  className="text-[11px] font-bold uppercase tracking-widest"

                  style={{ color: style.color || "#475569", fontSize: style.fontSize ? `${style.fontSize}px` : undefined }}

                >

                  {displayTitle}

                </p>

              ) : null}

              {widget.description ? (

                <p className="text-[10px] mt-0.5 opacity-80" style={{ color: style.color || "#64748b" }}>

                  {widget.description}

                </p>

              ) : null}

            </div>

          )}

          <ContainerNestedGrid
            key={isPhoneMode ? `phone-${widget.id}` : `desktop-${widget.id}`}
            childWidgets={sectionChildren}
            layout={nestedLayout}
            containerId={widget.id}
            readOnly={readOnly}
            selectedWidgetId={selectedWidgetId}
            onLayoutChange={(nextLayout) => onNestedLayoutChange?.(widget.id, nextLayout, isPhoneMode)}
            onSelectWidget={(childId) => {
              onSelectWidget?.(childId);
            }}
            onDeleteWidget={onDeleteWidget}
            onAddChildWidget={onAddChildWidget}
            onCloneChildWidget={onCloneChildWidget}
            isDraggingOver={isDropTarget}
            mobilePadding={isPhoneMode ? mobilePadding : { top: 0, right: 0, bottom: 0, left: 0 }}
            isPhoneMode={isPhoneMode}
          />

        </div>

      );

    }



    const configuredQuery =
      widget.has_query !== undefined ? Boolean(widget.has_query) : isConfiguredWidgetQuery(widget.query);
    const titleOnlyLabel = displayTitle || String(widget.description || "").trim();

    if (readOnly && configuredQuery === false) {
      if (!titleOnlyLabel) {
        return <div className="h-full w-full" aria-hidden="true" />;
      }
      return renderTitleOnlyKpi(titleOnlyLabel, style, alignClass);
    }

    if (error) {

      return (

        <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">

          <AlertCircle className="text-rose-500" size={24} />

          <span className="text-xs font-bold text-rose-600 uppercase tracking-tight">Query Error</span>

          <p className="text-[10px] opacity-80 line-clamp-3">{error}</p>

        </div>

      );

    }



    if (!configuredQuery && data.length === 0) {
      if (titleOnlyLabel) {
        return renderTitleOnlyKpi(titleOnlyLabel, style, alignClass);
      }

      return (

        <div className={`flex h-full ${alignClass} ${emptyPosClass} opacity-70 text-[10px] uppercase tracking-widest font-semibold break-words leading-tight px-1`}>

          {widget.emptyText || "Click edit and add query"}

        </div>

      );

    }



    if (data.length === 0) {

      return (

        <div className="flex items-center justify-center h-full opacity-70 text-[10px] uppercase tracking-widest font-bold">

          No Data Found

        </div>

      );

    }



    const keys = Object.keys(data[0] || {});

    const xKey = keys[0];

    const yKey = keys[1] || keys[0];



    if (type === "bar") {

      return (

        <ResponsiveContainer width="100%" height="100%">

          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

            <XAxis dataKey={xKey} fontSize={9} tickLine={false} axisLine={false} tick={{ fill: style.color || "#64748b" }} />

            <YAxis fontSize={9} tickLine={false} axisLine={false} tick={{ fill: style.color || "#64748b" }} />

            <Tooltip

              contentStyle={{ backgroundColor: style.bg || "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}

              itemStyle={{ fontSize: "10px", fontWeight: "bold", color: style.color || "#1e293b" }}

              labelStyle={{ color: style.color || "#64748b", fontSize: "9px", marginBottom: "4px" }}

            />

            <Bar dataKey={yKey} fill={style.color || "#3b82f6"} radius={[2, 2, 0, 0]} />

          </BarChart>

        </ResponsiveContainer>

      );

    }



    if (type === "line") {

      return (

        <ResponsiveContainer width="100%" height="100%">

          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

            <XAxis dataKey={xKey} fontSize={9} tickLine={false} axisLine={false} tick={{ fill: style.color || "#64748b" }} />

            <YAxis fontSize={9} tickLine={false} axisLine={false} tick={{ fill: style.color || "#64748b" }} />

            <Tooltip

              contentStyle={{ backgroundColor: style.bg || "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}

              itemStyle={{ fontSize: "10px", fontWeight: "bold", color: style.color || "#1e293b" }}

              labelStyle={{ color: style.color || "#64748b", fontSize: "9px", marginBottom: "4px" }}

            />

            <Line type="monotone" dataKey={yKey} stroke={style.color || "#3b82f6"} strokeWidth={2} dot={{ r: 3, fill: style.color || "#3b82f6" }} activeDot={{ r: 5 }} />

          </LineChart>

        </ResponsiveContainer>

      );

    }



    if (type === "pie") {

      return (

        <ResponsiveContainer width="100%" height="100%">

          <PieChart>

            <Tooltip

              contentStyle={{ backgroundColor: style.bg || "#fff", border: "1px solid #e2e8f0", borderRadius: "8px" }}

              itemStyle={{ fontSize: "10px", fontWeight: "bold", color: style.color || "#1e293b" }}

            />

            <Pie data={data} dataKey={yKey} nameKey={xKey} outerRadius={70} label>

              {data.map((entry, index) => (

                <Cell

                  key={`slice-${index}`}

                  fill={index % 2 === 0 ? style.color || "#3b82f6" : "#93c5fd"}

                />

              ))}

            </Pie>

          </PieChart>

        </ResponsiveContainer>

      );

    }



    if (type === "table") {

      return (

        <div className="overflow-auto h-full w-full min-w-0 custom-scrollbar">

          <table className="min-w-full divide-y divide-slate-100">

            <thead className="sticky top-0 z-10" style={{ backgroundColor: style.bg ? `${style.bg}ee` : "#f8fafc" }}>

              <tr>

                {keys.map((col) => (

                  <th

                    key={col}

                    className={`${readOnly ? "px-2 sm:px-3" : "px-3"} py-1.5 sm:py-2 text-left text-[8px] sm:text-[9px] font-bold uppercase tracking-widest border-b border-slate-200 whitespace-nowrap`}

                    style={{ color: style.color || "#64748b" }}

                  >

                    {col}

                  </th>

                ))}

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-50">

              {data.map((row, i) => (

                <tr key={i} className="hover:bg-black/5 transition-colors">

                  {keys.map((col) => (

                    <td

                      key={col}

                      className={`${readOnly ? "px-2 sm:px-3" : "px-3"} py-1 sm:py-1.5 whitespace-nowrap text-[9px] sm:text-[10px] font-medium`}

                      style={{ color: style.color || "#475569" }}

                    >

                      {formatDisplayValue(row[col])}

                    </td>

                  ))}

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      );

    }



    if (type === "kpi") {

      const val = data[0] ? Object.values(data[0])[0] : 0;

      const label = title || widget.description || "";

      const isTop = (style.kpiLabelPosition || "bottom") === "top";

      const displayVal = formatDisplayValue(val);

      const valueFontPx = resolveKpiValueFontPx(style, displayVal, readOnly);

      const labelFontPx = resolveKpiLabelFontPx(style);

      const labelStyle = {

        fontSize: `${labelFontPx}px`,

        lineHeight: 1.25,

        color: style.color || "#64748b",

      };

      return (

        <div className={`flex flex-col justify-center h-full min-w-0 gap-0.5 ${alignClass}`}>

          {label && isTop && (

            <div className="font-semibold px-0.5 break-words leading-tight" style={labelStyle}>

              {label}

            </div>

          )}

          <div

            className="font-black tracking-tight break-words leading-none max-w-full px-0.5"

            style={{ color: style.color || "#3b82f6", fontSize: `${valueFontPx}px` }}

          >

            {displayVal}

          </div>

          {label && !isTop && (

            <div className="font-semibold px-0.5 break-words leading-tight mt-0.5" style={labelStyle}>

              {label}

            </div>

          )}

        </div>

      );

    }



    return <div className="flex items-center justify-center h-full opacity-70 text-[10px] font-bold uppercase">Unknown Widget</div>;

  };



  const flatLivePhone = readOnly && isPhoneMode && nested;

  const outerStyle = buildBoxStyle(style, {
    transparentBg: isHeading && !style.bg,
    isContainer,
  });

  if (flatLivePhone) {
    outerStyle.padding = "4px";
    outerStyle.margin = "0";
    outerStyle.boxShadow = "none";
    outerStyle.border = "none";
  }

  const showHeader = displayTitle && type !== "kpi" && !isHeading && !isContainer;



  if (nested) {

    return (

      <div
        className={`h-full w-full flex flex-col overflow-hidden${
          flatLivePhone ? "" : " border border-slate-200/80 shadow-sm"
        }`}
        style={outerStyle}
      >
        {showHeader && (

          <div

            className="shrink-0 border-b border-slate-100/80 font-bold flex justify-between items-center"

            style={{ fontSize: style.fontSize ? `${style.fontSize}px` : "10px", color: style.color || "#64748b" }}

          >

            <span>{displayTitle}</span>

          </div>

        )}

        <div className="flex-1 min-h-0 overflow-hidden">{renderContent()}</div>

      </div>

    );

  }



  return (

    <div

      className={`h-full w-full flex flex-col transition-all ${
        isContainer && readOnly ? "overflow-visible" : "overflow-hidden"
      } ${

        isHeading ? "border-0 shadow-none" : "border border-slate-200/80 shadow-sm hover:shadow-md"

      }`}

      style={outerStyle}

    >

      {showHeader && (

        <div

          className="shrink-0 border-b border-slate-100/80 font-bold flex justify-between items-center"

          style={{

            fontSize: style.fontSize ? `${style.fontSize}px` : "10px",

            color: style.color || "#64748b",

            backgroundColor: style.bg ? `${style.bg}cc` : "rgba(248,250,252,0.8)",

          }}

        >

          <span className="truncate">{displayTitle}</span>

        </div>

      )}

      <div className={`flex-1 min-h-0 ${isContainer ? "overflow-visible" : "overflow-hidden"}`}>{renderContent()}</div>

    </div>

  );

};



export default WidgetRenderer;

