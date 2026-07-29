"use client";

/**
 * Task SearchableSelect — IMS-identical chrome (form variant).
 * Same look as `@/ui/common/forms/SearchableSelect`:
 * search icon + typeahead in trigger, rounded-lg, portal dropdown.
 *
 * Keeps Task's in-memory API: `options` / `{ id, name }` / `isMulti` / `clearable`.
 * Multi + compactMulti matches inventory-report: "N selected" + pinned selected panel to deselect.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, CheckCircle2, X, AlertCircle } from "lucide-react";
import { sortOptionsByNameAsc } from "@/apps/task/lib/helpers/sortOptions";
import { FORM_LABEL_CLASS, FORM_ERROR_CLASS } from "@/ui/common/Constants";
import {
  listPageFilterLabelClass,
  LIST_PAGE_FILTER_VALUE_CLASS,
  listPageFilterBoxClass,
} from "@/ui/common/list/ListPageSearchField";

const VIEWPORT_MARGIN = 8;
const DROPDOWN_MAX_HEIGHT = 280;

function computeDropdownPosition(rect) {
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT && rect.top > spaceBelow;

  let width = Math.min(rect.width, window.innerWidth - VIEWPORT_MARGIN * 2);
  let left = rect.left;

  if (left + width > window.innerWidth - VIEWPORT_MARGIN) {
    left = Math.max(VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - width);
  }
  if (left < VIEWPORT_MARGIN) {
    left = VIEWPORT_MARGIN;
    width = Math.min(width, window.innerWidth - VIEWPORT_MARGIN * 2);
  }

  const top = openUp
    ? Math.max(VIEWPORT_MARGIN, rect.top - DROPDOWN_MAX_HEIGHT - 4)
    : rect.bottom + 4;

  return { top, left, width, maxHeight: DROPDOWN_MAX_HEIGHT, openUp };
}

function optionLabel(opt) {
  return String(opt?.name ?? "").trim();
}

function optionSubLabel(opt) {
  return String(opt?.subLabel ?? opt?.description ?? opt?.usercode ?? "").trim();
}

const SearchableSelect = ({
  label,
  options = [],
  displayOptions,
  value,
  onChange,
  placeholder = "Search...",
  selectCls,
  heightClass = "",
  disabled = false,
  isMulti = false,
  /** Inventory-report style: "N selected" + pinned selected rows to toggle off */
  compactMulti = false,
  clearable = false,
  error,
  required = false,
  /** "form" = IMS drawer (default); "toolbar" = list filter strip */
  variant = "form",
  filterVariant = "server",
  className = "",
}) => {
  const isToolbar = variant === "toolbar";
  const toolbarTone = filterVariant === "quick" ? "quick" : "server";
  const multi = !!isMulti;
  const multiCompactMode = multi && compactMulti;
  const multiTagsMode = multi && !compactMulti;

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: DROPDOWN_MAX_HEIGHT,
  });

  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const listRef = useRef(null);
  const keyboardNavRef = useRef(false);

  const sortedOptions = useMemo(() => sortOptionsByNameAsc(options), [options]);
  const lookupOptions = useMemo(
    () => sortOptionsByNameAsc(displayOptions ?? options),
    [displayOptions, options],
  );

  const selectedOptions = useMemo(() => {
    if (multi) {
      const ids = Array.isArray(value) ? value.map(String) : [];
      return ids
        .map((id) => lookupOptions.find((opt) => String(opt.id) === id))
        .filter(Boolean);
    }
    return lookupOptions.find((opt) => String(opt.id) === String(value)) || null;
  }, [multi, value, lookupOptions]);

  const selectedCount = multi ? (Array.isArray(value) ? value.length : 0) : 0;

  const selectedLabel = multi
    ? ""
    : selectedOptions
      ? optionLabel(selectedOptions)
      : "";

  // Keep closed single-select trigger text in sync with value (IMS behavior)
  useEffect(() => {
    if (multi) return;
    if (!isOpen) setSearch(selectedLabel);
  }, [multi, isOpen, selectedLabel]);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    setDropdownPos(computeDropdownPosition(triggerRef.current.getBoundingClientRect()));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) {
        setIsOpen(false);
        if (!multi) setSearch(selectedLabel);
        else setSearch("");
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [multi, selectedLabel]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  const selectedIdSet = useMemo(() => {
    if (multi) {
      return new Set((Array.isArray(value) ? value : []).map(String));
    }
    if (value !== "" && value != null) return new Set([String(value)]);
    return new Set();
  }, [multi, value]);

  const searchTrimmed = search.trim();
  const pinSelectedAtTop = multiCompactMode && !searchTrimmed;

  /** Options matching search (includes selected when compact so they can be toggled). */
  const filtered = useMemo(() => {
    const q = searchTrimmed.toLowerCase();
    let pool = sortedOptions;

    // Tag mode: selected stay as chips only — hide from the dropdown list
    if (multiTagsMode) {
      pool = sortedOptions.filter((opt) => !selectedIdSet.has(String(opt.id)));
    }

    // When closed single-select shows the selected label as search text, don't filter to one row on open
    if (!multi && selectedLabel && search === selectedLabel && isOpen) {
      return pool;
    }
    if (!q) return pool;
    return pool.filter((opt) => {
      const name = optionLabel(opt).toLowerCase();
      const sub = optionSubLabel(opt).toLowerCase();
      return name.includes(q) || sub.includes(q);
    });
  }, [
    sortedOptions,
    search,
    searchTrimmed,
    multi,
    multiTagsMode,
    selectedLabel,
    isOpen,
    selectedIdSet,
  ]);

  const unselectedListItems = useMemo(() => {
    if (!pinSelectedAtTop) return filtered;
    return filtered.filter((opt) => !selectedIdSet.has(String(opt.id)));
  }, [pinSelectedAtTop, filtered, selectedIdSet]);

  const keyboardList = pinSelectedAtTop ? unselectedListItems : filtered;

  useEffect(() => {
    if (!isOpen || !keyboardNavRef.current || activeIndex < 0 || !listRef.current) return;
    keyboardNavRef.current = false;
    const el = listRef.current.children[activeIndex];
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const openDropdown = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSelect = (id) => {
    if (multi) {
      const current = Array.isArray(value) ? value.map(String) : [];
      const sid = String(id);
      const next = current.includes(sid)
        ? current.filter((v) => v !== sid)
        : [...current, sid];
      onChange(next);
      setSearch("");
      setActiveIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      onChange(id);
      setIsOpen(false);
      setActiveIndex(-1);
      const picked = lookupOptions.find((o) => String(o.id) === String(id));
      setSearch(picked ? optionLabel(picked) : "");
    }
  };

  const handleClear = (e) => {
    e?.stopPropagation?.();
    if (disabled) return;
    if (multi) onChange([]);
    else onChange("");
    setSearch("");
    setActiveIndex(-1);
    if (!multi) setIsOpen(false);
    else setTimeout(() => inputRef.current?.focus(), 0);
  };

  const hasValue = multi
    ? Array.isArray(value) && value.length > 0
    : value !== "" && value != null;

  const showClear = (clearable || hasValue || !!search) && !disabled && (hasValue || !!search);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      const isTypingChar = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (isTypingChar) {
        setIsOpen(true);
        updatePosition();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        keyboardNavRef.current = true;
        setActiveIndex((prev) => (prev < keyboardList.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        keyboardNavRef.current = true;
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < keyboardList.length) {
          handleSelect(keyboardList[activeIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        if (!multi) setSearch(selectedLabel);
        else setSearch("");
        setActiveIndex(-1);
        break;
      default:
        break;
    }
  };

  const triggerShell = isToolbar
    ? `${listPageFilterBoxClass(toolbarTone)}${multiTagsMode ? " searchable-select-multi" : ""}`
    : `${
        multiTagsMode && hasValue ? "min-h-9 h-auto py-1" : "min-h-9 h-9"
      } w-full min-w-0 border border-slate-200 bg-white px-3 transition-all duration-200`;

  const triggerRadius = isToolbar ? "rounded-none" : "rounded-lg";
  const dropdownSurface = isToolbar ? "rounded-none" : "rounded-lg shadow-md";

  const rowLabelClass = isToolbar
    ? "text-[12px] font-medium text-slate-700"
    : "text-[13px] font-normal text-slate-700 leading-snug";
  const rowTitleWithDescClass = isToolbar
    ? "text-[12px] font-semibold text-slate-800"
    : "text-[13px] font-semibold text-slate-800 leading-snug";
  const rowSubClass = isToolbar
    ? "text-[11px] text-slate-500 font-normal"
    : "text-[11px] text-slate-500 font-normal leading-snug";

  const renderOptionRow = (opt, idx, keyPrefix = "", useActiveIndex = true) => {
    const isSelected = multi
      ? selectedIdSet.has(String(opt.id))
      : String(value) === String(opt.id);
    const sub = optionSubLabel(opt);
    const showSub = !!sub;
    const active = useActiveIndex && activeIndex === idx;

    return (
      <li
        key={`${keyPrefix}${opt.id === "" || opt.id == null ? `__opt_${idx}` : String(opt.id)}`}
        role="option"
        aria-selected={isSelected}
        onMouseEnter={() => {
          if (!useActiveIndex) return;
          if (!("ontouchstart" in window)) setActiveIndex(idx);
        }}
        onClick={() => handleSelect(opt.id)}
        className={`px-3 py-2 border-b border-slate-50 last:border-0 transition-colors flex flex-col cursor-pointer ${
          active ? "bg-indigo-50/50" : "hover:bg-slate-50"
        }`}
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className={`${showSub ? rowTitleWithDescClass : rowLabelClass} truncate`}>
            {optionLabel(opt) || placeholder}
          </span>
          {multi && isSelected ? (
            <CheckCircle2 size={12} className="text-indigo-600 shrink-0" />
          ) : null}
        </div>
        {showSub ? (
          <span className={`${rowSubClass} whitespace-normal break-words`}>{sub}</span>
        ) : null}
      </li>
    );
  };

  const listEmpty =
    pinSelectedAtTop
      ? unselectedListItems.length === 0 && selectedCount === 0
      : filtered.length === 0;

  const dropdownPanel =
    isOpen && mounted && dropdownPos.width > 0 ? (
      <div
        ref={dropdownRef}
        role="listbox"
        className={`fixed z-[10050] bg-white border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${dropdownSurface}`}
        style={{
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
          maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
          maxHeight: dropdownPos.maxHeight,
        }}
      >
        {pinSelectedAtTop && selectedCount > 0 ? (
          <div className="border-b border-slate-200 bg-slate-50/60">
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-[10px] font-semibold text-slate-600">
                Selected · {selectedCount}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear(e);
                }}
                className="text-[10px] font-semibold text-slate-500 hover:text-rose-600"
              >
                Clear all
              </button>
            </div>
            <ul className="max-h-[96px] overflow-y-auto">
              {(Array.isArray(selectedOptions) ? selectedOptions : []).map((opt, idx) =>
                renderOptionRow(opt, idx, "sel-", false),
              )}
            </ul>
          </div>
        ) : null}

        <ul
          ref={listRef}
          className={`overflow-y-auto ${
            pinSelectedAtTop && selectedCount > 0 ? "max-h-[124px]" : "max-h-[220px]"
          }`}
        >
          {listEmpty ? (
            <li className="p-8 text-center text-slate-400 text-xs">No results found</li>
          ) : (
            (pinSelectedAtTop ? unselectedListItems : filtered).map((opt, idx) =>
              renderOptionRow(opt, idx),
            )
          )}
        </ul>
      </div>
    ) : null;

  return (
    <div className={`block space-y-1 w-full min-w-0 max-w-full ${className}`}>
      {label ? (
        <label
          className={`block ${isToolbar ? listPageFilterLabelClass(toolbarTone) : FORM_LABEL_CLASS}`}
        >
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </label>
      ) : null}

      <div
        ref={triggerRef}
        className={`${selectCls || `${triggerShell} ${triggerRadius}`} ${heightClass} relative flex items-center gap-1.5 sm:gap-2 w-full min-w-0 max-w-full box-border ${
          multiTagsMode && hasValue ? "overflow-visible flex-wrap" : "overflow-hidden"
        } ${
          disabled
            ? "bg-slate-50 cursor-not-allowed opacity-75 border-slate-200"
            : isOpen
              ? "border-slate-500 shadow-sm cursor-text"
              : error
                ? "border-rose-400 ring-rose-50 ring-1 cursor-text"
                : "hover:border-slate-400 cursor-text"
        }`}
        onClick={(e) => {
          if (disabled) return;
          const clickedInput =
            e.target === inputRef.current || inputRef.current?.contains(e.target);
          if (clickedInput) {
            if (!isOpen) openDropdown();
            else inputRef.current?.focus();
            return;
          }
          if (isOpen) {
            setIsOpen(false);
            if (!multi) setSearch(selectedLabel);
            else setSearch("");
          } else {
            openDropdown();
          }
        }}
      >
        <Search
          size={13}
          className={`shrink-0 self-center ${isOpen ? "text-indigo-500" : "text-slate-400"}`}
        />

        <div
          className={`flex min-w-0 flex-1 items-center gap-1 ${
            multiTagsMode && hasValue ? "flex-wrap py-0.5 overflow-visible" : "overflow-hidden"
          }`}
        >
          {multiCompactMode && selectedCount > 0 ? (
            <span className="shrink-0 inline-flex items-center rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 tabular-nums">
              {selectedCount} selected
            </span>
          ) : null}

          {multiTagsMode && Array.isArray(selectedOptions) && selectedOptions.length > 0
            ? selectedOptions.slice(0, 2).map((opt) => (
                <span
                  key={opt.id}
                  className="inline-flex max-w-full sm:max-w-[45%] items-center gap-1 rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700"
                >
                  <span className="truncate">{optionLabel(opt)}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(opt.id);
                      }}
                      className="shrink-0 hover:text-rose-500 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  )}
                </span>
              ))
            : null}

          {multiTagsMode && Array.isArray(selectedOptions) && selectedOptions.length > 2 ? (
            <span className="shrink-0 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
              +{selectedOptions.length - 2}
            </span>
          ) : null}

          <input
            ref={inputRef}
            type="text"
            value={search}
            disabled={disabled}
            autoComplete="off"
            placeholder={
              multiCompactMode
                ? selectedCount > 0
                  ? "Search to add…"
                  : placeholder
                : multiTagsMode && selectedCount > 0
                  ? "Add more…"
                  : placeholder
            }
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const next = e.target.value;
              setSearch(next);
              setActiveIndex(-1);
              if (!isOpen) {
                setIsOpen(true);
                updatePosition();
              }
            }}
            onKeyDown={handleKeyDown}
            className={`min-w-0 flex-1 self-center bg-transparent outline-none ${
              multiTagsMode && hasValue ? "h-6 leading-6 min-w-[3rem]" : "truncate"
            } ${
              multiCompactMode ? "min-w-[4.5rem]" : ""
            } ${
              isToolbar
                ? LIST_PAGE_FILTER_VALUE_CLASS
                : "text-sm font-normal text-slate-800"
            } placeholder:text-slate-400`}
          />
        </div>

        <div className="flex shrink-0 items-center self-center gap-1 border-l border-slate-100 pl-1.5 sm:pl-2">
          {showClear && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-300 hover:text-rose-500 transition-colors"
              title="Clear"
              aria-label="Clear"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {mounted && dropdownPanel ? createPortal(dropdownPanel, document.body) : null}

      {error ? (
        <p className={FORM_ERROR_CLASS}>
          <AlertCircle size={12} className="shrink-0" /> {error}
        </p>
      ) : null}
    </div>
  );
};

export default SearchableSelect;
