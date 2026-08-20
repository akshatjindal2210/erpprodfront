"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Search, ChevronDown } from "lucide-react";
import { OK_INPUT, FORM_LABEL_CLASS, FORM_ERROR_CLASS } from "@/ui/common/Constants";
import { sortSelectRowsAsc } from "@/platform/utils/form/sortSelectOptions";

function normalizeStaticOptions(list, optionLabelKey, optionIdKey) {
  return (Array.isArray(list) ? list : []).map((o, i) => {
    if (o != null && typeof o === "object") return o;
    const label = String(o ?? "").trim();
    return { [optionIdKey]: i, [optionLabelKey]: label };
  }).filter((o) => String(o?.[optionLabelKey] ?? "").trim() !== "");
}

/**
 * Type-or-pick combobox — loads suggestions once from API, filters locally while typing.
 * User can pick from dropdown or enter a new value without extra API calls per keystroke.
 * `comboboxShell` matches SearchableSelect trigger styling (search icon + chevron).
 */
export default function TypeableSuggestField({
  label,
  required = false,
  value = "",
  onChange,
  error = "",
  disabled = false,
  readOnly = false,
  placeholder = "Type or pick from suggestions…",
  dataField,
  fetchSuggestions,
  staticOptions,
  optionLabelKey = "name",
  optionHintKey = "",
  optionIdKey = "id",
  active = true,
  onPick,
  onClearError,
  className = "",
  inputClassName = "",
  inputStyle,
  menuZIndex = 80,
  portalMenu = false,
  /** Match SearchableSelect shell — search icon, chevron, shared border/hover states. */
  comboboxShell = false,
  heightClass = "h-10",
}) {
  const [allOpts, setAllOpts] = useState([]);
  const [visibleOpts, setVisibleOpts] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [menuStyle, setMenuStyle] = useState(null);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef(null);
  const shellRef = useRef(null);
  const isLocked = disabled || readOnly;
  const loadedRef = useRef(false);
  const fetchSeqRef = useRef(0);
  const useStatic = staticOptions != null;

  useEffect(() => {
    setMounted(true);
  }, []);

  const getOptionLabel = useCallback(
    (opt) => String(opt?.[optionLabelKey] ?? opt?.[optionIdKey] ?? "").trim(),
    [optionIdKey, optionLabelKey]
  );

  const filterOptions = useCallback(
    (search, source) => {
      const rows = Array.isArray(source) ? source : [];
      const q = String(search ?? "").trim().toLowerCase();
      if (!q) return rows;
      return rows.filter((opt) => {
        const labelText = getOptionLabel(opt).toLowerCase();
        const hint = optionHintKey ? String(opt?.[optionHintKey] ?? "").toLowerCase() : "";
        return labelText.includes(q) || (hint && hint.includes(q));
      });
    },
    [getOptionLabel, optionHintKey]
  );

  const applyFilter = useCallback(
    (search, source) => {
      setVisibleOpts(sortSelectRowsAsc(filterOptions(search, source), optionLabelKey));
    },
    [filterOptions, optionLabelKey]
  );

  const updateMenuPosition = useCallback(() => {
    const el = comboboxShell ? shellRef.current : inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 160),
    });
  }, [comboboxShell]);

  const loadAllSuggestionsOnce = useCallback(async () => {
    if (!active || isLocked) {
      loadedRef.current = false;
      setAllOpts([]);
      setVisibleOpts([]);
      return;
    }

    if (useStatic) {
      const rows = sortSelectRowsAsc(
        normalizeStaticOptions(staticOptions, optionLabelKey, optionIdKey),
        optionLabelKey
      );
      loadedRef.current = true;
      setAllOpts(rows);
      applyFilter(value, rows);
      return;
    }

    if (typeof fetchSuggestions !== "function") {
      loadedRef.current = false;
      setAllOpts([]);
      setVisibleOpts([]);
      return;
    }
    if (loadedRef.current) return;

    const seq = ++fetchSeqRef.current;
    try {
      const list = await fetchSuggestions("");
      if (seq !== fetchSeqRef.current) return;
      const rows = sortSelectRowsAsc(Array.isArray(list) ? list : [], optionLabelKey);
      loadedRef.current = true;
      setAllOpts(rows);
      applyFilter(value, rows);
    } catch {
      if (seq !== fetchSeqRef.current) return;
      loadedRef.current = false;
      setAllOpts([]);
      setVisibleOpts([]);
    }
  }, [
    active,
    applyFilter,
    fetchSuggestions,
    isLocked,
    optionIdKey,
    optionLabelKey,
    staticOptions,
    useStatic,
    value,
  ]);

  useEffect(() => {
    if (!active || isLocked) {
      loadedRef.current = false;
      fetchSeqRef.current += 1;
      setAllOpts([]);
      setVisibleOpts([]);
      return;
    }
    loadedRef.current = false;
    void loadAllSuggestionsOnce();
  }, [active, isLocked, loadAllSuggestionsOnce, staticOptions]);

  useEffect(() => {
    if (!allOpts.length) return;
    applyFilter(value, allOpts);
  }, [value, allOpts, applyFilter]);

  useEffect(() => {
    if (!open || !portalMenu) return undefined;
    updateMenuPosition();
    const onReflow = () => updateMenuPosition();
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, portalMenu, updateMenuPosition, visibleOpts.length]);

  const handlePick = useCallback(
    (opt) => {
      const next = opt?.[optionLabelKey] ?? opt?.[optionIdKey] ?? value;
      onChange(next);
      onPick?.(opt);
      onClearError?.();
    },
    [onChange, onClearError, onPick, optionIdKey, optionLabelKey, value]
  );

  const focusField = useCallback(() => {
    if (isLocked) return;
    applyFilter(value, allOpts);
    setOpen(true);
    if (portalMenu) updateMenuPosition();
    inputRef.current?.focus();
  }, [allOpts, applyFilter, isLocked, portalMenu, updateMenuPosition, value]);

  const inputClasses = comboboxShell
    ? `min-w-0 flex-1 self-center bg-transparent outline-none text-[12px] text-slate-800 placeholder:text-slate-400 ${
        isLocked ? "cursor-not-allowed" : ""
      }`.trim()
    : inputClassName
      ? `w-full min-w-0 ${inputClassName} ${error ? "border-rose-500 bg-rose-50" : ""}`.trim()
      : `w-full min-w-0 ${OK_INPUT} rounded-lg ${error ? "border-rose-500 bg-rose-50" : "border-slate-200"}`;

  const shellClasses = comboboxShell
    ? `w-full min-w-0 min-h-9 ${heightClass} border bg-white px-3 rounded-lg flex items-center gap-1.5 sm:gap-2 transition-all duration-200 overflow-hidden ${
        isLocked
          ? "bg-slate-50 cursor-not-allowed opacity-75 border-slate-200"
          : open
            ? "border-slate-500 shadow-sm cursor-text"
            : error
              ? "border-rose-400 ring-rose-50 ring-1 cursor-text"
              : "border-slate-200 hover:border-slate-400 cursor-text"
      }`
    : "";

  const menuRowLabelClass = comboboxShell
    ? "text-[12px] font-medium text-slate-700 leading-snug"
    : "text-[13px] font-normal text-slate-700";

  const menuNode =
    !isLocked && open && visibleOpts.length > 0 ? (
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-md max-h-56 overflow-auto animate-in fade-in zoom-in-95 duration-100"
        style={
          portalMenu && menuStyle
            ? { position: "fixed", top: menuStyle.top, left: menuStyle.left, width: menuStyle.width, zIndex: menuZIndex }
            : { zIndex: menuZIndex }
        }
      >
        {visibleOpts.map((o, idx) => {
          const hint = optionHintKey ? o?.[optionHintKey] : "";
          const optStyle = o?.menuStyle;
          const hasCustomStyle = Boolean(optStyle?.backgroundColor);
          return (
            <button
              key={o[optionIdKey] ?? getOptionLabel(o) ?? idx}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handlePick(o);
                setOpen(false);
                setHighlight(-1);
              }}
              onMouseEnter={() => setHighlight(idx)}
              className={`w-full text-left px-3 py-2 border-b border-slate-50 last:border-b-0 transition-colors ${
                comboboxShell ? "min-h-[36px]" : "min-h-[44px] py-2.5"
              } ${
                hasCustomStyle
                  ? highlight === idx
                    ? "ring-1 ring-inset ring-indigo-300"
                    : ""
                  : highlight === idx
                    ? "bg-indigo-50/80"
                    : "hover:bg-slate-50"
              }`}
              style={optStyle}
            >
              <div className={menuRowLabelClass}>{getOptionLabel(o)}</div>
              {hint ? <div className="text-[11px] text-slate-500 font-normal leading-snug">{hint}</div> : null}
            </button>
          );
        })}
      </div>
    ) : null;

  const inputEl = (
    <input
      ref={inputRef}
      type="text"
      autoComplete="off"
      value={value}
      readOnly={readOnly}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v);
        if (!isLocked) {
          applyFilter(v, allOpts);
          setOpen(true);
          setHighlight(-1);
          if (portalMenu) updateMenuPosition();
        }
        onClearError?.();
      }}
      placeholder={placeholder}
      className={inputClasses}
      style={comboboxShell ? undefined : inputStyle}
      onFocus={() => {
        if (!isLocked) {
          applyFilter(value, allOpts);
          setOpen(true);
          if (portalMenu) updateMenuPosition();
        }
      }}
      onBlur={() => setTimeout(() => setOpen(false), 120)}
      onKeyDown={(e) => {
        if (isLocked || !open || visibleOpts.length === 0) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlight((prev) => Math.min(prev + 1, visibleOpts.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlight((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter" && highlight >= 0) {
          e.preventDefault();
          handlePick(visibleOpts[highlight]);
          setOpen(false);
          setHighlight(-1);
        } else if (e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
          setHighlight(-1);
        }
      }}
    />
  );

  return (
    <div className={`space-y-1 relative min-w-0 ${className}`.trim()} data-field={dataField}>
      {label ? (
        <label className={FORM_LABEL_CLASS}>
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </label>
      ) : null}
      {comboboxShell ? (
        <div
          ref={shellRef}
          style={inputStyle}
          className={shellClasses}
          onClick={(e) => {
            if (isLocked) return;
            if (e.target === inputRef.current) return;
            focusField();
          }}
        >
          <Search size={13} className={`shrink-0 self-center ${open ? "text-indigo-500" : "text-slate-400"}`} />
          {inputEl}
          <ChevronDown
            size={14}
            className={`shrink-0 self-center text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      ) : (
        inputEl
      )}
      {error ? (
        <p className={FORM_ERROR_CLASS}>
          <AlertCircle size={10} /> {error}
        </p>
      ) : null}
      {portalMenu && mounted && menuNode ? createPortal(menuNode, document.body) : null}
      {!portalMenu && menuNode ? <div className="absolute left-0 right-0 mt-1">{menuNode}</div> : null}
    </div>
  );
}
