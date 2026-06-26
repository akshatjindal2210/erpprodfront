"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { LIST_PAGE_FILTER_FIELD_WRAP_CLASS, LIST_PAGE_SEARCH_LABEL_CLASS, LIST_PAGE_SEARCH_INPUT_CLASS } from "@/core/components/common/ListPageSearchField";
import { clampFilterDateYmd, filterDateToDisplay, formatDateTypingInput, parseFilterDateInput } from "@/core/utils/utilHelper";

/**
 * Typeable DD/MM/YYYY filter date — outputs YYYY-MM-DD to parent.
 * Optional native calendar via icon (same as before).
 */
export default function FilterDateInput({
  label,
  valueYmd = "",
  onChangeYmd,
  disabled = false,
  minYmd,
  maxYmd,
  placeholder = "DD/MM/YYYY",
  onEnter,
  "aria-label": ariaLabel,
}) {
  const [text, setText] = useState(() => filterDateToDisplay(valueYmd));
  const focused = useRef(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!focused.current) {
      setText(filterDateToDisplay(valueYmd));
    }
  }, [valueYmd]);

  const commitDisplay = (raw) => {
    const typed = formatDateTypingInput(raw);
    setText(typed);
    if (!typed.trim()) {
      onChangeYmd?.("");
      return;
    }
    let ymd = parseFilterDateInput(typed);
    if (!ymd) return;
    ymd = clampFilterDateYmd(ymd, { min: minYmd, max: maxYmd });
    onChangeYmd?.(ymd);
    setText(filterDateToDisplay(ymd));
  };

  const openPicker = () => {
    if (disabled) return;
    const el = pickerRef.current;
    if (!el) return;
    el.focus();
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className={`${LIST_PAGE_FILTER_FIELD_WRAP_CLASS}${disabled ? " opacity-50" : ""}`}>
      {label ? <label className={`${LIST_PAGE_SEARCH_LABEL_CLASS} max-md:hidden`}>{label}</label> : null}
      <div className="relative min-w-0">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel || label || "Date"}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            commitDisplay(text);
          }}
          onChange={(e) => {
            const next = formatDateTypingInput(e.target.value);
            setText(next);
            const ymd = parseFilterDateInput(next);
            if (ymd) {
              const clamped = clampFilterDateYmd(ymd, { min: minYmd, max: maxYmd });
              onChangeYmd?.(clamped);
            } else if (!next.trim()) {
              onChangeYmd?.("");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDisplay(text);
              onEnter?.();
            }
          }}
          className={`${LIST_PAGE_SEARCH_INPUT_CLASS} pr-8 md:pr-9 ${disabled ? "cursor-not-allowed bg-slate-50" : ""}`}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={openPicker}
          className="absolute right-0 top-0 flex h-full w-8 md:w-9 items-center justify-center text-slate-400 hover:text-slate-600 disabled:pointer-events-none"
          aria-label="Open calendar"
        >
          <Calendar size={14} />
        </button>
        <input
          ref={pickerRef}
          type="date"
          value={valueYmd || ""}
          disabled={disabled}
          min={minYmd || undefined}
          max={maxYmd || undefined}
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const ymd = e.target.value || "";
            onChangeYmd?.(ymd);
            setText(filterDateToDisplay(ymd));
          }}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      </div>
    </div>
  );
}
