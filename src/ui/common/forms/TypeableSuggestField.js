"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertCircle } from "lucide-react";
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
  menuZIndex = 80,
  portalMenu = false,
}) {
  const [allOpts, setAllOpts] = useState([]);
  const [visibleOpts, setVisibleOpts] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [menuStyle, setMenuStyle] = useState(null);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef(null);
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
        const label = getOptionLabel(opt).toLowerCase();
        const hint = optionHintKey ? String(opt?.[optionHintKey] ?? "").toLowerCase() : "";
        return label.includes(q) || (hint && hint.includes(q));
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
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 160),
    });
  }, []);

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

  const inputClasses = inputClassName
    ? `w-full min-w-0 ${inputClassName} ${error ? "border-rose-500 bg-rose-50" : ""}`.trim()
    : `w-full min-w-0 ${OK_INPUT} rounded-lg ${error ? "border-rose-500 bg-rose-50" : "border-slate-200"}`;

  const menuNode =
    !isLocked && open && visibleOpts.length > 0 ? (
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto"
        style={
          portalMenu && menuStyle
            ? { position: "fixed", top: menuStyle.top, left: menuStyle.left, width: menuStyle.width, zIndex: menuZIndex }
            : { zIndex: menuZIndex }
        }
      >
        {visibleOpts.map((o, idx) => {
          const hint = optionHintKey ? o?.[optionHintKey] : "";
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
              className={`w-full text-left px-3 py-2 ${
                highlight === idx ? "bg-indigo-50" : "hover:bg-indigo-50/40"
              }`}
            >
              <div className="text-[11px] font-bold text-slate-700">{getOptionLabel(o)}</div>
              {hint ? <div className="text-[10px] text-slate-400 font-mono">{hint}</div> : null}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className={`space-y-1 relative min-w-0 ${className}`.trim()} data-field={dataField}>
      {label ? (
        <label className={FORM_LABEL_CLASS}>
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </label>
      ) : null}
      <input
        ref={inputRef}
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
