import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend } from "recharts";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Copy, GripVertical, Pencil, Search, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import SimpleNestedCanvas from "./SimpleNestedCanvas";
import ExportMenu from "@/ui/common/list/ExportMenu";
import { exportTableData } from "@/platform/utils/list/tableExport";
import { notifyListPageExportResult } from "@/platform/utils/list/listPageExport";
import { boxesFromChildren, savedStyleToCss } from "../utils/floatingLayoutEngine";
import { isConfiguredWidgetQuery } from "../utils/widgetQuery.js";
import { resolveWidgetSpacingPx, spacingPxToCss } from "../utils/dashboardLayoutEngine";
import { normalizeTableSearchPosition, normalizeTableSearchWidth } from "../utils/tableToolbar.js";
import {
  DASHBOARD_TABLE_BODY_BG,
  DASHBOARD_TABLE_HEADER_BG,
  DASHBOARD_WIDGET_BG,
} from "../utils/dashboardBuilderTheme";

const resolveKpiValueFontPx = (style = {}, displayVal = "", readOnly = false, nested = false) => {
  const configured = Number(style.fontSize);
  const textLen = String(displayVal || "").length;
  if (Number.isFinite(configured) && configured >= 8) {
    // Publish: always honour saved font size (no auto-shrink).
    if (readOnly) return configured;
    let size = configured;
    if (nested) {
      if (textLen > 14) size = Math.min(size, 16);
      else if (textLen > 10) size = Math.min(size, 22);
      else if (textLen > 6) size = Math.min(size, 28);
      return Math.max(8, Math.min(size, 48));
    }
    if (textLen > 14) size = Math.min(size, 12);
    else if (textLen > 10) size = Math.min(size, 14);
    else if (textLen > 6 && size > 20) size = 20;
    return Math.max(12, size);
  }
  if (nested) {
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

/**
 * Recharts ResponsiveContainer warns width/height -1 when the parent is not measurable yet
 * (floating builder scale / nested layout first paint). Mount the chart only after we have size.
 */
function ChartResponsiveContainer({ children }) {
  const hostRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = hostRef.current;
    if (!node) return undefined;

    const measure = () => {
      const width = Math.max(0, Math.floor(node.clientWidth || 0));
      const height = Math.max(0, Math.floor(node.clientHeight || 0));
      setSize((prev) => (
        prev.width === width && prev.height === height ? prev : { width, height }
      ));
    };

    measure();
    const raf = window.requestAnimationFrame(measure);
    if (typeof ResizeObserver === "undefined") {
      return () => window.cancelAnimationFrame(raf);
    }
    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(measure);
    });
    ro.observe(node);
    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const ready = size.width > 1 && size.height > 1;

  return (
    <div ref={hostRef} className="h-full w-full min-h-0 min-w-0 overflow-hidden">
      {ready ? (
        <ResponsiveContainer width={size.width} height={size.height} minWidth={0} minHeight={0}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

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
  const headerBg = style.tableHeaderBg || (style.bg ? `${style.bg}ee` : DASHBOARD_TABLE_HEADER_BG);
  const bodyBg = style.tableBodyBg || style.bg || DASHBOARD_TABLE_BODY_BG;
  const borderColor = style.tableBorderColor || "#e2e8f0";
  const rowHoverBg = style.tableRowHoverBg || DASHBOARD_TABLE_HEADER_BG;
  const headerFontPx = Math.max(8, Number(style.tableHeaderFontSize) || 9);
  const bodyFontPx = Math.max(8, Number(style.tableBodyFontSize) || Number(style.fontSize) || 10);
  const searchFontPx = Math.max(8, Number(style.tableSearchFontSize) || bodyFontPx);
  const searchColor = style.tableSearchColor || bodyColor;
  const searchBg = style.tableSearchBg || bodyBg;
  const cellPadX = Math.max(0, Number.isFinite(Number(style.tableCellPaddingX)) ? Number(style.tableCellPaddingX) : 8);
  const cellPadY = Math.max(0, Number.isFinite(Number(style.tableCellPaddingY)) ? Number(style.tableCellPaddingY) : 6);
  const toolbarGap = Math.max(0, Number.isFinite(Number(style.tableToolbarGap)) ? Number(style.tableToolbarGap) : 12);
  return {
    headerColor,
    bodyColor,
    headerBg,
    bodyBg,
    borderColor,
    rowHoverBg,
    headerFontPx,
    bodyFontPx,
    searchFontPx,
    searchColor,
    searchBg,
    cellPadX,
    cellPadY,
    toolbarGap,
  };
};

const DashboardTableView = ({
  data = [],
  style = {},
  nested = false,
  isPhoneMode = false,
  title = "",
  titlePosition = "top",
  titleAlign = "left",
  titleFontPx = 11,
  tableSearchEnabled = false,
  tableSearchPlaceholder = "",
  tableSearchPosition = "right",
  tableSearchWidth = 280,
  tableColumnSortEnabled = false,
  tableExportEnabled = false,
  /** Extra classes for the action header (search + export) wrapper */
  tableToolbarClassName = "",
  /** Extra classes for the search input wrapper (e.g. max-w-xs, w-[260px]) */
  tableSearchClassName = "",
  /** Extra classes for the export control wrapper */
  tableExportClassName = "",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [exporting, setExporting] = useState(false);
  const keys = Array.from(new Set(
    data.flatMap((row) =>
      row && typeof row === "object" && !Array.isArray(row) ? Object.keys(row) : [],
    ),
  ));
  const resolvedSearchPlaceholder = String(tableSearchPlaceholder || "").trim() || "Search...";
  const showSearch = tableSearchEnabled === true;
  const showExport = tableExportEnabled === true;
  const showColumnSort = tableColumnSortEnabled === true;
  const searchPos = normalizeTableSearchPosition(tableSearchPosition);
  const searchFull = searchPos === "full";
  const searchWidthPx = normalizeTableSearchWidth(tableSearchWidth);
  const compact = nested || isPhoneMode;
  // Phone/nested: keep search from forcing the toolbar wider than the widget shell.
  const effectiveSearchWidth = compact && !searchFull
    ? Math.min(searchWidthPx, 168)
    : searchWidthPx;
  const tableVisual = resolveTableVisualStyle(style);
  const headTextClass = compact
    ? "text-[8px] leading-tight"
    : "text-[8px] sm:text-[9px]";
  const bodyTextClass = compact
    ? "text-[9px] leading-snug"
    : "text-[9px] sm:text-[10px]";
  const cellPadStyle = {
    paddingLeft: `${compact ? Math.min(tableVisual.cellPadX, 8) : tableVisual.cellPadX}px`,
    paddingRight: `${compact ? Math.min(tableVisual.cellPadX, 8) : tableVisual.cellPadX}px`,
    paddingTop: `${compact ? Math.min(tableVisual.cellPadY, 6) : tableVisual.cellPadY}px`,
    paddingBottom: `${compact ? Math.min(tableVisual.cellPadY, 6) : tableVisual.cellPadY}px`,
  };

  const displayRows = useMemo(() => {
    const filtered = showSearch
      ? filterTableRows(data, keys, searchQuery)
      : data;
    return showColumnSort
      ? sortTableRows(filtered, sortKey, sortDir)
      : filtered;
  }, [data, keys, searchQuery, sortKey, sortDir, showSearch, showColumnSort]);

  const handleExport = useCallback(async (format) => {
    if (!displayRows.length || !keys.length) {
      toast.info("No rows to export.");
      return;
    }
    setExporting(true);
    try {
      const columns = keys.map((key) => ({
        key,
        label: String(key),
        format: (value) => {
          if (value == null || value === "") return "";
          if (typeof value === "number" && Number.isFinite(value)) return String(value);
          if (typeof value === "object") {
            try {
              return JSON.stringify(value);
            } catch {
              return String(value);
            }
          }
          return String(value);
        },
      }));
      const moduleName = String(title || "Dashboard Table").trim() || "Dashboard Table";
      const { filename } = await exportTableData({
        format,
        rows: displayRows,
        columns,
        moduleName,
        includeMeta: false,
      });
      const { message } = notifyListPageExportResult(format, filename);
      toast.success(message);
    } catch (err) {
      toast.error(err?.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }, [displayRows, keys, title]);

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

  const displayTitle = String(title || "").trim();
  const titleOnBottom = String(titlePosition || "top") === "bottom";
  const showTitleTop = Boolean(displayTitle) && !titleOnBottom;
  const showTitleBottom = Boolean(displayTitle) && titleOnBottom;
  const titleLeft = showTitleTop && titleAlign !== "right";
  const titleRight = showTitleTop && titleAlign === "right";
  const showTopBar = showTitleTop || showSearch || showExport;
  const totalRows = Array.isArray(data) ? data.length : 0;
  const searchActive = showSearch && Boolean(String(searchQuery || "").trim());
  const countLabel = searchActive
    ? `Showing ${displayRows.length} of ${totalRows}`
    : `Total ${totalRows} ${totalRows === 1 ? "row" : "rows"}`;
  const titleAlignClass =
    titleAlign === "right" ? "text-right" : titleAlign === "center" ? "text-center" : "text-left";
  const searchSizeClass = searchFull
    ? showExport
      ? "flex-1 min-w-[120px] w-auto max-w-none"
      : "min-w-[120px] w-full max-w-none"
    : "shrink-0";

  const renderTableTitle = (extraClass = "") => (
    <div
      className={`min-w-0 truncate font-bold uppercase tracking-widest ${titleAlignClass} ${extraClass}`.trim()}
      style={{
        color: style.color || "#334155",
        fontSize: `${titleFontPx}px`,
        ...(style.fontWeight && style.fontWeight !== "inherit" ? { fontWeight: style.fontWeight } : {}),
      }}
      title={displayTitle}
    >
      {displayTitle}
    </div>
  );

  const searchControl = showSearch ? (
    <label
      className={`relative block ${searchSizeClass} ${tableSearchClassName}`.trim()}
      style={searchFull ? undefined : { width: effectiveSearchWidth, maxWidth: "100%" }}
    >
      <Search
        size={Math.max(12, Math.min(14, Math.round(tableVisual.searchFontPx)))}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
        style={{ color: tableVisual.searchColor, opacity: 0.55 }}
        aria-hidden
      />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        placeholder={resolvedSearchPlaceholder}
        className="w-full h-8 rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-400/40 shadow-sm"
        style={{
          borderColor: tableVisual.borderColor,
          backgroundColor: tableVisual.searchBg,
          color: tableVisual.searchColor,
          fontSize: `${tableVisual.searchFontPx}px`,
          height: 32,
          paddingLeft: 30,
          paddingRight: searchQuery ? 28 : 10,
        }}
        aria-label="Search table rows"
      />
      {searchQuery ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:opacity-80"
          style={{ color: tableVisual.searchColor }}
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
  ) : null;

  const exportControl = showExport ? (
    <div
      className={`flex shrink-0 items-center ${tableExportClassName}`.trim()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <ExportMenu
        disabled={!displayRows.length}
        exporting={exporting}
        onExport={handleExport}
        label="Export"
        variant="solid"
        showLabel
        menuAlign="right"
        className="h-8 self-center [&>button]:!h-8 [&>button]:!min-h-8 [&>button]:!min-w-0 [&>button]:!w-auto [&>button]:!px-2.5 [&>button]:!text-[10px] [&>button]:!rounded-md [&>button]:!font-semibold"
      />
    </div>
  ) : null;

  return (
    <div
      className="flex flex-col h-full w-full min-h-0 min-w-0"
      style={{ backgroundColor: tableVisual.bodyBg }}
    >
      {showTopBar && (
        <div
          className={`table-action-header shrink-0 flex flex-nowrap items-center border-b px-2 py-1.5 sm:px-3 ${tableToolbarClassName}`.trim()}
          style={{
            backgroundColor: tableVisual.bodyBg,
            borderColor: tableVisual.borderColor,
            gap: `${tableVisual.toolbarGap}px`,
          }}
        >
          {titleLeft && searchPos === "left" ? (
            <>
              {renderTableTitle("max-w-[46%]")}
              {searchControl}
              {exportControl}
            </>
          ) : (
            <>
              {titleLeft ? renderTableTitle("flex-1") : null}
              <div
                className={`flex min-w-0 shrink-0 flex-nowrap items-center ${titleLeft || titleRight || searchPos !== "left" ? "ml-auto" : ""}`}
                style={{ gap: `${tableVisual.toolbarGap}px` }}
              >
                {titleRight ? renderTableTitle("max-w-[46%]") : null}
                {searchControl}
                {exportControl}
              </div>
            </>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0 min-w-0 overflow-auto overscroll-x-contain">
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
                  className={`text-left font-bold uppercase tracking-wide sm:tracking-widest border-b align-top whitespace-nowrap sm:whitespace-normal ${headTextClass}`}
                  style={{
                    color: tableVisual.headerColor,
                    borderColor: tableVisual.borderColor,
                    fontSize: `${tableVisual.headerFontPx}px`,
                    backgroundColor: tableVisual.headerBg,
                    ...cellPadStyle,
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
                    className={`break-words align-top font-medium ${bodyTextClass}`}
                    style={{
                      color: tableVisual.bodyColor,
                      fontSize: `${tableVisual.bodyFontPx}px`,
                      borderBottom: `1px solid ${tableVisual.borderColor}`,
                      ...cellPadStyle,
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
      <div
        className="shrink-0 flex flex-nowrap items-center border-t px-2 py-1 min-h-[28px] sm:px-3"
        style={{
          backgroundColor: tableVisual.bodyBg,
          borderColor: tableVisual.borderColor,
          gap: `${tableVisual.toolbarGap}px`,
        }}
      >
        {showTitleBottom && titleAlign !== "right" ? renderTableTitle("flex-1") : null}
        <span
          className="ml-auto shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums"
          style={{ color: tableVisual.bodyColor, opacity: 0.82 }}
          aria-live="polite"
        >
          {countLabel}
        </span>
        {showTitleBottom && titleAlign === "right" ? renderTableTitle("max-w-[60%]") : null}
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
  const fontWeight = style.fontWeight && style.fontWeight !== "inherit" ? style.fontWeight : undefined;
  return {
    boxSizing: "border-box",
    backgroundColor: transparentBg ? "transparent" : (style.bg || DASHBOARD_WIDGET_BG),
    color: style.color || "#334155",
    borderRadius: `${borderRadius}px`,
    fontFamily: style.fontFamily || "inherit",
    ...(fontWeight ? { fontWeight } : {}),
    padding: spacingPxToCss(padding),
    margin: isContainer ? "0" : spacingPxToCss(margin),
    width: isContainer ? "100%" : undefined,
    maxWidth: isContainer ? "100%" : undefined,
  };
};

const resolveContentGapPx = (style = {}, fallback = 4) => {
  if (Number.isFinite(Number(style.contentGap))) return Math.max(0, Number(style.contentGap));
  return fallback;
};

const resolveTitleFontPx = (style = {}, fallback = 11) => {
  if (Number.isFinite(Number(style.titleFontSize))) return Math.max(8, Number(style.titleFontSize));
  if (Number.isFinite(Number(style.fontSize))) return Math.max(8, Math.min(14, Number(style.fontSize)));
  return fallback;
};

const resolveContainerNestedLayoutPx = (widget, sectionChildren, isPhoneMode = false) => {
  if (isPhoneMode) {
    if (Array.isArray(widget.mobileNestedLayoutPx) && widget.mobileNestedLayoutPx.length) {
      return widget.mobileNestedLayoutPx;
    }
    // Fallback preview only — edits copy-on-write into mobileNestedLayoutPx.
    if (Array.isArray(widget.nestedLayoutPx) && widget.nestedLayoutPx.length) {
      return widget.nestedLayoutPx;
    }
    return boxesFromChildren(sectionChildren, []);
  }
  if (Array.isArray(widget.nestedLayoutPx) && widget.nestedLayoutPx.length) {
    return widget.nestedLayoutPx;
  }
  return boxesFromChildren(sectionChildren, []);
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
  pureSavedStyle = false,
  suppressChrome = false,
  onContainerShellPointerDown,
  canvasScale = 1,
  dragScale = 1,
}) => {
  const useBuilderVisuals = !readOnly && !pureSavedStyle;
  const previewRows = Array.isArray(widget.previewData) ? widget.previewData : null;
  const liveRows = Array.isArray(widget.data) ? widget.data : null;
  // Prefer non-empty preview; otherwise fall back to live data (empty [] must not hide rows).
  const rawData = (previewRows?.length ? previewRows : null)
    || (liveRows?.length ? liveRows : null)
    || previewRows
    || liveRows
    || [];
  const excludedUrlColumns = Array.isArray(widget.chart_config?.url_excluded_columns)
    ? widget.chart_config.url_excluded_columns
    : [];
  const data = String(widget.dataSource || widget.chart_config?.data_source || "").toLowerCase() === "url_json"
    && excludedUrlColumns.length
    ? rawData.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return row;
      return Object.fromEntries(
        Object.entries(row).filter(([key]) => !excludedUrlColumns.includes(key)),
      );
    })
    : rawData;
  const error = widget.error || widget.previewError || null;
  const { type, title, style = {} } = widget;
  const displayTitle = String(title || "").trim();
  const isHeading = type === "heading";
  const isContainer = type === "container" || type === "section";
  const isHybrid = type === "hybrid";
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
  const contentFlexAlignClass =
    style.contentAlign === "left"
      ? "items-start justify-start"
      : style.contentAlign === "right"
        ? "items-end justify-end"
        : "items-center justify-center";
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
            style={{
              color: style.color || "#0f172a",
              fontSize: `${headingFontPx}px`,
              ...(style.fontWeight && style.fontWeight !== "inherit" ? { fontWeight: style.fontWeight } : {}),
            }}
          >
            {title || widget.description || "Dashboard Heading"}
          </h2>
        </div>
      );
    }

    if (isContainer) {
      const sectionChildren = Array.isArray(widget.sectionChildren) ? widget.sectionChildren : [];
      const containerShellStyle = suppressChrome
        ? {
          boxSizing: "border-box",
          width: "100%",
          maxWidth: "100%",
          height: "100%",
          maxHeight: "100%",
          overflow: "hidden",
          borderRadius: Number.isFinite(Number(style.borderRadius))
            ? `${Number(style.borderRadius)}px`
            : "8px",
        }
        : buildBoxStyle(style, { isContainer: true });
      if (isPhoneMode) {
        containerShellStyle.padding = "0px";
        if (!readOnly) {
          containerShellStyle.overflow = "visible";
        }
      }

      const containerShellHeightClass = suppressChrome
        ? "h-full min-h-0 flex-1"
        : (readOnly && !isPhoneMode ? "h-full min-h-0" : "h-auto");

      return (
        <div
          className={`group relative flex flex-col items-start w-full h-full max-w-full min-w-0 ${
            readOnly && isPhoneMode ? "" : "min-h-0"
          } ${containerShellHeightClass} ${isPhoneMode && !readOnly ? "overflow-visible" : "overflow-hidden"}`}
          style={containerShellStyle}
        >
          {!readOnly && !nested && !suppressChrome && (
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
          {(displayTitle || widget.description) && !suppressChrome && (
            <div className="shrink-0 mb-2">
              {displayTitle ? (
                <p
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: style.color, fontSize: style.fontSize ? `${style.fontSize}px` : undefined }}
                >
                  {displayTitle}
                </p>
              ) : null}
              {widget.description ? (
                <p className="text-[10px] mt-0.5 opacity-80" style={{ color: style.color }}>
                  {widget.description}
                </p>
              ) : null}
            </div>
          )}
          <div className={`min-w-0 w-full max-w-full flex-1 min-h-0 flex flex-col ${isPhoneMode && !readOnly ? "overflow-visible" : "overflow-hidden"}`}>
            <SimpleNestedCanvas
              key={`simple-nested-${widget.id}`}
              childWidgets={sectionChildren}
              layoutPx={resolveContainerNestedLayoutPx(widget, sectionChildren, isPhoneMode)}
              containerId={widget.id}
              readOnly={readOnly}
              selectedWidgetId={selectedWidgetId}
              fillParentHeight={suppressChrome}
              canvasScale={canvasScale}
              dragScale={dragScale}
              isPhoneMode={isPhoneMode}
              onLayoutChange={(nextLayout, options) => onNestedLayoutChange?.(widget.id, nextLayout, isPhoneMode, options)}
              onSelectWidget={(childId) => onSelectWidget?.(childId)}
              onDeleteWidget={onDeleteWidget}
              onAddChildWidget={onAddChildWidget}
              onCloneChildWidget={onCloneChildWidget}
              onCanvasBackgroundClick={() => onSelectWidget?.(widget.id)}
              onContainerShellPointerDown={onContainerShellPointerDown}
            />
          </div>
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
        <div className="flex flex-col items-center justify-center h-full p-3 text-center gap-2 overflow-auto">
          <AlertCircle className="text-rose-500 shrink-0" size={22} />
          <span className="text-xs font-bold text-rose-600 uppercase tracking-tight">Query Error</span>
          <p className="text-[10px] text-rose-700/90 whitespace-pre-wrap break-words leading-relaxed max-w-full">
            {error}
          </p>
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
      const isBuilderNestedKpi = nested && !readOnly && (
        type === "kpi" || widget.rawType === "kpi" || widget.rawType === "count" || widget.rawType === "sum"
      );
      if (!isBuilderNestedKpi) {
        return (
          <div className="flex items-center justify-center h-full opacity-70 text-[10px] uppercase tracking-widest font-bold">
            No Data Found
          </div>
        );
      }
    }

    const keys = Array.from(new Set(
      data.flatMap((row) =>
        row && typeof row === "object" && !Array.isArray(row) ? Object.keys(row) : [],
      ),
    ));
    const graphXKey = String(style.graphXKey || "").trim();
    const graphYKey = String(style.graphYKey || "").trim();
    const xKey = (graphXKey && keys.includes(graphXKey)) ? graphXKey : keys[0];
    const yKey = (graphYKey && keys.includes(graphYKey)) ? graphYKey : (keys[1] || keys[0]);
    const graphTextPx = Math.max(8, Math.min(18, Number(style.graphTextSize) || Number(style.fontSize) || 10));
    const pieRadius = Math.max(40, Math.min(320, Number(style.graphPieRadius) || 70));
    const showLegend = style.graphShowLegend !== false;
    const palette = Array.isArray(style.graphColors) && style.graphColors.length
      ? style.graphColors
      : [style.color || "#3b82f6", "#60a5fa", "#93c5fd", "#1d4ed8", "#34d399", "#f59e0b", "#f43f5e", "#a855f7"];
    const tickFill = style.color || "#64748b";
    const wrapChart = (chart) => (
      <ChartResponsiveContainer>
        {chart}
      </ChartResponsiveContainer>
    );

    if (type === "bar") {
      return wrapChart(
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: showLegend ? 8 : 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey={xKey} fontSize={graphTextPx} tickLine={false} axisLine={false} tick={{ fill: tickFill, fontSize: graphTextPx }} />
          <YAxis fontSize={graphTextPx} tickLine={false} axisLine={false} tick={{ fill: tickFill, fontSize: graphTextPx }} />
          <Tooltip
            contentStyle={{ backgroundColor: style.bg || "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            itemStyle={{ fontSize: `${graphTextPx}px`, fontWeight: "bold", color: style.color || "#1e293b" }}
            labelStyle={{ color: tickFill, fontSize: `${Math.max(8, graphTextPx - 1)}px`, marginBottom: "4px" }}
          />
          {showLegend ? <Legend wrapperStyle={{ fontSize: `${graphTextPx}px` }} /> : null}
          <Bar dataKey={yKey} fill={palette[0] || "#3b82f6"} radius={[2, 2, 0, 0]} />
        </BarChart>,
      );
    }

    if (type === "line") {
      return wrapChart(
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: showLegend ? 8 : 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey={xKey} fontSize={graphTextPx} tickLine={false} axisLine={false} tick={{ fill: tickFill, fontSize: graphTextPx }} />
          <YAxis fontSize={graphTextPx} tickLine={false} axisLine={false} tick={{ fill: tickFill, fontSize: graphTextPx }} />
          <Tooltip
            contentStyle={{ backgroundColor: style.bg || "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            itemStyle={{ fontSize: `${graphTextPx}px`, fontWeight: "bold", color: style.color || "#1e293b" }}
            labelStyle={{ color: tickFill, fontSize: `${Math.max(8, graphTextPx - 1)}px`, marginBottom: "4px" }}
          />
          {showLegend ? <Legend wrapperStyle={{ fontSize: `${graphTextPx}px` }} /> : null}
          <Line type="monotone" dataKey={yKey} stroke={palette[0] || "#3b82f6"} strokeWidth={2} dot={{ r: 3, fill: palette[0] || "#3b82f6" }} activeDot={{ r: 5 }} />
        </LineChart>,
      );
    }

    if (type === "area") {
      return wrapChart(
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: showLegend ? 8 : 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey={xKey} fontSize={graphTextPx} tickLine={false} axisLine={false} tick={{ fill: tickFill, fontSize: graphTextPx }} />
          <YAxis fontSize={graphTextPx} tickLine={false} axisLine={false} tick={{ fill: tickFill, fontSize: graphTextPx }} />
          <Tooltip
            contentStyle={{ backgroundColor: style.bg || "#fff", border: "1px solid #e2e8f0", borderRadius: "8px" }}
            itemStyle={{ fontSize: `${graphTextPx}px`, fontWeight: "bold", color: style.color || "#1e293b" }}
          />
          {showLegend ? <Legend wrapperStyle={{ fontSize: `${graphTextPx}px` }} /> : null}
          <Area type="monotone" dataKey={yKey} stroke={palette[0] || "#3b82f6"} fill={palette[1] || palette[0] || "#93c5fd"} fillOpacity={0.35} />
        </AreaChart>,
      );
    }

    if (type === "pie") {
      return wrapChart(
        <PieChart>
          <Tooltip
            contentStyle={{ backgroundColor: style.bg || "#fff", border: "1px solid #e2e8f0", borderRadius: "8px" }}
            itemStyle={{ fontSize: `${graphTextPx}px`, fontWeight: "bold", color: style.color || "#1e293b" }}
          />
          {showLegend ? <Legend wrapperStyle={{ fontSize: `${graphTextPx}px` }} /> : null}
          <Pie
            data={data}
            dataKey={yKey}
            nameKey={xKey}
            outerRadius={pieRadius}
            label={{ fontSize: graphTextPx, fill: tickFill }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`slice-${index}`}
                fill={palette[index % palette.length] || "#3b82f6"}
              />
            ))}
          </Pie>
        </PieChart>,
      );
    }

    if (type === "table" || type === "hybrid") {
      return (
        <DashboardTableView
          data={data}
          style={style}
          nested={nested}
          isPhoneMode={isPhoneMode}
          title={displayTitle || widget.title || widget.description || ""}
          titlePosition={style.titlePosition === "bottom" ? "bottom" : "top"}
          titleAlign={style.contentAlign === "right" ? "right" : "left"}
          titleFontPx={resolveTitleFontPx(style, nested ? 10 : 11)}
          tableSearchEnabled={widget.tableSearchEnabled === true}
          tableSearchPlaceholder={widget.tableSearchPlaceholder || ""}
          tableSearchPosition={widget.tableSearchPosition || "right"}
          tableSearchWidth={widget.tableSearchWidth}
          tableColumnSortEnabled={widget.tableColumnSortEnabled === true}
          tableExportEnabled={widget.tableExportEnabled === true}
        />
      );
    }

    if (type === "kpi" || widget.rawType === "kpi" || widget.rawType === "count" || widget.rawType === "sum") {
      const val = data[0] ? Object.values(data[0])[0] : null;
      const label = title || widget.description || "";
      const isTop = (style.kpiLabelPosition || "bottom") === "top";
      const displayVal = val != null && val !== "" ? formatDisplayValue(val) : "—";
      const valueFontPx = resolveKpiValueFontPx(style, displayVal, !useBuilderVisuals, nested);
      const labelFontPx = resolveKpiLabelFontPx(style);
      const contentGapPx = resolveContentGapPx(style, nested ? 2 : 4);
      const fontWeight = style.fontWeight && style.fontWeight !== "inherit" ? style.fontWeight : undefined;
      const labelStyle = {
        fontSize: `${labelFontPx}px`,
        lineHeight: 1.05,
        color: style.color || "#64748b",
        ...(fontWeight ? { fontWeight } : {}),
        marginBottom: isTop ? undefined : undefined,
      };
      // Nested KPI: fit cell; horizontal align follows contentAlign (do not hardcode items-center).
      const kpiShellClass = nested
        ? `flex flex-col justify-center h-full w-full min-h-0 min-w-0 overflow-visible ${alignClass}`
        : `flex flex-col justify-center h-full w-full min-h-0 min-w-0 overflow-visible ${alignClass}`;
      const kpiTextAlign =
        style.contentAlign === "left" ? "text-left" : style.contentAlign === "right" ? "text-right" : "text-center";
      return (
        <div className={kpiShellClass} style={{ gap: `${contentGapPx}px` }}>
          {label && isTop && (
            <div
              className={`font-semibold px-0.5 leading-tight shrink-0 whitespace-normal break-words ${kpiTextAlign}${nested || readOnly ? "" : " truncate"}`}
              style={labelStyle}
            >
              {label}
            </div>
          )}
          <div
            className={`nested-kpi-value font-black tracking-tight leading-none max-w-full px-0.5 shrink-0 ${kpiTextAlign}`}
            style={{
              color: style.color || "#3b82f6",
              fontSize: `${valueFontPx}px`,
              lineHeight: 1,
              overflow: "visible",
              ...(fontWeight ? { fontWeight } : {}),
            }}
            title={String(displayVal)}
          >
            {displayVal}
          </div>
          {label && !isTop && (
            <div
              className={`font-semibold px-0.5 leading-tight shrink-0 whitespace-normal break-words ${kpiTextAlign}${nested || readOnly ? "" : " truncate"}`}
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

  const titleAlignClass =
    style.contentAlign === "left"
      ? "text-left justify-start"
      : style.contentAlign === "right"
        ? "text-right justify-end"
        : "text-center justify-center";
  const titlePosition = style.titlePosition === "bottom" ? "bottom" : "top";

  if (suppressChrome) {
    if (isContainer) {
      return renderContent();
    }
    if (!isHeading) {
      const isKpiChrome = type === "kpi" || widget.rawType === "kpi" || widget.rawType === "count" || widget.rawType === "sum";
      const isTableChrome = type === "table" || type === "hybrid";
      const showTitle = Boolean(displayTitle) && !isKpiChrome && !isTableChrome;
      const titleFontPx = resolveTitleFontPx(style);
      const contentGapPx = resolveContentGapPx(style, 4);
      const fontWeight = style.fontWeight && style.fontWeight !== "inherit" ? style.fontWeight : undefined;
      const titleEl = showTitle ? (
        <div
          className={`shrink-0 px-2 pt-1.5 pb-0.5 text-[11px] font-bold uppercase tracking-widest truncate flex ${titleAlignClass}`}
          style={{
            color: style.color || "#334155",
            fontSize: `${titleFontPx}px`,
            ...(fontWeight ? { fontWeight } : {}),
          }}
          title={displayTitle}
        >
          <span className="truncate w-full">{displayTitle}</span>
        </div>
      ) : null;
      return (
        <div
          className={`h-full w-full min-h-0 flex flex-col overflow-hidden${nested && !readOnly ? " pointer-events-none" : ""}`}
          style={showTitle ? { gap: `${contentGapPx}px` } : undefined}
        >
          {titlePosition === "top" ? titleEl : null}
          <div className="min-h-0 flex-1 overflow-hidden">
            {renderContent()}
          </div>
          {titlePosition === "bottom" ? titleEl : null}
        </div>
      );
    }
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
    // Keep user padding for nested widgets when explicitly set; otherwise stay flush in container.
    const hasExplicitPad = ["padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]
      .some((key) => Number.isFinite(Number(style?.[key])));
    if (!hasExplicitPad) {
      outerStyle.padding = "0px";
    }
    outerStyle.overflow = "visible";
    if (!readOnly) {
      outerStyle.backgroundColor = "transparent";
      outerStyle.boxShadow = "none";
      outerStyle.border = "none";
    }
  }
  const isKpi = type === "kpi" || widget.rawType === "kpi" || widget.rawType === "count" || widget.rawType === "sum";
  const isTableLike = type === "table" || type === "hybrid";
  const showHeader = displayTitle && !isKpi && !isHeading && !isContainer && !isTableLike;

  if (nested && pureSavedStyle) {
    const innerCss = savedStyleToCss(style);
    const showTitle = Boolean(displayTitle) && !isKpi && type !== "table" && type !== "hybrid";
    const titleFontPx = resolveTitleFontPx(style, 10);
    const contentGapPx = resolveContentGapPx(style, 4);
    const titleEl = showTitle ? (
      <div
        className={`shrink-0 px-1 pb-0.5 text-[10px] font-bold uppercase tracking-widest truncate flex ${titleAlignClass}`}
        style={{ color: style.color || "#334155", fontSize: `${titleFontPx}px` }}
        title={displayTitle}
      >
        <span className="truncate w-full">{displayTitle}</span>
      </div>
    ) : null;
    return (
      <div
        className="h-full w-full min-h-0 flex flex-col overflow-hidden"
        style={{
          ...innerCss,
          backgroundColor: "transparent",
          border: "none",
          boxShadow: "none",
          margin: 0,
          padding: innerCss.padding ?? 0,
          ...(showTitle ? { gap: `${contentGapPx}px` } : {}),
        }}
      >
        {titlePosition === "top" ? titleEl : null}
        <div className={`flex-1 min-h-0 w-full overflow-hidden flex ${contentFlexAlignClass}`}>
          {renderContent()}
        </div>
        {titlePosition === "bottom" ? titleEl : null}
      </div>
    );
  }

  if (nested) {
    const nestedTitleFontPx = resolveTitleFontPx(style, 10);
    const nestedTitleStyle = {
      fontSize: `${nestedTitleFontPx}px`,
      color: style.color || "#64748b",
      ...(style.fontWeight && style.fontWeight !== "inherit" ? { fontWeight: style.fontWeight } : {}),
    };
    return (
      <div
        className={`h-full w-full min-h-[64px] flex flex-col overflow-visible${
          flatLivePhone || !readOnly ? "" : " border border-slate-200/80 shadow-sm"
        }`}
        style={outerStyle}
      >
        {showHeader && titlePosition === "top" && (
          <div
            className={`shrink-0 border-b border-slate-100/80 font-bold flex items-center ${titleAlignClass}`}
            style={nestedTitleStyle}
          >
            <span className="truncate w-full">{displayTitle}</span>
          </div>
        )}
        <div className={`flex-1 min-h-[48px] w-full overflow-visible flex ${contentFlexAlignClass}`}>
          {renderContent()}
        </div>
        {showHeader && titlePosition === "bottom" && (
          <div
            className={`shrink-0 border-t border-slate-100/80 font-bold flex items-center ${titleAlignClass}`}
            style={nestedTitleStyle}
          >
            <span className="truncate w-full">{displayTitle}</span>
          </div>
        )}
      </div>
    );
  }

  const chromeTitleFontPx = resolveTitleFontPx(style, 10);
  const chromeTitleStyle = {
    fontSize: `${chromeTitleFontPx}px`,
    color: style.color || "#64748b",
    backgroundColor: style.bg ? `${style.bg}cc` : "rgba(248,250,252,0.8)",
    ...(style.fontWeight && style.fontWeight !== "inherit" ? { fontWeight: style.fontWeight } : {}),
  };

  return (
    <div
      className={`h-full w-full min-w-0 max-w-full flex flex-col transition-all ${
        isContainer && readOnly ? "overflow-x-hidden overflow-y-visible" : "overflow-hidden"
      } ${
        isHeading ? "border-0 shadow-none" : "border border-slate-200/80 shadow-sm hover:shadow-md"
      }`}
      style={outerStyle}
    >
      {showHeader && titlePosition === "top" && (
        <div
          className={`shrink-0 border-b border-slate-100/80 font-bold flex items-center ${titleAlignClass}`}
          style={chromeTitleStyle}
        >
          <span className="truncate w-full">{displayTitle}</span>
        </div>
      )}
      <div className={`flex-1 min-h-0 min-w-0 max-w-full ${isContainer ? "overflow-x-hidden overflow-y-visible" : "overflow-hidden"}`}>{renderContent()}</div>
      {showHeader && titlePosition === "bottom" && (
        <div
          className={`shrink-0 border-t border-slate-100/80 font-bold flex items-center ${titleAlignClass}`}
          style={chromeTitleStyle}
        >
          <span className="truncate w-full">{displayTitle}</span>
        </div>
      )}
    </div>
  );
};

export default WidgetRenderer;