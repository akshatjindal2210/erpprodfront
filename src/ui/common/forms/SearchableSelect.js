"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, Search, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { FORM_ERROR_CLASS, FORM_HINT_CLASS, FORM_LABEL_CLASS } from "@/ui/common/Constants";
import { listPageFilterLabelClass, LIST_PAGE_FILTER_VALUE_CLASS, listPageFilterBoxClass } from "@/ui/common/list/ListPageSearchField";
import { sortSelectRowsAsc } from "@/platform/utils/form/sortSelectOptions";

const PAGE_SIZE = 50;

function toSearchText(value) {
  return String(value ?? "");
}

function getDisplayLabel(item, labelKey) {
  if (!item || typeof item !== "object") return "";
  return toSearchText(item[labelKey]).trim();
}

export default function SearchableSelect({ value, onChange, fetchService, getByIdService, dataKey = "id", labelKey = "name", subLabelKey = "", 
  error = "", required = false, disabled = false, placeholder = "Search...", label = "", className = "", helperText = "",
  /** Optional: show this field under each dropdown row (e.g. item D-Code for disambiguation). */
  listHintKey = "", listHintLabel = "D-Code",
  /**
   * When false (default), hide `subLabelKey` if it matches `labelKey` (case-insensitive).
   * When true, always show both lines when subLabel has text — even if identical to the label.
   */
  showDuplicateSubLabel = false,
  /**
   * When true, keep fetchService row order as returned (no A→Z re-sort).
   * Default false keeps existing alphabetical dropdown behaviour elsewhere.
   */
  preserveApiOrder = false,
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
  /**
   * When `variant="toolbar"`: `"quick"` = indigo client filter (same as Quick Search),
   * `"server"` = white DB filter.
   */
  filterVariant = "server",
  emptyMessage = "No options available",
  /** Override trigger height to align with sibling inputs (e.g. "h-10"). */
  heightClass = "h-9",
  /** Input + list show only `labelKey` text — never raw id/value fallback. */
  labelOnlyDisplay = false,
  /** Multiple selection support */
  multiple = false,
  /** If true, show selected items as tags in multiple mode */
  showTags = true,
  /** Toolbar multi: fixed height + "N selected" instead of many tags */
  compactMulti = false,
  /** Pin "All" at top — clears selection (empty = no filter) */
  showAllOption = false,
  allOptionLabel = "All",
  /**
   * List filters with an "All …" option: clear the label when opening
   * so the full list shows (otherwise search="All Users" only matches itself).
   */
  clearSearchOnOpen = false,
  /** Max tags in trigger before "+N more" (when not compactMulti) */
  maxVisibleTags = 2,
  /** Fired when the dropdown opens (lazy-load parent options). */
  onDropdownOpen,
  /** Fired on hover/focus intent — prefetch options before open. */
  onDropdownIntent,
  /** Optional per-option class (e.g. muted zero-balance schedule lines). */
  getOptionClassName,
  /** Return true to block selecting an option (still shown in list). */
  isOptionDisabled,
}) {
  const isToolbar = variant === "toolbar";
  const toolbarTone = filterVariant === "quick" ? "quick" : "server";
  const multiCompactMode = multiple && compactMulti;
  const multiTagsMode = multiple && showTags && !compactMulti;
  const dropdownRowLabelClass = isToolbar
    ? "text-[12px] font-medium text-slate-700"
    : "text-[13px] font-normal text-slate-700 leading-snug";
  /** Title row when a description line is shown underneath */
  const dropdownRowTitleWithDescClass = isToolbar
    ? "text-[12px] font-semibold text-slate-800"
    : "text-[13px] font-semibold text-slate-800 leading-snug";
  const dropdownRowSubLabelClass = isToolbar
    ? "text-[11px] text-slate-500 font-normal"
    : "text-[11px] text-slate-500 font-normal leading-snug";
  const triggerRadius = isToolbar ? "rounded-none" : "rounded-lg";
  const triggerShellClass = isToolbar
    ? `${listPageFilterBoxClass(toolbarTone)}${multiTagsMode ? " searchable-select-multi" : ""}`
    : `${
        multiTagsMode ? "min-h-9 h-auto" : "min-h-9 h-9"
      } w-full min-w-0 border border-slate-200 bg-white px-3 transition-all duration-200`;
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
  const [selected, setSelected] = useState(multiple ? [] : null);

  const triggerHeightClass = multiTagsMode
    ? isToolbar
      ? "min-h-8 md:min-h-9 h-auto py-1"
      : "min-h-9 h-auto py-1"
    : isToolbar
      ? heightClass
      : "min-h-9 h-9";

  const selectedCount = multiple ? (selected?.length ?? 0) : 0;

  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const [openUp, setOpenUp] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [apiMessage, setApiMessage] = useState("");
  const [lastFetchedQuery, setLastFetchedQuery] = useState(null);

  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const fetchSeqRef = useRef(0);
  const lastFetchedQueryRef = useRef(null);
  const keyboardNavRef = useRef(false);

  const fetchServiceRef = useRef(fetchService);
  const getByIdServiceRef = useRef(getByIdService);
  const onDropdownOpenRef = useRef(onDropdownOpen);
  const onDropdownIntentRef = useRef(onDropdownIntent);
  const bootstrapOpenRef = useRef(false);

  useEffect(() => { fetchServiceRef.current = fetchService; }, [fetchService]);
  useEffect(() => { getByIdServiceRef.current = getByIdService; }, [getByIdService]);
  useEffect(() => { onDropdownOpenRef.current = onDropdownOpen; }, [onDropdownOpen]);
  useEffect(() => { onDropdownIntentRef.current = onDropdownIntent; }, [onDropdownIntent]);

  const fetchDataRef = useRef(null);

  const showAllRow = multiple && showAllOption && (!searchText.trim() || items.length > 0);
  const listIndexOffset = showAllRow ? 1 : 0;

  const getSearchTextFromSelection = useCallback((sel) => {
    if (multiple) {
      if (showTags || compactMulti) return "";
      const labels = (sel || []).map(s => getDisplayLabel(s, labelKey)).filter(Boolean).join(", ");
      return labels || (sel?.length > 0 ? `${sel.length} items selected` : "");
    }
    return sel ? (labelOnlyDisplay ? getDisplayLabel(sel, labelKey) : toSearchText(sel[labelKey])) : "";
  }, [multiple, showTags, compactMulti, labelKey, labelOnlyDisplay]);

  // 1. Position Calculation — viewport coords for fixed portal (works inside Drawer scroll-lock)
  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    const panelHeight = 264;
    const spaceBelow = window.innerHeight - rect.bottom;
    const nextOpenUp = spaceBelow < panelHeight && rect.top > spaceBelow;

    let width = Math.min(rect.width, window.innerWidth - margin * 2);
    let left = rect.left;
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - margin - width);
    }
    if (left < margin) {
      left = margin;
      width = Math.min(width, window.innerWidth - margin * 2);
    }

    setOpenUp(nextOpenUp);
    setDropPos({
      width,
      left,
      top: !nextOpenUp ? rect.bottom + 4 : Math.max(margin, rect.top - panelHeight - 4),
    });
  }, []);

  const prepareOpenSearch = useCallback(() => {
    if (!clearSearchOnOpen) return;
    setSearch("");
    setLastFetchedQuery(null);
    lastFetchedQueryRef.current = null;
  }, [clearSearchOnOpen]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", calcPosition, true);
    window.addEventListener("resize", calcPosition);
    return () => {
      window.removeEventListener("scroll", calcPosition, true);
      window.removeEventListener("resize", calcPosition);
    };
  }, [open, calcPosition]);

  // 2. Fetch Data Logic
  const fetchData = useCallback(async (query, p = 1) => {
    const seq = ++fetchSeqRef.current;
    const queryChanged = p === 1 && lastFetchedQueryRef.current !== query;
    if (p === 1) {
      setLoading(true);
      setApiMessage("");
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await fetchServiceRef.current({ search: query, page: p, limit: PAGE_SIZE });
      if (seq !== fetchSeqRef.current) return;

      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

      if (res?.message && list.length === 0) {
        setApiMessage(res.message);
      }

      setItems((prev) => {
        const merged = p === 1 ? list : [...prev, ...list];
        const ordered =
          preserveApiOrder || merged.length < 2 ? merged : sortSelectRowsAsc(merged, labelKey);
        return labelOnlyDisplay
          ? ordered.filter((item) => getDisplayLabel(item, labelKey))
          : ordered;
      });
      setHasMore(list.length === PAGE_SIZE);
      setPage(p);
      setLastFetchedQuery(query);
      lastFetchedQueryRef.current = query;
      
      if (p === 1 && queryChanged) {
        setActiveIndex(list.length > 0 ? 0 : -1);
        if (listRef.current) listRef.current.scrollTop = 0;
      }
    } catch (err) {
      if (seq === fetchSeqRef.current && p === 1) setItems([]);
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [labelKey, labelOnlyDisplay, preserveApiOrder]);

  fetchDataRef.current = fetchData;

  const runFetchAfterBootstrap = useCallback(() => {
    bootstrapOpenRef.current = false;
    lastFetchedQueryRef.current = null;
    fetchDataRef.current?.("", 1);
  }, []);

  const startOpenBootstrap = useCallback(() => {
    bootstrapOpenRef.current = true;
    setLoading(true);
    setItems([]);
    setApiMessage("");
    const result = onDropdownOpenRef.current?.();
    if (result && typeof result.then === "function") {
      result.finally(() => runFetchAfterBootstrap());
      return;
    }
    runFetchAfterBootstrap();
  }, [runFetchAfterBootstrap]);

  // 3. Single useEffect for Fetching
  useEffect(() => {
    if (!open) {
      bootstrapOpenRef.current = false;
      setLastFetchedQuery(null);
      lastFetchedQueryRef.current = null;
      return;
    }

    const q = searchText;
    const trimmed = q.trim();
    const minChars = Math.max(1, Number(minSearchChars) || 1);
    
    if (!trimmed) {
      if (requireSearch) {
        setItems([]);
        setHasMore(false);
        setPage(1);
        setActiveIndex(-1);
        lastFetchedQueryRef.current = null;
        return;
      }
      if (bootstrapOpenRef.current) return;
      const prevQuery = lastFetchedQueryRef.current;
      if (prevQuery === null) {
        if (onDropdownOpenRef.current) {
          startOpenBootstrap();
        } else {
          fetchData("", 1);
        }
      } else if (prevQuery !== "") {
        fetchData("", 1);
      }
      return;
    }

    if (requireSearch && trimmed.length < minChars) {
      setItems([]);
      setHasMore(false);
      setPage(1);
      setActiveIndex(-1);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(trimmed, 1), 300);

    return () => clearTimeout(debounceRef.current);
  }, [searchText, open, fetchData, requireSearch, minSearchChars, startOpenBootstrap]);

  // 4. Pre-fill Logic (For Edit Mode)
  useEffect(() => {
    if (multiple) {
      if (!Array.isArray(value) || value.length === 0) {
        setSelected([]);
        if (!open) setSearch("");
        return;
      }

      // If we already have all selected items, just update the search label if not open
      const currentIds = (selected || []).map(s => String(s[dataKey]));
      const valueIds = value.map(v => String(v));
      const isMatch = currentIds.length === valueIds.length && valueIds.every(id => currentIds.includes(id));
      
      if (isMatch) {
        if (!open) {
          setSearch(getSearchTextFromSelection(selected));
        }
        return;
      }

      // Fetch items for the IDs
      const validIds = value.filter(id => id != null && id !== "" && typeof id !== "object");
      if (validIds.length === 0) {
        setSelected([]);
        if (!open) setSearch("");
        return;
      }

      Promise.all(validIds.map(id => getByIdServiceRef.current(id).catch(() => null)))
        .then((results) => {
          const items = results
            .map(res => res?.data || res)
            .filter(item => item && item[dataKey]);
          
          setSelected(items);
          if (!open) {
            setSearch(getSearchTextFromSelection(items));
          }
        });
    } else {
      // Non-multiple: value should be a single ID (integer or string)
      if (!value || (Array.isArray(value) && value.length === 0) || typeof value === "object") { 
        setSelected(null); 
        if (!open) setSearch(""); 
        return; 
      }
      if (selected?.[dataKey] == value) {
        if (!open) {
          setSearch(getSearchTextFromSelection(selected));
        }
        return;
      }

      getByIdServiceRef.current(value).then((res) => {
        const item = res?.data || res;
        if (item?.[dataKey]) {
          setSelected(item);
          if (!open) {
            const label = getDisplayLabel(item, labelKey);
            setSearch(labelOnlyDisplay ? label : label || toSearchText(item[labelKey]) || String(value));
          }
        }
      }).catch(() => {
        if (!open) {
          setSearch(labelOnlyDisplay ? "" : String(value));
        }
      });
    }
  // Re-resolve when getById changes (e.g. schedule catalog finished loading on edit).
  }, [value, dataKey, labelKey, labelOnlyDisplay, multiple, open, getByIdService]);

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
        setSearch(getSearchTextFromSelection(selected));
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, selected, getSearchTextFromSelection]);

  const getVisibleSelectableItems = useCallback(() => {
    return items.filter((item) => {
      if (!item || item[dataKey] == null) return false;
      if (labelOnlyDisplay && !getDisplayLabel(item, labelKey)) return false;
      return true;
    });
  }, [items, dataKey, labelKey, labelOnlyDisplay]);

  const selectedIdSet = useCallback(() => {
    if (multiple) {
      return new Set((Array.isArray(selected) ? selected : []).map((s) => String(s[dataKey])));
    }
    if (selected?.[dataKey] != null) {
      return new Set([String(selected[dataKey])]);
    }
    return new Set();
  }, [selected, dataKey, multiple]);

  const unselectedListItems = useCallback(() => {
    const ids = selectedIdSet();
    return getVisibleSelectableItems().filter((item) => !ids.has(String(item[dataKey])));
  }, [getVisibleSelectableItems, selectedIdSet]);

  /** Toolbar multi: selected in a fixed top panel; bottom list scroll stays put when picking more. */
  const pinSelectedAtTop = multiCompactMode && !searchText.trim();

  const renderOptionRow = (item, idx, keyPrefix = "") => {
    const isItemSelected = selectedIdSet().has(String(item[dataKey]));
    const rowLabel = getDisplayLabel(item, labelKey) || (labelOnlyDisplay ? "" : toSearchText(item[labelKey]));
    if (labelOnlyDisplay && !rowLabel) return null;
    const subLabelText =
      !labelOnlyDisplay && subLabelKey && item[subLabelKey] != null
        ? String(item[subLabelKey]).trim()
        : "";
    const labelMatchesSub =
      subLabelText !== "" &&
      subLabelText.toLowerCase() === String(item[labelKey] ?? "").trim().toLowerCase();
    const showSubLabel =
      subLabelText !== "" && (showDuplicateSubLabel || !labelMatchesSub);
    const rowTitleClass = showSubLabel ? dropdownRowTitleWithDescClass : dropdownRowLabelClass;

    const extraOptionClass =
      typeof getOptionClassName === "function" ? String(getOptionClassName(item) || "").trim() : "";
    const optionDisabled =
      typeof isOptionDisabled === "function" ? Boolean(isOptionDisabled(item)) : false;

    return (
      <li
        key={`${keyPrefix}${item[dataKey] ?? idx}`}
        onClick={() => {
          if (optionDisabled) return;
          handleSelect(item);
        }}
        onMouseEnter={() => !("ontouchstart" in window) && setActiveIndex(idx)}
        aria-disabled={optionDisabled || undefined}
        className={`px-3 py-2 border-b border-slate-50 last:border-0 transition-colors flex flex-col ${
          optionDisabled
            ? "cursor-not-allowed opacity-80"
            : activeIndex === idx
              ? "cursor-pointer bg-indigo-50/50"
              : "cursor-pointer hover:bg-slate-50"
        } ${extraOptionClass}`}
      >
        <div className="flex items-center justify-between">
          <span className={rowTitleClass}>{rowLabel}</span>
          <div className="flex items-center gap-2">
            {item.box_count != null && (
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] sm:text-xs font-bold border border-slate-200">
                {item.box_count} Boxes
              </span>
            )}
            {multiple && isItemSelected ? (
              <CheckCircle2 size={12} className="text-indigo-600 shrink-0" />
            ) : null}
          </div>
        </div>
        {showSubLabel ? (
          <span className={`${dropdownRowSubLabelClass} whitespace-normal break-words`}>{subLabelText}</span>
        ) : null}
        {!labelOnlyDisplay && listHintKey && item[listHintKey] != null && item[listHintKey] !== "" ? (
          <span className="text-[11px] font-mono text-slate-500 font-normal tracking-tight">
            {listHintLabel}: {String(item[listHintKey])}
          </span>
        ) : null}
      </li>
    );
  };

  const handleClearAll = () => {
    if (!multiple) return;
    setSelected([]);
    setSearch("");
    setLastFetchedQuery(null);
    lastFetchedQueryRef.current = null;
    onChange([], []);
    if (open) fetchData("", 1);
    inputRef.current?.focus();
  };

  /** All: with search → select every item in the current filtered list; without search → clear filter */
  const handleSelectAllVisible = () => {
    if (!multiple) return;
    const trimmedSearch = searchText.trim();

    if (!trimmedSearch) {
      handleClearAll();
      return;
    }

    const visible = getVisibleSelectableItems();
    if (!visible.length) return;

    const merged = new Map((selected || []).map((s) => [String(s[dataKey]), s]));
    visible.forEach((item) => merged.set(String(item[dataKey]), item));
    const nextSelected = Array.from(merged.values());
    setSelected(nextSelected);
    onChange(
      nextSelected.map((s) => s[dataKey]),
      nextSelected
    );
    if (showTags) {
      setSearch("");
      setLastFetchedQuery("");
      lastFetchedQueryRef.current = "";
    }
    inputRef.current?.focus();
  };

  const handleSelect = (item) => {
    if (typeof isOptionDisabled === "function" && isOptionDisabled(item)) return;
    if (multiple) {
      const isSelected = (selected || []).some(s => String(s[dataKey]) === String(item[dataKey]));
      let nextSelected;
      if (isSelected) {
        nextSelected = selected.filter(s => String(s[dataKey]) !== String(item[dataKey]));
      } else {
        nextSelected = [...(selected || []), item];
      }
      setSelected(nextSelected);
      const nextIds = nextSelected.map(s => s[dataKey]);
      onChange(nextIds, nextSelected);
      if (showTags) {
        setSearch("");
        setLastFetchedQuery("");
        lastFetchedQueryRef.current = "";
      }
      inputRef.current?.focus();
    } else {
      setSelected(item);
      setSearch(getDisplayLabel(item, labelKey) || (labelOnlyDisplay ? "" : toSearchText(item[labelKey])));
      onChange(item[dataKey], item);
      setOpen(false);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (multiple) {
      setSelected([]);
      setSearch("");
      onChange([], []);
    } else {
      setSelected(null);
      setSearch("");
      onChange(null, null);
    }
    setActiveIndex(-1);
    setLastFetchedQuery(null);
    lastFetchedQueryRef.current = null;
    if (open && multiple) fetchData("", 1);
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
        if (clearSearchOnOpen) {
          // Replace "All …" instead of appending into it
          e.preventDefault();
          setLastFetchedQuery(null);
          lastFetchedQueryRef.current = null;
          setSearch(e.key);
          calcPosition();
          setOpen(true);
          return;
        }
        setOpen(true);
        calcPosition();
        return; // allow the character to be typed normally
      }
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        prepareOpenSearch();
        setOpen(true);
        calcPosition();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        keyboardNavRef.current = true;
        setActiveIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        keyboardNavRef.current = true;
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
        setSearch(getSearchTextFromSelection(selected));
        break;
      case "Tab":
        // Select the active item on Tab if one is highlighted
        if (activeIndex >= 0 && activeIndex < items.length) {
          handleSelect(items[activeIndex]);
        } else {
          setOpen(false);
          setSearch(getSearchTextFromSelection(selected));
        }
        break;
    }
  };

  // Scroll active item into view — keyboard only (mouse hover must not jump scroll position)
  useEffect(() => {
    if (!keyboardNavRef.current || activeIndex < 0 || !listRef.current || !open) return;
    keyboardNavRef.current = false;
    const activeEl = listRef.current.children[activeIndex + listIndexOffset];
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open, listIndexOffset]);

  const dropdownEl = open && dropPos.width > 0 ? (
    <div
      ref={dropdownRef}
      id="searchable-portal"
      style={
        usePortal
          ? {
              top: dropPos.top,
              left: dropPos.left,
              width: dropPos.width,
              maxWidth: "calc(100vw - 16px)",
              position: "fixed",
              // Above GlobalDetailModal (z-9999) and similar full-screen overlays
              zIndex: 10050,
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
                handleClearAll();
              }}
              className="text-[10px] font-semibold text-slate-500 hover:text-rose-600"
            >
              Clear all
            </button>
          </div>
          <ul className="max-h-[96px] overflow-y-auto">
            {(selected || []).map((item, idx) => renderOptionRow(item, idx, "sel-"))}
          </ul>
        </div>
      ) : null}

      <ul
        ref={listRef}
        className={`overflow-y-auto ${pinSelectedAtTop && selectedCount > 0 ? "max-h-[124px]" : "max-h-[220px]"}`}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20 && hasMore && !loadingMore && !loading) {
            fetchData(searchText, page + 1);
          }
        }}
      >
        {loading && items.length === 0 && !(pinSelectedAtTop && selectedCount > 0) ? (
          <div className="p-10 flex flex-col items-center gap-2">
            <Loader2 size={20} className="animate-spin text-indigo-500" />
            <span className="text-xs text-slate-400 font-medium">Fetching data...</span>
          </div>
        ) : items.length === 0 && !(multiple && showAllOption) && !(pinSelectedAtTop && selectedCount > 0) ? (
          <li className="p-8 text-center text-slate-400 text-xs flex flex-col gap-2">
            <span>{searchText.trim() ? "No results found" : (apiMessage || emptyMessage)}</span>
            {!searchText.trim() && apiMessage && <span className="text-xs text-slate-500 font-normal leading-relaxed">{apiMessage}</span>}
          </li>
        ) : (
          <>
          {showAllRow ? (
            <li
              onClick={() => handleSelectAllVisible()}
              onMouseEnter={() => !("ontouchstart" in window) && setActiveIndex(-1)}
              className={`px-3 py-2 cursor-pointer border-b border-slate-100 transition-colors flex items-center justify-between ${
                !searchText.trim() && selectedCount === 0 ? "bg-indigo-50/80" : "hover:bg-slate-50"
              }`}
            >
              <span className={dropdownRowLabelClass}>
                {searchText.trim() && items.length > 0
                  ? `${allOptionLabel} (${items.length})`
                  : allOptionLabel}
              </span>
              {!searchText.trim() && selectedCount === 0 ? (
                <CheckCircle2 size={12} className="text-indigo-600 shrink-0" />
              ) : null}
            </li>
          ) : null}

          {(pinSelectedAtTop ? unselectedListItems() : getVisibleSelectableItems()).map((item, idx) =>
            renderOptionRow(item, idx)
          )}
          </>
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
        <label className={isToolbar ? listPageFilterLabelClass(toolbarTone) : FORM_LABEL_CLASS}>
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </label>
      )}
      <div 
        ref={triggerRef} 
        className={`w-full min-w-0 ${triggerShellClass} ${triggerRadius} flex items-center gap-1.5 sm:gap-2 ${
          multiTagsMode ? "overflow-visible" : "overflow-hidden"
        } ${
          disabled ? 'bg-slate-50 cursor-not-allowed opacity-75 border-slate-200' : 
          open ? 'border-slate-500 shadow-sm cursor-text' : 
          error ? 'border-rose-400 ring-rose-50 ring-1 cursor-text' : 
          'hover:border-slate-400 cursor-text'
        } ${triggerHeightClass}`}
        onMouseEnter={() => {
          if (!disabled) onDropdownIntentRef.current?.();
        }}
        onFocus={() => {
          if (!disabled) onDropdownIntentRef.current?.();
        }}
        onClick={(e) => {
          if (disabled) return;
          onDropdownIntentRef.current?.();
          const clickedInput =
            e.target === inputRef.current || inputRef.current?.contains(e.target);
          if (clickedInput) {
            if (!open) {
              prepareOpenSearch();
              calcPosition();
              setOpen(true);
            }
            setTimeout(() => inputRef.current?.focus(), 0);
            return;
          }
          if (open) {
            setOpen(false);
            setSearch(getSearchTextFromSelection(selected));
          } else {
            prepareOpenSearch();
            calcPosition();
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 10);
          }
        }}
      >
        <Search
          size={13}
          className={`shrink-0 self-center ${open ? "text-indigo-500" : "text-slate-400"}`}
        />

        <div className={`flex min-w-0 flex-1 items-center gap-1 ${multiTagsMode ? "flex-wrap py-0.5" : "overflow-hidden"}`}>
          {multiCompactMode && selectedCount > 0 ? (
            <span className="shrink-0 inline-flex items-center rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 tabular-nums">
              {selectedCount} selected
            </span>
          ) : null}

          {multiTagsMode && selectedCount > 0
            ? selected.slice(0, maxVisibleTags).map((item) => (
                <span
                  key={item[dataKey]}
                  className="inline-flex max-w-full sm:max-w-[45%] items-center gap-1 rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700"
                >
                  <span className="truncate">{getDisplayLabel(item, labelKey)}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(item);
                    }}
                    className="shrink-0 hover:text-rose-500 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))
            : null}

          {multiTagsMode && selectedCount > maxVisibleTags ? (
            <span className="shrink-0 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
              +{selectedCount - maxVisibleTags}
            </span>
          ) : null}

          <input
            ref={inputRef}
            type="text"
            value={searchText}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const next = e.target.value;
              fetchSeqRef.current += 1;
              setSearch(next);
              if (!open) {
                setOpen(true);
                calcPosition();
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              multiCompactMode
                ? selectedCount > 0
                  ? "Search to add…"
                  : allOptionLabel
                : multiTagsMode && selectedCount > 0
                  ? "Add more…"
                  : placeholder
            }
            disabled={disabled}
            autoComplete="off"
            className={`min-w-[4.5rem] flex-1 self-center bg-transparent outline-none ${
              multiTagsMode ? "h-6 leading-6" : "truncate"
            } ${isToolbar ? LIST_PAGE_FILTER_VALUE_CLASS : "text-sm font-normal text-slate-800"} placeholder:text-slate-400`}
          />
        </div>

        <div className="flex shrink-0 items-center self-center gap-1 border-l border-slate-100 pl-1.5 sm:pl-2">
          {(searchText || (multiple && selected?.length > 0)) && !disabled && (
            <button type="button" onClick={handleClear} className="text-slate-300 hover:text-rose-500 transition-colors">
              <X size={14} />
            </button>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {helperText ? (
        <p className={FORM_HINT_CLASS}>{helperText}</p>
      ) : null}
      {error && <p className={FORM_ERROR_CLASS}><AlertCircle size={12} /> {error}</p>}
      {dropdown}
    </div>
  );
}