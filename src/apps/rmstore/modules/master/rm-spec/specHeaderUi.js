"use client";

import { useCallback } from "react";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";

/** Real CSS colors (not pastels) so black/gray/silver stay distinct. Keys are normalized names. */
const NAMED_COLOR_HEX = {
  aliceblue: "#f0f8ff",
  antiquewhite: "#faebd7",
  aqua: "#00ffff",
  aquamarine: "#7fffd4",
  azure: "#f0ffff",
  beige: "#f5f5dc",
  bisque: "#ffe4c4",
  black: "#000000",
  blanchedalmond: "#ffebcd",
  blue: "#0000ff",
  blueviolet: "#8a2be2",
  brass: "#b5a642",
  bronze: "#cd7f32",
  brown: "#a52a2a",
  burlywood: "#deb887",
  cadetblue: "#5f9ea0",
  charcoal: "#36454f",
  charcoalgray: "#36454f",
  chartreuse: "#7fff00",
  chocolate: "#d2691e",
  copper: "#b87333",
  coral: "#ff7f50",
  cornflowerblue: "#6495ed",
  cornsilk: "#fff8dc",
  cream: "#fffdd0",
  crimson: "#dc143c",
  cyan: "#00ffff",
  darkblue: "#00008b",
  darkcyan: "#008b8b",
  darkgoldenrod: "#b8860b",
  darkgray: "#a9a9a9",
  darkgreen: "#006400",
  darkkhaki: "#bdb76b",
  darkmagenta: "#8b008b",
  darkolivegreen: "#556b2f",
  darkorange: "#ff8c00",
  darkorchid: "#9932cc",
  darkred: "#8b0000",
  darksalmon: "#e9967a",
  darkseagreen: "#8fbc8f",
  darkslateblue: "#483d8b",
  darkslategray: "#2f4f4f",
  darkturquoise: "#00ced1",
  darkviolet: "#9400d3",
  deeppink: "#ff1493",
  deepskyblue: "#00bfff",
  dimgray: "#696969",
  dodgerblue: "#1e90ff",
  firebrick: "#b22222",
  floralwhite: "#fffaf0",
  forestgreen: "#228b22",
  fuchsia: "#ff00ff",
  gainsboro: "#dcdcdc",
  ghostwhite: "#f8f8ff",
  gold: "#ffd700",
  golden: "#ffd700",
  goldenrod: "#daa520",
  gray: "#808080",
  green: "#008000",
  greenyellow: "#adff2f",
  honeydew: "#f0fff0",
  hotpink: "#ff69b4",
  indianred: "#cd5c5c",
  indigo: "#4b0082",
  ivory: "#fffff0",
  khaki: "#f0e68c",
  lavender: "#e6e6fa",
  lavenderblush: "#fff0f5",
  lawngreen: "#7cfc00",
  lemonchiffon: "#fffacd",
  lightblue: "#add8e6",
  lightcoral: "#f08080",
  lightcyan: "#e0ffff",
  lightgoldenrodyellow: "#fafad2",
  lightgray: "#d3d3d3",
  lightgreen: "#90ee90",
  lightpink: "#ffb6c1",
  lightsalmon: "#ffa07a",
  lightseagreen: "#20b2aa",
  lightskyblue: "#87cefa",
  lightslategray: "#778899",
  lightsteelblue: "#b0c4de",
  lightyellow: "#ffffe0",
  lime: "#00ff00",
  limegreen: "#32cd32",
  linen: "#faf0e6",
  magenta: "#ff00ff",
  maroon: "#800000",
  mediumaquamarine: "#66cdaa",
  mediumblue: "#0000cd",
  mediumorchid: "#ba55d3",
  mediumpurple: "#9370db",
  mediumseagreen: "#3cb371",
  mediumslateblue: "#7b68ee",
  mediumspringgreen: "#00fa9a",
  mediumturquoise: "#48d1cc",
  mediumvioletred: "#c71585",
  midnightblue: "#191970",
  mintcream: "#f5fffa",
  mistyrose: "#ffe4e1",
  moccasin: "#ffe4b5",
  navajowhite: "#ffdead",
  navy: "#000080",
  navyblue: "#000080",
  offwhite: "#f7f6f2",
  oldlace: "#fdf5e6",
  olive: "#808000",
  olivedrab: "#6b8e23",
  orange: "#ffa500",
  orangered: "#ff4500",
  orchid: "#da70d6",
  palegoldenrod: "#eee8aa",
  palegreen: "#98fb98",
  paleturquoise: "#afeeee",
  palevioletred: "#db7093",
  papayawhip: "#ffefd5",
  peachpuff: "#ffdab9",
  peru: "#cd853f",
  pink: "#ffc0cb",
  plum: "#dda0dd",
  powderblue: "#b0e0e6",
  purple: "#800080",
  rebeccapurple: "#663399",
  red: "#ff0000",
  rosybrown: "#bc8f8f",
  royalblue: "#4169e1",
  saddlebrown: "#8b4513",
  salmon: "#fa8072",
  sandybrown: "#f4a460",
  seagreen: "#2e8b57",
  seashell: "#fff5ee",
  sienna: "#a0522d",
  silver: "#c0c0c0",
  skyblue: "#87ceeb",
  slateblue: "#6a5acd",
  slategray: "#708090",
  snow: "#fffafa",
  springgreen: "#00ff7f",
  steelblue: "#4682b4",
  tan: "#d2b48c",
  teal: "#008080",
  thistle: "#d8bfd8",
  tomato: "#ff6347",
  turquoise: "#40e0d0",
  violet: "#ee82ee",
  wheat: "#f5deb3",
  white: "#ffffff",
  whitesmoke: "#f5f5f5",
  yellow: "#ffff00",
  yellowgreen: "#9acd32",
};

function normalizeColorKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "")
    .replace(/grey/g, "gray");
}

function parseRgb(color) {
  const hex = String(color || "").trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    const h = short[1];
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  const full = /^#([0-9a-f]{6})$/i.exec(hex);
  if (full) {
    const h = full[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(hex);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function relativeLuminance(rgb) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** Pick the text color that is actually more readable on this fill. */
function contrastText(bg) {
  const rgb = parseRgb(bg);
  if (!rgb) return "#0f172a";
  const L = relativeLuminance(rgb);
  const whiteContrast = 1.05 / (L + 0.05);
  const darkContrast = (L + 0.05) / 0.06;
  return whiteContrast >= darkContrast ? "#ffffff" : "#0f172a";
}

const GENERIC_COLOR_WORDS = new Set([
  "black", "white", "gray", "red", "blue", "green", "yellow", "orange", "pink", "purple", "brown",
]);

const COLOR_QUALIFIERS = new Set(["dark", "light", "deep", "pale", "medium", "bright", "off"]);

/**
 * "NAVY BLUE" → navy. A phrase is a color only when every word is a known color
 * or qualifier, so grades like "MIX BLUE" stay uncolored.
 */
function resolveNamedHex(raw) {
  const key = normalizeColorKey(raw);
  if (NAMED_COLOR_HEX[key]) return NAMED_COLOR_HEX[key];

  const words = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/grey/g, "gray")
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (!words.length || words.some((word) => !NAMED_COLOR_HEX[word] && !COLOR_QUALIFIERS.has(word))) {
    return undefined;
  }

  let generic = null;
  for (const word of words) {
    const hex = NAMED_COLOR_HEX[word];
    if (!hex) continue;
    if (!GENERIC_COLOR_WORDS.has(word)) return hex;
    generic = generic || hex;
  }
  return generic;
}

/** Map stored color label → actual CSS background. Unknown labels stay uncolored. */
export function specColorBackground(color) {
  const raw = String(color || "").trim();
  if (!raw) return undefined;
  if (raw.startsWith("#") || /^rgb/i.test(raw)) return raw;
  return resolveNamedHex(raw);
}

export function specColorInputStyle(color) {
  const bg = specColorBackground(color);
  if (!bg) return undefined;
  const fg = contrastText(bg);
  return {
    backgroundColor: bg,
    color: fg,
    borderColor: fg === "#ffffff" ? "rgba(255,255,255,0.45)" : "rgba(15, 23, 42, 0.22)",
  };
}

export function specColorMenuStyle(color) {
  const style = specColorInputStyle(color);
  if (!style) return { backgroundColor: "#ffffff", color: "#0f172a" };
  return style;
}

/** Compact list/card chip — value in caps, optional mapped color fill. */
export function SpecColorChip({ value, color }) {
  const text = String(value || "").trim();
  if (!text) return <span className="text-[11px] text-slate-400">—</span>;
  const style = specColorInputStyle(color ?? text);
  return (
    <span
      className="inline-flex max-w-full items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wide border truncate"
      style={style}
      title={text}
    >
      {text}
    </span>
  );
}

function upperValue(v) {
  return String(v ?? "").toUpperCase();
}

function mapHeaderRowsForSelect(rows, { withColor = false } = {}) {
  return (rows || [])
    .map((r) => {
      const value = String(r?.value ?? r?.id ?? "").trim();
      if (!value) return null;
      const color = withColor && r?.color ? String(r.color).trim() : null;
      return { id: value, name: value, color };
    })
    .filter(Boolean);
}

function headerOptionColor(item, { withColor = false, useValueAsColor = false } = {}) {
  if (withColor && item?.color) return String(item.color).trim();
  if (useValueAsColor && item?.name) return String(item.name).trim();
  return null;
}

/** Shared SearchableSelect for spec headers — select-only or type+select (`allowFreeText`). */
export function SpecHeaderSearchableSelect({
  label,
  required,
  value,
  onChange,
  onPick,
  error,
  readOnly,
  active,
  dataField,
  fetchSuggestions,
  withColor = false,
  useValueAsColor = false,
  selectedColor,
  allowFreeText = false,
  placeholder = "Search...",
  onClearError,
  uppercase = true,
}) {
  const toStored = useCallback(
    (v) => (uppercase ? upperValue(v) : String(v ?? "")),
    [uppercase]
  );

  const fetchService = useCallback(
    async ({ search = "", page = 1, limit = 50 } = {}) => {
      if (!active) return { data: [], total: 0 };
      const rows = await fetchSuggestions(search);
      const mapped = mapHeaderRowsForSelect(rows, { withColor });
      const safePage = Math.max(1, Number(page) || 1);
      const safeLimit = Math.max(1, Number(limit) || 50);
      const start = (safePage - 1) * safeLimit;
      return {
        data: mapped.slice(start, start + safeLimit),
        total: mapped.length,
      };
    },
    [active, fetchSuggestions, withColor]
  );

  const getByIdService = useCallback(
    async (id) => {
      if (!id || !active) return null;
      const sid = toStored(id);
      if (allowFreeText) {
        return sid ? { id: sid, name: sid } : null;
      }
      const rows = await fetchSuggestions("");
      const hit = mapHeaderRowsForSelect(rows, { withColor }).find((r) => r.id === sid);
      return hit || { id: sid, name: sid };
    },
    [active, allowFreeText, fetchSuggestions, toStored, withColor]
  );

  const getOptionStyle = useCallback(
    (item) => specColorMenuStyle(headerOptionColor(item, { withColor, useValueAsColor })),
    [useValueAsColor, withColor]
  );

  const storedValue = value ? toStored(value) : "";
  const triggerStyle = specColorInputStyle(selectedColor ?? (useValueAsColor ? storedValue : null));

  return (
    <div data-field={dataField}>
      <SearchableSelect
        label={label}
        required={required}
        value={allowFreeText ? storedValue : storedValue || null}
        allowFreeText={allowFreeText}
        onChange={(id, item) => {
          const next = allowFreeText ? toStored(id ?? "") : id ? toStored(id) : "";
          onChange(next);
          if (item && onPick) {
            onPick({
              value: next,
              color: withColor ? item.color ?? null : useValueAsColor ? next : null,
            });
          }
          onClearError?.();
        }}
        fetchService={fetchService}
        getByIdService={getByIdService}
        dataKey="id"
        labelKey="name"
        error={error}
        disabled={readOnly || !active}
        placeholder={placeholder}
        preserveApiOrder
        heightClass="h-10"
        triggerStyle={triggerStyle}
        getOptionStyle={withColor || useValueAsColor ? getOptionStyle : undefined}
        uppercase={uppercase}
      />
    </div>
  );
}

/** Condition / grade — colored when mapped; typeable only with special permission. */
export function SpecColoredHeaderField({
  label,
  required,
  value,
  onChange,
  colorValue,
  onColorChange,
  error,
  readOnly,
  active,
  dataField,
  fetchSuggestions,
  canType,
  withColor = false,
  placeholder,
  onClearError,
  uppercase = true,
}) {
  const toStored = (v) => (uppercase ? upperValue(v) : String(v ?? ""));

  const handlePick = useCallback(
    (opt) => {
      if (withColor && opt?.color && onColorChange) {
        onColorChange(toStored(opt.color));
      }
    },
    [onColorChange, toStored, withColor]
  );

  return (
    <SpecHeaderSearchableSelect
      label={label}
      required={required}
      value={value}
      onChange={(v) => onChange(toStored(v))}
      onPick={handlePick}
      error={error}
      readOnly={readOnly}
      active={active}
      dataField={dataField}
      fetchSuggestions={fetchSuggestions}
      withColor={withColor}
      selectedColor={withColor ? colorValue : undefined}
      allowFreeText={Boolean(canType)}
      placeholder={canType ? placeholder || "Type or pick..." : placeholder || "Search..."}
      onClearError={onClearError}
      uppercase={uppercase}
    />
  );
}

/**
 * Size — every user (no special permission): SearchableSelect UI + type, suggest, select.
 */
export function SpecSizeField({
  value,
  onChange,
  error,
  readOnly,
  active,
  fetchSuggestions,
  onClearError,
}) {
  const stored = value ? upperValue(value) : "";

  const fetchService = useCallback(
    async ({ search = "" } = {}) => {
      if (!active) return { data: [], total: 0 };
      const rows = await fetchSuggestions(search);
      const data = mapHeaderRowsForSelect(rows);
      return { data, total: data.length };
    },
    [active, fetchSuggestions]
  );

  const getByIdService = useCallback(
    async (id) => {
      const sid = upperValue(id);
      return sid ? { id: sid, name: sid } : null;
    },
    []
  );

  return (
    <div data-field="size">
      <SearchableSelect
        label="Size"
        required
        value={stored}
        allowFreeText
        onChange={(id) => {
          onChange(id ? upperValue(id) : "");
          onClearError?.();
        }}
        fetchService={fetchService}
        getByIdService={getByIdService}
        dataKey="id"
        labelKey="name"
        error={error}
        disabled={readOnly || !active}
        placeholder="Type or pick size..."
        preserveApiOrder
        heightClass="h-10"
        uppercase
      />
    </div>
  );
}

/** Color fields — typeable only with special permission. */
export function SpecPlainHeaderField({
  label,
  required,
  value,
  onChange,
  error,
  readOnly,
  active,
  dataField,
  fetchSuggestions,
  canType,
  colorField = false,
  placeholder,
  onClearError,
  uppercase = true,
}) {
  const toStored = (v) => (uppercase ? upperValue(v) : String(v ?? ""));

  return (
    <SpecHeaderSearchableSelect
      label={label}
      required={required}
      value={value}
      onChange={(v) => onChange(toStored(v))}
      error={error}
      readOnly={readOnly}
      active={active}
      dataField={dataField}
      fetchSuggestions={fetchSuggestions}
      useValueAsColor={colorField}
      selectedColor={colorField ? value : undefined}
      allowFreeText={Boolean(canType)}
      placeholder={canType ? placeholder || "Type or pick..." : placeholder || "Search..."}
      onClearError={onClearError}
      uppercase={uppercase}
    />
  );
}
