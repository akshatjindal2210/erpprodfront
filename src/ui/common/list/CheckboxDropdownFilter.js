"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LIST_PAGE_FILTER_VALUE_CLASS, listPageFilterBoxClass, listPageFilterLabelClass } from "@/ui/common/list/ListPageSearchField";

function isChecked(value, optValue) {
  const v = value?.[optValue];
  if (v !== undefined) return v !== false;
  const s = value?.[String(optValue)];
  if (s !== undefined) return s !== false;
  // No key: treat as checked only when value is empty (default = all)
  return !value || Object.keys(value).length === 0;
}

function summarizeSelection(value, options, allLabel) {
  const included = options.filter((opt) => isChecked(value, opt.value));
  if (!included.length) return "None selected";
  if (included.length === options.length) return allLabel;
  if (included.length === 1) return included[0].label;
  return `${included.length} selected`;
}

/** Normalize checkbox map to string keys for every option (avoids missing-key = checked bugs). */
function normalizeValue(value, options) {
  const src = value && typeof value === "object" ? value : {};
  const keys = Object.keys(src);
  if (!keys.length) {
    return Object.fromEntries(options.map((o) => [String(o.value), true]));
  }
  return Object.fromEntries(options.map((o) => [String(o.value), isChecked(src, o.value)]));
}

export default function CheckboxDropdownFilter({
  label,
  options = [],
  value,
  allLabel = "All zones",
  variant = "quick",
  disabled = false,
  stacked = false,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const allRef = useRef(null);

  const groupValue = useMemo(() => normalizeValue(value, options), [value, options]);
  const allLabelText = allLabel || "All zones";
  const allChecked = options.length > 0 && options.every((opt) => groupValue[String(opt.value)] !== false);
  const noneChecked = options.length > 0 && options.every((opt) => groupValue[String(opt.value)] === false);
  const summary = summarizeSelection(groupValue, options, allLabelText);
  const boxVariant = variant === "server" ? "server" : "quick";

  /** Selected first so partial filters are visible without scrolling. */
  const orderedOptions = useMemo(() => {
    if (allChecked || noneChecked) return options;
    const selected = [];
    const rest = [];
    for (const opt of options) {
      if (groupValue[String(opt.value)] !== false) selected.push(opt);
      else rest.push(opt);
    }
    return [...selected, ...rest];
  }, [options, groupValue, allChecked, noneChecked]);

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = !allChecked && !noneChecked;
  }, [allChecked, noneChecked]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = 0;
  }, [open, summary]);

  const setAll = (checked) => {
    onChange?.(Object.fromEntries(options.map((opt) => [String(opt.value), checked])));
  };

  const setOne = (zoneId, checked) => {
    const next = normalizeValue(groupValue, options);
    next[String(zoneId)] = checked;
    onChange?.(next);
  };

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <label className={`${listPageFilterLabelClass(boxVariant)} ${stacked ? "" : "max-md:hidden"}`}>
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${[listPageFilterBoxClass(boxVariant), LIST_PAGE_FILTER_VALUE_CLASS, "flex h-8 md:h-9 w-full min-w-0 items-center justify-between gap-2 px-2 md:px-3 text-left outline-none"].join(" ")}${disabled ? " opacity-50 cursor-not-allowed" : " cursor-pointer"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={`truncate text-[11px] font-bold uppercase tracking-wide ${allChecked ? "text-slate-600" : "text-indigo-800"}`}
        >
          {summary}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          ref={listRef}
          className="absolute left-0 top-full z-[100] mt-1 max-h-[min(18rem,50vh)] min-w-full w-max max-w-[min(18rem,90vw)] overflow-y-auto border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <label className="sticky top-0 z-[1] flex cursor-pointer items-center gap-2 border-b border-slate-100 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50">
            <input
              ref={allRef}
              type="checkbox"
              checked={allChecked}
              onChange={(e) => setAll(e.target.checked)}
              className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-indigo-600"
            />
            <span>{allLabelText}</span>
          </label>
          {orderedOptions.map((opt) => {
            const key = String(opt.value);
            const checked = groupValue[key] !== false;
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide hover:bg-indigo-50 ${
                  checked ? "bg-indigo-50/60 text-indigo-900" : "text-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setOne(opt.value, e.target.checked)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-indigo-600"
                />
                <span className="min-w-0 truncate" title={opt.label}>
                  {opt.label}
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
