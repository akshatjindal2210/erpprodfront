"use client";

import { useCallback } from "react";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";

const NAMED_COLOR_BG = {
  red: "#fecaca",
  green: "#bbf7d0",
  blue: "#bfdbfe",
  yellow: "#fef08a",
  orange: "#fed7aa",
  purple: "#e9d5ff",
  pink: "#fbcfe8",
  brown: "#d6bfa8",
  black: "#d1d5db",
  white: "#ffffff",
  grey: "#e5e7eb",
  gray: "#e5e7eb",
  golden: "#fcd34d",
  gold: "#fcd34d",
  silver: "#d1d5db",
};

/** Map stored color label → CSS background for field / dropdown row. */
export function specColorBackground(color) {
  const raw = String(color || "").trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.startsWith("#") || lower.startsWith("rgb")) return raw;
  return NAMED_COLOR_BG[lower] || raw;
}

export function specColorInputStyle(color) {
  const bg = specColorBackground(color);
  if (!bg) return undefined;
  return {
    backgroundColor: bg,
    borderColor: "rgba(15, 23, 42, 0.18)",
  };
}

export function specColorMenuStyle(color) {
  const bg = specColorBackground(color);
  if (!bg) return { backgroundColor: "#ffffff" };
  return { backgroundColor: bg };
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
