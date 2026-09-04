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

/** Flat (2D) vs depth-styled (3D) cartesian charts — still Recharts, no new engine. */
export const GRAPH_VIEW_MODE_OPTIONS = [
  { value: "2d", label: "2D" },
  { value: "3d", label: "3D" },
];

/** Bar comparison layout when multiple series are enabled. */
export const GRAPH_BAR_LAYOUT_OPTIONS = [
  { value: "grouped", label: "Grouped" },
  { value: "stacked", label: "Stacked" },
];

/** Cap multi-series comparison (SQL wide columns). */
export const GRAPH_MAX_SERIES = 8;

/** Defaults preserve pre-advanced chart look when unset / never configured. */
export const DEFAULT_GRAPH_ADVANCED_STYLE = {
  graphComparisonMode: "single",
  graphYKey2: undefined,
  /** Extra Y columns beyond A/B — used when Compare is on (2–8 series). */
  graphYKeys: undefined,
  graphViewMode: "2d",
  graphBarLayout: "grouped",
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
  /** Empty / unset = auto from data (integer-friendly). */
  graphYAxisMin: "",
  graphYAxisMax: "",
  /** Y tick gap/step e.g. 1, 2, 0.5. Empty = auto. */
  graphYTickStep: "",
  /** Optional tick count hint (3–12) when Gap is auto. Empty = auto. */
  graphYTickCount: "",
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
const VIEW_MODE_SET = new Set(GRAPH_VIEW_MODE_OPTIONS.map((o) => o.value));
const BAR_LAYOUT_SET = new Set(GRAPH_BAR_LAYOUT_OPTIONS.map((o) => o.value));

export function normalizeGraphComparisonMode(raw) {
  const v = String(raw || "single").trim().toLowerCase();
  return COMPARE_SET.has(v) ? v : "single";
}

export function normalizeGraphViewMode(raw) {
  const v = String(raw || "2d").trim().toLowerCase();
  return VIEW_MODE_SET.has(v) ? v : "2d";
}

export function normalizeGraphBarLayout(raw) {
  const v = String(raw || "grouped").trim().toLowerCase();
  return BAR_LAYOUT_SET.has(v) ? v : "grouped";
}

export function normalizeGraphYKeys(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  raw.forEach((item) => {
    const key = String(item || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out.slice(0, GRAPH_MAX_SERIES);
}

/**
 * Resolve Y-series keys for rendering.
 * - Single mode → [primaryY]
 * - Compare mode → graphYKeys (preferred) or legacy graphYKey + graphYKey2, auto-fill from columns
 */
export function resolveGraphYKeys({
  style = {},
  columnKeys = [],
  xKey = "",
  yKey = "",
  comparisonOn = false,
} = {}) {
  const keys = Array.isArray(columnKeys) ? columnKeys.map(String) : [];
  const primary = String(yKey || "").trim();
  if (!comparisonOn) {
    return primary ? [primary] : [];
  }

  const fromStyle = normalizeGraphYKeys(style.graphYKeys);
  let series = [];

  if (fromStyle.length) {
    // Explicit Compare list order wins (first = left/front series).
    series = fromStyle.filter((k) => keys.includes(k) && k !== xKey);
  } else {
    if (primary && keys.includes(primary)) series.push(primary);
    const y2 = String(style.graphYKey2 || "").trim();
    if (y2 && keys.includes(y2) && y2 !== primary && y2 !== xKey) series.push(y2);
    if (series.length < 2) {
      keys.forEach((k) => {
        if (series.length >= GRAPH_MAX_SERIES) return;
        if (!k || k === xKey || series.includes(k)) return;
        series.push(k);
      });
    }
    // Legacy path only: keep Style-tab Y as first series.
    if (primary && series.includes(primary)) {
      series = [primary, ...series.filter((k) => k !== primary)];
    } else if (primary && keys.includes(primary) && !series.length) {
      series = [primary];
    }
  }

  return series.slice(0, GRAPH_MAX_SERIES);
}

/** Keep graphYKey / graphYKey2 in sync when editing graphYKeys (backward compatible saves). */
export function syncLegacyYKeysFromList(yKeys = []) {
  const list = normalizeGraphYKeys(yKeys);
  return {
    graphYKeys: list.length ? list : undefined,
    graphYKey: list[0] || undefined,
    graphYKey2: list[1] || undefined,
  };
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

/** Parse optional Y-axis bound from style ("" / null = unset). */
export function parseGraphYAxisBound(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function niceCeil(max) {
  if (!(max > 0)) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  const f = max / base;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * base;
}

function cleanTick(n) {
  if (!Number.isFinite(n)) return n;
  if (Math.abs(n) < 1e-12) return 0;
  const rounded = Number(n.toPrecision(12));
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return Math.round(rounded);
  return rounded;
}

/** Build Y ticks from an explicit gap/step (1, 2, 0.5, …). */
export function buildTicksByStep(min, max, step) {
  const s = Number(step);
  if (!(s > 0) || !Number.isFinite(s)) return null;
  if (!(Number.isFinite(min) && Number.isFinite(max))) return null;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const start = cleanTick(Math.floor(lo / s + 1e-12) * s);
  const ticks = [];
  for (let i = 0; i < 64; i += 1) {
    const v = cleanTick(start + i * s);
    if (v > hi + s * 1e-9) break;
    if (v >= lo - s * 1e-9) ticks.push(v);
  }
  if (!ticks.length) return [cleanTick(lo), cleanTick(hi)].filter((v, idx, arr) => arr.indexOf(v) === idx);
  const last = ticks[ticks.length - 1];
  if (hi - last > s * 1e-6) ticks.push(cleanTick(hi));
  return ticks;
}

function buildIntegerTicks(min, max, preferredCount = 5) {
  const lo = Math.floor(min);
  const hi = Math.ceil(max);
  if (hi <= lo) return [lo];
  const span = hi - lo;
  const target = Math.max(2, Math.min(12, Math.round(Number(preferredCount) || 5)));
  let step = Math.max(1, Math.ceil(span / (target - 1)));
  // Snap step to 1,2,5 × 10^n
  const exp = Math.floor(Math.log10(step));
  const base = 10 ** Math.max(0, exp);
  const f = step / base;
  step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * base;
  return buildTicksByStep(lo, hi, step) || [lo, hi];
}

/**
 * Coerce series columns to finite numbers so Recharts domains/bars stay correct
 * (PG/MySQL often return numeric strings).
 */
export function coerceGraphChartData(rows = [], seriesKeys = []) {
  const keys = Array.isArray(seriesKeys) ? seriesKeys.filter(Boolean) : [];
  if (!keys.length || !Array.isArray(rows)) return rows || [];
  return rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const next = { ...row };
    keys.forEach((key) => {
      const n = toNumber(row[key]);
      next[key] = n === null ? 0 : n;
    });
    return next;
  });
}

/**
 * Y-axis domain / ticks for bar, line, area.
 * Avoids fractional 0 / 0.25 / 0.5 / 0.75 when data is counts (integers).
 * Optional style.graphYAxisMin / graphYAxisMax override auto scale (e.g. 0 → 10).
 */
export function resolveGraphYAxisProps({
  data = [],
  seriesKeys = [],
  style = {},
  stacked = false,
} = {}) {
  const keys = Array.isArray(seriesKeys) ? seriesKeys.filter(Boolean) : [];
  const values = [];
  (Array.isArray(data) ? data : []).forEach((row) => {
    if (stacked && keys.length > 1) {
      let sum = 0;
      keys.forEach((k) => {
        const n = toNumber(row?.[k]);
        sum += n === null ? 0 : n;
      });
      values.push(sum);
    } else {
      keys.forEach((k) => {
        const n = toNumber(row?.[k]);
        if (n !== null) values.push(n);
      });
    }
  });

  const dataMin = values.length ? Math.min(...values) : 0;
  const dataMax = values.length ? Math.max(...values) : 0;
  const allIntegers = values.length > 0 && values.every((v) => Math.abs(v - Math.round(v)) < 1e-9);

  const manualMin = parseGraphYAxisBound(style.graphYAxisMin);
  const manualMax = parseGraphYAxisBound(style.graphYAxisMax);
  const tickHint = parseGraphYAxisBound(style.graphYTickCount);
  const tickStep = parseGraphYAxisBound(style.graphYTickStep);

  let yMin = manualMin != null ? manualMin : (dataMin >= 0 ? 0 : dataMin);
  let yMax = manualMax != null ? manualMax : dataMax;

  if (manualMax == null) {
    if (allIntegers) {
      yMax = Math.max(niceCeil(Math.max(dataMax, 0)), dataMax > 0 ? Math.ceil(dataMax) : 1);
      // Tiny counts (0–1) looked like 0,0.25,… — bump headroom for readable integer ticks
      if (yMax <= 1) yMax = 1;
    } else if (!(yMax > yMin)) {
      yMax = yMin + 1;
    } else {
      yMax = niceCeil(yMax);
    }
  }

  if (!(yMax > yMin)) {
    yMax = yMin + 1;
  }

  // Explicit Gap (1 / 2 / 0.5…) wins — full control over Y spacing
  if (tickStep != null && tickStep > 0) {
    if (manualMax == null && tickStep * 2 > (yMax - yMin)) {
      yMax = yMin + tickStep * Math.max(2, Math.ceil((Math.max(dataMax, 0) - yMin) / tickStep) || 2);
    }
    const ticks = buildTicksByStep(yMin, yMax, tickStep);
    const stepIsInt = Math.abs(tickStep - Math.round(tickStep)) < 1e-9;
    return {
      domain: [ticks?.[0] ?? yMin, ticks?.[ticks.length - 1] ?? yMax],
      ticks: ticks || [yMin, yMax],
      allowDecimals: !stepIsInt,
      width: 48,
    };
  }

  const preferIntegers = allIntegers
    || (
      manualMin != null && manualMax != null
      && Number.isInteger(manualMin) && Number.isInteger(manualMax)
    );

  const props = {
    domain: [yMin, yMax],
    allowDecimals: !preferIntegers,
    width: 48,
  };

  if (preferIntegers) {
    const ticks = buildIntegerTicks(yMin, yMax, tickHint != null ? tickHint : 5);
    props.ticks = ticks;
    props.allowDecimals = false;
    props.domain = [ticks[0] ?? yMin, ticks[ticks.length - 1] ?? yMax];
  } else if (tickHint != null && tickHint >= 2) {
    props.tickCount = Math.min(12, Math.max(2, Math.round(tickHint)));
  }

  return props;
}

/** Axis tick text — raw scale, snap near-integers, no %/diff transform. */
export function formatGraphAxisTick(raw, style = {}) {
  let n = toNumber(raw);
  if (n === null) return String(raw ?? "");
  if (Math.abs(n - Math.round(n)) < 1e-9) n = Math.round(n);
  const axisStyle = {
    ...style,
    graphDisplayValue: "raw",
    // Prefer clean integers on axis when auto decimals
    graphDecimalPlaces: normalizeGraphDecimalPlaces(style.graphDecimalPlaces) === "auto" && Number.isInteger(n)
      ? "0"
      : style.graphDecimalPlaces,
  };
  return formatGraphValue(n, axisStyle);
}

/**
 * Chart margins. Manual override when graphUseManualMargins; otherwise
 * auto margins reserve space for legend position so labels/legend are not clipped.
 */
export function resolveGraphChartMargins(style = {}, {
  showLegend = true,
  chartType = "bar",
  showDataLabels = false,
} = {}) {
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

  // Data labels sit above bars — keep them out of the legend / clip edge
  if (!isPie && showDataLabels) {
    margins.top = Math.max(margins.top, 28);
  }

  if (!showLegend) return margins;

  const position = normalizeGraphLegendPosition(style.graphLegendPosition);
  const edge = isPie ? 28 : 36;
  const side = isPie ? 56 : 72;

  if (position === "top") {
    margins.top = Math.max(margins.top, edge + (showDataLabels ? 8 : 0));
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
  const yKeysRaw = read("graph_y_keys", "graphYKeys");
  let graphYKeys = defaults.graphYKeys;
  if (Array.isArray(yKeysRaw)) {
    graphYKeys = normalizeGraphYKeys(yKeysRaw);
  } else if (yKeysRaw != null && String(yKeysRaw).trim()) {
    try {
      const parsed = typeof yKeysRaw === "string" ? JSON.parse(yKeysRaw) : yKeysRaw;
      graphYKeys = normalizeGraphYKeys(parsed);
    } catch {
      graphYKeys = defaults.graphYKeys;
    }
  }
  // Legacy A/B → seed graphYKeys when array missing
  if ((!graphYKeys || !graphYKeys.length) && yKey2) {
    const primary = String(read("graph_y_key", "graphYKey") || "").trim();
    graphYKeys = normalizeGraphYKeys([primary, yKey2].filter(Boolean));
  }

  return {
    graphComparisonMode: normalizeGraphComparisonMode(
      read("graph_comparison_mode", "graphComparisonMode") ?? defaults.graphComparisonMode,
    ),
    graphYKey2: yKey2 != null && String(yKey2).trim() !== "" ? String(yKey2).trim() : defaults.graphYKey2,
    graphYKeys: graphYKeys && graphYKeys.length ? graphYKeys : defaults.graphYKeys,
    graphViewMode: normalizeGraphViewMode(
      read("graph_view_mode", "graphViewMode") ?? defaults.graphViewMode,
    ),
    graphBarLayout: normalizeGraphBarLayout(
      read("graph_bar_layout", "graphBarLayout") ?? defaults.graphBarLayout,
    ),
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
    graphYAxisMin: (() => {
      const v = read("graph_y_axis_min", "graphYAxisMin");
      if (v === null || v === undefined || v === "") return defaults.graphYAxisMin ?? "";
      return String(v);
    })(),
    graphYAxisMax: (() => {
      const v = read("graph_y_axis_max", "graphYAxisMax");
      if (v === null || v === undefined || v === "") return defaults.graphYAxisMax ?? "";
      return String(v);
    })(),
    graphYTickStep: (() => {
      const v = read("graph_y_tick_step", "graphYTickStep");
      if (v === null || v === undefined || v === "") return defaults.graphYTickStep ?? "";
      return String(v);
    })(),
    graphYTickCount: (() => {
      const v = read("graph_y_tick_count", "graphYTickCount");
      if (v === null || v === undefined || v === "") return defaults.graphYTickCount ?? "";
      return String(v);
    })(),
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
  const yKeys = normalizeGraphYKeys(s.graphYKeys);
  const legacy = syncLegacyYKeysFromList(
    yKeys.length
      ? yKeys
      : [s.graphYKey, s.graphYKey2].filter(Boolean),
  );
  return {
    graph_comparison_mode: normalizeGraphComparisonMode(s.graphComparisonMode),
    graph_y_key_2: legacy.graphYKey2 || s.graphYKey2 || undefined,
    graph_y_keys: legacy.graphYKeys || undefined,
    graph_view_mode: normalizeGraphViewMode(s.graphViewMode),
    graph_bar_layout: normalizeGraphBarLayout(s.graphBarLayout),
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
    graph_y_axis_min: s.graphYAxisMin !== undefined && s.graphYAxisMin !== null && String(s.graphYAxisMin).trim() !== ""
      ? String(s.graphYAxisMin).trim()
      : undefined,
    graph_y_axis_max: s.graphYAxisMax !== undefined && s.graphYAxisMax !== null && String(s.graphYAxisMax).trim() !== ""
      ? String(s.graphYAxisMax).trim()
      : undefined,
    graph_y_tick_step: s.graphYTickStep !== undefined && s.graphYTickStep !== null && String(s.graphYTickStep).trim() !== ""
      ? String(s.graphYTickStep).trim()
      : undefined,
    graph_y_tick_count: s.graphYTickCount !== undefined && s.graphYTickCount !== null && String(s.graphYTickCount).trim() !== ""
      ? String(s.graphYTickCount).trim()
      : undefined,
    graph_use_manual_margins: s.graphUseManualMargins === true,
    graph_margin_top: Number.isFinite(Number(s.graphMarginTop)) ? Math.round(Number(s.graphMarginTop)) : undefined,
    graph_margin_right: Number.isFinite(Number(s.graphMarginRight)) ? Math.round(Number(s.graphMarginRight)) : undefined,
    graph_margin_bottom: Number.isFinite(Number(s.graphMarginBottom)) ? Math.round(Number(s.graphMarginBottom)) : undefined,
    graph_margin_left: Number.isFinite(Number(s.graphMarginLeft)) ? Math.round(Number(s.graphMarginLeft)) : undefined,
  };
}
