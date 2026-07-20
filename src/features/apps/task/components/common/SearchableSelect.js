"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, Check, X, AlertCircle } from "lucide-react";
import { sortOptionsByNameAsc } from "@/features/apps/task/helpers/sortOptions";

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

const SearchableSelect = ({
  label,
  options = [],
  displayOptions,
  value,
  onChange,
  placeholder,
  selectCls,
  disabled = false,
  isMulti = false,
  clearable = false,
  error,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, maxHeight: DROPDOWN_MAX_HEIGHT });

  const buttonRef = useRef(null);
  const optionsContainerRef = useRef(null);
  const listRef = useRef(null);

  const sortedOptions = useMemo(() => sortOptionsByNameAsc(options), [options]);
  const lookupOptions = useMemo(
    () => sortOptionsByNameAsc(displayOptions ?? options),
    [displayOptions, options],
  );

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos(computeDropdownPosition(rect));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (!buttonRef.current?.contains(e.target) && !optionsContainerRef.current?.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const filtered = sortedOptions.filter((opt) =>
    opt.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedOptions = isMulti
    ? lookupOptions.filter((opt) => Array.isArray(value) && value.map(String).includes(String(opt.id)))
    : lookupOptions.find((opt) => String(opt.id) === String(value));

  const openDropdown = () => {
    if (buttonRef.current && !disabled) {
      updatePosition();
      setIsOpen(true);
    }
  };

  const handleSelect = (id) => {
    if (isMulti) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValue = currentValues.includes(id)
        ? currentValues.filter((v) => v !== id)
        : [...currentValues, id];
      onChange(newValue);
    } else {
      onChange(id);
      setIsOpen(false);
      setSearch("");
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (isMulti) onChange([]);
    else onChange("");
    setSearch("");
    setIsOpen(false);
  };

  const hasValue = isMulti
    ? Array.isArray(value) && value.length > 0
    : value !== "" && value != null;

  const dropdownPanel = isOpen && mounted ? (
    <div
      ref={optionsContainerRef}
      role="listbox"
      className="fixed z-[1100] bg-white border border-slate-300 shadow-lg rounded-none flex flex-col overflow-hidden"
      style={{
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
        maxHeight: dropdownPos.maxHeight,
      }}
    >
      <div className="p-2 border-b border-slate-100 bg-white sticky top-0 shrink-0">
        <div className="flex items-center w-full min-w-0 bg-slate-50 rounded-lg px-2 border border-slate-100 focus-within:border-indigo-300 transition-colors">
          <Search size={14} className="text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="bg-transparent border-none outline-none w-full min-w-0 py-2 px-2 text-sm text-slate-600 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div
        ref={listRef}
        className="overflow-y-auto flex-1 min-h-0"
        style={{ maxHeight: dropdownPos.maxHeight - 56 }}
      >
        {filtered.length > 0 ? (
          filtered.map((opt) => {
            const isSelected = isMulti
              ? (Array.isArray(value) && value.map(String).includes(String(opt.id)))
              : String(value) === String(opt.id);

            return (
              <button
                key={opt.id}
                type="button"
                className={`w-full flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 text-sm transition-colors border-b border-slate-50 last:border-0 min-w-0
                  ${isSelected ? "bg-indigo-50 text-indigo-600 font-semibold" : "hover:bg-slate-50 text-slate-600"}`}
                onClick={() => handleSelect(opt.id)}
              >
                <span className="truncate text-left min-w-0">{opt.name}</span>
                {isSelected && <Check size={14} className="text-indigo-600 flex-shrink-0" />}
              </button>
            );
          })
        ) : (
          <div className="px-4 py-8 text-center text-xs text-slate-400">No results found</div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="w-full min-w-0">
      {label && (
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
          {label}
        </label>
      )}

      <div
        ref={buttonRef}
        onClick={openDropdown}
        className={`${selectCls || "bg-white border border-slate-300 rounded-none p-2 min-h-9"} relative flex flex-wrap items-center gap-1.5 w-full min-w-0 text-left transition-all duration-200 ${
          error ? "border-rose-400 ring-1 ring-rose-50" : ""
        } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : "hover:border-slate-400 cursor-pointer"} ${
          isOpen ? "ring-1 ring-indigo-200 border-indigo-500" : ""
        }`}
      >
        {isMulti && Array.isArray(value) && value.length > 0 ? (
          <div className="flex flex-wrap gap-1 min-w-0">
            {selectedOptions.map((opt) => (
              <span key={opt.id} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-indigo-100 max-w-full">
                <span className="truncate">{opt.name}</span>
                {!disabled && (
                  <X size={12} className="hover:text-indigo-900 cursor-pointer shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleSelect(opt.id); }}
                  />
                )}
              </span>
            ))}
          </div>
        ) : !isMulti && selectedOptions ? (
          <span className="text-[12px] text-slate-700 pl-1 truncate min-w-0 flex-1">{selectedOptions.name}</span>
        ) : (
          <span className="text-[12px] text-slate-400 pl-1 truncate flex-1">{placeholder}</span>
        )}

        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          {clearable && hasValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
              title="Clear"
              aria-label="Clear selection"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {mounted && dropdownPanel ? createPortal(dropdownPanel, document.body) : null}

      {error && (
        <p className="flex items-center gap-1 text-xs text-rose-500 mt-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
};

export default SearchableSelect;
