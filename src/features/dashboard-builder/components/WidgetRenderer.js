import React, { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Copy, GripVertical, Pencil, Search, Trash2, X } from "lucide-react";
import ContainerNestedGrid from "./ContainerNestedGrid";
import { isConfiguredWidgetQuery } from "../utils/widgetQuery.js";
import { hasCustomMobileNestedLayout, resolveWidgetSpacingPx, readNestedGridWidthPx, spacingPxToCss, stackNestedLayoutForPhone } from "../utils/dashboardLayoutEngine";

const resolveKpiValueFontPx = (style = {}, displayVal = "", readOnly = false, nested = false) => {
  const configured = Number(style.fontSize);
  const textLen = String(displayVal || "").length;
  if (nested) {
    if (Number.isFinite(configured) && configured >= 8) {
      let size = configured;
      if (textLen > 14) size = Math.min(size, 16);
      else if (textLen > 10) size = Math.min(size, 22);
      else if (textLen > 6) size = Math.min(size, 28);
      return Math.max(8, Math.min(size, 48));
    }
    let nestedBase = 14;
    if (textLen > 10) nestedBase = 11;
    else if (textLen > 6) nestedBase = 12;
    return nestedBase;
  }
  let base = Number.isFinite(configured) && configured >= 14 ? configured : (readOnly ? 28 : 26);
  if (textLen > 14) base = Math.min(base, 12);
  else if (textLen > 10) base = Math.min(base, 14);
  else if (textLen > 6 && base > 20) base = 20;
  return Math.max(12, base);
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

const filterTableRows = (rows = [], columns = [], query = "") => {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    columns.some((col) => formatDisplayValue(row[col]).toLowerCase().includes(needle)),
  );
};

const sortTableRows = (rows = [], column = "", direction = "asc") => {
  if (!column) return rows;
  const dir = direction === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => {
    const a = formatDisplayValue(left[column]).toLowerCase();
    const b = formatDisplayValue(right[column]).toLowerCase();
    const aNum = Number(a);
    const bNum = Number(b);
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && a !== "" && b !== "") {
      return (aNum - bNum) * dir;
    }
    return a.localeCompare(b) * dir;
  });
};

const resolveTableVisualStyle = (style = {}) => {
  const headerColor = style.tableHeaderColor || style.color || "#64748b";
  const bodyColor = style.tableBodyColor || style.color || "#475569";
  const headerBg = style.tableHeaderBg || (style.bg ? `${style.bg}ee` : "#f8fafc");
  const bodyBg = style.tableBodyBg || style.bg || "#ffffff";
  const borderColor = style.tableBorderColor || "#e2e8f0";
  const rowHoverBg = style.tableRowHoverBg || "#f8fafc";
  const headerFontPx = Math.max(8, Number(style.tableHeaderFontSize) || 9);
  const bodyFontPx = Math.max(8, Number(style.tableBodyFontSize) || Number(style.fontSize) || 10);
  return {
    headerColor,
    bodyColor,
    headerBg,
    bodyBg,
    borderColor,
    rowHoverBg,
    headerFontPx,
    bodyFontPx,
  };
};

const DashboardTableView = ({
  data = [],
  style = {},
  nested = false,
  isPhoneMode = false,
  tableSearchEnabled = false,
  tableSearchPlaceholder = "",
  tableSearchPosition = "right",
  tableColumnSortEnabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const keys = Object.keys(data[0] || {});
  const resolvedSearchPlaceholder = String(tableSearchPlaceholder || "").trim() || "Search...";
  const showSearch = tableSearchEnabled === true;
  const showColumnSort = tableColumnSortEnabled === true;
  const searchAlignLeft = tableSearchPosition === "left";
  const compact = nested || isPhoneMode;
  const tableVisual = resolveTableVisualStyle(style);
  const headPad = compact ? "px-2" : "px-2 sm:px-3";
  const cellPad = compact ? "px-2" : "px-2 sm:px-3";
  const headTextClass = compact
    ? "text-[8px] leading-tight"
    : "text-[8px] sm:text-[9px]";
  const bodyTextClass = compact
    ? "text-[9px] leading-snug"
    : "text-[9px] sm:text-[10px]";

  const displayRows = useMemo(() => {
    const filtered = showSearch
      ? filterTableRows(data, keys, searchQuery)
      : data;
    return showColumnSort
      ? sortTableRows(filtered, sortKey, sortDir)
      : filtered;
  }, [data, keys, searchQuery, sortKey, sortDir, showSearch, showColumnSort]);

  const toggleSort = (column) => {
    if (!showColumnSort) return;
    if (sortKey !== column) {
      setSortKey(column);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    setSortKey(null);
    setSortDir("asc");
  };

  const renderSortIcon = (column) => {
    if (!showColumnSort) return null;
    if (sortKey !== column) {
      return <ArrowUpDown size={10} className="shrink-0 opacity-40" aria-hidden />;
    }
    return sortDir === "asc"
      ? <ArrowUp size={10} className="shrink-0 text-blue-600" aria-hidden />
      : <ArrowDown size={10} className="shrink-0 text-blue-600" aria-hidden />;
  };

  return (
    <div
      className="flex flex-col h-full w-full min-h-0 min-w-0"
      style={{ backgroundColor: tableVisual.bodyBg }}
    >
      {showSearch && (
        <div
          className={`shrink-0 flex items-center gap-2 border-b px-2 py-1.5 ${
            searchAlignLeft ? "justify-start" : "justify-end"
          }`}
          style={{ backgroundColor: tableVisual.headerBg, borderColor: tableVisual.borderColor }}
        >
          <label
            className={`relative block shrink-0 ${
              compact
                ? "w-full max-w-full"
                : nested
                  ? "w-[min(240px,60vw)]"
                  : "w-[min(280px,64vw)]"
            }`}
          >
            <Search
              size={compact ? 13 : 14}
              className="pointer-events-none absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              placeholder={resolvedSearchPlaceholder}
              className={`w-full rounded-md border bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400/40 shadow-sm ${
                compact ? "h-8 pl-8 pr-8 text-[11px]" : "h-9 pl-10 pr-10 text-xs"
              }`}
              style={{ borderColor: tableVisual.borderColor }}
              aria-label="Search table rows"
            />
            {searchQuery ? (
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery("");
                }}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            ) : null}
          </label>
        </div>
      )}
      <div className="flex-1 min-h-0 min-w-0 overflow-auto custom-scrollbar overscroll-x-contain">
        <table
          className={`w-full min-w-max border-collapse ${
            compact ? "table-auto" : "table-fixed sm:table-auto"
          }`}
          style={{ borderColor: tableVisual.borderColor }}
        >
          <thead className="sticky top-0 z-10" style={{ backgroundColor: tableVisual.headerBg }}>
            <tr>
              {keys.map((col) => (
                <th
                  key={col}
                  className={`${headPad} py-1.5 sm:py-2 text-left font-bold uppercase tracking-wide sm:tracking-widest border-b align-top whitespace-nowrap sm:whitespace-normal ${headTextClass}`}
                  style={{
                    color: tableVisual.headerColor,
                    borderColor: tableVisual.borderColor,
                    fontSize: `${tableVisual.headerFontPx}px`,
                    backgroundColor: tableVisual.headerBg,
                  }}
                >
                  {showColumnSort ? (
                    <button
                      type="button"
                      className="inline-flex max-w-full items-center gap-1 text-left hover:opacity-80"
                      style={{ color: tableVisual.headerColor }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSort(col);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <span className="break-words">{col}</span>
                      {renderSortIcon(col)}
                    </button>
                  ) : (
                    <span className="break-words">{col}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr
                key={i}
                className="transition-colors"
                style={{ backgroundColor: tableVisual.bodyBg }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = tableVisual.rowHoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = tableVisual.bodyBg;
                }}
              >
                {keys.map((col) => (
                  <td
                    key={col}
                    className={`${cellPad} py-1 sm:py-1.5 break-words align-top font-medium ${bodyTextClass}`}
                    style={{
                      color: tableVisual.bodyColor,
                      fontSize: `${tableVisual.bodyFontPx}px`,
                      borderBottom: `1px solid ${tableVisual.borderColor}`,
                    }}
                  >
                    {formatDisplayValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {searchQuery.trim() && displayRows.length === 0 ? (
          <div className="px-3 py-4 text-center text-[10px] font-medium text-slate-400">
            No rows match &quot;{searchQuery.trim()}&quot;
          </div>
        ) : null}
      </div>
    </div>
  );
};

const buildBoxStyle = (style = {}, { transparentBg = false, isContainer = false, compactPad = false } = {}) => {
  const defaultPad = Number.isFinite(Number(style.padding)) ? Math.max(0, Number(style.padding)) : 8;
  const padFallback = compactPad ? Math.min(defaultPad, 4) : defaultPad;
  const defaultMar = Number.isFinite(Number(style.margin)) ? Math.max(0, Number(style.margin)) : 0;
  const padding = resolveWidgetSpacingPx(style, "padding", padFallback);
  const margin = resolveWidgetSpacingPx(style, "margin", defaultMar);
  const borderRadius = Number.isFinite(Number(style.borderRadius)) ? Math.max(0, Number(style.borderRadius)) : 6;
  return {
    boxSizing: "border-box",
    backgroundColor: transparentBg ? "transparent" : (style.bg || "#ffffff"),
    color: style.color || "#334155",
    borderRadius: `${borderRadius}px`,
    fontFamily: style.fontFamily || "inherit",
    padding: spacingPxToCss(padding),
    margin: isContainer ? "0" : spacingPxToCss(margin),
    width: isContainer ? "100%" : undefined,
    maxWidth: isContainer ? "100%" : undefined,
  };
};

const resolveContainerNestedLayout = (widget, sectionChildren, isPhoneMode) => {
  if (isPhoneMode) {
    const desktopNested = Array.isArray(widget.nestedLayout) && widget.nestedLayout.length
      ? widget.nestedLayout
      : sectionChildren
        .map((child) => child.layout || {})
        .filter((item) => item && item.i);
    const mobileNested = Array.isArray(widget.mobileNestedLayout) ? widget.mobileNestedLayout : [];
    if (mobileNested.length && hasCustomMobileNestedLayout(desktopNested, mobileNested)) {
      return mobileNested;
    }
    return stackNestedLayoutForPhone(desktopNested);
  }
  if (Array.isArray(widget.nestedLayout) && widget.nestedLayout.length) {
    return widget.nestedLayout;
  }
  return sectionChildren
    .map((child) => child.layout || {})
    .filter((item) => item && item.i);
};

const WidgetRenderer = ({
  widget,
  readOnly = false,
  nested = false,
  isPhoneMode = false,
  designParity = false,
  selectedWidgetId = null,
  onNestedLayoutChange,
  onSelectWidget,
  onDeleteWidget,
  onAddChildWidget,
  onCloneChildWidget,
  onCloneWidget,
  onNestedGridWidthDiscover,
  isDropTarget = false,
  isContainerResizing = false,
}) => {
  const useBuilderVisuals = !readOnly || designParity;
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
    : (useBuilderVisuals ? 16 : 18);

  const renderContent = () => {
    if (type === "heading") {
      const headingAlign =
        style.contentAlign === "right"
          ? "justify-end text-right"
          : style.contentAlign === "center"
            ? "justify-center text-center"
            : "justify-start text-left";
      return (
        <div className={`flex w-full items-start py-0 ${headingAlign}`}>
          <h2
            className="font-extrabold tracking-tight leading-none w-full m-0"
            style={{ color: style.color || "#0f172a", fontSize: `${headingFontPx}px` }}
          >
            {title || widget.description || "Dashboard Heading"}
          </h2>
        </div>
      );
    }

    if (isContainer) {
      const sectionChildren = Array.isArray(widget.sectionChildren) ? widget.sectionChildren : [];
      const nestedLayout = resolveContainerNestedLayout(widget, sectionChildren, isPhoneMode);
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
          className={`group relative flex flex-col items-start w-full max-w-full shrink-0 ${
            readOnly ? "" : "min-h-0"
          } h-auto ${readOnly || !isPhoneMode ? "overflow-visible" : "overflow-hidden"}`}
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
            nestedGridWidthPx={isPhoneMode ? null : readNestedGridWidthPx(widget)}
            isContainerResizing={isContainerResizing}
            onNestedGridWidthDiscover={(widthPx, options) => onNestedGridWidthDiscover?.(widget.id, widthPx, options)}
            readOnly={readOnly}
            selectedWidgetId={selectedWidgetId}
            onLayoutChange={(nextLayout, options) => onNestedLayoutChange?.(widget.id, nextLayout, isPhoneMode, options)}
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
      // Never render a blank white card — show title or emptyText so nested KPIs stay visible.
      if (titleOnlyLabel) {
        return renderTitleOnlyKpi(titleOnlyLabel, style, alignClass);
      }
      return (
        <div className={`flex h-full w-full ${alignClass} ${emptyPosClass} opacity-70 text-[10px] uppercase tracking-widest font-semibold break-words leading-tight px-1`}>
          {widget.emptyText || "Click edit and add query"}
        </div>
      );
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
        <DashboardTableView
          data={data}
          style={style}
          nested={nested}
          isPhoneMode={isPhoneMode}
          tableSearchEnabled={widget.tableSearchEnabled === true}
          tableSearchPlaceholder={widget.tableSearchPlaceholder || ""}
          tableSearchPosition={widget.tableSearchPosition === "left" ? "left" : "right"}
          tableColumnSortEnabled={widget.tableColumnSortEnabled === true}
        />
      );
    }

    if (type === "kpi" || widget.rawType === "kpi" || widget.rawType === "count" || widget.rawType === "sum") {
      const val = data[0] ? Object.values(data[0])[0] : 0;
      const label = title || widget.description || "";
      const isTop = (style.kpiLabelPosition || "bottom") === "top";
      const displayVal = formatDisplayValue(val);
      const valueFontPx = resolveKpiValueFontPx(style, displayVal, !useBuilderVisuals, nested);
      const labelFontPx = resolveKpiLabelFontPx(style);
      const labelStyle = {
        fontSize: `${labelFontPx}px`,
        lineHeight: 1.05,
        color: style.color || "#64748b",
      };
      // Nested cards can be short — center value, never clip the number.
      const kpiShellClass = `flex flex-col justify-center items-stretch h-full w-full min-h-0 min-w-0 gap-0 overflow-visible ${alignClass}`;
      return (
        <div className={kpiShellClass}>
          {label && isTop && (
            <div
              className={`font-semibold px-0.5 truncate leading-tight shrink-0${nested ? " text-center" : ""}`}
              style={labelStyle}
            >
              {label}
            </div>
          )}
          <div
            className="nested-kpi-value font-black tracking-tight leading-none max-w-full px-0.5 text-center shrink-0"
            style={{
              color: style.color || "#3b82f6",
              fontSize: `${valueFontPx}px`,
              lineHeight: 1,
              overflow: "visible",
            }}
            title={String(displayVal)}
          >
            {displayVal}
          </div>
          {label && !isTop && (
            <div
              className={`font-semibold px-0.5 truncate leading-tight mt-0.5 shrink-0${nested ? " text-center" : ""}`}
              style={labelStyle}
            >
              {label}
            </div>
          )}
        </div>
      );
    }

    return <div className="flex items-center justify-center h-full opacity-70 text-[10px] font-bold uppercase">Unknown Widget</div>;
  };

  if (isHeading) {
    const headingAlignClass =
      style.contentAlign === "right"
        ? "justify-end text-right"
        : style.contentAlign === "center"
          ? "justify-center text-center"
          : "justify-start text-left";
    const headingPad = resolveWidgetSpacingPx(style, "padding", 0);
    return (
      <div
        className={`h-full w-full flex items-start border-0 shadow-none bg-transparent ${headingAlignClass}`}
        style={{
          background: "transparent",
          boxShadow: "none",
          padding: spacingPxToCss(headingPad),
        }}
      >
        {renderContent()}
      </div>
    );
  }

  const flatLivePhone = readOnly && isPhoneMode && nested;
  const outerStyle = buildBoxStyle(style, {
    transparentBg: isHeading && !style.bg,
    isContainer,
    compactPad: nested && !isContainer,
  });
  if (flatLivePhone) {
    outerStyle.padding = "4px";
    outerStyle.margin = "0";
    outerStyle.boxShadow = "none";
    outerStyle.border = "none";
  }
  if (nested && !isContainer) {
    // Compact padding so value fits on short published cards without changing grid height.
    outerStyle.padding = "0px";
    outerStyle.overflow = "visible";
  }
  const isKpi = type === "kpi" || widget.rawType === "kpi" || widget.rawType === "count" || widget.rawType === "sum";
  const showHeader = displayTitle && !isKpi && !isHeading && !isContainer;

  if (nested) {
    return (
      <div
        className={`h-full w-full min-h-0 flex flex-col overflow-visible${
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
        <div className="flex-1 min-h-0 w-full overflow-visible flex items-stretch">
          {renderContent()}
        </div>
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