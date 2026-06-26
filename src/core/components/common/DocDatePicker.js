"use client";

import { useRef } from "react";
import { formatDocDate } from "@/core/utils/utilHelper";

function displayDate(iso) {
  if (!iso) return "DD/MM/YYYY";
  return formatDocDate(iso) || "DD/MM/YYYY";
}

function openPicker(inputRef) {
  const el = inputRef?.current;
  if (!el) return;
  el.focus();
  if (typeof el.showPicker === "function") {
    try {
      el.showPicker();
    } catch {
      // browser may block programmatic picker
    }
  }
}

/**
 * Packing-entry style date field — shows DD/MM/YYYY, stores YYYY-MM-DD.
 */
export default function DocDatePicker({
  value = "",
  onChange,
  className = "",
  boxClassName = "",
  placeholder = "DD/MM/YYYY",
  disabled = false,
  title,
  "aria-label": ariaLabel,
}) {
  const inputRef = useRef(null);
  const hasValue = Boolean(value);
  const shown = hasValue ? displayDate(value) : placeholder;

  return (
    <div
      className={`relative flex min-w-0 items-center ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${boxClassName}`}
      onClick={() => !disabled && openPicker(inputRef)}
      title={title}
    >
      <span
        className={`pointer-events-none block w-full min-w-0 truncate text-[11px] font-bold uppercase ${
          hasValue ? "text-slate-600" : "text-slate-400"
        }`}
      >
        {shown}
      </span>
      <input
        ref={inputRef}
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={ariaLabel || "Date"}
        className={`absolute inset-0 z-10 h-full w-full cursor-pointer border-0 bg-transparent opacity-0 ${className}`}
      />
    </div>
  );
}
