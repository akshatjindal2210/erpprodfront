/**
 * Advanced GRAPH widget settings — defaults, value formatting, chart margins.
 * Isolated so chart options can grow without touching KPI/TABLE/HEAD/BOX widgets.
 */

export const GRAPH_COMPARISON_MODE_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "comparison", label: "Compare" },
];

export const GRAPH_VALUE_FORMAT_OPTIONS = [
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent" },
  { value: "abbreviated", label: "Abbrev." },
  { value: "custom", label: "Custom" },
];

export const GRAPH_DISPLAY_VALUE_OPTIONS = [
  { value: "raw", label: "Raw" },
  { value: "percent_total", label: "% Total" },
  { value: "difference", label: "Diff" },
];

export const GRAPH_DECIMAL_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
];

/** Matches historical Recharts default (legend under the chart). */
export const GRAPH_LEGEND_POSITION_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

/** Defaults preserve pre-advanced chart look when unset / never configured. */
export const DEFAULT_GRAPH_ADVANCED_STYLE = {
  graphComparisonMode: "single",
  graphYKey2: undefined,
  graphValueFormat: "number",
  graphCurrencySymbol: "₹",
  graphDecimalPlaces: "auto",
  graphPrefix: "",
  graphSuffix: "",
  graphDisplayValue: "raw",
  /** null = auto: pie on, bar/line/area off (historical behavior) */
  graphShowDataLabels: null,
  /** bottom = historical Recharts Legend default */
  graphLegendPosition: "bottom",
  graphUseManualMargins: false,
  graphMarginTop: 10,
  graphMarginRight: 12,
  graphMarginBottom: 8,
  graphMarginLeft: 8,
};

const FORMAT_SET = new Set(GRAPH_VALUE_FORMAT_OPTIONS.map((o) => o.value));
const DISPLAY_SET = new Set(GRAPH_DISPLAY_VALUE_OPTIONS.map((o) => o.value));
const COMPARE_SET = new Set(GRAPH_COMPARISON_MODE_OPTIONS.map((o) => o.value));
const LEGEND_POS_SET = new Set(GRAPH_LEGEND_POSITION_OPTIONS.map((o) => o.value));

export function normalizeGraphComparisonMode(raw) {
  const v = String(raw || "single").trim().toLowerCase();
  return COMPARE_SET.has(v) ? v : "single";
}

export function normalizeGraphValueFormat(raw) {
  const v = String(raw || "number").trim().toLowerCase();
  return FORMAT_SET.has(v) ? v : "number";
}

export function normalizeGraphDisplayValue(raw) {
  const v = String(raw || "raw").trim().toLowerCase();
  return DISPLAY_SET.has(v) ? v : "raw";
}

export function normalizeGraphDecimalPlaces(raw) {
  if (raw === null || raw === undefined || raw === "" || raw === "auto") return "auto";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "auto";
  return String(Math.max(0, Math.min(2, Math.round(n))));
}

export function normalizeGraphLegendPosition(raw) {
  const v = String(raw || "bottom").trim().toLowerCase();
  return LEGEND_POS_SET.has(v) ? v : "bottom";
}

export function isGraphComparisonEnabled(style = {}) {
  return normalizeGraphComparisonMode(style.graphComparisonMode) === "comparison";
}

/**
 * Shared Recharts Legend props for every chart type (bar/line/area/pie).
 * Returns null when legend is hidden.
 */
export function resolveGraphLegendProps(style = {}, { showLegend = true, fontSize = 10 } = {}) {
  if (!showLegend) return null;

  const position = normalizeGraphLegendPosition(style.graphLegendPosition);
  const baseWrapper = {
    fontSize: `${Math.max(8, Math.min(18, Number(fontSize) || 10))}px`,
    lineHeight: 1.2,
  };

  if (position === "top") {
    return {
      verticalAlign: "top",
      align: "center",
      layout: "horizontal",
      wrapperStyle: { ...baseWrapper, width: "100%", paddingBottom: 2 },
    };
  }
  if (position === "left") {
    return {
      verticalAlign: "middle",
      align: "left",
      layout: "vertical",
      wrapperStyle: {
        ...baseWrapper,
        maxHeight: "90%",
        overflow: "auto",
        paddingRight: 4,
      },
    };
  }
  if (position === "right") {
    return {
      verticalAlign: "middle",
      align: "right",
      layout: "vertical",
      wrapperStyle: {
        ...baseWrapper,
        maxHeight: "90%",
        overflow: "auto",
        paddingLeft: 4,
      },
    };
  }

  // bottom (default / backward compatible)
  return {
    verticalAlign: "bottom",
    align: "center",
    layout: "horizontal",
    wrapperStyle: { ...baseWrapper, width: "100%", paddingTop: 2 },
  };
}

/**
 * Data labels: explicit true/false wins; otherwise pie=on, cartesian=off.
 */
export function resolveGraphShowDataLabels(style = {}, chartType = "bar") {
  if (style.graphShowDataLabels === true) return true;
  if (style.graphShowDataLabels === false) return false;
  return chartType === "pie";
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function applyDecimalPlaces(n, places) {
  const mode = normalizeGraphDecimalPlaces(places);
  if (mode === "auto") {
    return Number.isInteger(n) ? String(n) : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  const d = Number(mode);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function abbreviateNumber(n, places) {
  const abs = Math.abs(n);
  const mode = normalizeGraphDecimalPlaces(places);
  const digits = mode === "auto" ? 1 : Number(mode);
  const fmt = (v, suffix) => {
    const rounded = Number(v.toFixed(digits));
    return `${rounded}${suffix}`;
  };
  if (abs >= 1e9) return fmt(n / 1e9, "B");
  if (abs >= 1e6) return fmt(n / 1e6, "M");
  if (abs >= 1e3) return fmt(n / 1e3, "K");
  return applyDecimalPlaces(n, places);
}

/**
 * Format a numeric (or coercible) chart value using advanced graph style.
 * Non-numeric values fall back to String(value).
 */
export function formatGraphValue(value, style = {}) {
  if (value === null || value === undefined || value === "") return "-";
  const n = toNumber(value);
  if (n === null) return String(value);

  const format = normalizeGraphValueFormat(style.graphValueFormat);
  const places = style.graphDecimalPlaces;
  const prefix = String(style.graphPrefix || "");
  const suffix = String(style.graphSuffix || "");
  const currency = String(style.graphCurrencySymbol || "₹");

  let core;
  switch (format) {
    case "currency":
      core = `${currency}${applyDecimalPlaces(n, places)}`;
      break;
    case "percent":
      core = `${applyDecimalPlaces(n, places === "auto" ? 1 : places)}%`;
      break;
    case "abbreviated":
      core = abbreviateNumber(n, places);
      break;
    case "custom":
      core = `${prefix}${applyDecimalPlaces(n, places)}${suffix}`;
      break;
    case "number":
    default:
      core = applyDecimalPlaces(n, places);
      break;
  }

  if (format !== "custom" && (prefix || suffix)) {
    return `${prefix}${core}${suffix}`;
  }
  return core;
}

/**
 * Resolve the numeric value to show (raw / % of total / series difference).
 */
export function resolveGraphDisplayNumber({
  value,
  compareValue,
  total,
  style = {},
}) {
  const mode = normalizeGraphDisplayValue(style.graphDisplayValue);
  const n = toNumber(value);
  if (n === null) return null;

  if (mode === "percent_total") {
    const t = toNumber(total);
    if (t === null || t === 0) return null;
    return (n / t) * 100;
  }
  if (mode === "difference") {
    const c = toNumber(compareValue);
    if (c === null) return n;
    return n - c;
  }
  return n;
}

export function sumSeriesTotal(rows = [], dataKey) {
  if (!dataKey) return 0;
  return rows.reduce((acc, row) => {
    const n = toNumber(row?.[dataKey]);
    return acc + (n === null ? 0 : n);
  }, 0);
}

/**
 * Chart margins. Manual override when graphUseManualMargins; otherwise
 * auto margins reserve space for legend position so labels/legend are not clipped.
 */
export function resolveGraphChartMargins(style = {}, { showLegend = true, chartType = "bar" } = {}) {
  if (style.graphUseManualMargins === true) {
    return {
      top: Math.max(0, Number(style.graphMarginTop) || 0),
      right: Math.max(0, Number(style.graphMarginRight) || 0),
      bottom: Math.max(0, Number(style.graphMarginBottom) || 0),
      left: Math.max(0, Number(style.graphMarginLeft) || 0),
    };
  }

  const isPie = chartType === "pie";
  const margins = isPie
    ? { top: 8, right: 8, bottom: 8, left: 8 }
    : { top: 16, right: 16, bottom: 12, left: 8 };

  if (!showLegend) return margins;

  const position = normalizeGraphLegendPosition(style.graphLegendPosition);
  const edge = isPie ? 28 : 32;
  const side = isPie ? 56 : 72;

  if (position === "top") {
    margins.top = Math.max(margins.top, edge);
  } else if (position === "left") {
    margins.left = Math.max(margins.left, side);
  } else if (position === "right") {
    margins.right = Math.max(margins.right, side);
  } else {
    // bottom — historical default
    margins.bottom = Math.max(margins.bottom, edge);
  }

  return margins;
}

/** CamelCase style fields for defaultWidgetStyle / in-memory widgets. */
export function getDefaultGraphAdvancedStyle() {
  return { ...DEFAULT_GRAPH_ADVANCED_STYLE };
}

/** Merge advanced graph fields from chart_config (snake or camel). */
export function mergeGraphAdvancedFromConfig(cfg = {}, defaults = DEFAULT_GRAPH_ADVANCED_STYLE) {
  const read = (snake, camel) => cfg[snake] ?? cfg[camel];

  const showLabelsRaw = read("graph_show_data_labels", "graphShowDataLabels");
  let graphShowDataLabels = defaults.graphShowDataLabels;
  if (showLabelsRaw === true || showLabelsRaw === false) {
    graphShowDataLabels = showLabelsRaw;
  } else if (showLabelsRaw === "true") {
    graphShowDataLabels = true;
  } else if (showLabelsRaw === "false") {
    graphShowDataLabels = false;
  }

  const yKey2 = read("graph_y_key_2", "graphYKey2");

  return {
    graphComparisonMode: normalizeGraphComparisonMode(
      read("graph_comparison_mode", "graphComparisonMode") ?? defaults.graphComparisonMode,
    ),
    graphYKey2: yKey2 != null && String(yKey2).trim() !== "" ? String(yKey2).trim() : defaults.graphYKey2,
    graphValueFormat: normalizeGraphValueFormat(
      read("graph_value_format", "graphValueFormat") ?? defaults.graphValueFormat,
    ),
    graphCurrencySymbol: String(
      read("graph_currency_symbol", "graphCurrencySymbol") ?? defaults.graphCurrencySymbol ?? "₹",
    ),
    graphDecimalPlaces: normalizeGraphDecimalPlaces(
      read("graph_decimal_places", "graphDecimalPlaces") ?? defaults.graphDecimalPlaces,
    ),
    graphPrefix: String(read("graph_prefix", "graphPrefix") ?? defaults.graphPrefix ?? ""),
    graphSuffix: String(read("graph_suffix", "graphSuffix") ?? defaults.graphSuffix ?? ""),
    graphDisplayValue: normalizeGraphDisplayValue(
      read("graph_display_value", "graphDisplayValue") ?? defaults.graphDisplayValue,
    ),
    graphShowDataLabels,
    graphLegendPosition: normalizeGraphLegendPosition(
      read("graph_legend_position", "graphLegendPosition") ?? defaults.graphLegendPosition,
    ),
    graphUseManualMargins: read("graph_use_manual_margins", "graphUseManualMargins") === true,
    graphMarginTop: Number.isFinite(Number(read("graph_margin_top", "graphMarginTop")))
      ? Math.round(Number(read("graph_margin_top", "graphMarginTop")))
      : defaults.graphMarginTop,
    graphMarginRight: Number.isFinite(Number(read("graph_margin_right", "graphMarginRight")))
      ? Math.round(Number(read("graph_margin_right", "graphMarginRight")))
      : defaults.graphMarginRight,
    graphMarginBottom: Number.isFinite(Number(read("graph_margin_bottom", "graphMarginBottom")))
      ? Math.round(Number(read("graph_margin_bottom", "graphMarginBottom")))
      : defaults.graphMarginBottom,
    graphMarginLeft: Number.isFinite(Number(read("graph_margin_left", "graphMarginLeft")))
      ? Math.round(Number(read("graph_margin_left", "graphMarginLeft")))
      : defaults.graphMarginLeft,
  };
}

/** Snake_case chart_config payload for save draft / publish. */
export function graphAdvancedToChartConfig(style = {}) {
  const s = style || {};
  return {
    graph_comparison_mode: normalizeGraphComparisonMode(s.graphComparisonMode),
    graph_y_key_2: s.graphYKey2 || undefined,
    graph_value_format: normalizeGraphValueFormat(s.graphValueFormat),
    graph_currency_symbol: s.graphCurrencySymbol || "₹",
    graph_decimal_places: normalizeGraphDecimalPlaces(s.graphDecimalPlaces),
    graph_prefix: s.graphPrefix || "",
    graph_suffix: s.graphSuffix || "",
    graph_display_value: normalizeGraphDisplayValue(s.graphDisplayValue),
    graph_show_data_labels: s.graphShowDataLabels === true || s.graphShowDataLabels === false
      ? s.graphShowDataLabels
      : undefined,
    graph_legend_position: normalizeGraphLegendPosition(s.graphLegendPosition),
    graph_use_manual_margins: s.graphUseManualMargins === true,
    graph_margin_top: Number.isFinite(Number(s.graphMarginTop)) ? Math.round(Number(s.graphMarginTop)) : undefined,
    graph_margin_right: Number.isFinite(Number(s.graphMarginRight)) ? Math.round(Number(s.graphMarginRight)) : undefined,
    graph_margin_bottom: Number.isFinite(Number(s.graphMarginBottom)) ? Math.round(Number(s.graphMarginBottom)) : undefined,
    graph_margin_left: Number.isFinite(Number(s.graphMarginLeft)) ? Math.round(Number(s.graphMarginLeft)) : undefined,
  };
}
