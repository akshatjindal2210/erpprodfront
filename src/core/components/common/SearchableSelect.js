"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, Search, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { LIST_PAGE_SEARCH_LABEL_CLASS } from "./ListPageSearchField";

const PAGE_SIZE = 50;

function toSearchText(value) {
  return String(value ?? "");
}

export default function SearchableSelect({ value, onChange, fetchService, getByIdService, dataKey = "id", labelKey = "name", subLabelKey = "", 
  error = "", required = false, disabled = false, placeholder = "Search...", label = "", className = "", helperText = "",
  /** Optional: show this field under each dropdown row (e.g. item D-Code for disambiguation). */
  listHintKey = "", listHintLabel = "D-Code",
  /** If true, don't show any options until user types something. */
  requireSearch = false,
  /** Minimum characters required before fetching (only used when requireSearch=true). */
  minSearchChars = 1,
  /** Render dropdown inside the component instead of document.body portal. */
  usePortal = true,
  /**
   * "form" — rounded corners like modal/drawer inputs (`rounded-lg`).
   * "toolbar" — sharp corners to match list filter strips next to `ListPageSearchField`.
   */
  variant = "form",
  emptyMessage = "No options available",
  /** Override trigger height to align with sibling inputs (e.g. "h-10"). */
  heightClass = "h-9",
}) {
  const isToolbar = variant === "toolbar";
  const triggerRadius = isToolbar ? "rounded-none" : "rounded-lg";
  const dropdownSurface = isToolbar
    ? "rounded-none"
    : "rounded-lg shadow-md";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchText = toSearchText(search);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const [openUp, setOpenUp] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [apiMessage, setApiMessage] = useState("");

  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // 1. Position Calculation
  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const nextOpenUp = spaceBelow < 260;
    setOpenUp(nextOpenUp);
    setDropPos({
      width: rect.width,
      left: rect.left + window.scrollX,
      top: !nextOpenUp ? rect.bottom + window.scrollY + 4 : rect.top + window.scrollY - 264,
    });
  }, []);

  // 2. Fetch Data Logic
  const fetchData = useCallback(async (query, p = 1) => {
    if (p === 1) {
      setLoading(true);
      setApiMessage("");
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await fetchService({ search: query, page: p, limit: PAGE_SIZE });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      
      if (res?.message && list.length === 0) {
        setApiMessage(res.message);
      }

      setItems(prev => p === 1 ? list : [...prev, ...list]);
      setHasMore(list.length === PAGE_SIZE);
      setPage(p);
      
      if (p === 1) {
        // When opening/searching, try to highlight the already selected item first
        const selectedIdx = value ? list.findIndex(item => String(item[dataKey]) === String(value)) : -1;
        setActiveIndex(selectedIdx !== -1 ? selectedIdx : (list.length > 0 ? 0 : -1));
      }
    } catch (err) {
      if (p === 1) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fetchService, labelKey, dataKey, value]);

  // 3. FIXED: Single useEffect for Fetching (Removed the duplicate)
  useEffect(() => {
    if (!open) return;

    const q = searchText;
    const trimmed = q.trim();
    const minChars = Math.max(1, Number(minSearchChars) || 1);

    // Click/open should show options immediately (fetch first page).
    if (!trimmed) {
      if (requireSearch) {
        setItems([]);
        setHasMore(false);
        setPage(1);
        setActiveIndex(-1);
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      fetchData("", 1);
      return;
    }

    if (requireSearch && trimmed.length < minChars) {
      setItems([]);
      setHasMore(false);
      setPage(1);
      setActiveIndex(-1);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(trimmed, 1), 300);

    return () => clearTimeout(debounceRef.current);
  }, [searchText, open, fetchData, requireSearch, minSearchChars]);

  // 4. Pre-fill Logic (For Edit Mode)
  useEffect(() => {
    if (!value) { setSelected(null); setSearch(""); return; }
    if (selected?.[dataKey] == value) return;

    getByIdService(value).then((res) => {
      const item = res?.data || res;
      if (item?.[dataKey]) {
        setSelected(item);
        setSearch(toSearchText(item[labelKey]));
      }
    }).catch(() => {
      setSearch(String(value));
    });
  }, [value, dataKey, labelKey, getByIdService]);

  // 5. Click Outside logic
  useEffect(() => {
    const handleClickOutside = (e) => {
      const dd = dropdownRef.current;
      const portals = document.querySelectorAll("#searchable-portal");
      const clickedInAnyPortal = Array.from(portals).some((el) => el.contains(e.target));
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        !(dd && dd.contains(e.target)) &&
        !clickedInAnyPortal
      ) {
        setOpen(false);
        setSearch(selected ? toSearchText(selected[labelKey]) : "");
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, selected, labelKey]);

  const handleSelect = (item) => {
    setSelected(item);
    setSearch(toSearchText(item[labelKey]));
    onChange(item[dataKey], item);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelected(null);
    setSearch("");
    onChange(null, null);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      // Keyboard-first UX: if user tabs into the input and starts typing,
      // open dropdown immediately (no need to press space / click).
      const isTypingChar =
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey;
      if (isTypingChar) {
        setOpen(true);
        calcPosition();
        return; // allow the character to be typed normally
      }
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        calcPosition();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < items.length) {
          handleSelect(items[activeIndex]);
        }
        break;
      case " ":
        // If searching, space is part of search. If just opened without search, maybe select?
        // Standard select opens on space. Let's keep it for opening but not for selecting once open.
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setSearch(selected ? toSearchText(selected[labelKey]) : "");
        break;
      case "Tab":
        // Select the active item on Tab if one is highlighted
        if (activeIndex >= 0 && activeIndex < items.length) {
          handleSelect(items[activeIndex]);
        } else {
          setOpen(false);
          setSearch(selected ? toSearchText(selected[labelKey]) : "");
        }
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  const dropdownEl = open ? (
    <div
      ref={dropdownRef}
      id="searchable-portal"
      style={
        usePortal
          ? { 
              ...dropPos, 
              position: "absolute", 
              zIndex: 99999,
              // On mobile, if opening up, we might need a different top calculation
              // but for now let's ensure it doesn't exceed viewport
            }
          : {
              position: "absolute",
              left: 0,
              right: 0,
              width: "100%",
              zIndex: 50,
              ...(openUp ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }),
            }
      }
      className={`bg-white border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${dropdownSurface}`}
    >
      <ul ref={listRef} className="max-h-[220px] overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20 && hasMore && !loadingMore && !loading) {
            fetchData(searchText, page + 1);
          }
        }}>
        {loading ? (
          <div className="p-10 flex flex-col items-center gap-2">
            <Loader2 size={20} className="animate-spin text-indigo-500" />
            <span className="text-[10px] text-slate-400 font-medium">Fetching data...</span>
          </div>
        ) : items.length === 0 ? (
          <li className="p-8 text-center text-slate-400 text-xs flex flex-col gap-2">
            <span>{searchText.trim() ? "No results found" : (apiMessage || emptyMessage)}</span>
            {!searchText.trim() && apiMessage && <span className="text-[10px] text-slate-500 font-normal leading-relaxed">{apiMessage}</span>}
          </li>
        ) : (
          items.map((item, idx) => (
            <li key={item[dataKey] || idx} onClick={() => handleSelect(item)}
              onMouseEnter={() => !('ontouchstart' in window) && setActiveIndex(idx)}
              className={`px-3 py-2 cursor-pointer border-b border-slate-50 last:border-0 transition-colors flex flex-col ${
                activeIndex === idx ? "bg-indigo-50/50" : ""
              } ${selected?.[dataKey] === item[dataKey] ? "bg-indigo-100/50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-[11px]">{item[labelKey]}</span>
                {selected?.[dataKey] === item[dataKey] && <CheckCircle2 size={12} className="text-indigo-600" />}
              </div>
              {subLabelKey && item[subLabelKey] != null && String(item[subLabelKey]).trim() !== ""
                && String(item[subLabelKey]).trim().toLowerCase() !== String(item[labelKey] ?? "").trim().toLowerCase() ? (
                <span className="text-[9px] text-slate-400 font-medium whitespace-normal break-words">{item[subLabelKey]}</span>
              ) : null}
              {listHintKey && item[listHintKey] != null && item[listHintKey] !== "" ? (
                <span className="text-[9px] font-mono text-slate-500 font-semibold tracking-tight">
                  {listHintLabel}: {String(item[listHintKey])}
                </span>
              ) : null}
            </li>
          ))
        )}
        {loadingMore && <li className="p-3 text-center border-t border-slate-50 bg-slate-50/30"><Loader2 size={16} className="animate-spin mx-auto text-indigo-400" /></li>}
      </ul>
    </div>
  ) : null;

  const dropdown = open
    ? (usePortal ? createPortal(dropdownEl, document.body) : dropdownEl)
    : null;

  return (
    <div className={`space-y-1 ${className} ${usePortal ? "" : "relative"}`}>
      {label && (
        <label className={LIST_PAGE_SEARCH_LABEL_CLASS}>
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </label>
      )}
      <div 
        ref={triggerRef} 
        className={`w-full min-w-0 border border-slate-300 ${triggerRadius} px-2 sm:px-3 ${heightClass} flex items-center gap-1.5 sm:gap-2 overflow-hidden transition-all duration-200 ${
          disabled ? 'bg-slate-50 cursor-not-allowed opacity-75 border-slate-200' : 
          open ? 'bg-white border-slate-500 shadow-sm cursor-text' : 
          error ? 'bg-white border-rose-400 ring-rose-50 ring-1 cursor-text' : 
          'bg-white hover:border-slate-400 cursor-text'
        }`} 
        onClick={() => { 
          if(!disabled) { 
            if (open) {
              setOpen(false);
              setSearch(selected ? toSearchText(selected[labelKey]) : "");
            } else {
              calcPosition(); 
              setOpen(true); 
              setTimeout(() => inputRef.current?.focus(), 10); 
            }
          } 
        }}
      >
        <Search size={14} className={`shrink-0 ${open ? "text-indigo-500" : "text-slate-400"}`} />
        <input 
          ref={inputRef} type="text" value={searchText} 
          onChange={(e) => {
            const next = e.target.value;
            setSearch(next);
            if (!open) {
              setOpen(true);
              calcPosition();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder} disabled={disabled} autoComplete="off" 
          className="flex-1 min-w-0 bg-transparent outline-none text-slate-700 placeholder:text-slate-400 text-[12px] font-medium truncate"
        />
        <div className="flex items-center gap-1 shrink-0 pl-1.5 sm:pl-2 border-l border-slate-100">
          {searchText && !disabled && (
            <button type="button" onClick={handleClear} className="text-slate-300 hover:text-rose-500 transition-colors">
              <X size={14} />
            </button>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {helperText ? (
        <p className="text-[10px] text-slate-500 ml-1 leading-relaxed">{helperText}</p>
      ) : null}
      {error && <p className="text-[9px] text-rose-500 flex items-center gap-1 ml-1"><AlertCircle size={10} /> {error}</p>}
      {dropdown}
    </div>
  );
}