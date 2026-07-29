"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "lucide-react";
import dayjs from "dayjs";
import FilterDateCalendar from "@/ui/common/date/FilterDateCalendar";
import { LIST_PAGE_FILTER_FIELD_WRAP_CLASS, listPageFilterLabelClass, listPageSearchInputClass } from "@/ui/common/list/ListPageSearchField";
import { clampFilterDateYmd, editFilterDateInput, filterDateToDisplay, formatDateTypingInput, joinFilterDateSegments, parseFilterDateInput, splitFilterDateSegments } from "@/platform/utils/core/utilHelper";

function calendarStateFromText(text, fallbackYmd) {
  const digits = String(text ?? "").replace(/\D/g, "");
  const today = dayjs();

  if (digits.length >= 8) {
    const ymd = parseFilterDateInput(formatDateTypingInput(text));
    if (ymd) {
      const d = dayjs(ymd);
      return { viewMonth: d.startOf("month"), selectedYmd: ymd, highlightDay: d.date() };
    }
  }

  if (digits.length >= 4) {
    const dd = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    let yyyy = fallbackYmd ? dayjs(fallbackYmd).year() : today.year();
    if (digits.length >= 8) {
      yyyy = Number(digits.slice(4, 8));
    }
    const candidate = dayjs(
      `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
      "YYYY-MM-DD",
      true
    );
    if (candidate.isValid() && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return {
        viewMonth: candidate.startOf("month"),
        selectedYmd: digits.length >= 8 ? candidate.format("YYYY-MM-DD") : "",
        highlightDay: dd,
      };
    }
  }

  if (digits.length >= 2) {
    const dd = Number(digits.slice(0, 2));
    if (dd >= 1 && dd <= 31) {
      const base = fallbackYmd ? dayjs(fallbackYmd) : today;
      return { viewMonth: base.startOf("month"), selectedYmd: fallbackYmd || "", highlightDay: dd };
    }
  }

  if (fallbackYmd) {
    const d = dayjs(fallbackYmd);
    return { viewMonth: d.startOf("month"), selectedYmd: fallbackYmd, highlightDay: d.date() };
  }

  return { viewMonth: today.startOf("month"), selectedYmd: "", highlightDay: null };
}

function restoreCaret(input, caret) {
  if (!input || caret == null) return;
  requestAnimationFrame(() => {
    try {
      input.setSelectionRange(caret, caret);
    } catch {
      /* ignore */
    }
  });
}

/**
 * Typeable DD/MM/YYYY filter date — outputs YYYY-MM-DD to parent.
 * Custom calendar below the field; typing stays active while calendar is open.
 * Day / month / year edit independently so backspace does not shift later digits.
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
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() =>
    valueYmd ? dayjs(valueYmd).startOf("month") : dayjs().startOf("month")
  );
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });

  const focused = useRef(false);
  const wrapRef = useRef(null);
  const textInputRef = useRef(null);
  const panelRef = useRef(null);
  const textRef = useRef(text);
  textRef.current = text;

  const calendarState = useMemo(
    () => calendarStateFromText(text, valueYmd),
    [text, valueYmd]
  );

  useEffect(() => {
    if (!focused.current) {
      setText(filterDateToDisplay(valueYmd));
    }
  }, [valueYmd]);

  useEffect(() => {
    if (open) {
      setViewMonth(calendarState.viewMonth);
    }
  }, [calendarState.viewMonth, open]);

  const updatePanelPos = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPanelPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 272),
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updatePanelPos();
    const onReflow = () => updatePanelPos();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, updatePanelPos]);

  const publishFromText = useCallback(
    (raw) => {
      const typed = String(raw ?? "");
      if (!typed.trim()) {
        onChangeYmd?.("");
        return;
      }
      let ymd = parseFilterDateInput(typed);
      if (!ymd) return;
      ymd = clampFilterDateYmd(ymd, { min: minYmd, max: maxYmd });
      onChangeYmd?.(ymd);
      setText(filterDateToDisplay(ymd));
    },
    [maxYmd, minYmd, onChangeYmd]
  );

  const commitDisplay = (raw) => {
    const typed = String(raw ?? "");
    setText(typed);
    if (!typed.trim()) {
      onChangeYmd?.("");
      return;
    }
    let ymd = parseFilterDateInput(typed);
    if (!ymd) {
      /** Incomplete / invalid — revert display to last committed value. */
      setText(filterDateToDisplay(valueYmd));
      return;
    }
    ymd = clampFilterDateYmd(ymd, { min: minYmd, max: maxYmd });
    onChangeYmd?.(ymd);
    setText(filterDateToDisplay(ymd));
  };

  const applyYmd = useCallback(
    (ymd) => {
      const clamped = ymd ? clampFilterDateYmd(ymd, { min: minYmd, max: maxYmd }) : "";
      onChangeYmd?.(clamped);
      setText(filterDateToDisplay(clamped));
      if (clamped) setViewMonth(dayjs(clamped).startOf("month"));
    },
    [maxYmd, minYmd, onChangeYmd]
  );

  const closePanel = useCallback(() => setOpen(false), []);

  const handleBlur = () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active === textInputRef.current) return;
      if (panelRef.current?.contains(active)) return;
      focused.current = false;
      closePanel();
      commitDisplay(textRef.current);
    }, 120);
  };

  const handlePick = (ymd) => {
    applyYmd(ymd);
    textInputRef.current?.focus({ preventScroll: true });
  };

  const handleToday = () => {
    const today = dayjs().format("YYYY-MM-DD");
    if (!isDisabledYmd(today, minYmd, maxYmd)) handlePick(today);
  };

  const handleClear = () => {
    applyYmd("");
    textInputRef.current?.focus({ preventScroll: true });
  };

  const applyEditResult = (result) => {
    setText(result.text);
    restoreCaret(textInputRef.current, result.caret);
    const ymd = parseFilterDateInput(result.text);
    if (ymd) {
      const clamped = clampFilterDateYmd(ymd, { min: minYmd, max: maxYmd });
      onChangeYmd?.(clamped);
      if (clamped !== ymd) {
        const display = filterDateToDisplay(clamped);
        setText(display);
        restoreCaret(textInputRef.current, display.length);
      }
    } else if (!result.text.trim()) {
      onChangeYmd?.("");
    }
  };

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[200]"
            style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
          >
            <FilterDateCalendar
              viewMonth={viewMonth}
              onViewMonthChange={setViewMonth}
              selectedYmd={calendarState.selectedYmd || valueYmd}
              highlightDay={calendarState.highlightDay}
              minYmd={minYmd}
              maxYmd={maxYmd}
              onPickYmd={handlePick}
              onClear={handleClear}
              onToday={handleToday}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className={`${LIST_PAGE_FILTER_FIELD_WRAP_CLASS}${disabled ? " opacity-50" : ""}`}
    >
      {label ? <label className={`${listPageFilterLabelClass("server")} max-md:hidden`}>{label}</label> : null}
      <div ref={wrapRef} className="relative min-w-0">
        <input
          ref={textInputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel || label || "Date"}
          aria-expanded={open}
          onFocus={() => {
            focused.current = true;
            if (!disabled) {
              setOpen(true);
              updatePanelPos();
            }
          }}
          onBlur={handleBlur}
          onChange={(e) => {
            /**
             * Paste / autofill / mobile: if the field already has DD/MM/YYYY structure,
             * keep segments (do not reflow all digits left — that caused 23/07/2026 → 07/20/26).
             */
            const raw = e.target.value;
            const prev = textRef.current;
            const prevSegs = splitFilterDateSegments(prev);
            const structured =
              /[/\-.]/.test(prev) ||
              Boolean(prevSegs[1] || prevSegs[2]) ||
              /[/\-.]/.test(raw);
            const next = structured
              ? joinFilterDateSegments(splitFilterDateSegments(raw))
              : formatDateTypingInput(raw);
            setText(next);
            const caret = e.target.selectionStart;
            restoreCaret(textInputRef.current, caret);
            const ymd = parseFilterDateInput(next);
            if (ymd) {
              applyYmd(ymd);
            } else if (!next.trim()) {
              onChangeYmd?.("");
            }
            if (!open && !disabled) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              closePanel();
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              commitDisplay(textRef.current);
              closePanel();
              onEnter?.();
              return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const handled =
              e.key === "Backspace" ||
              e.key === "Delete" ||
              /^\d$/.test(e.key);

            if (!handled) return;

            const result = editFilterDateInput(textRef.current, {
              key: e.key,
              selectionStart: e.currentTarget.selectionStart ?? 0,
              selectionEnd: e.currentTarget.selectionEnd ?? 0,
            });
            if (!result) return;
            e.preventDefault();
            applyEditResult(result);
            if (!open && !disabled) setOpen(true);
          }}
          className={`${listPageSearchInputClass("server")} pr-8 md:pr-9 ${disabled ? "cursor-not-allowed bg-slate-50" : ""}`}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
            updatePanelPos();
            textInputRef.current?.focus({ preventScroll: true });
          }}
          className="absolute right-0 top-0 flex h-full w-8 md:w-9 items-center justify-center text-indigo-400 hover:text-indigo-600 disabled:pointer-events-none"
          aria-label="Toggle calendar"
        >
          <Calendar size={14} />
        </button>
      </div>
      {panel}
    </div>
  );
}

function isDisabledYmd(ymd, minYmd, maxYmd) {
  if (!ymd) return true;
  if (minYmd && ymd < minYmd) return true;
  if (maxYmd && ymd > maxYmd) return true;
  return false;
}
